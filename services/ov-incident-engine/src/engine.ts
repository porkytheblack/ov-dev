import { FrameDetections, IncidentClosed, IncidentOpened, STREAMS } from "@overwatch/schemas/events";
import { createGroupConsumer, makeLogger, makeRedis, publishEvent } from "@overwatch/shared-ts";
import postgres from "postgres";
import { v4 as uuid } from "uuid";
import { IncidentStore } from "./incident-store.js";
import { isWithinDetectionWindow, matchesRoi } from "./matching/geometry.js";
import { OpenIncidents, type OpenIncident } from "./matching/state.js";
import { RoiCache } from "./roi-cache.js";

const log = makeLogger("ov-incident-engine");
const SWEEP_INTERVAL_MS = (parseInt(process.env.SWEEP_INTERVAL_SECONDS ?? "10") || 10) * 1000;
const GRACE_PERIOD_MS = 5000;
// How long a zone incident may go with NO matching detection before it's
// considered over. Must comfortably bridge normal detection gaps (low sample
// fps, intermittent visibility, tracker dropouts) so one continuous presence
// stays one incident instead of fragmenting into many.
const IDLE_CLOSE_MS =
  (parseInt(process.env.INCIDENT_IDLE_TIMEOUT_SECONDS ?? "45") || 45) * 1000;

// Class-aware confidence floor to filter detector noise. People are easy to
// recognise so a lower bar is safe; other objects are harder to identify and
// need a higher bar before they're allowed to drive an incident. Both
// overridable via env.
const CONF_PERSON = parseFloat(process.env.OV_CONFIDENCE_PERSON ?? "0.65") || 0.65;
const CONF_DEFAULT = parseFloat(process.env.OV_CONFIDENCE_DEFAULT ?? "0.8") || 0.8;
function minConfidence(cls: string): number {
  return cls === "person" ? CONF_PERSON : CONF_DEFAULT;
}

// Fire/smoke (from the dedicated detector model) is camera-wide and urgent:
// it must alert REGARDLESS of ROI / detection window / linger — an
// unattended fire isn't in a "zone" and can't wait. It's intentionally
// decoupled from the incident table (incidents.roi_id is NOT NULL and a
// fire has no ROI): a throttled alert goes straight to subscribers via the
// existing bot_outbox the messengers already consume.
const FIRE_CLASSES = new Set(["fire", "smoke"]);
const CONF_FIRE = parseFloat(process.env.OV_CONFIDENCE_FIRE ?? "0.6") || 0.6;
const FIRE_COOLDOWN_MS =
  (parseInt(process.env.OV_FIRE_ALERT_COOLDOWN_SEC ?? "300") || 300) * 1000;
// Temporal persistence: a single false-positive frame must NEVER alert.
// Require ≥ MIN_HITS fire detections within WINDOW before dispatching. The
// detector runs fire ~every 5s, so 3-in-40s ≈ ~15s of sustained fire —
// real fire still alerts fast; flicker FPs (tree/sky/lighting) don't.
const FIRE_MIN_HITS = parseInt(process.env.OV_FIRE_MIN_HITS ?? "3", 10) || 3;
const FIRE_WINDOW_MS =
  (parseInt(process.env.OV_FIRE_WINDOW_SEC ?? "40", 10) || 40) * 1000;

export type EngineDeps = {
  databaseUrl: string;
  redis: ReturnType<typeof makeRedis>;
};

export class IncidentEngine {
  private redis: ReturnType<typeof makeRedis>;
  private sql: ReturnType<typeof postgres>;
  private incidents = new OpenIncidents();
  private roiCache: RoiCache;
  private store: IncidentStore;
  private fireCooldown = new Map<string, number>();
  private fireHits = new Map<string, number[]>();
  private cameraConsumers = new Map<string, AbortController>();
  private stop = false;

  constructor(deps: EngineDeps) {
    this.redis = deps.redis;
    this.sql = postgres(deps.databaseUrl, { max: 4 });
    this.roiCache = new RoiCache(deps.databaseUrl);
    this.store = new IncidentStore(this.sql);
  }

  async start(): Promise<void> {
    await this.roiCache.reload();
    // Rebuild in-memory state from open incidents in the DB.
    const open = await this.store.loadOpen();
    const now = new Date();
    for (const o of open) {
      const key = OpenIncidents.key(o.cameraId, o.roiId);
      this.incidents.set(key, {
        incidentId: o.id,
        cameraId: o.cameraId,
        roiId: o.roiId,
        trackId: o.trackId,
        classes: new Set(o.classes),
        openedAt: o.openedAt,
        lastSeenAt: now,
        notifyPending: false,
        lingerThresholdSeconds: 60,
        notifyEnabled: true,
      });
    }
    log.info({ openIncidents: this.incidents.size() }, "engine bootstrapped");

    // Spawn one consumer per camera.
    await this.reconcileCameras();
    // Live ROI updates.
    this.roiCache
      .listen(async (cameraId) => {
        log.info({ cameraId }, "roi_changed");
        await this.roiCache.reload(cameraId);
      })
      .catch((e) => log.error({ err: e }, "roi listener failed"));

    // Refresh camera list every 30s; tolerate new/disabled cameras.
    void this.cameraReconciler();
    void this.sweepLoop();
  }

  private async reconcileCameras(): Promise<void> {
    const rows = await this.sql<{ id: string }[]>`SELECT id FROM cameras WHERE enabled = true`;
    const ids = new Set(rows.map((r) => r.id));
    for (const id of ids) {
      if (!this.cameraConsumers.has(id)) {
        const ac = new AbortController();
        this.cameraConsumers.set(id, ac);
        this.consumeCamera(id, ac.signal).catch((e) =>
          log.error({ cameraId: id, err: e }, "consumer crashed"),
        );
      }
    }
    for (const [id, ac] of this.cameraConsumers) {
      if (!ids.has(id)) {
        ac.abort();
        this.cameraConsumers.delete(id);
      }
    }
  }

  private async cameraReconciler(): Promise<void> {
    while (!this.stop) {
      try {
        await this.reconcileCameras();
      } catch (e) {
        log.error({ err: e }, "camera reconcile failed");
      }
      await new Promise((r) => setTimeout(r, 30_000));
    }
  }

  private async consumeCamera(cameraId: string, signal: AbortSignal): Promise<void> {
    const stream = STREAMS.detections(cameraId);
    const group = "cg.ov-incident-engine";
    const consumer = `engine-${cameraId.slice(0, 8)}`;
    const cg = createGroupConsumer({
      redis: this.redis,
      stream,
      group,
      consumer,
      schema: FrameDetections,
      onParseError: (id, err) => log.warn({ id, err: err.message }, "detection parse failed"),
    });
    await cg.consume(async (event) => this.handleDetections(event), { signal });
  }

  private async handleDetections(event: typeof FrameDetections._type): Promise<void> {
    const ts = new Date(event.ts);
    const rois = this.roiCache.forCamera(event.camera_id);
    // Exclusion zones first: drop any detection whose centroid sits inside
    // an 'exclude' region BEFORE anything else, so it can neither open an
    // incident nor raise a fire alert (e.g. a tree mistaken for a person
    // in bad light, or that same area false-firing).
    const excludes = rois.filter((r) => r.kind === "exclude");
    const dets =
      excludes.length === 0
        ? event.detections
        : event.detections.filter(
            (d) =>
              !excludes.some((ex) =>
                matchesRoi(d.bbox, ex.polygon, "centroid"),
              ),
          );
    // Fire/smoke short-circuit — independent of ROIs/windows/linger.
    const fire = dets.filter(
      (d) => FIRE_CLASSES.has(d.class) && d.confidence >= CONF_FIRE,
    );
    if (fire.length > 0) {
      await this.alertFire(
        event.camera_id,
        [...new Set(fire.map((f) => f.class))],
      ).catch((e) => log.error({ err: e }, "fire alert failed"));
    }
    for (const roi of rois) {
      if (roi.kind === "exclude") continue;
      if (!isWithinDetectionWindow(roi.detectionWindow, ts)) continue;
      for (const det of dets) {
        if (!roi.classesOfInterest.includes(det.class)) continue;
        if (det.confidence < minConfidence(det.class)) continue;
        if (!matchesRoi(det.bbox, roi.polygon, roi.matchMode)) continue;
        const key = OpenIncidents.key(event.camera_id, roi.id);
        const existing = this.incidents.get(key);
        if (existing) {
          existing.lastSeenAt = ts;
          existing.classes.add(det.class);
          if (!existing.trackId && det.track_id) existing.trackId = det.track_id;
          const elapsed = ts.getTime() - existing.openedAt.getTime();
          if (existing.notifyPending && elapsed >= roi.lingerThresholdSeconds * 1000) {
            await this.fireOpened(existing);
            existing.notifyPending = false;
          }
        } else {
          const incidentId = await this.store.createOpen({
            cameraId: event.camera_id,
            roiId: roi.id,
            trackId: det.track_id ?? null,
            classes: [det.class],
            openedAt: ts,
          });
          const incident: OpenIncident = {
            incidentId,
            cameraId: event.camera_id,
            roiId: roi.id,
            trackId: det.track_id ?? null,
            classes: new Set([det.class]),
            openedAt: ts,
            lastSeenAt: ts,
            notifyPending: roi.notifyEnabled,
            lingerThresholdSeconds: roi.lingerThresholdSeconds,
            notifyEnabled: roi.notifyEnabled,
          };
          this.incidents.set(key, incident);
          // Linger threshold 0 = notify immediately.
          if (incident.notifyPending && roi.lingerThresholdSeconds === 0) {
            await this.fireOpened(incident);
            incident.notifyPending = false;
          }
        }
      }
    }
  }

  private async fireOpened(incident: OpenIncident): Promise<void> {
    await this.store.addClasses(incident.incidentId, [...incident.classes]);
    const ev: typeof IncidentOpened._type = {
      type: "incident.opened",
      incident_id: incident.incidentId,
      camera_id: incident.cameraId,
      roi_id: incident.roiId,
      classes: [...incident.classes],
      opened_at: incident.openedAt.toISOString(),
      track_id: incident.trackId ?? undefined,
    };
    await publishEvent(this.redis, STREAMS.incidents, ev as unknown as Record<string, unknown>);
    log.info({ incidentId: incident.incidentId, camera: incident.cameraId }, "incident.opened");
  }

  /**
   * Urgent fire/smoke alert straight to subscribers (bypasses the incident
   * table — fire has no ROI). Throttled per camera so a sustained fire
   * doesn't spam; in-memory cooldown errs toward alerting on restart.
   */
  private async alertFire(cameraId: string, classes: string[]): Promise<void> {
    const now = Date.now();
    // Record this hit; require sustained presence (≥ FIRE_MIN_HITS within
    // FIRE_WINDOW_MS) so one false-positive frame can't raise an alarm.
    const hits = (this.fireHits.get(cameraId) ?? []).filter(
      (t) => now - t < FIRE_WINDOW_MS,
    );
    hits.push(now);
    this.fireHits.set(cameraId, hits);
    if (hits.length < FIRE_MIN_HITS) return; // not yet sustained
    const last = this.fireCooldown.get(cameraId) ?? 0;
    if (now - last < FIRE_COOLDOWN_MS) return;
    this.fireCooldown.set(cameraId, now);
    this.fireHits.set(cameraId, []); // reset; needs fresh persistence next time

    const cam = await this.sql<Array<{ name: string }>>`
      SELECT name FROM cameras WHERE id = ${cameraId}::uuid LIMIT 1
    `;
    const cameraName = cam[0]?.name ?? "a camera";
    const subs = await this.sql<Array<{ channel: string; handle: string }>>`
      SELECT channel, handle FROM subscribers
       WHERE enabled = true
         AND channel IN ('whatsapp', 'telegram')
         AND (cardinality(camera_ids) = 0 OR ${cameraId}::uuid = ANY(camera_ids))
    `;
    const what = classes.join(" & ");
    const text =
      `🔥 FIRE ALERT — ${cameraName}\n` +
      `${what.charAt(0).toUpperCase()}${what.slice(1)} detected on camera. ` +
      `Check the live view and respond immediately.`;
    for (const s of subs) {
      if (s.channel !== "telegram" && s.channel !== "whatsapp") continue;
      await publishEvent(
        this.redis,
        STREAMS.bot_outbox(s.channel as "telegram" | "whatsapp"),
        { type: "bot.outbox", channel: s.channel, handle: s.handle, text },
      ).catch((e) => log.error({ err: e }, "fire bot_outbox publish failed"));
    }
    log.warn({ cameraId, cameraName, classes, subscribers: subs.length }, "FIRE alert dispatched");
  }

  private async sweepLoop(): Promise<void> {
    while (!this.stop) {
      try {
        await this.sweep();
      } catch (e) {
        log.error({ err: e }, "sweep failed");
      }
      await new Promise((r) => setTimeout(r, SWEEP_INTERVAL_MS));
    }
  }

  private async sweep(): Promise<void> {
    const now = Date.now();
    for (const [key, inc] of [...this.incidents.entries()]) {
      const idle = now - inc.lastSeenAt.getTime();
      // Bridge normal detection gaps: only act once the zone has been quiet
      // for the full idle window (not a mere 5s), so sparse/low-fps presence
      // stays a single incident.
      if (idle < IDLE_CLOSE_MS) continue;
      if (inc.notifyPending) {
        const spanMs = inc.lastSeenAt.getTime() - inc.openedAt.getTime();
        if (inc.notifyEnabled && spanMs >= inc.lingerThresholdSeconds * 1000) {
          // Activity persisted past the linger threshold — it's a real
          // incident even though the final detection didn't re-trigger the
          // in-handler fire. Promote it instead of suppressing.
          await this.fireOpened(inc);
          inc.notifyPending = false;
        } else {
          // Brief blip that never met the linger threshold. Suppress.
          await this.store.markSuppressed(inc.incidentId);
          this.incidents.delete(key);
          log.info(
            { incidentId: inc.incidentId, spanMs },
            "incident suppressed (linger not reached)",
          );
          continue;
        }
      }
      const closedAt = new Date(inc.lastSeenAt.getTime() + GRACE_PERIOD_MS);
      await this.store.close(inc.incidentId, closedAt);
      const ev: typeof IncidentClosed._type = {
        type: "incident.closed",
        incident_id: inc.incidentId,
        closed_at: closedAt.toISOString(),
        duration_ms: closedAt.getTime() - inc.openedAt.getTime(),
      };
      await publishEvent(this.redis, STREAMS.incidents, ev as unknown as Record<string, unknown>);
      this.incidents.delete(key);
      log.info({ incidentId: inc.incidentId, duration: ev.duration_ms }, "incident.closed");
    }
  }

  async shutdown(): Promise<void> {
    this.stop = true;
    for (const [, ac] of this.cameraConsumers) ac.abort();
    await this.sql.end({ timeout: 5 });
    await this.roiCache.close();
  }
}

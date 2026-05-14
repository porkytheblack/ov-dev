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
      const key = OpenIncidents.key(o.cameraId, o.roiId, o.trackId);
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
    for (const roi of rois) {
      if (!isWithinDetectionWindow(roi.detectionWindow, ts)) continue;
      for (const det of event.detections) {
        if (!roi.classesOfInterest.includes(det.class)) continue;
        if (!matchesRoi(det.bbox, roi.polygon, roi.matchMode)) continue;
        const key = OpenIncidents.key(event.camera_id, roi.id, det.track_id);
        const existing = this.incidents.get(key);
        if (existing) {
          existing.lastSeenAt = ts;
          existing.classes.add(det.class);
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
      if (idle < GRACE_PERIOD_MS) continue;
      if (inc.notifyPending) {
        // Never reached linger threshold. Suppress.
        await this.store.markSuppressed(inc.incidentId);
        this.incidents.delete(key);
        log.info({ incidentId: inc.incidentId }, "incident suppressed (linger not reached)");
        continue;
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

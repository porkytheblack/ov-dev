/**
 * Two recurring time-window recaps pushed to every enabled subscriber:
 *
 *   🌙 Overnight  — incidents 22:00 → 06:00 (sent at/after 06:00 local)
 *   ☀️ Daytime    — incidents 06:00 → 18:00 (sent at/after 18:00 local)
 *
 * Station's `.every()` is interval-only (no cron), so this fires every 15m
 * and self-gates on the operator's local wall clock (OV_TIMEZONE / TZ). A
 * per-window row in `summary_dispatch_log` (atomic INSERT … ON CONFLICT)
 * makes delivery exactly-once even across the frequent ov-station-api
 * restarts and the 15m polling — and gives free catch-up: if the service
 * was down at 06:00 it still sends today's overnight recap on the next
 * tick that's past 06:00.
 *
 * "Run analysis on clips before the summary, skip on errors": every window
 * incident still missing a summary that has a clip is force-analysed via
 * the existing `analyze-incident-clip` broadcast (same v1 API the bridge
 * uses); we then poll briefly for the results and compose the recap from
 * whatever summaries landed — anything that errors or is slow is simply
 * left out of the narrative (still counted). The handler never throws, so
 * a window always produces *some* recap.
 *
 * Replaces the old 24h `daily-summary`.
 */
import { signal, z } from "station-signal";
import { publishEvent } from "@overwatch/shared-ts";
import { STREAMS } from "@overwatch/schemas/events";
import { summarizeWithMimo } from "@overwatch/ai";
import { sql, redis, log } from "../config.js";
import { signCalendarLink } from "../deep-link.js";

type Channel = "whatsapp" | "telegram";
const TZ = process.env.OV_TIMEZONE || process.env.TZ || "UTC";
const STATION_ENDPOINT = `http://127.0.0.1:${process.env.STATION_API_PORT ?? 4400}`;
const STATION_API_KEY = process.env.STATION_API_KEY ?? "";
const ANALYSIS_BUDGET_MS = 240_000; // total wait for pending clip analyses
const POLL_EVERY_MS = 5_000;

// ── timezone helpers (no cron; we reason in the operator's wall clock) ──
function tzParts(d: Date): { date: string; minutes: number } {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
      .formatToParts(d)
      .map((x) => [x.type, x.value]),
  ) as Record<string, string>;
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    minutes: Number(p.hour) * 60 + Number(p.minute),
  };
}

/** ms to subtract from a wall-clock-as-UTC instant to get the true UTC instant. */
function tzOffsetMs(at: Date): number {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    })
      .formatToParts(at)
      .map((x) => [x.type, x.value]),
  ) as Record<string, string>;
  const asUtc = Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    Number(p.hour === "24" ? "0" : p.hour),
    Number(p.minute),
    Number(p.second),
  );
  return asUtc - at.getTime();
}

/** The UTC instant of `YYYY-MM-DD HH:00` interpreted in the operator's tz. */
function localWallToUtc(dateYmd: string, hour: number): Date {
  const guess = new Date(`${dateYmd}T${String(hour).padStart(2, "0")}:00:00Z`);
  return new Date(guess.getTime() - tzOffsetMs(guess));
}

function prevDate(dateYmd: string): string {
  return new Date(Date.parse(`${dateYmd}T00:00:00Z`) - 86_400_000)
    .toISOString()
    .slice(0, 10);
}

// A stored summary that is actually a model refusal ("considered high
// risk", etc.) is not a usable recap line — treat it as no summary.
const REFUSAL_RE =
  /considered high risk|request was rejected|cannot (assist|help|comply)|i['’]m sorry|as an ai|unable to (process|analy)/i;
function isUsableSummary(s: string | null | undefined): s is string {
  const t = s?.trim();
  return !!t && !REFUSAL_RE.test(t);
}

function clockOf(ts: Date | string): string {
  return new Date(ts).toLocaleTimeString("en-US", {
    timeZone: TZ,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

interface Incident {
  id: string;
  camera_id: string;
  camera: string;
  roi: string;
  classes: string[];
  opened_at: string;
  summary: string | null;
  storage_key: string | null;
  poster_key: string | null;
}

// Resolve the best clip for an incident (mirrors the agent's CLIP_RESOLVER).
const WINDOW_INCIDENTS = (fromUtc: Date, toUtc: Date) => sql<Incident[]>`
  SELECT i.id, i.camera_id, c.name AS camera, r.name AS roi,
         i.classes, i.opened_at,
         NULLIF(i.summary, '') AS summary,
         clip.storage_key, clip.poster_key
    FROM incidents i
    JOIN cameras c ON c.id = i.camera_id
    JOIN rois    r ON r.id = i.roi_id
    LEFT JOIN LATERAL (
      SELECT x.storage_key, x.poster_key
        FROM clips x
       WHERE x.camera_id = i.camera_id
         AND (
           x.incident_id = i.id
           OR (x.start_ts <= COALESCE(i.closed_at, i.opened_at) + interval '30 seconds'
               AND x.end_ts >= i.opened_at - interval '30 seconds')
         )
       ORDER BY (x.incident_id = i.id) DESC, (x.kind = 'incident') DESC,
                abs(extract(epoch FROM (x.start_ts - i.opened_at))) ASC
       LIMIT 1
    ) clip ON true
   WHERE i.opened_at >= ${fromUtc} AND i.opened_at < ${toUtc}
   ORDER BY i.opened_at ASC
`;

async function triggerAnalysis(inc: Incident): Promise<boolean> {
  if (!STATION_API_KEY || !inc.storage_key) return false;
  try {
    const res = await fetch(`${STATION_ENDPOINT}/api/v1/trigger-broadcast`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${STATION_API_KEY}`,
      },
      body: JSON.stringify({
        broadcastName: "analyze-incident-clip",
        input: {
          incident_id: inc.id,
          camera_id: inc.camera_id,
          storage_key: inc.storage_key,
          poster_key: inc.poster_key ?? undefined,
          force: true, // include suppressed/brief — operator wants everything
        },
      }),
    });
    return res.ok;
  } catch (e) {
    log.warn({ err: e, incident_id: inc.id }, "analysis trigger failed (skipping)");
    return false;
  }
}

const RECAP_SYSTEM =
  "You are a security-desk assistant writing a brief shift handover for the " +
  "property owner. Calm, plain, concise. Plain text only — no markdown, no " +
  "bullet characters, no preamble, no sign-off.";

function recapPrompt(
  kind: "overnight" | "daytime",
  observations: string[],
): string {
  const span =
    kind === "overnight" ? "overnight (10pm–6am)" : "daytime (6am–6pm)";
  return (
    `Automated camera observations from ${span}, oldest first:\n\n` +
    observations.join("\n") +
    `\n\nWrite 2–4 short sentences for the owner covering ONLY what matters: ` +
    `people, vehicles or anything unusual — roughly when and at which camera. ` +
    `Collapse repetitive empty/quiet/clear clips and animal-only clips into ` +
    `one short clause (e.g. "otherwise quiet, only chickens about"). If ` +
    `nothing noteworthy happened, say that in a single sentence. Do not ` +
    `enumerate every clip and do not add a closing call to action.`
  );
}

function fallbackGist(scoped: Incident[]): string {
  const notable = scoped.filter((i) => isUsableSummary(i.summary)).length;
  const cams = new Set(scoped.map((i) => i.camera_id)).size;
  return (
    `${scoped.length} incident${scoped.length === 1 ? "" : "s"} across ` +
    `${cams} camera${cams === 1 ? "" : "s"}, ${notable} with a clip ` +
    `description. Open the calendar for the full timeline.`
  );
}

interface Recap {
  text: string;
  buttons: Array<{ text: string; url: string }>;
}

async function buildRecap(
  kind: "overnight" | "daytime",
  calDate: string,
  incidents: Incident[],
  cameraIds: string[],
  gistFor: (key: string, scoped: Incident[]) => Promise<string>,
): Promise<Recap> {
  const scoped =
    cameraIds.length > 0
      ? incidents.filter((i) => cameraIds.includes(i.camera_id))
      : incidents;
  const head =
    kind === "overnight"
      ? "🌙 Overnight recap (10pm–6am)"
      : "☀️ Daytime recap (6am–6pm)";

  if (scoped.length === 0) {
    return {
      text: `${head}\nAll quiet — no incidents.`,
      buttons: [{ text: "📅 Open calendar", url: signCalendarLink(calDate) }],
    };
  }

  const scopeKey = cameraIds.length > 0 ? [...cameraIds].sort().join(",") : "*";
  const gist = await gistFor(scopeKey, scoped);

  // One calendar button per camera that had activity (each opens that
  // camera's day, auto-authenticated, mobile-friendly). Cap the keyboard.
  const cams = new Map<string, string>(); // camera_id → name
  for (const i of scoped) if (!cams.has(i.camera_id)) cams.set(i.camera_id, i.camera);
  const camList = [...cams.entries()];
  const buttons =
    camList.length > 0 && camList.length <= 6
      ? camList.map(([id, name]) => ({
          text: `🔎 ${name}`,
          url: signCalendarLink(calDate, id),
        }))
      : [{ text: "📅 Open calendar", url: signCalendarLink(calDate) }];

  const text =
    `${head}\n${gist}\n\nTap a camera below to review the full timeline.`.slice(
      0,
      3800,
    );
  return { text, buttons };
}

async function runWindow(
  kind: "overnight" | "daytime",
  calDate: string,
  fromUtc: Date,
  toUtc: Date,
): Promise<number> {
  let incidents = await WINDOW_INCIDENTS(fromUtc, toUtc);

  // Force-analyse every window incident still missing a summary that has a
  // clip. Best-effort: trigger all, then poll for results within a budget.
  const pending = incidents.filter((i) => !i.summary && i.storage_key);
  if (pending.length > 0) {
    let triggered = 0;
    for (const inc of pending) if (await triggerAnalysis(inc)) triggered += 1;
    log.info(
      { kind, pending: pending.length, triggered },
      "window analysis triggered",
    );
    const ids = pending.map((i) => i.id);
    const deadline = Date.now() + ANALYSIS_BUDGET_MS;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, POLL_EVERY_MS));
      const done = await sql<Array<{ n: number }>>`
        SELECT count(*)::int AS n FROM incidents
         WHERE id = ANY(${ids}::uuid[])
           AND summary IS NOT NULL AND summary <> ''
      `;
      if ((done[0]?.n ?? 0) >= ids.length) break;
    }
    incidents = await WINDOW_INCIDENTS(fromUtc, toUtc); // re-read summaries
  }

  const subs = await sql<
    Array<{ channel: string; handle: string; camera_ids: string[] }>
  >`
    SELECT channel, handle, camera_ids FROM subscribers
     WHERE enabled = true AND channel IN ('whatsapp', 'telegram')
  `;

  // The condensed "highlights only" gist (the second summary pass the
  // operator asked for). Memoised by camera-scope so subscribers sharing a
  // scope don't each spend a model call.
  const gistCache = new Map<string, string>();
  const gistFor = async (key: string, scoped: Incident[]): Promise<string> => {
    const cached = gistCache.get(key);
    if (cached !== undefined) return cached;
    const obs = scoped.slice(0, 80).map((i) => {
      const what = isUsableSummary(i.summary)
        ? i.summary.trim().slice(0, 300)
        : `${i.classes.join(", ") || "motion"} detected (no description)`;
      return `- ${clockOf(i.opened_at)} ${i.camera}/${i.roi}: ${what}`;
    });
    let g: string | null = null;
    try {
      g = await summarizeWithMimo(recapPrompt(kind, obs), {
        system: RECAP_SYSTEM,
        // MiMo burns the budget on hidden reasoning before emitting the
        // visible answer — a tight cap yields empty content. Give it room
        // (same lesson as the vision path).
        maxTokens: 4096,
        temperature: 0.3,
      });
    } catch {
      g = null;
    }
    const out = g?.trim() || fallbackGist(scoped);
    gistCache.set(key, out);
    return out;
  };

  let notified = 0;
  for (const sub of subs) {
    try {
      const recap = await buildRecap(
        kind,
        calDate,
        incidents,
        sub.camera_ids ?? [],
        gistFor,
      );
      await publishEvent(redis, STREAMS.bot_outbox(sub.channel as Channel), {
        type: "bot.outbox",
        channel: sub.channel,
        handle: sub.handle,
        text: recap.text,
        buttons: recap.buttons,
      });
      notified += 1;
    } catch (e) {
      log.warn({ err: e, handle: sub.handle }, "recap publish failed");
    }
  }
  log.info(
    { kind, incidents: incidents.length, notified },
    "window recap dispatched",
  );
  return notified;
}

export const windowSummaries = signal("window-summaries")
  .input(z.object({}))
  .output(z.object({ sent: z.number() }))
  .every("15m")
  .withInput({})
  .timeout(360_000)
  .retries(1)
  .run(async () => {
    await sql`
      CREATE TABLE IF NOT EXISTS summary_dispatch_log (
        window_key TEXT PRIMARY KEY,
        sent_at    TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `;
    await sql`
      DELETE FROM summary_dispatch_log WHERE sent_at < now() - interval '30 days'
    `.catch(() => {});

    const now = new Date();
    const { date: today, minutes } = tzParts(now);
    let sent = 0;

    // Self-heal cross-day staleness: a row for *today's* key that was
    // written on a PRIOR local day (e.g. a manual test trigger after
    // midnight) would make today's window look "already sent" forever and
    // it would never fire. Drop such rows; same-day idempotency is
    // unaffected (those rows have sent_at ≥ today's local midnight).
    const todayStartUtc = localWallToUtc(today, 0);
    await sql`
      DELETE FROM summary_dispatch_log
       WHERE window_key IN (${`overnight:${today}`}, ${`daytime:${today}`})
         AND sent_at < ${todayStartUtc}
    `.catch(() => {});

    // Each window: (key, eligible-after-local-minute, [fromUtc, toUtc)).
    const windows: Array<{
      key: string;
      kind: "overnight" | "daytime";
      eligible: boolean;
      from: Date;
      to: Date;
      // Calendar day the "review in detail" button opens. The night belongs
      // to the date it started (prev day); daytime is today.
      calDate: string;
    }> = [
      {
        key: `overnight:${today}`,
        kind: "overnight",
        eligible: minutes >= 6 * 60, // at/after 06:00 local
        from: localWallToUtc(prevDate(today), 22),
        to: localWallToUtc(today, 6),
        calDate: prevDate(today),
      },
      {
        key: `daytime:${today}`,
        kind: "daytime",
        eligible: minutes >= 18 * 60, // at/after 18:00 local
        from: localWallToUtc(today, 6),
        to: localWallToUtc(today, 18),
        calDate: today,
      },
    ];

    for (const w of windows) {
      if (!w.eligible) continue;
      // Atomic claim — exactly-once per window across restarts & 15m ticks.
      const claimed = await sql<Array<{ window_key: string }>>`
        INSERT INTO summary_dispatch_log (window_key) VALUES (${w.key})
        ON CONFLICT DO NOTHING
        RETURNING window_key
      `;
      if (claimed.length === 0) continue; // already sent this window
      try {
        sent += await runWindow(w.kind, w.calDate, w.from, w.to);
      } catch (e) {
        // Never let one window's failure block the other / crash the tick.
        log.error({ err: e, window: w.key }, "window recap failed");
      }
    }
    return { sent };
  });

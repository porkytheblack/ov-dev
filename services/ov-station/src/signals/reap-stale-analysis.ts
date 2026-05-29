/**
 * Safety net: recurring reaper that fails out incident analyses wedged in
 * `summary_status = 'pending'`.
 *
 * `summary_status` is a product-level state machine SEPARATE from Station's
 * own run rows. It is set to 'pending' when an analysis is triggered and only
 * ever advanced to 'ready' by the `write-summary` node on success — there is
 * no failure transition. Station reconciles its OWN broadcast/signal rows on
 * timeout, but nothing moves `summary_status` off 'pending' when the broadcast
 * fails, is skipped under `onFailure("continue")`, or the runner process
 * crashes mid-pipeline (e.g. a transient `EAI_AGAIN postgres` killing
 * ov-station-api). The dashboard then shows "Analyzing…" forever.
 *
 * The read path (`GET /:id/analysis` in ov-api) heals incidents the moment
 * someone polls them; this reaper is the catch-all for the ones nobody is
 * watching and for process-crash orphans. It declares a pending analysis
 * failed once it is older than any run could legitimately still be active —
 * well past the 300s `analyze-incident-clip` broadcast timeout.
 */
import { signal, z } from "station-signal";
import { sql, log } from "../config.js";

// Minutes a pending analysis may sit before it's declared failed. MUST exceed
// the analyze-incident-clip broadcast timeout (300s) with comfortable margin.
const STALE_MINUTES = Number(process.env.ANALYSIS_STALE_MINUTES ?? 15) || 15;

export const reapStaleAnalysis = signal("reap-stale-analysis")
  .input(z.object({}))
  .output(z.object({ failed: z.number() }))
  .every("5m")
  .withInput({})
  .timeout(30_000)
  .retries(1)
  .run(async () => {
    // Age off the manual trigger timestamp when present (the auto path never
    // sets 'pending'); fall back to opened_at for any pending row that carries
    // no analysis metadata (legacy / non-manual). Both columns always exist.
    const rows = await sql<{ id: string }[]>`
      UPDATE incidents
         SET summary_status = 'failed'
       WHERE summary_status = 'pending'
         AND summary IS NULL
         AND coalesce(
               (metadata->'analysis'->>'triggered_at')::timestamptz,
               opened_at
             ) < now() - make_interval(mins => ${STALE_MINUTES})
      RETURNING id
    `;
    if (rows.length > 0) {
      log.info(
        { count: rows.length, stale_minutes: STALE_MINUTES },
        "reaped stale pending analyses",
      );
    }
    return { failed: rows.length };
  });

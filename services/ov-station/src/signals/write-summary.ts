/**
 * Persists the resolved summary onto the incident and broadcasts
 * `summary.ready` so the notifier / dashboard pick it up.
 */
import { signal, z } from "station-signal";
import { publishEvent } from "@overwatch/shared-ts";
import { STREAMS } from "@overwatch/schemas/events";
import { sql, redis, log } from "../config.js";

const Input = z.object({
  incident_id: z.string(),
  summary: z.string(),
});

const Output = z.object({ ok: z.boolean() });

export const writeSummary = signal("write-summary")
  .input(Input)
  .output(Output)
  .timeout(30_000)
  .retries(3)
  .run(async (input) => {
    await sql`
      UPDATE incidents
         SET summary = ${input.summary}, summary_status = 'ready'
       WHERE id = ${input.incident_id}::uuid
    `;
    await publishEvent(redis, STREAMS.summaries, {
      type: "summary.ready",
      incident_id: input.incident_id,
      summary: input.summary,
    });
    log.info({ incident_id: input.incident_id }, "summary written");
    return { ok: true };
  });

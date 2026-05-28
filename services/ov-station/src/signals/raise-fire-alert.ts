/**
 * Sends the urgent fire alert after the vision adjudicator did NOT rule it a
 * false alarm (confirmed fire, or undetermined → fail-open). Goes through
 * the shared `dispatchFireAlert` so the per-camera Postgres rate limit and
 * the message format are identical to the engine's high-confidence path.
 */
import { signal, z } from "station-signal";
import { dispatchFireAlert } from "@overwatch/shared-ts";
import { sql, redis, log } from "../config.js";

const COOLDOWN_SEC =
  parseInt(process.env.OV_FIRE_ALERT_COOLDOWN_SEC ?? "3600", 10) || 3600;

const Input = z.object({
  camera_id: z.string(),
  classes: z.array(z.string()),
  reason: z.string(),
});

const Output = z.object({ sent: z.boolean(), subscribers: z.number() });

export const raiseFireAlert = signal("raise-fire-alert")
  .input(Input)
  .output(Output)
  .timeout(30_000)
  .retries(2)
  .run(async (input) => {
    const r = await dispatchFireAlert(sql, redis, {
      cameraId: input.camera_id,
      classes: input.classes,
      cooldownSec: COOLDOWN_SEC,
    });
    log.warn(
      {
        camera_id: input.camera_id,
        classes: input.classes,
        reason: input.reason,
        sent: r.sent,
        subscribers: r.subscribers,
      },
      r.sent
        ? "FIRE alert dispatched (adjudicated)"
        : "FIRE alert suppressed (within per-camera cooldown)",
    );
    return r;
  });

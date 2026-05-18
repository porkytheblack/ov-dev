/**
 * Fire-adjudication pipeline for the uncertain-confidence band.
 *
 *   fire-verdict                 (vision second opinion; fail-open)
 *     ├─ raise-fire-alert        (when decision !== "false_alarm")
 *     └─ cleanup-fire-frame      (always — after fire-verdict)
 *
 * High-confidence fire never reaches here — the engine alerts it directly.
 * `onFailure("continue")` keeps cleanup running even if the alert node
 * fails, and `cleanup-fire-frame` depends only on `fire-verdict` (not on
 * the alert) so the retained frame is always reclaimed regardless of
 * verdict. `fire-verdict` never throws, so the alert decision is always
 * reached (fail-open: undetermined ⇒ alert).
 */
import { broadcast } from "station-broadcast";
import { fireVerdict } from "../signals/fire-verdict.js";
import { raiseFireAlert } from "../signals/raise-fire-alert.js";
import { cleanupFireFrame } from "../signals/cleanup-fire-frame.js";

type U = Record<string, unknown>;
const v = (u: U) =>
  u["fire-verdict"] as
    | {
        camera_id: string;
        classes: string[];
        frame_key?: string;
        decision: "fire" | "false_alarm" | "undetermined";
        reason: string;
      }
    | undefined;

export const adjudicateFire = broadcast("adjudicate-fire")
  .input(fireVerdict)
  .then(raiseFireAlert, {
    // Alert on confirmed fire AND on undetermined (fail-open). Suppress only
    // an explicit false alarm. A missing verdict object also fails open.
    when: (u) => v(u)?.decision !== "false_alarm",
    map: (u) => {
      const c = v(u)!;
      return { camera_id: c.camera_id, classes: c.classes, reason: c.reason };
    },
  })
  .then(cleanupFireFrame, {
    // Depends only on the verdict (not the alert) so it runs whether or not
    // an alert was sent, and even when raise-fire-alert is skipped.
    after: ["fire-verdict"],
    map: (u) => ({ frame_key: v(u)?.frame_key }),
  })
  .onFailure("continue")
  .timeout(120_000)
  .build();

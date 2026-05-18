/**
 * Deletes the transient clip/poster from R2 once analysis has finished.
 * Runs after `analyze-clip` regardless of whether it succeeded (the
 * broadcast uses the `continue` failure policy), so a clip never lingers
 * in R2 longer than its processing window.
 */
import { signal, z } from "station-signal";
import { makeR2, r2Remove } from "@overwatch/shared-ts";
import { log } from "../config.js";

const Input = z.object({
  clipKey: z.string(),
  posterKey: z.string().optional(),
});

const Output = z.object({ removed: z.number() });

export const cleanupR2 = signal("cleanup-r2")
  .input(Input)
  .output(Output)
  .timeout(30_000)
  .retries(3)
  .run(async (input) => {
    const r2 = makeR2();
    let removed = 0;
    await r2Remove(r2, input.clipKey);
    removed += 1;
    if (input.posterKey) {
      await r2Remove(r2, input.posterKey);
      removed += 1;
    }
    log.info({ clipKey: input.clipKey, removed }, "R2 objects cleaned up");
    return { removed };
  });

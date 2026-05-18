/**
 * Safety net: recurring sweep that deletes any incident clip left in R2
 * longer than its processing window (e.g. if the service crashed between
 * upload and cleanup). The broadcast normally cleans up its own objects;
 * this guarantees the bucket never accumulates stale clips.
 */
import { signal, z } from "station-signal";
import {
  makeR2,
  r2Configured,
  r2ListOlderThan,
  r2Remove,
  R2_INCIDENT_PREFIX,
} from "@overwatch/shared-ts";
import { log, R2_TTL_MINUTES } from "../config.js";

export const r2Sweep = signal("r2-sweep")
  .input(z.object({}))
  .output(z.object({ removed: z.number() }))
  .every("10m")
  .withInput({})
  .timeout(60_000)
  .retries(1)
  .run(async () => {
    if (!r2Configured()) return { removed: 0 };
    const r2 = makeR2();
    const stale = await r2ListOlderThan(
      r2,
      R2_INCIDENT_PREFIX,
      R2_TTL_MINUTES * 60_000,
    );
    for (const key of stale) await r2Remove(r2, key);
    if (stale.length > 0) log.info({ count: stale.length }, "swept stale R2 clips");
    return { removed: stale.length };
  });

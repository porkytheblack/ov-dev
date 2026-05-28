/**
 * Deletes the suspect frame the detector retained for adjudication. Runs
 * after the verdict regardless of outcome so a retained frame never lingers;
 * the MinIO frames-bucket lifecycle policy is the backstop if this is
 * skipped (e.g. broadcast failure). Idempotent — a missing object is fine.
 */
import { signal, z } from "station-signal";
import { BUCKETS, makeMinio } from "@overwatch/shared-ts";
import { log } from "../config.js";

const Input = z.object({ frame_key: z.string().optional() });
const Output = z.object({ removed: z.number() });

export const cleanupFireFrame = signal("cleanup-fire-frame")
  .input(Input)
  .output(Output)
  .timeout(15_000)
  .retries(2)
  .run(async (input) => {
    if (!input.frame_key) return { removed: 0 };
    try {
      const minio = makeMinio();
      await minio.removeObject(BUCKETS.frames, input.frame_key);
      return { removed: 1 };
    } catch (e) {
      const code = (e as { code?: string }).code ?? "";
      if (code === "NoSuchKey" || code === "NotFound") return { removed: 0 };
      // Best-effort: never fail the broadcast over cleanup — the bucket
      // lifecycle policy reclaims it anyway.
      log.warn({ err: e, frame_key: input.frame_key }, "fire frame cleanup failed");
      return { removed: 0 };
    }
  });

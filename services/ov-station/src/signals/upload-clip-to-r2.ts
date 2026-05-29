/**
 * Pulls the incident clip (and poster, if any) out of the internal MinIO
 * store and pushes it to Cloudflare R2 so the Mimo vision model can fetch
 * it over a public URL. The object is transient — `cleanup-r2` (or the
 * `r2-sweep` safety net) removes it once analysis is done.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { signal, z } from "station-signal";
import {
  BUCKETS,
  makeMinio,
  makeR2,
  r2EnsureBucket,
  r2PublicUrl,
  r2PutFile,
  R2_INCIDENT_PREFIX,
} from "@overwatch/shared-ts";
import {
  log,
  ANALYSIS_MAX_MB,
  ANALYSIS_MAX_SECONDS,
  ANALYSIS_MAX_HEIGHT,
  ANALYSIS_FPS,
} from "../config.js";
import { fitVideoToBudget } from "../fit-video.js";

const Input = z.object({
  incident_id: z.string(),
  storage_key: z.string(),
  poster_key: z.string().optional(),
});

const Output = z.object({
  clipKey: z.string(),
  posterKey: z.string().optional(),
  clipUrl: z.string(),
  posterUrl: z.string().optional(),
});

export const uploadClipToR2 = signal("upload-clip-to-r2")
  .input(Input)
  .output(Output)
  .timeout(120_000)
  .retries(2)
  .run(async (input) => {
    const minio = makeMinio();
    const r2 = makeR2();
    await r2EnsureBucket(r2);

    const work = mkdtempSync(join(tmpdir(), `ov-station-${input.incident_id}-`));
    try {
      const clipKey = `${R2_INCIDENT_PREFIX}${input.incident_id}/clip.mp4`;
      const localClip = join(work, "clip.mp4");
      await minio.fGetObject(BUCKETS.clips, input.storage_key, localClip);

      // Shrink to a budget the vision model can ingest. analyze-clip fetches
      // this R2 object and base64-inlines it into the OpenRouter request, so an
      // oversized clip blows the provider limit; fitVideoToBudget re-encodes it
      // to fit (dropping audio + excess resolution/fps/duration). Stored MinIO
      // clip — used for dashboard playback — is untouched; only this R2 copy is
      // trimmed.
      const fitted = await fitVideoToBudget(localClip, join(work, "clip-analysis.mp4"), {
        maxBytes: ANALYSIS_MAX_MB * 1024 * 1024,
        maxSeconds: ANALYSIS_MAX_SECONDS,
        maxHeight: ANALYSIS_MAX_HEIGHT,
        fps: ANALYSIS_FPS,
      });
      if (fitted.transcoded) {
        log.info(
          {
            incident_id: input.incident_id,
            src_mb: +(fitted.srcBytes / 1048576).toFixed(1),
            out_mb: +(fitted.bytes / 1048576).toFixed(1),
          },
          "clip re-encoded to fit analysis budget",
        );
      }
      await r2PutFile(r2, clipKey, fitted.path, "video/mp4");

      let posterKey: string | undefined;
      let posterUrl: string | undefined;
      if (input.poster_key) {
        posterKey = `${R2_INCIDENT_PREFIX}${input.incident_id}/poster.jpg`;
        const localPoster = join(work, "poster.jpg");
        try {
          await minio.fGetObject(BUCKETS.clips, input.poster_key, localPoster);
          await r2PutFile(r2, posterKey, localPoster, "image/jpeg");
          posterUrl = r2PublicUrl(posterKey);
        } catch (e) {
          log.warn({ err: e, incident_id: input.incident_id }, "poster upload failed; continuing without it");
          posterKey = undefined;
        }
      }

      log.info({ incident_id: input.incident_id, clipKey }, "clip uploaded to R2");
      return {
        clipKey,
        posterKey,
        clipUrl: r2PublicUrl(clipKey),
        posterUrl,
      };
    } finally {
      rmSync(work, { recursive: true, force: true });
    }
  });

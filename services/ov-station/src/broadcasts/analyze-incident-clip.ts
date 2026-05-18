/**
 * Vision pipeline as an asynchronous Station broadcast.
 *
 *   fetch-clip-context              (decide: analyse or skip)
 *        └─ upload-clip-to-r2       (when !skip — clip → public R2 URL)
 *             └─ analyze-clip       (Mimo vision model → summary)
 *                  ├─ write-summary (when summary — persist + publish)
 *                  └─ cleanup-r2    (always — delete the transient clip)
 *
 * `onFailure("continue")` ensures `cleanup-r2` still runs even if the model
 * call fails, so R2 never holds a clip past its processing window.
 */
import { broadcast } from "station-broadcast";
import { fetchClipContext } from "../signals/fetch-clip-context.js";
import { uploadClipToR2 } from "../signals/upload-clip-to-r2.js";
import { analyzeClip } from "../signals/analyze-clip.js";
import { writeSummary } from "../signals/write-summary.js";
import { cleanupR2 } from "../signals/cleanup-r2.js";

type U = Record<string, unknown>;
const ctx = (u: U) =>
  u["fetch-clip-context"] as {
    skip: boolean;
    incident_id: string;
    storage_key: string;
    poster_key?: string;
    prompt: string;
  };
const up = (u: U) =>
  u["upload-clip-to-r2"] as
    | { clipKey: string; posterKey?: string; clipUrl: string; posterUrl?: string }
    | undefined;
const an = (u: U) =>
  u["analyze-clip"] as { incident_id: string; summary: string } | undefined;

export const analyzeIncidentClip = broadcast("analyze-incident-clip")
  .input(fetchClipContext)
  .then(uploadClipToR2, {
    when: (u) => ctx(u)?.skip === false,
    map: (u) => {
      const c = ctx(u);
      return {
        incident_id: c.incident_id,
        storage_key: c.storage_key,
        poster_key: c.poster_key,
      };
    },
  })
  .then(analyzeClip, {
    // Station passes a node only its declared `after` outputs — analyze-clip
    // needs both the context (prompt/incident_id) and the R2 URLs.
    after: ["fetch-clip-context", "upload-clip-to-r2"],
    when: (u) => !!up(u)?.clipKey,
    map: (u) => {
      const c = ctx(u);
      const r = up(u)!;
      return {
        incident_id: c.incident_id,
        prompt: c.prompt,
        clipUrl: r.clipUrl,
        posterUrl: r.posterUrl,
      };
    },
  })
  .then(writeSummary, {
    after: ["analyze-clip"],
    when: (u) => !!an(u)?.summary,
    map: (u) => {
      const a = an(u)!;
      return { incident_id: a.incident_id, summary: a.summary };
    },
  })
  .then(cleanupR2, {
    // Wait for analyze-clip (so the clip isn't deleted mid-analysis) but read
    // the R2 keys from upload-clip-to-r2. On analyze failure this node is
    // skipped; the recurring `r2-sweep` reclaims the orphan within its TTL.
    after: ["analyze-clip", "upload-clip-to-r2"],
    when: (u) => !!up(u)?.clipKey,
    map: (u) => {
      const r = up(u)!;
      return { clipKey: r.clipKey, posterKey: r.posterKey };
    },
  })
  .onFailure("continue")
  .timeout(300_000)
  .build();

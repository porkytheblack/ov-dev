/**
 * Shrink an incident clip to a vision-model-friendly size before it's handed
 * to the analyzer.
 *
 * The OpenRouter/Gemini vision path does NOT stream the clip from a URL — it
 * fetches the bytes and inlines them as a base64 `data:` URL in the request
 * body (see packages/ai-ts/src/openrouter.ts). base64 inflates the payload by
 * ~33%, so a >30MB clip blows the request/input limit and the call fails. We
 * therefore re-encode the clip to fit a byte budget, disposing of everything
 * the summary doesn't need:
 *   - audio (`-an`)            — irrelevant to a visual scene summary
 *   - excess resolution        — capped to maxHeight (720p is plenty)
 *   - excess frame rate        — capped to `fps` (a few fps reads fine)
 *   - excess duration          — capped to maxSeconds (keeps the onset)
 * and finally bitrate-targets the remaining bytes so the result is reliably
 * under budget regardless of how compressible the footage is.
 *
 * Requires ffmpeg/ffprobe on PATH (installed in the ov-station image).
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { statSync } from "node:fs";

const execFileAsync = promisify(execFile);

export interface FitOptions {
  /** Hard byte ceiling for the produced file. */
  maxBytes: number;
  /** Keep at most this many seconds from the start (<=0 disables the cap). */
  maxSeconds: number;
  /** Downscale so height never exceeds this (no upscaling). */
  maxHeight: number;
  /** Cap the output frame rate. */
  fps: number;
}

export interface FitResult {
  /** Path to upload — the original when it already fit, else the re-encode. */
  path: string;
  transcoded: boolean;
  bytes: number;
  srcBytes: number;
}

async function probe(
  path: string,
): Promise<{ durationSec: number; height: number }> {
  try {
    const { stdout } = await execFileAsync("ffprobe", [
      "-v", "error",
      "-select_streams", "v:0",
      "-show_entries", "format=duration:stream=height",
      "-of", "json",
      path,
    ]);
    const j = JSON.parse(stdout) as {
      format?: { duration?: string };
      streams?: Array<{ height?: number }>;
    };
    return {
      durationSec: Number(j.format?.duration) || 0,
      height: Number(j.streams?.[0]?.height) || 0,
    };
  } catch {
    return { durationSec: 0, height: 0 };
  }
}

/**
 * Produce a clip that fits `opts.maxBytes`, writing to `output`. Returns the
 * original `input` untouched when it's already within budget and not over-long.
 * Never throws for encode reasons the caller can't act on — on ffmpeg failure
 * it returns the original path so the pipeline degrades rather than dying.
 */
export async function fitVideoToBudget(
  input: string,
  output: string,
  opts: FitOptions,
): Promise<FitResult> {
  const srcBytes = statSync(input).size;
  const { durationSec, height } = await probe(input);

  // Fast path: already small enough and not over-long → ship the original.
  const overLong = opts.maxSeconds > 0 && durationSec > opts.maxSeconds;
  if (srcBytes <= opts.maxBytes && !overLong) {
    return { path: input, transcoded: false, bytes: srcBytes, srcBytes };
  }

  const effDuration =
    opts.maxSeconds > 0
      ? Math.min(durationSec || opts.maxSeconds, opts.maxSeconds)
      : durationSec || 1;

  // Only downscale (never up) and keep width even for yuv420p/libx264.
  const vf: string[] = [];
  if (opts.maxHeight > 0 && height > opts.maxHeight) {
    vf.push(`scale=-2:${opts.maxHeight}`);
  }
  if (opts.fps > 0) vf.push(`fps=${opts.fps}`);

  // Two passes of decreasing quality so we land under budget even on
  // hard-to-compress footage; the second only runs if the first overshoots.
  for (const safety of [0.9, 0.6]) {
    const usableBytes = opts.maxBytes * safety;
    const bitrate = Math.max(
      150_000,
      Math.floor((usableBytes * 8) / Math.max(1, effDuration)),
    );
    const args = [
      "-y",
      "-i", input,
      ...(opts.maxSeconds > 0 ? ["-t", String(opts.maxSeconds)] : []),
      "-an",
      ...(vf.length ? ["-vf", vf.join(",")] : []),
      "-c:v", "libx264",
      "-preset", "veryfast",
      "-b:v", String(bitrate),
      "-maxrate", String(Math.floor(bitrate * 1.3)),
      "-bufsize", String(bitrate),
      "-pix_fmt", "yuv420p",
      "-movflags", "+faststart",
      output,
    ];
    try {
      await execFileAsync("ffmpeg", args, { maxBuffer: 1 << 26 });
    } catch {
      // ffmpeg missing/failed — degrade to the original rather than failing
      // the whole analysis pipeline.
      return { path: input, transcoded: false, bytes: srcBytes, srcBytes };
    }
    const outBytes = statSync(output).size;
    if (outBytes <= opts.maxBytes) {
      return { path: output, transcoded: true, bytes: outBytes, srcBytes };
    }
  }

  // Best effort: return the last (smallest) encode even if marginally over.
  return { path: output, transcoded: true, bytes: statSync(output).size, srcBytes };
}

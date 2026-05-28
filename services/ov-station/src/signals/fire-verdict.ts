/**
 * Root of the fire-adjudication broadcast. Pulls the retained suspect frame
 * out of MinIO, hands it to the configured vision model (MiMo or Gemini,
 * picked by `VISION_PROVIDER`) as a base64 data URI, and resolves a strict
 * fire / false-alarm / unavailable verdict.
 *
 * FAIL-CLOSED for the uncertain band by operator policy: anything that
 * prevents a real verdict (no retained frame, MinIO miss, model down /
 * timeout / refusal / not configured) resolves to `"unavailable"`, which
 * the broadcast treats as "suppress" — no spam while the adjudicator is
 * unreachable. High-confidence fire still alerts engine-direct,
 * independent of the adjudicator. Only an explicit model `false_alarm`
 * suppresses a high-confidence detection.
 */
import { signal, z } from "station-signal";
import { BUCKETS, makeMinio } from "@overwatch/shared-ts";
import { classifyFireVision, visionConfigured } from "@overwatch/ai";
import { sql, log } from "../config.js";

const Input = z.object({
  camera_id: z.string(),
  classes: z.array(z.string()),
  frame_key: z.string().optional(),
  confidence: z.number(),
  high_confidence: z.boolean(),
});

const Output = z.object({
  camera_id: z.string(),
  classes: z.array(z.string()),
  frame_key: z.string().optional(),
  decision: z.enum(["fire", "false_alarm", "unavailable"]),
  reason: z.string(),
});

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const c of stream) {
    chunks.push(typeof c === "string" ? Buffer.from(c) : (c as Buffer));
  }
  return Buffer.concat(chunks);
}

export const fireVerdict = signal("fire-verdict")
  .input(Input)
  .output(Output)
  .timeout(60_000)
  .retries(0)
  .run(async (input) => {
    const base = {
      camera_id: input.camera_id,
      classes: input.classes,
      frame_key: input.frame_key,
    };
    try {
      // Defensive: the engine only sends sub-threshold fire here, but if a
      // high-confidence one ever arrives, confirm without a model round-trip.
      if (input.high_confidence) {
        return { ...base, decision: "fire" as const, reason: "high confidence" };
      }
      // Can't adjudicate (no frame / MiMo not configured) → "unavailable".
      // Per the operator's choice the uncertain band SUPPRESSES on
      // unavailable while MiMo is unreachable; high-confidence fire still
      // alerts engine-direct, independent of MiMo.
      if (!input.frame_key) {
        return {
          ...base,
          decision: "unavailable" as const,
          reason: "no frame retained",
        };
      }
      if (!visionConfigured()) {
        return {
          ...base,
          decision: "unavailable" as const,
          reason: "vision adjudicator not configured",
        };
      }

      let dataUri: string;
      try {
        const minio = makeMinio();
        const obj = await minio.getObject(BUCKETS.frames, input.frame_key);
        const buf = await streamToBuffer(obj);
        if (buf.length === 0) throw new Error("empty frame");
        dataUri = `data:image/jpeg;base64,${buf.toString("base64")}`;
      } catch (e) {
        log.warn(
          { err: e, camera_id: input.camera_id, frame_key: input.frame_key },
          "fire frame fetch failed; cannot adjudicate",
        );
        return {
          ...base,
          decision: "unavailable" as const,
          reason: "frame unavailable",
        };
      }

      const cam = await sql<Array<{ name: string }>>`
        SELECT name FROM cameras WHERE id = ${input.camera_id}::uuid LIMIT 1
      `;
      const cameraName = cam[0]?.name ?? "the camera";

      const res = await classifyFireVision({
        imageUrl: dataUri,
        cameraName,
        classes: input.classes,
        detectorConfidence: input.confidence,
      });
      const outcome =
        res.verdict === "fire"
          ? "fire confirmed → alerting"
          : res.verdict === "false_alarm"
            ? "false alarm → suppressed"
            : "adjudicator unavailable → suppressed (high-confidence fire still alerts engine-direct)";
      log.warn(
        {
          camera_id: input.camera_id,
          verdict: res.verdict,
          reason: res.reason,
          detectorConfidence: input.confidence,
        },
        `fire verdict: ${outcome}`,
      );
      return { ...base, decision: res.verdict, reason: res.reason };
    } catch (e) {
      // Never throw out of the broadcast root. Can't adjudicate → unavailable
      // → suppressed for the uncertain band (operator's choice); a clearly
      // visible fire reads high-confidence and alerts engine-direct anyway.
      log.error(
        { err: e, camera_id: input.camera_id },
        "fire-verdict crashed; unavailable → suppressed",
      );
      return {
        ...base,
        decision: "unavailable" as const,
        reason: "verdict error",
      };
    }
  });

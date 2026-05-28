/**
 * Sends the public clip (and poster) to the configured vision model
 * (MiMo or Gemini, picked by `VISION_PROVIDER`) and resolves the
 * natural-language incident summary. Runs asynchronously inside the
 * Station broadcast; retries on transient model errors.
 */
import { signal, z } from "station-signal";
import { analyzeClipVision } from "@overwatch/ai";
import { log } from "../config.js";

const Input = z.object({
  incident_id: z.string(),
  prompt: z.string(),
  clipUrl: z.string(),
  posterUrl: z.string().optional(),
});

const Output = z.object({
  incident_id: z.string(),
  summary: z.string(),
});

export const analyzeClip = signal("analyze-clip")
  .input(Input)
  .output(Output)
  .timeout(180_000)
  .retries(2)
  .run(async (input) => {
    const summary = await analyzeClipVision({
      prompt: input.prompt,
      images: input.posterUrl ? [{ url: input.posterUrl }] : [],
      videoUrl: input.clipUrl,
      systemPrompt: "Keep the log entry short, factual, and limited to the highlighted zone.",
    });
    log.info({ incident_id: input.incident_id }, "vision summary resolved");
    return { incident_id: input.incident_id, summary };
  });

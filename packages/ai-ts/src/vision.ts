/**
 * Vision-provider dispatcher. Picks Mimo or Gemini per call based on the
 * `VISION_PROVIDER` env, so the rest of the codebase doesn't care which
 * model is in play.
 *
 *   VISION_PROVIDER=mimo     → Xiaomi MiMo (legacy default)
 *   VISION_PROVIDER=gemini   → Google Gemini 2.5 Flash-Lite
 *
 * Each provider implements the same three operations:
 *   - analyzeClipVision()    — natural-language clip summary
 *   - classifyFireVision()   — fire/false_alarm/unavailable verdict
 *   - summarizeVision()      — text-only summarization (window recaps)
 *
 * Plus `visionConfigured()` so the caller can decide whether to even
 * attempt the call. When the configured provider isn't ready, the
 * dispatcher treats the request as if the model is unavailable (fire
 * verdicts) or throws (clip analyze) — exactly the behaviour the legacy
 * MiMo-only code already had, just behind one switch.
 */
import {
  analyzeWithMimoVision,
  classifyFireWithMimo,
  mimoConfigured,
  summarizeWithMimo,
  type FireClassifyRequest,
  type FireClassifyResult,
  type MimoVisionRequest,
} from "./mimo.js";
import {
  analyzeWithGeminiVision,
  classifyFireWithGemini,
  geminiConfigured,
  summarizeWithGemini,
  type GeminiVisionRequest,
} from "./gemini.js";
import {
  analyzeWithOpenRouterVision,
  classifyFireWithOpenRouter,
  openRouterConfigured,
  summarizeWithOpenRouter,
  type OpenRouterVisionRequest,
} from "./openrouter.js";

export type VisionProvider = "mimo" | "gemini" | "openrouter";

// MiMo stays the default so nothing breaks for operators who haven't set
// VISION_PROVIDER yet. The operator flips this to "gemini" in .env.
const DEFAULT_PROVIDER: VisionProvider = "mimo";

export function visionProvider(): VisionProvider {
  const raw = (process.env.VISION_PROVIDER ?? "").trim().toLowerCase();
  if (raw === "mimo" || raw === "gemini" || raw === "openrouter") return raw;
  return DEFAULT_PROVIDER;
}

/** True when the currently-selected vision provider has an API key. The
 *  fire-verdict broadcast uses this to short-circuit to "unavailable" and
 *  suppress the alert when no adjudicator is wired up. */
export function visionConfigured(): boolean {
  switch (visionProvider()) {
    case "gemini":
      return geminiConfigured("vision");
    case "openrouter":
      return openRouterConfigured("vision");
    case "mimo":
    default:
      return mimoConfigured("vision");
  }
}

// All three request shapes are structurally identical (text prompt +
// optional images + optional videoUrl) — accept any at the boundary.
export type VisionRequest =
  | MimoVisionRequest
  | GeminiVisionRequest
  | OpenRouterVisionRequest;

export async function analyzeClipVision(req: VisionRequest): Promise<string> {
  switch (visionProvider()) {
    case "gemini":
      return analyzeWithGeminiVision(req);
    case "openrouter":
      return analyzeWithOpenRouterVision(req);
    case "mimo":
    default:
      return analyzeWithMimoVision(req);
  }
}

export async function classifyFireVision(
  req: FireClassifyRequest,
): Promise<FireClassifyResult> {
  switch (visionProvider()) {
    case "gemini":
      return classifyFireWithGemini(req);
    case "openrouter":
      return classifyFireWithOpenRouter(req);
    case "mimo":
    default:
      return classifyFireWithMimo(req);
  }
}

export async function summarizeVision(
  prompt: string,
  opts: { system?: string; maxTokens?: number; temperature?: number } = {},
): Promise<string | null> {
  switch (visionProvider()) {
    case "gemini":
      return summarizeWithGemini(prompt, opts);
    case "openrouter":
      return summarizeWithOpenRouter(prompt, opts);
    case "mimo":
    default:
      return summarizeWithMimo(prompt, opts);
  }
}

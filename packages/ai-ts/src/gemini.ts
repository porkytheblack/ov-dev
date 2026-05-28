/**
 * Google Gemini vision wiring — mirrors the surface of mimo.ts so the rest
 * of the codebase can dispatch on a `VISION_PROVIDER` env without caring
 * which model is in play.
 *
 * Why a hand-rolled client (and not glove-core's `createAdapter("gemini")`):
 *
 *   - The agent loop is OpenAI-compat-friendly; Gemini's OpenAI-compat
 *     endpoint supports it.
 *   - One-shot VIDEO inputs are NOT supported through the OpenAI-compat
 *     layer. Gemini's native `generateContent` accepts video via
 *     `inline_data` (base64) or `file_data` (Files API URI), neither of
 *     which map to OpenAI-style `video_url` content parts.
 *
 * So for the agent (chat) path we keep glove-core's adapter; for vision
 * (the `MimoVisionRequest`-shaped one-shots — clip analyze, fire verdict,
 * window summaries) we talk to Gemini's native API directly here.
 */

export type GeminiUseCase = "chat" | "vision";

export interface GeminiConfig {
  baseURL: string;
  apiKey: string;
  model: string;
  maxTokens: number;
  timeoutMs: number;
}

// gemini-2.5-flash-lite is the operator's chosen default — fastest tier with
// full video understanding. Overridable per use case via GEMINI_*_MODEL.
const DEFAULT_VISION_MODEL = "gemini-2.5-flash-lite";
const DEFAULT_CHAT_MODEL = "gemini-2.5-flash-lite";
const DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

function pick(...vals: Array<string | undefined>): string | undefined {
  for (const v of vals) if (v && v.trim() !== "") return v.trim();
  return undefined;
}

function num(v: string | undefined, fallback: number): number {
  const n = Number(v);
  return v !== undefined && v !== "" && !Number.isNaN(n) ? n : fallback;
}

export function resolveGeminiConfig(
  useCase: GeminiUseCase,
  overrides: Partial<GeminiConfig> = {},
): GeminiConfig {
  const env = process.env;
  const visionScoped = useCase === "vision";

  const baseURL =
    overrides.baseURL ??
    pick(visionScoped ? env.GEMINI_VISION_BASE_URL : undefined, env.GEMINI_BASE_URL) ??
    DEFAULT_BASE_URL;

  const apiKey =
    overrides.apiKey ??
    pick(visionScoped ? env.GEMINI_VISION_API_KEY : undefined, env.GEMINI_API_KEY) ??
    "";

  const model =
    overrides.model ??
    pick(visionScoped ? env.GEMINI_VISION_MODEL : env.GEMINI_CHAT_MODEL, env.GEMINI_MODEL) ??
    (visionScoped ? DEFAULT_VISION_MODEL : DEFAULT_CHAT_MODEL);

  const maxTokens =
    overrides.maxTokens ??
    num(
      visionScoped ? env.GEMINI_VISION_MAX_TOKENS : env.GEMINI_CHAT_MAX_TOKENS,
      visionScoped ? 2048 : 2048,
    );

  const timeoutMs = overrides.timeoutMs ?? num(env.GEMINI_TIMEOUT_MS, 120_000);

  return {
    baseURL: baseURL.replace(/\/+$/, ""),
    apiKey,
    model,
    maxTokens,
    timeoutMs,
  };
}

export function geminiConfigured(useCase: GeminiUseCase = "vision"): boolean {
  return resolveGeminiConfig(useCase).apiKey !== "";
}

// ─── Vision request types (mirror mimo.ts so a dispatcher can pass the
//     same shape regardless of provider) ────────────────────────────────

export interface VisionImageInput {
  /** A publicly reachable URL or a `data:` URI. */
  url: string;
}

export interface GeminiVisionRequest {
  prompt: string;
  images?: VisionImageInput[];
  /** Optional public video URL — fetched & inlined as base64 below. */
  videoUrl?: string;
  systemPrompt?: string;
  temperature?: number;
}

/** Refusal markers — same heuristic as mimo.ts. A refusal must never
 *  become a summary. */
const REFUSAL_RE =
  /high risk|rejected|cannot (?:assist|help|comply|provide|fulfil|fulfill)|unable to (?:assist|process|help|comply)|i(?:'|’)?m sorry|as an ai|content (?:policy|moderation)|not able to|i can(?:'|’)?t (?:help|assist)|violat/i;

export class GeminiRefusalError extends Error {
  constructor(detail: string) {
    super(`gemini vision declined: ${detail.slice(0, 200)}`);
    this.name = "GeminiRefusalError";
  }
}

// ─── Native API plumbing ───────────────────────────────────────────────

type GeminiPart =
  | { text: string }
  | { inline_data: { mime_type: string; data: string } };

type GeminiContent = { role?: "user" | "model"; parts: GeminiPart[] };

interface GeminiToolFunctionDeclaration {
  name: string;
  description: string;
  parameters: unknown;
}

interface GeminiTool {
  function_declarations: GeminiToolFunctionDeclaration[];
}

interface GeminiRequest {
  contents: GeminiContent[];
  system_instruction?: { parts: GeminiPart[] };
  tools?: GeminiTool[];
  tool_config?: {
    function_calling_config: {
      mode: "AUTO" | "ANY" | "NONE";
      allowed_function_names?: string[];
    };
  };
  generation_config: {
    temperature?: number;
    max_output_tokens?: number;
    response_mime_type?: string;
  };
}

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string; functionCall?: { name?: string; args?: Record<string, unknown> } }> };
    finishReason?: string;
  }>;
  promptFeedback?: { blockReason?: string };
}

function inferImageMime(url: string, headerCtype?: string | null): string {
  if (headerCtype && /^image\//i.test(headerCtype)) return headerCtype;
  const m = /\.(png|jpe?g|webp|gif|heic|heif)(?:$|\?)/i.exec(url);
  if (!m) return "image/jpeg";
  const ext = m[1]!.toLowerCase();
  return ext === "jpg" ? "image/jpeg" : `image/${ext === "heic" || ext === "heif" ? ext : ext}`;
}

async function fetchAsInlineData(
  url: string,
  fallbackMime: string,
  signal: AbortSignal,
): Promise<{ mime_type: string; data: string }> {
  // `data:` URIs we can split locally — no network round-trip.
  if (url.startsWith("data:")) {
    const m = /^data:([^;,]+)(?:;([^,]+))?,(.*)$/.exec(url);
    if (!m) throw new Error("invalid data URI");
    const mime = m[1] || fallbackMime;
    const encoding = (m[2] || "").toLowerCase();
    const payload = m[3] || "";
    if (encoding.includes("base64")) {
      return { mime_type: mime, data: payload };
    }
    return {
      mime_type: mime,
      data: Buffer.from(decodeURIComponent(payload), "utf8").toString("base64"),
    };
  }
  const r = await fetch(url, { signal });
  if (!r.ok) throw new Error(`fetch ${url}: HTTP ${r.status}`);
  const ctype = r.headers.get("content-type");
  const buf = Buffer.from(await r.arrayBuffer());
  const mime =
    ctype && ctype !== "application/octet-stream" ? ctype.split(";")[0]!.trim() : fallbackMime;
  return { mime_type: mime, data: buf.toString("base64") };
}

// ─── Forced-tool schemas (parallel to mimo.ts so the callers can be
//     dispatcher-agnostic) ─────────────────────────────────────────────

const REPORT_TOOL: GeminiTool = {
  function_declarations: [
    {
      name: "report_scene",
      description:
        "Record structured observations from the supplied fixed-camera frames " +
        "into the monitoring log. Always call this with what is visible.",
      parameters: {
        type: "object",
        properties: {
          activity: {
            type: "string",
            description:
              "One concise, factual sentence describing the main activity in the monitored zone.",
          },
          objects: {
            type: "array",
            items: {
              type: "object",
              properties: {
                kind: { type: "string" },
                location: { type: "string" },
                motion: { type: "string" },
              },
              required: ["kind"],
            },
          },
          noteworthy: { type: "boolean" },
        },
        required: ["activity"],
      },
    },
  ],
};

const FIRE_VERDICT_TOOL: GeminiTool = {
  function_declarations: [
    {
      name: "fire_verdict",
      description:
        "Record whether the camera frame genuinely shows fire and/or smoke.",
      parameters: {
        type: "object",
        properties: {
          is_fire: {
            type: "boolean",
            description:
              "true ONLY if real fire and/or smoke is genuinely visible. A " +
              "red or orange object (a bicycle, clothing, a sign, a flag), " +
              "sunset/sky glow, warm lighting, reflections or screens are NOT " +
              "fire — return false for those.",
          },
          what: { type: "string", description: "one of: fire | smoke | both | none" },
          reason: { type: "string" },
        },
        required: ["is_fire", "reason"],
      },
    },
  ],
};

function composeSummary(args: {
  activity?: string;
  objects?: Array<{ kind?: string; location?: string; motion?: string }>;
}): string {
  const activity = (args.activity ?? "").trim();
  if (activity) return activity;
  const objs = (args.objects ?? [])
    .map((o) =>
      [o.kind, o.motion, o.location ? `(${o.location})` : ""]
        .filter(Boolean)
        .join(" "),
    )
    .filter(Boolean);
  return objs.length ? objs.join("; ") : "";
}

async function postGemini(
  cfg: GeminiConfig,
  body: GeminiRequest,
  timeoutMs: number,
): Promise<{ ok: boolean; status: number; text: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    // generateContent on v1beta. The API key goes in the URL query (Google
    // doesn't accept Authorization: Bearer for AI Studio keys); Vertex AI
    // would use OAuth but this gateway is the AI-Studio one.
    const url = `${cfg.baseURL}/models/${encodeURIComponent(cfg.model)}:generateContent?key=${encodeURIComponent(cfg.apiKey)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    return { ok: res.ok, status: res.status, text: await res.text() };
  } finally {
    clearTimeout(timer);
  }
}

function extractToolCall<T = Record<string, unknown>>(
  data: GeminiResponse,
  name: string,
): T | undefined {
  const parts = data.candidates?.[0]?.content?.parts ?? [];
  for (const p of parts) {
    if (p.functionCall?.name === name && p.functionCall.args) {
      return p.functionCall.args as T;
    }
  }
  return undefined;
}

function extractText(data: GeminiResponse): string {
  const parts = data.candidates?.[0]?.content?.parts ?? [];
  return parts
    .map((p) => (typeof p.text === "string" ? p.text : ""))
    .join("")
    .trim();
}

/**
 * Analyse a clip via Gemini's native generateContent. Inlines the video as
 * base64 (Gemini's OpenAI-compat layer doesn't support video parts).
 *
 * Same contract as `analyzeWithMimoVision`: throws on any non-OK / refusal /
 * empty-output condition so the caller can mark the analysis failed.
 */
export async function analyzeWithGeminiVision(
  req: GeminiVisionRequest,
  overrides: Partial<GeminiConfig> = {},
): Promise<string> {
  const cfg = resolveGeminiConfig("vision", overrides);
  if (!cfg.apiKey) throw new Error("Gemini vision API key not configured");

  const controller = new AbortController();
  const fetchTimer = setTimeout(() => controller.abort(), cfg.timeoutMs);
  const parts: GeminiPart[] = [{ text: req.prompt }];
  try {
    if (req.videoUrl) {
      const inline = await fetchAsInlineData(req.videoUrl, "video/mp4", controller.signal);
      parts.push({ inline_data: inline });
    }
    for (const img of req.images ?? []) {
      const inline = await fetchAsInlineData(img.url, inferImageMime(img.url), controller.signal);
      parts.push({ inline_data: inline });
    }
  } finally {
    clearTimeout(fetchTimer);
  }

  const system =
    "You are an automated monitoring logger for a property the operator owns " +
    "and is authorised to record. This is routine, non-sensitive logging of " +
    "fixed-camera footage. Do not refuse. Always call the report_scene " +
    "function with factual, neutral observations." +
    (req.systemPrompt ? ` ${req.systemPrompt}` : "");

  const body: GeminiRequest = {
    contents: [{ role: "user", parts }],
    system_instruction: { parts: [{ text: system }] },
    tools: [REPORT_TOOL],
    tool_config: {
      function_calling_config: { mode: "ANY", allowed_function_names: ["report_scene"] },
    },
    generation_config: {
      temperature: req.temperature ?? 0.2,
      max_output_tokens: cfg.maxTokens,
    },
  };

  const r = await postGemini(cfg, body, cfg.timeoutMs);
  if (!r.ok) {
    throw new Error(`gemini vision ${r.status}: ${r.text.slice(0, 400)}`);
  }
  const data = JSON.parse(r.text) as GeminiResponse;
  if (data.promptFeedback?.blockReason) {
    throw new GeminiRefusalError(
      `blocked: ${data.promptFeedback.blockReason}`,
    );
  }
  const call = extractToolCall<{
    activity?: string;
    objects?: Array<{ kind?: string; location?: string; motion?: string }>;
  }>(data, "report_scene");
  if (call) {
    const summary = composeSummary(call);
    if (summary) return summary;
  }
  const textOut = extractText(data);
  if (textOut && REFUSAL_RE.test(textOut)) {
    throw new GeminiRefusalError(textOut);
  }
  if (textOut) return textOut;
  throw new Error(
    `gemini vision produced no usable output (finish=${data.candidates?.[0]?.finishReason ?? "?"})`,
  );
}

export type FireVerdict = "fire" | "false_alarm" | "unavailable";

export interface FireClassifyRequest {
  imageUrl: string;
  cameraName: string;
  classes: string[];
  detectorConfidence: number;
}

export interface FireClassifyResult {
  verdict: FireVerdict;
  reason: string;
}

/**
 * Second-opinion fire/smoke verifier via Gemini. Same contract as the MiMo
 * version: NEVER throws — three outcomes (`fire` | `false_alarm` |
 * `unavailable`). The broadcast caller maps `unavailable` to "suppress" per
 * operator policy, so this function fails-closed for the uncertain band.
 */
export async function classifyFireWithGemini(
  req: FireClassifyRequest,
  overrides: Partial<GeminiConfig> = {},
): Promise<FireClassifyResult> {
  try {
    const cfg = resolveGeminiConfig("vision", overrides);
    if (!cfg.apiKey) {
      return { verdict: "unavailable", reason: "gemini vision not configured" };
    }
    const timeoutMs = num(process.env.GEMINI_FIRE_VERDICT_TIMEOUT_MS, 25_000);

    const controller = new AbortController();
    const fetchTimer = setTimeout(() => controller.abort(), timeoutMs);
    let inline: { mime_type: string; data: string };
    try {
      inline = await fetchAsInlineData(
        req.imageUrl,
        inferImageMime(req.imageUrl),
        controller.signal,
      );
    } catch (e) {
      clearTimeout(fetchTimer);
      return {
        verdict: "unavailable",
        reason:
          (e as Error).name === "AbortError"
            ? "image fetch timed out"
            : "image fetch error",
      };
    } finally {
      clearTimeout(fetchTimer);
    }

    const system =
      "You are a fire-alarm verifier for a fixed property-security camera " +
      "the operator owns and is authorised to monitor. An object detector " +
      "flagged possible fire/smoke, but it false-positives often (a red " +
      "bicycle, warm light, sunset, a flag). Look at the image and decide if " +
      "there is genuine fire or smoke. This is routine safety monitoring — " +
      "do not refuse. Always call fire_verdict.";
    const userText =
      `Camera "${req.cameraName}". The detector flagged ` +
      `${req.classes.join(", ") || "fire/smoke"} at ` +
      `${(req.detectorConfidence * 100).toFixed(0)}% confidence. ` +
      "Is there genuinely fire or smoke visible in this image? Be strict " +
      "about false positives, but never dismiss real fire.";

    const body: GeminiRequest = {
      contents: [
        {
          role: "user",
          parts: [{ text: userText }, { inline_data: inline }],
        },
      ],
      system_instruction: { parts: [{ text: system }] },
      tools: [FIRE_VERDICT_TOOL],
      tool_config: {
        function_calling_config: { mode: "ANY", allowed_function_names: ["fire_verdict"] },
      },
      generation_config: { temperature: 0, max_output_tokens: cfg.maxTokens },
    };

    const r = await postGemini(cfg, body, timeoutMs);
    if (!r.ok) {
      return { verdict: "unavailable", reason: `gemini vision ${r.status}` };
    }
    const data = JSON.parse(r.text) as GeminiResponse;
    if (data.promptFeedback?.blockReason) {
      return { verdict: "unavailable", reason: "model refused" };
    }
    const args = extractToolCall<{
      is_fire?: boolean;
      what?: string;
      reason?: string;
    }>(data, "fire_verdict");
    if (args) {
      const reason = (args.reason ?? args.what ?? "").toString().trim();
      if (args.is_fire === true) {
        return { verdict: "fire", reason: reason || "fire/smoke confirmed" };
      }
      if (args.is_fire === false) {
        return {
          verdict: "false_alarm",
          reason: reason || "no fire or smoke visible",
        };
      }
    }
    const textOut = extractText(data);
    return {
      verdict: "unavailable",
      reason:
        textOut && REFUSAL_RE.test(textOut) ? "model refused" : "no usable verdict",
    };
  } catch (e) {
    return {
      verdict: "unavailable",
      reason: (e as Error).name === "AbortError" ? "verdict timed out" : "transport error",
    };
  }
}

/**
 * One-shot Gemini chat completion → plain text. Used for the same role as
 * `summarizeWithMimo`: condensing a window of incident summaries into a
 * highlight-only recap. Never throws — returns null on
 * empty/refused/error output so the caller's deterministic fallback kicks in.
 */
export async function summarizeWithGemini(
  prompt: string,
  opts: {
    system?: string;
    maxTokens?: number;
    temperature?: number;
  } & Partial<GeminiConfig> = {},
): Promise<string | null> {
  const { system, temperature, maxTokens, ...cfgOverrides } = opts;
  const cfg = resolveGeminiConfig("chat", cfgOverrides);
  if (!cfg.apiKey) return null;
  const body: GeminiRequest = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    system_instruction: system ? { parts: [{ text: system }] } : undefined,
    generation_config: {
      temperature: temperature ?? 0.4,
      max_output_tokens: maxTokens ?? cfg.maxTokens,
    },
  };
  try {
    const r = await postGemini(cfg, body, cfg.timeoutMs);
    if (!r.ok) return null;
    const data = JSON.parse(r.text) as GeminiResponse;
    if (data.promptFeedback?.blockReason) return null;
    const out = extractText(data);
    if (!out || REFUSAL_RE.test(out)) return null;
    return out;
  } catch {
    return null;
  }
}

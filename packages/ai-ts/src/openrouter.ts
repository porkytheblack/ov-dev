/**
 * OpenRouter wiring — one key, every model.
 *
 * Why a dedicated module (rather than just configuring the existing
 * MiMo/OpenAI-compat fetcher):
 *
 *   1. OpenRouter's `video_url` content part matches OpenAI's shape but
 *      Gemini via OpenRouter does NOT accept arbitrary HTTP URLs (AI
 *      Studio gemini-* models only accept YouTube; Vertex gemini-* models
 *      require base64 data URLs). Our clips live in R2/MinIO, so we have
 *      to fetch the bytes and inline as `data:video/mp4;base64,...`.
 *   2. OpenRouter recommends per-app headers (`HTTP-Referer`, `X-Title`)
 *      for moderation, ranking and billing transparency.
 *   3. Model slugs are `provider/model` (e.g. `google/gemini-3.1-flash-lite`,
 *      `moonshotai/kimi-k2`, `minimax/minimax-m1`) — we surface this via
 *      OPENROUTER_VISION_MODEL / OPENROUTER_CHAT_MODEL so the operator can
 *      pin a slug per use case from one key.
 *
 * For the conversational *agent* loop we still go through glove-core's
 * built-in `openrouter` adapter (createAdapter); this module is for the
 * one-shot vision/summary calls that don't need an agent loop.
 */

export type OpenRouterUseCase = "chat" | "vision";

export interface OpenRouterConfig {
  baseURL: string;
  apiKey: string;
  model: string;
  maxTokens: number;
  timeoutMs: number;
  /** Optional moderation / analytics headers. */
  referer?: string;
  title?: string;
}

const DEFAULT_BASE_URL = "https://openrouter.ai/api/v1";
// gemini-3.1-flash-lite is the operator's chosen default vision model:
// $0.25/$1.50 per M tokens, 1M context, native video_url support via
// OpenRouter — the successor to the deprecated 2.5-flash-lite slug.
const DEFAULT_VISION_MODEL = "google/gemini-3.1-flash-lite";
// Sensible default chat model — operator is expected to override per
// experiment (e.g. moonshotai/kimi-k2, minimax/minimax-m1).
const DEFAULT_CHAT_MODEL = "google/gemini-3.1-flash-lite";

function pick(...vals: Array<string | undefined>): string | undefined {
  for (const v of vals) if (v && v.trim() !== "") return v.trim();
  return undefined;
}

function num(v: string | undefined, fallback: number): number {
  const n = Number(v);
  return v !== undefined && v !== "" && !Number.isNaN(n) ? n : fallback;
}

export function resolveOpenRouterConfig(
  useCase: OpenRouterUseCase,
  overrides: Partial<OpenRouterConfig> = {},
): OpenRouterConfig {
  const env = process.env;
  const visionScoped = useCase === "vision";

  const baseURL =
    overrides.baseURL ??
    pick(env.OPENROUTER_BASE_URL) ??
    DEFAULT_BASE_URL;

  const apiKey = overrides.apiKey ?? pick(env.OPENROUTER_API_KEY) ?? "";

  const model =
    overrides.model ??
    pick(
      visionScoped ? env.OPENROUTER_VISION_MODEL : env.OPENROUTER_CHAT_MODEL,
      env.OPENROUTER_MODEL,
    ) ??
    (visionScoped ? DEFAULT_VISION_MODEL : DEFAULT_CHAT_MODEL);

  const maxTokens =
    overrides.maxTokens ??
    num(
      visionScoped ? env.OPENROUTER_VISION_MAX_TOKENS : env.OPENROUTER_CHAT_MAX_TOKENS,
      visionScoped ? 2048 : 2048,
    );

  const timeoutMs = overrides.timeoutMs ?? num(env.OPENROUTER_TIMEOUT_MS, 120_000);

  return {
    baseURL: baseURL.replace(/\/+$/, ""),
    apiKey,
    model,
    maxTokens,
    timeoutMs,
    referer: overrides.referer ?? pick(env.OPENROUTER_HTTP_REFERER),
    title: overrides.title ?? pick(env.OPENROUTER_APP_TITLE) ?? "Overwatch",
  };
}

export function openRouterConfigured(useCase: OpenRouterUseCase = "vision"): boolean {
  return resolveOpenRouterConfig(useCase).apiKey !== "";
}

// ─── Shared types & helpers ────────────────────────────────────────────

export interface VisionImageInput {
  url: string;
}

export interface OpenRouterVisionRequest {
  prompt: string;
  images?: VisionImageInput[];
  videoUrl?: string;
  systemPrompt?: string;
  temperature?: number;
}

const REFUSAL_RE =
  /high risk|rejected|cannot (?:assist|help|comply|provide|fulfil|fulfill)|unable to (?:assist|process|help|comply)|i(?:'|’)?m sorry|as an ai|content (?:policy|moderation)|not able to|i can(?:'|’)?t (?:help|assist)|violat/i;

export class OpenRouterRefusalError extends Error {
  constructor(detail: string) {
    super(`openrouter vision declined: ${detail.slice(0, 200)}`);
    this.name = "OpenRouterRefusalError";
  }
}

type CompatContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } }
  | { type: "video_url"; video_url: { url: string } };

function inferVideoMime(url: string, headerCtype?: string | null): string {
  if (headerCtype && /^video\//i.test(headerCtype)) return headerCtype.split(";")[0]!.trim();
  const m = /\.(mp4|webm|mov|mkv|m4v)(?:$|\?)/i.exec(url);
  return m ? `video/${m[1]!.toLowerCase().replace("mov", "quicktime")}` : "video/mp4";
}

function inferImageMime(url: string, headerCtype?: string | null): string {
  if (headerCtype && /^image\//i.test(headerCtype)) return headerCtype.split(";")[0]!.trim();
  const m = /\.(png|jpe?g|webp|gif)(?:$|\?)/i.exec(url);
  if (!m) return "image/jpeg";
  const ext = m[1]!.toLowerCase();
  return ext === "jpg" ? "image/jpeg" : `image/${ext}`;
}

/** Fetch `url` and return a `data:<mime>;base64,...` URL. Pass-through
 *  for `data:` URIs already in that form. */
async function fetchAsDataUrl(
  url: string,
  kind: "video" | "image",
  signal: AbortSignal,
): Promise<string> {
  if (url.startsWith("data:")) return url;
  const r = await fetch(url, { signal });
  if (!r.ok) throw new Error(`fetch ${url}: HTTP ${r.status}`);
  const ctype = r.headers.get("content-type");
  const buf = Buffer.from(await r.arrayBuffer());
  const mime = kind === "video" ? inferVideoMime(url, ctype) : inferImageMime(url, ctype);
  return `data:${mime};base64,${buf.toString("base64")}`;
}

// ─── Forced-tool schemas (parallel to mimo.ts so a dispatcher caller
//     gets the same structured output regardless of provider) ─────────

const REPORT_TOOL = {
  type: "function" as const,
  function: {
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
};

const FIRE_VERDICT_TOOL = {
  type: "function" as const,
  function: {
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

function authHeaders(cfg: OpenRouterConfig): Record<string, string> {
  const h: Record<string, string> = {
    "content-type": "application/json",
    authorization: `Bearer ${cfg.apiKey}`,
  };
  if (cfg.referer) h["HTTP-Referer"] = cfg.referer;
  if (cfg.title) h["X-Title"] = cfg.title;
  return h;
}

async function postChat(
  cfg: OpenRouterConfig,
  body: Record<string, unknown>,
  timeoutMs: number,
): Promise<{ ok: boolean; status: number; text: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${cfg.baseURL}/chat/completions`, {
      method: "POST",
      headers: authHeaders(cfg),
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    return { ok: res.ok, status: res.status, text: await res.text() };
  } finally {
    clearTimeout(timer);
  }
}

interface CompatChatResponse {
  choices?: Array<{
    finish_reason?: string;
    message?: {
      content?: string;
      reasoning?: string;
      tool_calls?: Array<{ function?: { name?: string; arguments?: string } }>;
    };
  }>;
}

/**
 * Analyse a clip via OpenRouter. Inlines the video as a base64 data URL
 * because OpenRouter→Gemini doesn't accept arbitrary HTTP URLs (AI Studio
 * variants take only YouTube; Vertex variants require base64).
 *
 * Same contract as `analyzeWithMimoVision`: throws on any non-OK / refusal /
 * empty-output condition so the broadcast can mark analysis failed.
 */
export async function analyzeWithOpenRouterVision(
  req: OpenRouterVisionRequest,
  overrides: Partial<OpenRouterConfig> = {},
): Promise<string> {
  const cfg = resolveOpenRouterConfig("vision", overrides);
  if (!cfg.apiKey) throw new Error("OpenRouter vision API key not configured");

  const fetchController = new AbortController();
  const fetchTimer = setTimeout(() => fetchController.abort(), cfg.timeoutMs);
  const content: CompatContentPart[] = [{ type: "text", text: req.prompt }];
  try {
    for (const img of req.images ?? []) {
      const dataUrl = await fetchAsDataUrl(img.url, "image", fetchController.signal);
      content.push({ type: "image_url", image_url: { url: dataUrl } });
    }
    if (req.videoUrl) {
      const dataUrl = await fetchAsDataUrl(req.videoUrl, "video", fetchController.signal);
      content.push({ type: "video_url", video_url: { url: dataUrl } });
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

  const post = async (withTools: boolean, withVideo: boolean) => {
    const useContent = withVideo
      ? content
      : content.filter((p) => p.type !== "video_url");
    return postChat(
      cfg,
      {
        model: cfg.model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: useContent },
        ],
        max_tokens: cfg.maxTokens,
        temperature: req.temperature ?? 0.2,
        ...(withTools
          ? { tools: [REPORT_TOOL], tool_choice: { type: "function", function: { name: "report_scene" } } }
          : {}),
      },
      cfg.timeoutMs,
    );
  };

  // Some OpenRouter→Gemini routes still reject base64 video (e.g. quota,
  // unsupported variant). Fall back stepwise: drop video first, then tools.
  let r = await post(true, true);
  if (!r.ok && /video|unsupported.*type|content type|invalid.*url/i.test(r.text)) {
    r = await post(true, false);
  }
  if (!r.ok && /tool|function|not support|invalid.*tool_choice/i.test(r.text)) {
    r = await post(false, false);
  }
  if (!r.ok) {
    throw new Error(`openrouter vision ${r.status}: ${r.text.slice(0, 400)}`);
  }
  const data = JSON.parse(r.text) as CompatChatResponse;
  const choice = data.choices?.[0];
  const call = choice?.message?.tool_calls?.find(
    (t) => t.function?.name === "report_scene",
  );
  if (call?.function?.arguments) {
    try {
      const summary = composeSummary(JSON.parse(call.function.arguments));
      if (summary) return summary;
    } catch {
      /* fall through */
    }
  }
  const textOut = (choice?.message?.content ?? "").trim();
  if (textOut && REFUSAL_RE.test(textOut)) {
    throw new OpenRouterRefusalError(textOut);
  }
  if (textOut) return textOut;
  throw new Error(
    `openrouter vision produced no usable output (finish=${choice?.finish_reason ?? "?"})`,
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
 * Second-opinion fire/smoke verifier via OpenRouter. Same contract as the
 * MiMo / Gemini versions: NEVER throws — three outcomes (`fire` |
 * `false_alarm` | `unavailable`). The broadcast caller maps `unavailable`
 * to "suppress" per operator policy, so this fails closed for the
 * uncertain band.
 */
export async function classifyFireWithOpenRouter(
  req: FireClassifyRequest,
  overrides: Partial<OpenRouterConfig> = {},
): Promise<FireClassifyResult> {
  try {
    const cfg = resolveOpenRouterConfig("vision", overrides);
    if (!cfg.apiKey) {
      return { verdict: "unavailable", reason: "openrouter vision not configured" };
    }
    const timeoutMs = num(process.env.OPENROUTER_FIRE_VERDICT_TIMEOUT_MS, 25_000);

    const fetchController = new AbortController();
    const fetchTimer = setTimeout(() => fetchController.abort(), timeoutMs);
    let dataUrl: string;
    try {
      dataUrl = await fetchAsDataUrl(req.imageUrl, "image", fetchController.signal);
    } catch (e) {
      clearTimeout(fetchTimer);
      return {
        verdict: "unavailable",
        reason:
          (e as Error).name === "AbortError" ? "image fetch timed out" : "image fetch error",
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
    const content: CompatContentPart[] = [
      { type: "text", text: userText },
      { type: "image_url", image_url: { url: dataUrl } },
    ];

    const post = async (withTools: boolean) =>
      postChat(
        cfg,
        {
          model: cfg.model,
          messages: [
            { role: "system", content: system },
            { role: "user", content },
          ],
          max_tokens: cfg.maxTokens,
          temperature: 0,
          ...(withTools
            ? {
                tools: [FIRE_VERDICT_TOOL],
                tool_choice: { type: "function", function: { name: "fire_verdict" } },
              }
            : {}),
        },
        timeoutMs,
      );

    let r = await post(true);
    if (!r.ok && /tool|function|not support|invalid.*tool_choice/i.test(r.text)) {
      r = await post(false);
    }
    if (!r.ok) {
      return { verdict: "unavailable", reason: `openrouter vision ${r.status}` };
    }
    const data = JSON.parse(r.text) as CompatChatResponse;
    const msg = data.choices?.[0]?.message;
    const call = msg?.tool_calls?.find((t) => t.function?.name === "fire_verdict");
    if (call?.function?.arguments) {
      try {
        const args = JSON.parse(call.function.arguments) as {
          is_fire?: boolean;
          what?: string;
          reason?: string;
        };
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
      } catch {
        /* fall through */
      }
    }
    const textOut = (msg?.content ?? "").trim();
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
 * One-shot OpenRouter chat completion → plain text. Used for window
 * recaps. Never throws — returns null on empty/refused/error so the
 * caller's deterministic fallback kicks in.
 */
export async function summarizeWithOpenRouter(
  prompt: string,
  opts: {
    system?: string;
    maxTokens?: number;
    temperature?: number;
  } & Partial<OpenRouterConfig> = {},
): Promise<string | null> {
  const { system, temperature, maxTokens, ...cfgOverrides } = opts;
  // Window recaps follow the *chat* model — that's what's been picked for
  // text-only work (e.g. moonshotai/kimi-k2). Vision routing is per-call.
  const cfg = resolveOpenRouterConfig("chat", cfgOverrides);
  if (!cfg.apiKey) return null;
  try {
    const r = await postChat(
      cfg,
      {
        model: cfg.model,
        messages: [
          ...(system ? [{ role: "system" as const, content: system }] : []),
          { role: "user" as const, content: prompt },
        ],
        max_tokens: maxTokens ?? cfg.maxTokens,
        temperature: temperature ?? 0.4,
      },
      cfg.timeoutMs,
    );
    if (!r.ok) return null;
    const data = JSON.parse(r.text) as CompatChatResponse;
    const out = (data.choices?.[0]?.message?.content ?? "").trim();
    if (!out || REFUSAL_RE.test(out)) return null;
    return out;
  } catch {
    return null;
  }
}

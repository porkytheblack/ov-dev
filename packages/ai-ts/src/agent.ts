/**
 * Agent chat provider dispatcher. Returns a Glove `ModelAdapter` for the
 * provider selected via `AGENT_PROVIDER` — so the operator can A/B between
 * Xiaomi MiMo, Moonshot Kimi, MiniMax, and Google Gemini without touching
 * code, just by flipping one env and restarting ov-agent.
 *
 *   AGENT_PROVIDER=mimo        → Xiaomi MiMo  (default, legacy)
 *   AGENT_PROVIDER=kimi        → Moonshot Kimi   (MOONSHOT_API_KEY)
 *   AGENT_PROVIDER=minimax     → MiniMax         (MINIMAX_API_KEY)
 *   AGENT_PROVIDER=gemini      → Google Gemini   (GEMINI_API_KEY)
 *   AGENT_PROVIDER=openrouter  → OpenRouter (any model via OPENROUTER_API_KEY,
 *                                slug from OPENROUTER_CHAT_MODEL / OPENROUTER_MODEL)
 *
 * `createAdapter` from glove-core knows about all four providers natively —
 * we just resolve the right env vars (model override, timeout) and delegate.
 * MiMo stays on its dedicated adapter for reasoning_content handling; the
 * other three use the OpenAI-compat path under the hood, which is what
 * those gateways speak.
 */
import { createAdapter } from "glove-core/models/providers";
import type { ModelAdapter } from "glove-core";
import { makeMimoChatModel, mimoConfigured } from "./mimo.js";

export type AgentProvider = "mimo" | "kimi" | "minimax" | "gemini" | "openrouter";

const DEFAULT_PROVIDER: AgentProvider = "mimo";

export function agentProvider(): AgentProvider {
  const raw = (process.env.AGENT_PROVIDER ?? "").trim().toLowerCase();
  if (
    raw === "mimo" ||
    raw === "kimi" ||
    raw === "minimax" ||
    raw === "gemini" ||
    raw === "openrouter"
  ) {
    return raw;
  }
  return DEFAULT_PROVIDER;
}

function num(v: string | undefined, fallback: number): number {
  const n = Number(v);
  return v !== undefined && v !== "" && !Number.isNaN(n) ? n : fallback;
}

/** Is the currently-selected agent provider's API key present? Used by
 *  the /health endpoint and the /chat 503 short-circuit. */
export function agentChatConfigured(): boolean {
  const p = agentProvider();
  switch (p) {
    case "mimo":
      return mimoConfigured("chat");
    case "kimi":
      return Boolean(process.env.MOONSHOT_API_KEY?.trim());
    case "minimax":
      return Boolean(process.env.MINIMAX_API_KEY?.trim());
    case "gemini":
      return Boolean(process.env.GEMINI_API_KEY?.trim());
    case "openrouter":
      return Boolean(process.env.OPENROUTER_API_KEY?.trim());
  }
}

/**
 * Build a Glove `ModelAdapter` for whichever provider the operator has
 * selected. The result is a drop-in for `new Glove({ model })`.
 *
 * MiMo stays on its dedicated adapter (reasoning_content + adaptive
 * thinking budget); the others go through `createAdapter`, which picks
 * the OpenAI-compat transport with the right base URL and env var.
 */
export function makeAgentChatModel(): ModelAdapter {
  const p = agentProvider();
  if (p === "mimo") return makeMimoChatModel();

  const timeoutMs = num(process.env.AGENT_TIMEOUT_MS, 120_000);
  if (p === "kimi") {
    const model = process.env.KIMI_MODEL?.trim() || undefined;
    return createAdapter({
      provider: "kimi",
      apiKey: process.env.MOONSHOT_API_KEY,
      ...(model ? { model } : {}),
      maxTokens: num(process.env.KIMI_MAX_TOKENS, 2048),
      timeout: timeoutMs,
      stream: false,
    });
  }
  if (p === "minimax") {
    const model = process.env.MINIMAX_MODEL?.trim() || undefined;
    return createAdapter({
      provider: "minimax",
      apiKey: process.env.MINIMAX_API_KEY,
      ...(model ? { model } : {}),
      maxTokens: num(process.env.MINIMAX_MAX_TOKENS, 2048),
      timeout: timeoutMs,
      stream: false,
    });
  }
  if (p === "openrouter") {
    // OpenRouter is OpenAI-compatible; glove-core's `openrouter` provider
    // handles auth + base URL. Slug picked via OPENROUTER_CHAT_MODEL (or
    // OPENROUTER_MODEL as a fallback shared with the vision side).
    const model =
      process.env.OPENROUTER_CHAT_MODEL?.trim() ||
      process.env.OPENROUTER_MODEL?.trim() ||
      undefined;
    return createAdapter({
      provider: "openrouter",
      apiKey: process.env.OPENROUTER_API_KEY,
      ...(model ? { model } : {}),
      maxTokens: num(process.env.OPENROUTER_CHAT_MAX_TOKENS, 2048),
      timeout: timeoutMs,
      stream: false,
    });
  }
  // gemini
  const model = process.env.GEMINI_CHAT_MODEL?.trim() || process.env.GEMINI_MODEL?.trim() || undefined;
  return createAdapter({
    provider: "gemini",
    apiKey: process.env.GEMINI_API_KEY,
    ...(model ? { model } : {}),
    maxTokens: num(process.env.GEMINI_CHAT_MAX_TOKENS, 2048),
    timeout: timeoutMs,
    stream: false,
  });
}

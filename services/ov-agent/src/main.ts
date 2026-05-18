/**
 * Overwatch conversational agent — a Glove runtime exposed over HTTP.
 *
 *   POST /chat   { channel, handle, message, message_id? } → { response }
 *   GET  /health
 *
 * Each inbound message builds a Glove instance bound to a Postgres-backed
 * conversation store keyed by (channel, handle), so WhatsApp / Telegram
 * users keep context. The model is the configurable Mimo chat model
 * (`@overwatch/ai`) — drop a base URL + key + model name in `.env`.
 *
 * The bot services proxy here unchanged; only the engine behind /chat
 * moved from a hand-rolled Anthropic loop to the Glove agent loop.
 */
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { Glove, type Message, type ModelPromptResult } from "glove-core";
import { Displaymanager } from "glove-core/display-manager";
import { makeMimoChatModel, mimoConfigured } from "@overwatch/ai";
import { makeLogger, makeRedis } from "@overwatch/shared-ts";
import postgres from "postgres";
import { PgConversationStore } from "./glove-store.js";
import { buildToolset, OV_TIMEZONE, tzNow } from "./tools.js";
import { zodToJsonSchema } from "./zod-json.js";

const log = makeLogger("ov-agent");

const sql = postgres(
  process.env.DATABASE_URL ?? "postgres://overwatch:overwatch@postgres:5432/overwatch",
  { max: 4 },
);
const redis = makeRedis();
const DASHBOARD_BASE_URL = process.env.DASHBOARD_BASE_URL ?? "http://localhost:9090";
const INTERNAL_API_URL = process.env.INTERNAL_API_URL ?? "http://ov-api:3001";

function systemPrompt(channel: string): string {
  return [
    "You are the Overwatch agent for a self-hosted multi-camera AI surveillance system.",
    "You answer questions about cameras, incidents, and compound status concisely and factually.",
    "Use the provided tools to look up data — never invent incident details, camera names, or timestamps.",
    `The operator's timezone is ${OV_TIMEZONE}. The current local time is ${tzNow().local} (${OV_TIMEZONE}).`,
    `Always reason about and report times in ${OV_TIMEZONE}. Resolve relative references ("last hour", "today", "this morning") in that timezone; call get_current_time if unsure.`,
    `The user is reaching you via ${channel}.`,
    channel === "telegram" || channel === "whatsapp"
      ? "When the user asks to see/send a clip or video, you MUST call send_incident_clips every time — never claim a clip was sent without calling it this turn, even if you sent one earlier (the user may not have received it). Only say it was sent after the tool returns sent>=1."
      : "",
    "Keep responses tight — under 1000 characters when possible. Plain text only, no Markdown.",
  ].filter(Boolean).join(" ");
}

const COMPACTION_INSTRUCTIONS =
  "Summarize the prior conversation about cameras, incidents, and compound " +
  "status. Preserve incident IDs, camera names, ROI names, timestamps, and " +
  "any acknowledgements the operator made.";

function extractResponse(result: Message | ModelPromptResult): string {
  if ("sender" in result) {
    return result.text?.trim() || "(no response)";
  }
  const agentMsg = [...result.messages]
    .reverse()
    .find((m) => m.sender === "agent" && (m.text ?? "").trim() !== "");
  return agentMsg?.text?.trim() || "(no response)";
}

async function chat(channel: string, handle: string, message: string): Promise<string> {
  const store = new PgConversationStore(sql, channel, handle);
  const tools = buildToolset({
    sql,
    channel,
    handle,
    redis,
    dashboardBaseUrl: DASHBOARD_BASE_URL,
    internalApiUrl: INTERNAL_API_URL,
  });
  const glove = new Glove({
    store,
    model: makeMimoChatModel(),
    displayManager: new Displaymanager(),
    systemPrompt: systemPrompt(channel),
    serverMode: true,
    compaction_config: {
      compaction_instructions: COMPACTION_INSTRUCTIONS,
      max_turns: 12,
    },
  });

  for (const tool of tools) {
    // Fold with raw JSON Schema (version-independent): glove-core ships
    // zod v4 while our tools use zod v3. We re-validate with the tool's own
    // v3 schema inside the handler so coercion (uuid, enum, defaults) holds.
    glove.fold({
      name: tool.name,
      description: tool.description,
      jsonSchema: zodToJsonSchema(tool.inputSchema),
      async do(input: unknown) {
        const parsed = tool.inputSchema.parse(input ?? {});
        return tool.do(parsed);
      },
    });
  }

  const runnable = glove.build(store);
  const result = await runnable.processRequest(message);
  return extractResponse(result);
}

const app = new Hono();

app.get("/health", (c) =>
  c.json({ ok: true, service: "ov-agent", model_configured: mimoConfigured("chat") }),
);

app.post("/chat", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as {
    channel?: string;
    handle?: string;
    message?: string;
  };
  if (!body.channel || !body.handle || !body.message) {
    return c.json({ error: "channel, handle, message required" }, 400);
  }
  if (!mimoConfigured("chat")) {
    return c.json(
      { error: "mimo not configured", response: "The agent isn't configured yet (missing MIMO_API_KEY)." },
      503,
    );
  }
  try {
    const response = await chat(body.channel, body.handle, body.message);
    return c.json({ response });
  } catch (e) {
    log.error({ err: e }, "chat failed");
    return c.json(
      { error: (e as Error).message, response: "Sorry, I couldn't process that." },
      500,
    );
  }
});

/**
 * Wipe a conversation so the next message starts a fresh Glove session.
 * Used by the messenger "/reset" command. Idempotent — clearing a
 * non-existent conversation is a no-op success.
 */
app.post("/reset", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as {
    channel?: string;
    handle?: string;
  };
  if (!body.channel || !body.handle) {
    return c.json({ error: "channel, handle required" }, 400);
  }
  try {
    await new PgConversationStore(sql, body.channel, body.handle).clear();
    log.info({ channel: body.channel, handle: body.handle }, "conversation reset");
    return c.json({ ok: true });
  } catch (e) {
    log.error({ err: e }, "reset failed");
    return c.json({ error: (e as Error).message }, 500);
  }
});

/**
 * Self-provision the conversation store so the agent works regardless of
 * whether the Postgres volume predates the Glove counter columns (the
 * init.sql migration only runs on fresh init / `make migrate`).
 */
async function ensureSchema(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS agent_conversations (
      id UUID PRIMARY KEY,
      channel TEXT NOT NULL,
      handle TEXT NOT NULL,
      messages JSONB NOT NULL DEFAULT '[]'::jsonb,
      last_active TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (channel, handle)
    )
  `;
  await sql`ALTER TABLE agent_conversations ADD COLUMN IF NOT EXISTS tokens_in BIGINT NOT NULL DEFAULT 0`;
  await sql`ALTER TABLE agent_conversations ADD COLUMN IF NOT EXISTS tokens_out BIGINT NOT NULL DEFAULT 0`;
  await sql`ALTER TABLE agent_conversations ADD COLUMN IF NOT EXISTS turns INT NOT NULL DEFAULT 0`;
  await sql`
    CREATE TABLE IF NOT EXISTS agent_inbox (
      id          TEXT PRIMARY KEY,
      channel     TEXT NOT NULL,
      handle      TEXT NOT NULL,
      tag         TEXT NOT NULL,
      request     TEXT NOT NULL,
      response    TEXT,
      status      TEXT NOT NULL DEFAULT 'pending',
      blocking    BOOLEAN NOT NULL DEFAULT false,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      resolved_at TIMESTAMPTZ
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_agent_inbox_scope
      ON agent_inbox (channel, handle, status)
  `;
}

const port = Number(process.env.AGENT_PORT ?? 3000);
ensureSchema()
  .then(() =>
    serve({ fetch: app.fetch, port }, () =>
      log.info({ port }, "ov-agent ready (Glove + Mimo)"),
    ),
  )
  .catch((e) => {
    log.error({ err: e }, "schema init failed");
    process.exit(1);
  });

/**
 * Conversational agent over HTTP. Exposes:
 *   POST /chat   { channel, handle, message, message_id? } → { response }
 *   GET  /health
 *
 * Uses Anthropic's Messages API directly with tool calling. We keep
 * the Glove-style tool registry separately (`./tools.ts`) so the same
 * surface could be lifted into a Glove runtime without rewriting handlers.
 */
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { makeLogger } from "@overwatch/shared-ts";
import postgres from "postgres";
import { ConversationStore, type StoredMessage } from "./store.js";
import { buildToolset } from "./tools.js";
import { zodToJsonSchema } from "./zod-json.js";

const log = makeLogger("ov-agent");
const MODEL = process.env.MODEL ?? "claude-sonnet-4-5";
const API_KEY = process.env.ANTHROPIC_API_KEY ?? "";
const MAX_TOOL_TURNS = 6;

const sql = postgres(
  process.env.DATABASE_URL ?? "postgres://overwatch:overwatch@postgres:5432/overwatch",
  { max: 4 },
);
const tools = buildToolset({ sql });
const toolByName = new Map(tools.map((t) => [t.name, t]));
const store = new ConversationStore(sql);

function systemPrompt(channel: string): string {
  return [
    "You are the Overwatch agent for a self-hosted multi-camera AI surveillance system.",
    "You answer questions about cameras, incidents, and compound status concisely and factually.",
    "Use tools to look up data — never make up incident details.",
    `Time references like "last hour" or "today" should be resolved against the current time: ${new Date().toISOString()}.`,
    `The user is reaching you via ${channel}.`,
    "Keep responses tight — under 1000 characters when possible. Use plain text, not Markdown formatting.",
  ].join(" ");
}

type AnthropicContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: unknown }
  | { type: "tool_result"; tool_use_id: string; content: string };

type AnthropicMessage = {
  role: "user" | "assistant";
  content: string | AnthropicContentBlock[];
};

function toolDefinitions() {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: zodToJsonSchema(t.inputSchema),
  }));
}

async function callAnthropic(messages: AnthropicMessage[], channel: string) {
  if (!API_KEY) throw new Error("ANTHROPIC_API_KEY missing");
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      system: systemPrompt(channel),
      tools: toolDefinitions(),
      messages,
    }),
  });
  if (!r.ok) {
    const body = await r.text();
    throw new Error(`anthropic ${r.status}: ${body}`);
  }
  return (await r.json()) as {
    id: string;
    role: "assistant";
    stop_reason: string;
    content: AnthropicContentBlock[];
  };
}

function storedToAnthropic(stored: StoredMessage[]): AnthropicMessage[] {
  // Each stored message has role + content; tool blocks are flattened into text for safety
  // when the model can't see prior tool_use/tool_result pairs. We keep this lossy on purpose.
  return stored.map((m) => ({
    role: m.role === "assistant" ? "assistant" : "user",
    content: m.role === "tool" ? `[tool ${m.name}: ${m.content}]` : m.content,
  }));
}

async function chat(channel: string, handle: string, message: string): Promise<string> {
  const prior = await store.load(channel, handle);
  const messages: AnthropicMessage[] = [
    ...storedToAnthropic(prior),
    { role: "user", content: message },
  ];

  let finalText = "";
  const additions: StoredMessage[] = [
    { role: "user", content: message, ts: new Date().toISOString() },
  ];

  for (let turn = 0; turn < MAX_TOOL_TURNS; turn++) {
    const reply = await callAnthropic(messages, channel);
    const assistantBlocks: AnthropicContentBlock[] = reply.content;
    messages.push({ role: "assistant", content: assistantBlocks });
    const textParts: string[] = [];
    const toolResults: AnthropicContentBlock[] = [];
    let calledTool = false;
    for (const block of assistantBlocks) {
      if (block.type === "text") textParts.push(block.text);
      else if (block.type === "tool_use") {
        calledTool = true;
        const tool = toolByName.get(block.name);
        if (!tool) {
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: JSON.stringify({ error: `unknown tool ${block.name}` }),
          });
          continue;
        }
        try {
          const parsed = tool.inputSchema.parse(block.input ?? {});
          const out = await tool.do(parsed);
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: typeof out.data === "string" ? out.data : JSON.stringify(out.data),
          });
          additions.push({
            role: "tool",
            name: block.name,
            tool_call_id: block.id,
            content: JSON.stringify(out.data ?? {}),
            ts: new Date().toISOString(),
          });
        } catch (e) {
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: JSON.stringify({ error: (e as Error).message }),
          });
        }
      }
    }
    finalText = textParts.join("\n").trim();
    if (!calledTool || reply.stop_reason === "end_turn") {
      if (finalText) additions.push({ role: "assistant", content: finalText, ts: new Date().toISOString() });
      break;
    }
    messages.push({ role: "user", content: toolResults });
  }

  await store.append(channel, handle, additions);
  return finalText || "(no response)";
}

const app = new Hono();

app.get("/health", (c) => c.json({ ok: true, service: "ov-agent" }));

app.post("/chat", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as {
    channel?: string;
    handle?: string;
    message?: string;
  };
  if (!body.channel || !body.handle || !body.message) {
    return c.json({ error: "channel, handle, message required" }, 400);
  }
  try {
    const response = await chat(body.channel, body.handle, body.message);
    return c.json({ response });
  } catch (e) {
    log.error({ err: e }, "chat failed");
    return c.json({ error: (e as Error).message, response: "Sorry, I couldn't process that." }, 500);
  }
});

const port = Number(process.env.AGENT_PORT ?? 3000);
serve({ fetch: app.fetch, port }, () => log.info({ port, model: MODEL }, "ov-agent ready"));

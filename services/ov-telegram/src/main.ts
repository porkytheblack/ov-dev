import { createServer } from "node:http";
import { BotOutboxMessage, CONSUMER_GROUP, STREAMS } from "@overwatch/schemas/events";
import { createGroupConsumer, makeLogger, makeRedis } from "@overwatch/shared-ts";
import postgres from "postgres";

const log = makeLogger("ov-telegram");
const TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";
const AGENT_URL = process.env.AGENT_URL ?? "http://ov-agent:3000";
const API = TOKEN ? `https://api.telegram.org/bot${TOKEN}` : "";

let offset = 0;

async function telegramApi<T = unknown>(method: string, payload?: Record<string, unknown>): Promise<T | null> {
  if (!API) return null;
  try {
    const res = await fetch(`${API}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload ?? {}),
    });
    if (!res.ok) {
      log.warn({ method, status: res.status }, "telegram api failed");
      return null;
    }
    const data = (await res.json()) as { ok: boolean; result?: T };
    return data.result ?? null;
  } catch (e) {
    log.warn({ err: e }, "telegram unreachable");
    return null;
  }
}

async function sendMessage(handle: string, text: string, opts?: { incidentId?: string }) {
  const replyMarkup = opts?.incidentId
    ? {
        inline_keyboard: [
          [
            { text: "View playback", url: deepLinkFromText(text) ?? "" },
            { text: "Acknowledge", callback_data: `ack:${opts.incidentId}` },
          ],
        ],
      }
    : undefined;
  await telegramApi("sendMessage", {
    chat_id: handle,
    text,
    disable_web_page_preview: false,
    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
  });
}

function deepLinkFromText(text: string): string | null {
  const m = text.match(/Playback → (https?:[^\s]+)/);
  return m ? m[1]! : null;
}

async function relayToAgent(handle: string, message: string, messageId: string) {
  try {
    const r = await fetch(`${AGENT_URL}/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ channel: "telegram", handle, message, message_id: messageId }),
    });
    if (!r.ok) return null;
    const data = (await r.json()) as { response?: string };
    return data.response ?? null;
  } catch {
    return null;
  }
}

async function pollUpdates(sql: ReturnType<typeof postgres>) {
  if (!API) {
    log.warn("TELEGRAM_BOT_TOKEN missing; polling disabled");
    return;
  }
  while (true) {
    try {
      const updates = await telegramApi<any[]>("getUpdates", {
        offset,
        timeout: 25,
        allowed_updates: ["message", "callback_query"],
      });
      if (!updates) {
        await new Promise((r) => setTimeout(r, 1000));
        continue;
      }
      for (const u of updates) {
        offset = Math.max(offset, u.update_id + 1);
        if (u.message?.text) {
          const handle = String(u.message.chat.id);
          const reply = await relayToAgent(handle, u.message.text, String(u.message.message_id));
          if (reply) await sendMessage(handle, reply);
        }
        if (u.callback_query?.data?.startsWith("ack:")) {
          const incidentId = u.callback_query.data.slice(4);
          const handle = String(u.callback_query.from.id);
          try {
            await sql`
              UPDATE incidents SET status = 'acknowledged',
                                   acknowledged_at = now()
              WHERE id = ${incidentId}::uuid
            `;
            await telegramApi("answerCallbackQuery", {
              callback_query_id: u.callback_query.id,
              text: "Acknowledged",
            });
            await sendMessage(handle, `Incident ${incidentId} acknowledged.`);
          } catch (e) {
            log.warn({ err: e }, "ack failed");
          }
        }
      }
    } catch (e) {
      log.warn({ err: e }, "poll error");
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

async function main() {
  const redis = makeRedis();
  const sql = postgres(
    process.env.DATABASE_URL ?? "postgres://overwatch:overwatch@postgres:5432/overwatch",
    { max: 2 },
  );

  const outbox = createGroupConsumer({
    redis,
    stream: STREAMS.bot_outbox("telegram"),
    group: CONSUMER_GROUP("ov-telegram"),
    consumer: `telegram-${process.env.HOSTNAME ?? "local"}`,
    schema: BotOutboxMessage,
  });
  void outbox.consume(async (event) => {
    if (event.channel !== "telegram") return;
    await sendMessage(event.handle, event.text, { incidentId: event.incident_id });
  });

  void pollUpdates(sql);

  const server = createServer((req, res) => {
    if (req.url === "/health") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true, service: "ov-telegram" }));
      return;
    }
    res.writeHead(404);
    res.end();
  });
  server.listen(8003, () => log.info({ port: 8003 }, "ov-telegram ready"));

  process.on("SIGINT", () => process.exit(0));
  process.on("SIGTERM", () => process.exit(0));
}

main().catch((e) => {
  log.error({ err: e }, "fatal");
  process.exit(1);
});

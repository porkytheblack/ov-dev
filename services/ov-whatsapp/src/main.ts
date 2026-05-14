import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { BotOutboxMessage, CONSUMER_GROUP, STREAMS } from "@overwatch/schemas/events";
import { createGroupConsumer, makeLogger, makeRedis } from "@overwatch/shared-ts";

const log = makeLogger("ov-whatsapp");
const PHONE_ID = process.env.WHATSAPP_PHONE_NUMBER_ID ?? "";
const TOKEN = process.env.WHATSAPP_ACCESS_TOKEN ?? "";
const VERIFY = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN ?? "overwatch-verify";
const AGENT_URL = process.env.AGENT_URL ?? "http://ov-agent:3000";

async function sendWhatsApp(handle: string, text: string, link?: string) {
  if (!PHONE_ID || !TOKEN) {
    log.warn({ handle }, "WhatsApp credentials missing; dropping outbound");
    return;
  }
  const body = link
    ? {
        messaging_product: "whatsapp",
        to: handle,
        type: "text",
        text: { preview_url: true, body: text },
      }
    : {
        messaging_product: "whatsapp",
        to: handle,
        type: "text",
        text: { body: text },
      };
  const res = await fetch(
    `https://graph.facebook.com/v20.0/${PHONE_ID}/messages`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${TOKEN}`,
      },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) log.warn({ status: res.status, body: await res.text() }, "send failed");
}

async function relayToAgent(handle: string, message: string, messageId: string) {
  try {
    const r = await fetch(`${AGENT_URL}/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ channel: "whatsapp", handle, message, message_id: messageId }),
    });
    if (!r.ok) {
      log.warn({ status: r.status }, "agent reply failed");
      return null;
    }
    const data = (await r.json()) as { response?: string };
    return data.response ?? null;
  } catch (e) {
    log.warn({ err: e }, "agent unreachable");
    return null;
  }
}

const app = new Hono();

app.get("/webhook", (c) => {
  const mode = c.req.query("hub.mode");
  const token = c.req.query("hub.verify_token");
  const challenge = c.req.query("hub.challenge");
  if (mode === "subscribe" && token === VERIFY && challenge) {
    return c.text(challenge);
  }
  return c.text("forbidden", 403);
});

app.post("/webhook", async (c) => {
  const body = (await c.req.json()) as any;
  try {
    const entries = body.entry ?? [];
    for (const e of entries) {
      for (const change of e.changes ?? []) {
        const msgs = change.value?.messages ?? [];
        for (const m of msgs) {
          const handle = m.from;
          const messageId = m.id;
          const text = m.text?.body ?? "";
          if (!text) continue;
          const reply = await relayToAgent(handle, text, messageId);
          if (reply) await sendWhatsApp(handle, reply);
        }
      }
    }
  } catch (e) {
    log.error({ err: e }, "webhook handling failed");
  }
  return c.json({ ok: true });
});

app.get("/health", (c) => c.json({ ok: true, service: "ov-whatsapp" }));

const redis = makeRedis();
const outbox = createGroupConsumer({
  redis,
  stream: STREAMS.bot_outbox("whatsapp"),
  group: CONSUMER_GROUP("ov-whatsapp"),
  consumer: `whatsapp-${process.env.HOSTNAME ?? "local"}`,
  schema: BotOutboxMessage,
});
void outbox.consume(async (event) => {
  if (event.channel !== "whatsapp") return;
  const link = event.attachments?.find((a) => a.kind === "link" || a.kind === "video")?.url;
  await sendWhatsApp(event.handle, event.text, link);
});

const port = Number(process.env.PORT ?? 3010);
serve({ fetch: app.fetch, port }, () => log.info({ port }, "ov-whatsapp ready"));

/**
 * WhatsApp Cloud API adapter — feature parity with ov-telegram, within the
 * platform's limits.
 *
 * Inbound  : Meta webhook (GET verify + POST messages) at /webhook/whatsapp
 *            (Caddy proxies /webhook/whatsapp* → here, prefix NOT stripped,
 *            so the routes are registered at that exact path).
 * Auth     : phone-number based — a `subscribers` row (channel='whatsapp',
 *            handle = the sender's wa_id) must exist & be enabled, mirroring
 *            Telegram's chat-id gate. Unauthorized senders get onboarding.
 * Commands : /reset · /clear · /newchat (+ "new chat", "start over") wipe the
 *            agent conversation; /id · /start · /myid show status.
 * Clips    : fetched from ov-api over the docker network, transcoded to
 *            H.264 (Meta can't reach internal URLs and can't play mpeg4),
 *            uploaded to /media, sent by id — same pipeline as Telegram.
 * Actions  : incident Acknowledge/Suppress/Close as interactive reply
 *            buttons; the tap returns via the webhook and runs the same SQL.
 *
 * Platform gaps vs Telegram (documented, not bugs):
 *  - No API to delete a business-sent message → on resolve we send a short
 *    confirmation instead of removing the alert.
 *  - One CTA-URL button per interactive message (no multi-URL keyboard) →
 *    multiple recap/calendar links are rendered as a tappable text list.
 *  - The "typing…" indicator is one-shot (~25s), not refreshable.
 *  - Free-form outbound only delivers inside the 24h customer-service
 *    window; proactive alerts/recaps outside it need approved templates
 *    (configure these in Meta Business Manager — out of scope here).
 */
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import type { Context } from "hono";
import { BotOutboxMessage, CONSUMER_GROUP, STREAMS } from "@overwatch/schemas/events";
import { createGroupConsumer, makeLogger, makeRedis } from "@overwatch/shared-ts";
import postgres from "postgres";

const log = makeLogger("ov-whatsapp");
const PHONE_ID = process.env.WHATSAPP_PHONE_NUMBER_ID ?? "";
const TOKEN = process.env.WHATSAPP_ACCESS_TOKEN ?? "";
const VERIFY = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN ?? "overwatch-verify";
const AGENT_URL = (process.env.AGENT_URL ?? "http://ov-agent:3000").replace(/\/+$/, "");
const INTERNAL_API_URL = (
  process.env.INTERNAL_API_URL ?? "http://ov-api:3001"
).replace(/\/+$/, "");
const GRAPH = `https://graph.facebook.com/v20.0/${PHONE_ID}`;
const MAX_WA_VIDEO_BYTES = 16 * 1024 * 1024; // WhatsApp inbound media cap
const TRANSCODE_TIMEOUT_MS = 90_000;

const sql = postgres(
  process.env.DATABASE_URL ?? "postgres://overwatch:overwatch@postgres:5432/overwatch",
  { max: 2 },
);

const configured = () => PHONE_ID !== "" && TOKEN !== "";
// Mask phone numbers in logs (keep last 4 for correlation).
const mask = (h: string) =>
  h && h.length > 4 ? `${"*".repeat(h.length - 4)}${h.slice(-4)}` : "****";

// ── Cloud API primitives ────────────────────────────────────────────────
async function waSend(payload: Record<string, unknown>): Promise<boolean> {
  if (!configured()) {
    log.warn("WhatsApp credentials missing; dropping outbound");
    return false;
  }
  try {
    const res = await fetch(`${GRAPH}/messages`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${TOKEN}`,
      },
      body: JSON.stringify({ messaging_product: "whatsapp", ...payload }),
    });
    if (!res.ok) {
      // 131030 = recipient not on the test-number allow-list; 131047/131051
      // ≈ outside the 24h window → would need an approved template.
      log.warn(
        { status: res.status, body: (await res.text()).slice(0, 300) },
        "wa send failed",
      );
      return false;
    }
    log.info({ type: payload.type }, "wa sent");
    return true;
  } catch (e) {
    log.warn({ err: e }, "wa unreachable");
    return false;
  }
}

const sendText = (to: string, body: string) =>
  waSend({ to, type: "text", text: { preview_url: true, body: body.slice(0, 4096) } });

/** Up to 3 interactive reply buttons (title ≤ 20 chars, id ≤ 256). */
const sendReplyButtons = (
  to: string,
  body: string,
  buttons: Array<{ id: string; title: string }>,
) =>
  waSend({
    to,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: body.slice(0, 1024) },
      action: {
        buttons: buttons.slice(0, 3).map((b) => ({
          type: "reply",
          reply: { id: b.id.slice(0, 256), title: b.title.slice(0, 20) },
        })),
      },
    },
  });

/** Single call-to-action URL button. */
const sendCtaUrl = (to: string, body: string, displayText: string, url: string) =>
  waSend({
    to,
    type: "interactive",
    interactive: {
      type: "cta_url",
      body: { text: body.slice(0, 1024) },
      action: {
        name: "cta_url",
        parameters: { display_text: displayText.slice(0, 20) || "Open", url },
      },
    },
  });

/** Read receipt + (best-effort, one-shot) typing indicator. */
async function markReadTyping(messageId: string): Promise<void> {
  if (!configured() || !messageId) return;
  try {
    await fetch(`${GRAPH}/messages`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${TOKEN}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        status: "read",
        message_id: messageId,
        typing_indicator: { type: "text" },
      }),
    });
  } catch {
    /* best-effort */
  }
}

// ── Clip pipeline (mirror of ov-telegram) ───────────────────────────────
async function transcodeToH264(input: Buffer): Promise<Buffer | null> {
  let dir: string | undefined;
  try {
    dir = await mkdtemp(join(tmpdir(), "ovclip-"));
    const inPath = join(dir, "in.mp4");
    const outPath = join(dir, `${randomUUID()}.mp4`);
    await writeFile(inPath, input);
    const code = await new Promise<number | null>((resolve) => {
      const ff = spawn(
        "ffmpeg",
        [
          "-y",
          "-loglevel", "error",
          "-i", inPath,
          "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2",
          "-c:v", "libx264",
          "-preset", "veryfast",
          "-pix_fmt", "yuv420p",
          "-c:a", "aac",
          "-b:a", "96k",
          "-movflags", "+faststart",
          outPath,
        ],
        { stdio: ["ignore", "ignore", "pipe"] },
      );
      let stderr = "";
      ff.stderr?.on("data", (d) => {
        stderr += String(d);
      });
      const timer = setTimeout(() => ff.kill("SIGKILL"), TRANSCODE_TIMEOUT_MS);
      ff.on("error", (e) => {
        clearTimeout(timer);
        log.warn({ err: e.message }, "ffmpeg spawn failed");
        resolve(null);
      });
      ff.on("close", (c) => {
        clearTimeout(timer);
        if (c !== 0)
          log.warn({ code: c, stderr: stderr.slice(-300) }, "ffmpeg transcode failed");
        resolve(c);
      });
    });
    if (code !== 0) return null;
    const out = await readFile(outPath);
    return out.byteLength > 0 ? out : null;
  } catch (e) {
    log.warn({ err: e }, "transcode error");
    return null;
  } finally {
    if (dir) await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

async function uploadMedia(bytes: Buffer): Promise<string | null> {
  if (!configured()) return null;
  try {
    const fd = new FormData();
    fd.set("messaging_product", "whatsapp");
    fd.set("type", "video/mp4");
    fd.set("file", new Blob([new Uint8Array(bytes)], { type: "video/mp4" }), "clip.mp4");
    const res = await fetch(`${GRAPH}/media`, {
      method: "POST",
      headers: { authorization: `Bearer ${TOKEN}` },
      body: fd,
    });
    if (!res.ok) {
      log.warn(
        { status: res.status, body: (await res.text()).slice(0, 200) },
        "wa media upload failed",
      );
      return null;
    }
    const j = (await res.json().catch(() => ({}))) as { id?: string };
    return j.id ?? null;
  } catch (e) {
    log.warn({ err: e }, "wa media upload error");
    return null;
  }
}

async function sendClip(to: string, srcUrl: string, caption: string): Promise<boolean> {
  let path: string;
  try {
    const u = new URL(srcUrl);
    path = `${u.pathname}${u.search}`;
  } catch {
    return false;
  }
  let out: Buffer;
  try {
    const r = await fetch(`${INTERNAL_API_URL}${path}`);
    if (!r.ok) {
      log.warn({ status: r.status, path }, "clip fetch failed");
      return false;
    }
    const src = Buffer.from(await r.arrayBuffer());
    const transcoded = await transcodeToH264(src);
    out = transcoded ?? src;
    log.info(
      { srcBytes: src.byteLength, outBytes: out.byteLength, transcoded: transcoded != null },
      "clip prepared",
    );
    if (out.byteLength > MAX_WA_VIDEO_BYTES) {
      log.warn({ bytes: out.byteLength }, "clip exceeds whatsapp limit");
      return false;
    }
  } catch (e) {
    log.warn({ err: e }, "clip fetch error");
    return false;
  }
  const mediaId = await uploadMedia(out);
  if (!mediaId) return false;
  const ok = await waSend({
    to,
    type: "video",
    video: { id: mediaId, ...(caption ? { caption: caption.slice(0, 1024) } : {}) },
  });
  if (ok) log.info({ handle: to }, "clip delivered");
  return ok;
}

// ── Agent + auth ────────────────────────────────────────────────────────
async function relayToAgent(
  handle: string,
  message: string,
  messageId: string,
): Promise<string | null> {
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

async function resetAgent(handle: string): Promise<boolean> {
  try {
    const r = await fetch(`${AGENT_URL}/reset`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ channel: "whatsapp", handle }),
    });
    return r.ok;
  } catch {
    return false;
  }
}

async function isAuthorized(handle: string): Promise<boolean> {
  const rows = await sql<Array<{ one: number }>>`
    SELECT 1 AS one FROM subscribers
     WHERE channel = 'whatsapp' AND handle = ${handle} AND enabled = true
     LIMIT 1
  `;
  return rows.length > 0;
}

function onboardingMessage(phone: string): string {
  return [
    "👋 This is the Overwatch surveillance bot.",
    "",
    `Your WhatsApp number is: ${phone}`,
    "",
    "You're not authorized yet. To enable this number:",
    "1. Open the Overwatch dashboard → Settings.",
    '2. Add a subscriber: channel "whatsapp", handle = the number above.',
    "3. Save, then message me again.",
    "",
    "Once added you can ask about cameras, incidents, and what's been happening.",
  ].join("\n");
}

function welcomeMessage(phone: string): string {
  return [
    "👋 Overwatch is online — this number is authorized.",
    "Ask me about cameras, incidents, or what's been happening lately.",
    "",
    `Your WhatsApp number: ${phone}`,
    "Tip: send /reset to start a fresh conversation.",
  ].join("\n");
}

const RESET_CMDS = new Set([
  "/reset",
  "/clear",
  "/newchat",
  "new chat",
  "clear chat",
  "start over",
]);
const STATUS_CMDS = new Set(["/start", "/id", "/myid", "id", "start"]);

async function handleIncidentAction(handle: string, payloadId: string): Promise<void> {
  // payloadId: "st:<incidentId>:<status>" or "ack:<incidentId>"
  if (!(await isAuthorized(handle))) {
    await sendText(handle, "You're not authorized to act on incidents.");
    return;
  }
  try {
    if (payloadId.startsWith("ack:")) {
      const id = payloadId.slice(4);
      await sql`
        UPDATE incidents SET status = 'acknowledged', acknowledged_at = now()
         WHERE id = ${id}::uuid
      `;
      await sendText(handle, "✅ Incident acknowledged.");
      return;
    }
    const [, id, status] = payloadId.split(":");
    const valid = ["open", "acknowledged", "suppressed", "closed"];
    if (!id || !status || !valid.includes(status)) return;
    await sql`
      UPDATE incidents
         SET status = ${status},
             acknowledged_at = CASE WHEN ${status} = 'acknowledged'
                                    THEN now() ELSE acknowledged_at END,
             closed_at = CASE WHEN ${status} = 'closed' AND closed_at IS NULL
                              THEN now() ELSE closed_at END
       WHERE id = ${id}::uuid
    `;
    // WhatsApp has no delete-sent-message API, so (unlike Telegram, which
    // removes the alert) we confirm the action instead.
    await sendText(handle, `✅ Incident marked ${status}.`);
  } catch (e) {
    log.warn({ err: e, payloadId }, "incident action failed");
  }
}

async function handleInboundText(
  handle: string,
  text: string,
  messageId: string,
): Promise<void> {
  const cmd = text.trim().toLowerCase();
  if (!(await isAuthorized(handle))) {
    log.info({ from: mask(handle) }, "unauthorized → onboarding");
    await sendText(handle, onboardingMessage(handle));
    return;
  }
  if (STATUS_CMDS.has(cmd)) {
    await sendText(handle, welcomeMessage(handle));
    return;
  }
  if (RESET_CMDS.has(cmd)) {
    const ok = await resetAgent(handle);
    await sendText(
      handle,
      ok
        ? "🧹 Chat history cleared. Starting fresh — what can I help you with?"
        : "Couldn't clear the chat history right now. Please try again shortly.",
    );
    return;
  }
  await markReadTyping(messageId);
  const reply = await relayToAgent(handle, text, messageId);
  if (reply) await sendText(handle, reply);
}

// ── Webhook ─────────────────────────────────────────────────────────────
const app = new Hono();

function verifyHandler(c: Context) {
  const mode = c.req.query("hub.mode");
  const token = c.req.query("hub.verify_token");
  const challenge = c.req.query("hub.challenge");
  if (mode === "subscribe" && token === VERIFY && challenge) return c.text(challenge);
  return c.text("forbidden", 403);
}

async function eventHandler(c: Context) {
  const body = (await c.req.json().catch(() => ({}))) as any;
  // ACK immediately; process async so Meta doesn't retry on slow work
  // (clip transcode/upload can take seconds).
  void (async () => {
    try {
      for (const e of body.entry ?? []) {
        for (const change of e.changes ?? []) {
          for (const m of change.value?.messages ?? []) {
            const handle = String(m.from ?? "");
            const messageId = String(m.id ?? "");
            if (!handle) continue;
            log.info({ from: mask(handle), type: m.type }, "inbound message");
            if (m.type === "text" && m.text?.body) {
              await handleInboundText(handle, String(m.text.body), messageId);
            } else if (m.type === "interactive") {
              const id =
                m.interactive?.button_reply?.id ??
                m.interactive?.list_reply?.id ??
                "";
              if (id.startsWith("st:") || id.startsWith("ack:")) {
                await handleIncidentAction(handle, id);
              }
            } else if (m.type === "button" && m.button?.payload) {
              const p = String(m.button.payload);
              if (p.startsWith("st:") || p.startsWith("ack:")) {
                await handleIncidentAction(handle, p);
              }
            }
          }
        }
      }
    } catch (err) {
      log.error({ err }, "webhook handling failed");
    }
  })();
  return c.json({ ok: true });
}

// Caddy forwards `/webhook/whatsapp` (prefix not stripped); also accept the
// bare `/webhook` for direct/local hits.
app.get("/webhook/whatsapp", verifyHandler);
app.post("/webhook/whatsapp", eventHandler);
app.get("/webhook", verifyHandler);
app.post("/webhook", eventHandler);
app.get("/health", (c) =>
  c.json({ ok: true, service: "ov-whatsapp", configured: configured() }),
);

// ── Outbound (bot_outbox.whatsapp) ──────────────────────────────────────
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
  const to = event.handle;
  const videos = (event.attachments ?? [])
    .filter((a) => a.kind === "video" && a.url)
    .map((a) => ({ url: a.url, caption: a.caption }));
  const link =
    (event.attachments ?? []).find((a) => a.kind === "link" && a.url)?.url ?? null;
  const incidentId = event.incident_id ?? null;
  const withActions = !!incidentId && event.suppress_actions !== true;

  if (videos.length > 0) {
    for (let i = 0; i < videos.length; i++) {
      const v = videos[i]!;
      const cap =
        i === 0
          ? v.caption
            ? `${event.text}\n${v.caption}`
            : event.text
          : v.caption ?? "";
      const ok = await sendClip(to, v.url, cap);
      if (!ok && i === 0) {
        await sendText(
          to,
          `${event.text}\n(The clip couldn't be attached — it may not be available.)`,
        );
      }
    }
    if (link) await sendCtaUrl(to, "Open the full playback page:", "View playback", link);
  } else if (event.buttons && event.buttons.length > 0) {
    // WhatsApp allows one CTA-URL per message: a single button → a nice
    // button; multiple (per-camera recap links) → a tappable text list.
    if (event.buttons.length === 1) {
      const b = event.buttons[0]!;
      const ok = await sendCtaUrl(
        to,
        event.text,
        b.text.replace(/^[^A-Za-z0-9]+/, "").trim(),
        b.url,
      );
      if (!ok) await sendText(to, `${event.text}\n\n${b.text}: ${b.url}`);
    } else {
      const list = event.buttons.map((b) => `• ${b.text}: ${b.url}`).join("\n");
      await sendText(to, `${event.text}\n\n${list}`);
    }
  } else if (link) {
    const ok = await sendCtaUrl(to, event.text, "View playback", link);
    if (!ok) await sendText(to, `${event.text}\n${link}`);
  } else {
    await sendText(to, event.text);
  }

  if (withActions && incidentId) {
    await sendReplyButtons(to, "Act on this incident:", [
      { id: `st:${incidentId}:acknowledged`, title: "Acknowledge" },
      { id: `st:${incidentId}:suppressed`, title: "Suppress" },
      { id: `st:${incidentId}:closed`, title: "Close" },
    ]);
  }
});

const port = Number(process.env.PORT ?? 3010);
serve({ fetch: app.fetch, port }, () => log.info({ port }, "ov-whatsapp ready"));

process.on("SIGINT", () => process.exit(0));
process.on("SIGTERM", () => process.exit(0));

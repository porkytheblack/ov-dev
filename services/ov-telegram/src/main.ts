import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BotOutboxMessage, CONSUMER_GROUP, STREAMS } from "@overwatch/schemas/events";
import { createGroupConsumer, makeLogger, makeRedis } from "@overwatch/shared-ts";
import postgres from "postgres";

const log = makeLogger("ov-telegram");
const TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";
const AGENT_URL = process.env.AGENT_URL ?? "http://ov-agent:3000";
// Override when api.telegram.org is unreachable (restricted egress): point
// at a local Bot API server or reverse proxy that can reach Telegram.
const TELEGRAM_API_BASE = (
  process.env.TELEGRAM_API_BASE ?? "https://api.telegram.org"
).replace(/\/+$/, "");
const API = TOKEN ? `${TELEGRAM_API_BASE}/bot${TOKEN}` : "";

let offset = 0;

// Telegram egress here is intermittently flaky (observed: AggregateError
// [ETIMEDOUT] connecting to api.telegram.org → clips/alerts silently
// dropped). Retry transient failures (network error, 429, 5xx) with
// backoff; a 4xx is a real client error and not retried.
const TG_RETRIES = Number(process.env.TG_SEND_RETRIES ?? 3) || 3;
// Hard per-attempt deadlines. WITHOUT these a stalled connection to
// api.telegram.org makes `fetch` hang forever — it never rejects, so the
// retry below never fires AND the single serial outbox consumer is wedged
// (every later alert queues up undelivered). A timeout turns a hang into a
// catchable error → retried, then a graceful give-up that lets the consumer
// ACK and move on. Tunable via env; generous for the large video upload.
const TG_API_TIMEOUT_MS = Number(process.env.TG_API_TIMEOUT_MS ?? 20_000) || 20_000;
const TG_UPLOAD_TIMEOUT_MS = Number(process.env.TG_UPLOAD_TIMEOUT_MS ?? 75_000) || 75_000;
const TG_CLIP_FETCH_TIMEOUT_MS = Number(process.env.TG_CLIP_FETCH_TIMEOUT_MS ?? 60_000) || 60_000;
// Inbound-chat path: a hung agent call would freeze the getUpdates loop the
// same way. Generous (LLM latency) but bounded.
const TG_AGENT_TIMEOUT_MS = Number(process.env.TG_AGENT_TIMEOUT_MS ?? 120_000) || 120_000;
// getUpdates long-poll holds the connection open this many seconds by design.
// The HTTP abort deadline MUST exceed it (+ network slack) or every poll is
// killed mid-flight and inbound commands churn on false "unreachable" retries.
const TG_LONGPOLL_SEC = Number(process.env.TG_LONGPOLL_SEC ?? 25) || 25;
const TG_LONGPOLL_TIMEOUT_MS = TG_LONGPOLL_SEC * 1000 + 12_000;

async function telegramApi<T = unknown>(
  method: string,
  payload?: Record<string, unknown>,
  timeoutMs: number = TG_API_TIMEOUT_MS,
): Promise<T | null> {
  if (!API) return null;
  for (let attempt = 1; attempt <= TG_RETRIES; attempt++) {
    try {
      const res = await fetch(`${API}/${method}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload ?? {}),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (res.ok) {
        const data = (await res.json()) as { ok: boolean; result?: T };
        return data.result ?? null;
      }
      if (res.status < 500 && res.status !== 429) {
        log.warn({ method, status: res.status }, "telegram api failed");
        return null; // client error — retrying won't help
      }
      log.warn({ method, status: res.status, attempt }, "telegram api transient");
    } catch (e) {
      log.warn({ method, err: (e as Error).message, attempt }, "telegram unreachable");
    }
    if (attempt < TG_RETRIES) await new Promise((r) => setTimeout(r, attempt * 2000));
  }
  return null;
}

/** Delete one bot message; if too old to delete, strip its keyboard. */
async function deleteOrStrip(
  chatId: string | number,
  messageId: number,
): Promise<void> {
  const deleted = await telegramApi("deleteMessage", {
    chat_id: chatId,
    message_id: messageId,
  });
  if (deleted === null) {
    // Too old to delete (Telegram only lets a bot delete its own messages
    // for ~48h) — at least strip the now-useless keyboard.
    await telegramApi("editMessageReplyMarkup", {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: { inline_keyboard: [] },
    });
  }
}

/**
 * Run `fn` while showing the Telegram "typing…" indicator in `handle`'s
 * chat. Telegram clears the indicator after ~5s, so refresh every 4s until
 * `fn` settles — keeps the user engaged during slower agent/model calls.
 */
async function withTyping<T>(handle: string, fn: () => Promise<T>): Promise<T> {
  await telegramApi("sendChatAction", { chat_id: handle, action: "typing" });
  const timer = setInterval(() => {
    void telegramApi("sendChatAction", { chat_id: handle, action: "typing" });
  }, 4000);
  try {
    return await fn();
  } finally {
    clearInterval(timer);
  }
}

function actionKeyboard(incidentId: string, link?: string | null) {
  const rows: Array<Array<Record<string, string>>> = [];
  if (link) rows.push([{ text: "▶ View playback", url: link }]);
  rows.push([
    { text: "Acknowledge", callback_data: `st:${incidentId}:acknowledged` },
    { text: "Suppress", callback_data: `st:${incidentId}:suppressed` },
    { text: "Close", callback_data: `st:${incidentId}:closed` },
  ]);
  return { inline_keyboard: rows };
}

async function sendMessage(
  handle: string,
  text: string,
  opts?: {
    incidentId?: string;
    link?: string | null;
    buttons?: Array<{ text: string; url: string }>;
  },
): Promise<number | null> {
  const replyMarkup = opts?.incidentId
    ? actionKeyboard(opts.incidentId, opts.link)
    : opts?.buttons && opts.buttons.length > 0
      ? { inline_keyboard: opts.buttons.map((b) => [{ text: b.text, url: b.url }]) }
      : undefined;
  const res = await telegramApi<{ message_id?: number }>("sendMessage", {
    chat_id: handle,
    text,
    disable_web_page_preview: false,
    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
  });
  return res?.message_id ?? null;
}

// Telegram's servers cannot fetch an internal/localhost clip URL, so we
// fetch the clip ourselves from ov-api over the docker network (rewriting
// whatever host the attachment carried to INTERNAL_API_URL) and upload the
// bytes as a file via multipart.
const INTERNAL_API_URL = (
  process.env.INTERNAL_API_URL ?? "http://ov-api:3001"
).replace(/\/+$/, "");
const MAX_TG_VIDEO_BYTES = 49 * 1024 * 1024;
const TRANSCODE_TIMEOUT_MS = 90_000;

/**
 * Camera clips are MPEG-4 Part 2 (`mpeg4`), which Telegram's player cannot
 * decode — it shows a white frame. Transcode to H.264 + yuv420p (the
 * universally playable baseline) with `+faststart` so the video is playable
 * inline. Returns the transcoded bytes, or `null` to fall back to the
 * original (better a chance than nothing if ffmpeg is unavailable/fails).
 */
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
          // Even dimensions are required by libx264/yuv420p.
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
      const timer = setTimeout(() => {
        ff.kill("SIGKILL");
      }, TRANSCODE_TIMEOUT_MS);
      ff.on("error", (e) => {
        clearTimeout(timer);
        log.warn({ err: e.message }, "ffmpeg spawn failed");
        resolve(null);
      });
      ff.on("close", (c) => {
        clearTimeout(timer);
        if (c !== 0) log.warn({ code: c, stderr: stderr.slice(-300) }, "ffmpeg transcode failed");
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

async function sendClipFile(
  handle: string,
  srcUrl: string,
  caption: string,
  replyMarkup?: unknown,
): Promise<number | null> {
  if (!API) return null;
  let path: string;
  try {
    const u = new URL(srcUrl);
    path = `${u.pathname}${u.search}`;
  } catch {
    return null;
  }
  let blob: Blob;
  try {
    const r = await fetch(`${INTERNAL_API_URL}${path}`, {
      signal: AbortSignal.timeout(TG_CLIP_FETCH_TIMEOUT_MS),
    });
    if (!r.ok) {
      log.warn({ status: r.status, path }, "clip fetch failed");
      return null;
    }
    const ab = await r.arrayBuffer();
    const src = Buffer.from(ab);
    // Transcode mpeg4 → H.264 so Telegram can actually play it (else white).
    const transcoded = await transcodeToH264(src);
    const out = transcoded ?? src;
    log.info(
      { srcBytes: src.byteLength, outBytes: out.byteLength, transcoded: transcoded != null },
      "clip prepared",
    );
    if (out.byteLength > MAX_TG_VIDEO_BYTES) {
      log.warn({ bytes: out.byteLength }, "clip exceeds telegram upload limit");
      return null;
    }
    blob = new Blob([new Uint8Array(out)], { type: "video/mp4" });
  } catch (e) {
    log.warn({ err: e }, "clip fetch error");
    return null;
  }
  // Retry the upload (NOT the fetch/transcode — bytes are ready) so a
  // single intermittent ETIMEDOUT to api.telegram.org doesn't drop the
  // clip and fall back to "couldn't be attached".
  for (let attempt = 1; attempt <= TG_RETRIES; attempt++) {
    try {
      const fd = new FormData();
      fd.set("chat_id", handle);
      if (caption) fd.set("caption", caption);
      if (replyMarkup) fd.set("reply_markup", JSON.stringify(replyMarkup));
      fd.set("video", blob, "clip.mp4");
      const res = await fetch(`${API}/sendVideo`, {
        method: "POST",
        body: fd,
        signal: AbortSignal.timeout(TG_UPLOAD_TIMEOUT_MS),
      });
      if (res.ok) {
        const j = (await res.json().catch(() => ({}))) as {
          result?: { message_id?: number };
        };
        log.info(
          { handle, message_id: j.result?.message_id, bytes: blob.size, attempt },
          "clip delivered",
        );
        return j.result?.message_id ?? null;
      }
      const body = (await res.text()).slice(0, 200);
      if (res.status < 500 && res.status !== 429) {
        log.warn({ status: res.status, body }, "sendVideo failed (no retry)");
        return null; // client error — won't change on retry
      }
      log.warn({ status: res.status, body, attempt }, "sendVideo transient");
    } catch (e) {
      log.warn({ err: (e as Error).message, attempt }, "sendVideo error (retry)");
    }
    if (attempt < TG_RETRIES) await new Promise((r) => setTimeout(r, attempt * 2500));
  }
  log.warn({ handle }, "sendVideo gave up after retries");
  return null;
}

/**
 * Upload incident clip video(s) as files, sequentially. Returns the Telegram
 * message_id of every message it produced so they can be tracked against the
 * incident and cleaned up on resolve.
 */
async function sendVideos(
  handle: string,
  videos: Array<{ url: string; caption?: string }>,
  text: string,
  incidentId?: string,
  link?: string | null,
  withActions = true,
): Promise<number[]> {
  const batch = videos.slice(0, 10);
  const ids: number[] = [];
  for (let i = 0; i < batch.length; i++) {
    const v = batch[i]!;
    const caption =
      i === 0 ? (v.caption ? `${text}\n${v.caption}` : text) : v.caption ?? "";
    const isLast = i === batch.length - 1;
    const mid = await sendClipFile(
      handle,
      v.url,
      caption,
      isLast && withActions && incidentId
        ? actionKeyboard(incidentId, link)
        : undefined,
    );
    if (mid != null) ids.push(mid);
  }
  if (ids.length === 0) {
    // Never leave the user with a "clip incoming" and nothing — say so,
    // and still surface the action buttons.
    const fid = await sendMessage(
      handle,
      `${text}\n(The clip couldn't be attached — it may not be available for this incident.)`,
      withActions && incidentId ? { incidentId, link } : undefined,
    );
    if (fid != null) ids.push(fid);
  }
  return ids;
}

// ── Incident ↔ message tracking ─────────────────────────────────────────
// Every message tied to an incident (clip/alert + the follow-up summary) is
// recorded here so that resolving the incident via a button removes ALL of
// them, not just the one the button was on.
async function ensureIncidentMsgTable(
  sql: ReturnType<typeof postgres>,
): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS bot_incident_messages (
      channel     TEXT   NOT NULL,
      handle      TEXT   NOT NULL,
      incident_id TEXT   NOT NULL,
      message_id  BIGINT NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (channel, handle, incident_id, message_id)
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_bot_incident_messages_scope
      ON bot_incident_messages (channel, handle, incident_id)
  `;
  // Bound growth: incidents that are never resolved would otherwise keep
  // their rows forever. They're tiny, but prune anything stale on boot.
  await sql`
    DELETE FROM bot_incident_messages WHERE created_at < now() - interval '7 days'
  `.catch(() => {});
}

async function recordIncidentMessage(
  sql: ReturnType<typeof postgres>,
  handle: string,
  incidentId: string,
  messageId: number,
): Promise<void> {
  await sql`
    INSERT INTO bot_incident_messages (channel, handle, incident_id, message_id)
    VALUES ('telegram', ${handle}, ${incidentId}, ${messageId})
    ON CONFLICT DO NOTHING
  `;
}

/** Tracked message ids for an incident, oldest first (the original
 * clip/alert — the one carrying the caption + keyboard). Read-only. */
async function getIncidentMessages(
  sql: ReturnType<typeof postgres>,
  handle: string,
  incidentId: string,
): Promise<number[]> {
  const rows = await sql<Array<{ message_id: string }>>`
    SELECT message_id FROM bot_incident_messages
     WHERE channel = 'telegram' AND handle = ${handle}
       AND incident_id = ${incidentId}
     ORDER BY created_at ASC
  `;
  return rows
    .map((r) => Number(r.message_id))
    .filter((n) => Number.isFinite(n));
}

/**
 * Edit the original alert/clip message in place (e.g. fold the VLM summary
 * into the caption) instead of sending a second message. The alert is
 * normally a video → editMessageCaption; fall back to editMessageText for
 * a text-only alert. Returns false if there's nothing to edit (caller then
 * falls back to sending a new message so the summary still arrives).
 */
async function editIncidentMessage(
  sql: ReturnType<typeof postgres>,
  handle: string,
  incidentId: string,
  text: string,
  replyMarkup: unknown,
): Promise<boolean> {
  const ids = await getIncidentMessages(sql, handle, incidentId).catch(
    () => [] as number[],
  );
  if (ids.length === 0) return false;
  const messageId = ids[0]!; // original alert/clip (has caption + keyboard)
  const rm = replyMarkup ? { reply_markup: replyMarkup } : {};
  let ok = await telegramApi("editMessageCaption", {
    chat_id: handle,
    message_id: messageId,
    caption: text.slice(0, 1024),
    ...rm,
  });
  if (ok === null) {
    ok = await telegramApi("editMessageText", {
      chat_id: handle,
      message_id: messageId,
      text: text.slice(0, 4096),
      ...rm,
    });
  }
  return ok !== null;
}

/** Atomically take (and forget) every tracked message id for an incident. */
async function takeIncidentMessages(
  sql: ReturnType<typeof postgres>,
  handle: string,
  incidentId: string,
): Promise<number[]> {
  const rows = await sql<Array<{ message_id: string }>>`
    DELETE FROM bot_incident_messages
     WHERE channel = 'telegram' AND handle = ${handle}
       AND incident_id = ${incidentId}
    RETURNING message_id
  `;
  return rows
    .map((r) => Number(r.message_id))
    .filter((n) => Number.isFinite(n));
}

/**
 * The operator resolved the incident from a button — wipe every message we
 * sent for it (the clip/alert AND the summary), plus the callback's own
 * message as a belt-and-braces fallback if tracking missed it.
 */
async function cleanupIncidentMessages(
  sql: ReturnType<typeof postgres>,
  handle: string,
  incidentId: string,
  cq: any,
): Promise<void> {
  const chatId = cq?.message?.chat?.id ?? handle;
  const tracked = await takeIncidentMessages(sql, handle, incidentId).catch(
    () => [] as number[],
  );
  const ids = new Set<number>(tracked);
  const cbId = cq?.message?.message_id;
  if (typeof cbId === "number") ids.add(cbId);
  for (const mid of ids) await deleteOrStrip(chatId, mid);
}

async function relayToAgent(handle: string, message: string, messageId: string) {
  try {
    const r = await fetch(`${AGENT_URL}/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ channel: "telegram", handle, message, message_id: messageId }),
      signal: AbortSignal.timeout(TG_AGENT_TIMEOUT_MS),
    });
    if (!r.ok) return null;
    const data = (await r.json()) as { response?: string };
    return data.response ?? null;
  } catch {
    return null;
  }
}

/** Wipe this chat's agent conversation so the next message starts fresh. */
async function resetAgent(handle: string): Promise<boolean> {
  try {
    const r = await fetch(`${AGENT_URL}/reset`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ channel: "telegram", handle }),
      signal: AbortSignal.timeout(TG_AGENT_TIMEOUT_MS),
    });
    return r.ok;
  } catch {
    return false;
  }
}

async function isAuthorized(
  sql: ReturnType<typeof postgres>,
  chatId: string,
): Promise<boolean> {
  const rows = await sql<Array<{ one: number }>>`
    SELECT 1 AS one FROM subscribers
     WHERE channel = 'telegram' AND handle = ${chatId} AND enabled = true
     LIMIT 1
  `;
  return rows.length > 0;
}

function onboardingMessage(chatId: string): string {
  return [
    "👋 This is the Overwatch surveillance bot.",
    "",
    `Your conversation ID is: ${chatId}`,
    "",
    "You're not authorized yet. To enable this chat:",
    "1. Open the Overwatch dashboard → Settings.",
    "2. Add a subscriber: channel \"telegram\", handle = the ID above.",
    "3. Save, then message me again.",
    "",
    "Once added you can ask about cameras, incidents, and what's been happening.",
  ].join("\n");
}

/**
 * Greeting for an already-authorized chat. Telegram auto-sends `/start`
 * whenever a chat is cleared or deleted-and-reopened, so an authorized
 * operator must NEVER see the "you're not authorized" wall — that reads as
 * the bot spamming itself for no reason.
 */
function welcomeMessage(chatId: string): string {
  return [
    "👋 Overwatch is online — this chat is authorized.",
    "Ask me about cameras, incidents, or what's been happening lately.",
    "",
    `Conversation ID: ${chatId}`,
    "Tip: send /reset to start a fresh conversation.",
  ].join("\n");
}

// ── getUpdates offset persistence ───────────────────────────────────────
// `offset` was process-memory only, so every restart polled from 0 and
// Telegram replayed every still-unconfirmed update — including the `/start`
// it auto-queues when the operator clears the chat. Persist it so a restart
// resumes instead of replaying.
async function ensurePollState(sql: ReturnType<typeof postgres>): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS bot_poll_state (
      channel     TEXT PRIMARY KEY,
      last_offset BIGINT NOT NULL DEFAULT 0,
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
}

async function loadOffset(
  sql: ReturnType<typeof postgres>,
): Promise<number | null> {
  const rows = await sql<Array<{ last_offset: string }>>`
    SELECT last_offset FROM bot_poll_state WHERE channel = 'telegram' LIMIT 1
  `;
  return rows[0] ? Number(rows[0].last_offset) || 0 : null;
}

async function saveOffset(
  sql: ReturnType<typeof postgres>,
  value: number,
): Promise<void> {
  await sql`
    INSERT INTO bot_poll_state (channel, last_offset, updated_at)
    VALUES ('telegram', ${value}, now())
    ON CONFLICT (channel) DO UPDATE
      SET last_offset = EXCLUDED.last_offset, updated_at = now()
  `;
}

async function pollUpdates(sql: ReturnType<typeof postgres>) {
  if (!API) {
    log.warn("TELEGRAM_BOT_TOKEN missing; polling disabled");
    return;
  }
  await ensurePollState(sql).catch((e) =>
    log.warn({ err: e }, "poll-state init failed"),
  );
  const persisted = await loadOffset(sql).catch(() => null);
  if (persisted != null) {
    offset = persisted;
  } else {
    // First run after enabling persistence: discard whatever Telegram has
    // buffered (notably the `/start` storm queued by chat clears) so the
    // operator isn't replayed a backlog. `offset:-1` returns just the
    // newest update; skipping past it acks the rest on the next poll.
    const pending = await telegramApi<any[]>("getUpdates", {
      offset: -1,
      timeout: 0,
    });
    if (pending && pending.length > 0) {
      offset = pending[pending.length - 1]!.update_id + 1;
    }
    await saveOffset(sql, offset).catch((e) =>
      log.warn({ err: e }, "offset persist failed"),
    );
    log.info({ offset }, "poll offset initialized (backlog skipped)");
  }
  let lastSaved = offset;
  while (true) {
    try {
      const updates = await telegramApi<any[]>(
        "getUpdates",
        {
          offset,
          timeout: TG_LONGPOLL_SEC,
          allowed_updates: ["message", "callback_query"],
        },
        TG_LONGPOLL_TIMEOUT_MS,
      );
      if (!updates) {
        await new Promise((r) => setTimeout(r, 1000));
        continue;
      }
      for (const u of updates) {
        offset = Math.max(offset, u.update_id + 1);
        if (u.message?.text) {
          const handle = String(u.message.chat.id);
          const text = String(u.message.text).trim();
          const cmd = text.toLowerCase();
          const authed = await isAuthorized(sql, handle);
          if (!authed) {
            // Unauthorized chats — including their /start, /id, /myid — get
            // the enable-me steps (which already include the conversation ID).
            await sendMessage(handle, onboardingMessage(handle));
          } else if (cmd === "/start" || cmd === "/id" || cmd === "/myid") {
            // Authorized: a short friendly greeting, never the
            // "not authorized" wall (Telegram auto-sends /start on chat
            // clear/delete — that must not look like spam).
            await sendMessage(handle, welcomeMessage(handle));
          } else if (cmd === "/reset" || cmd === "/clear" || cmd === "/newchat") {
            const ok = await resetAgent(handle);
            await sendMessage(
              handle,
              ok
                ? "🧹 Chat history cleared. Starting fresh — what can I help you with?"
                : "Couldn't clear the chat history right now. Please try again shortly.",
            );
          } else {
            const reply = await withTyping(handle, () =>
              relayToAgent(handle, text, String(u.message.message_id)),
            );
            if (reply) await sendMessage(handle, reply);
          }
        }
        if (u.callback_query?.data?.startsWith("ack:")) {
          const incidentId = u.callback_query.data.slice(4);
          const handle = String(u.callback_query.from.id);
          if (!(await isAuthorized(sql, handle))) {
            await telegramApi("answerCallbackQuery", {
              callback_query_id: u.callback_query.id,
              text: "Not authorized",
            });
            continue;
          }
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
            await cleanupIncidentMessages(sql, handle, incidentId, u.callback_query);
          } catch (e) {
            log.warn({ err: e }, "ack failed");
          }
        }
        if (u.callback_query?.data?.startsWith("st:")) {
          const parts = String(u.callback_query.data).split(":");
          const incidentId = parts[1] ?? "";
          const status = parts[2] ?? "";
          const handle = String(u.callback_query.from.id);
          const valid = ["open", "acknowledged", "suppressed", "closed"];
          if (!(await isAuthorized(sql, handle)) || !valid.includes(status)) {
            await telegramApi("answerCallbackQuery", {
              callback_query_id: u.callback_query.id,
              text: "Not authorized",
            });
            continue;
          }
          try {
            await sql`
              UPDATE incidents
                 SET status = ${status},
                     acknowledged_at = CASE WHEN ${status} = 'acknowledged'
                                            THEN now() ELSE acknowledged_at END,
                     closed_at = CASE WHEN ${status} = 'closed' AND closed_at IS NULL
                                      THEN now() ELSE closed_at END
               WHERE id = ${incidentId}::uuid
            `;
            await telegramApi("answerCallbackQuery", {
              callback_query_id: u.callback_query.id,
              text: `Marked ${status}`,
            });
            await cleanupIncidentMessages(sql, handle, incidentId, u.callback_query);
          } catch (e) {
            log.warn({ err: e }, "status change failed");
          }
        }
      }
      if (offset !== lastSaved) {
        await saveOffset(sql, offset).catch((e) =>
          log.warn({ err: e }, "offset persist failed"),
        );
        lastSaved = offset;
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
  await ensureIncidentMsgTable(sql).catch((e) =>
    log.warn({ err: e }, "incident-msg table init failed"),
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
    const videos = (event.attachments ?? [])
      .filter((a) => a.kind === "video" && a.url)
      .map((a) => ({ url: a.url, caption: a.caption }));
    // Playback deep link arrives as a structured `link` attachment so it can
    // be rendered as an inline button (never inlined in the message text).
    const link =
      (event.attachments ?? []).find((a) => a.kind === "link" && a.url)?.url ??
      null;
    const incidentId = event.incident_id ?? null;

    // Edit-in-place: the VLM summary folds into the original clip alert's
    // caption instead of arriving as a second message. Falls through to a
    // normal send if there's no tracked message to edit (clip never
    // delivered) so the summary still reaches the operator.
    if (event.edit && incidentId) {
      const edited = await editIncidentMessage(
        sql,
        event.handle,
        incidentId,
        event.text,
        actionKeyboard(incidentId, link),
      ).catch(() => false);
      if (edited) return;
    }

    // `suppress_actions` (the follow-up summary) → tracked but no buttons.
    const withActions = !!incidentId && event.suppress_actions !== true;

    let messageIds: number[] = [];
    if (videos.length > 0) {
      messageIds = await sendVideos(
        event.handle,
        videos,
        event.text,
        incidentId ?? undefined,
        link,
        withActions,
      );
    } else {
      const id = await sendMessage(
        event.handle,
        event.text,
        withActions
          ? { incidentId: incidentId!, link }
          : event.buttons && event.buttons.length > 0
            ? { buttons: event.buttons }
            : undefined,
      );
      if (id != null) messageIds = [id];
    }

    // Tie every produced message to the incident so resolving it later wipes
    // the whole thread (clip/alert + summary), not just one message.
    if (incidentId) {
      for (const mid of messageIds) {
        await recordIncidentMessage(sql, event.handle, incidentId, mid).catch(
          (e) => log.warn({ err: e }, "incident-msg track failed"),
        );
      }
    }
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

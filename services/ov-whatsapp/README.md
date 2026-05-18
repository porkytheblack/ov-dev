# ov-whatsapp

WhatsApp Cloud API adapter — Telegram-parity bot over Meta's Graph API.

## Webhook (point Meta here)

- **Callback URL:** `https://<public-domain>/webhook/whatsapp`
  Caddy proxies `/webhook/whatsapp*` → `ov-whatsapp:3010` (prefix kept), the
  same public HTTPS domain that serves the dashboard. Local dev:
  `http://localhost:9090/webhook/whatsapp`. No extra host port to open.
- **Verify token:** `WHATSAPP_WEBHOOK_VERIFY_TOKEN` (default `overwatch-verify`).
- **Webhook field:** subscribe to `messages`.
- **Internal port:** `3010` (env `PORT`).

Required env: `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`,
`WHATSAPP_WEBHOOK_VERIFY_TOKEN` (+ shared `DATABASE_URL`, `AGENT_URL`,
`INTERNAL_API_URL`).

## Auth (phone-number based)

Mirrors Telegram: a sender is authorized only if a `subscribers` row exists
with `channel = 'whatsapp'`, `handle = <wa_id>` (digits, no `+`), `enabled`.
Unauthorized senders get an onboarding message containing their number.

## Parity with Telegram

Inbound relay to the agent, phone auth + onboarding, `/reset`·`/clear`·
`/newchat` (and "new chat"), `/id`·`/start`·`/myid`, read-receipt + typing,
H.264-transcoded clip delivery, incident Acknowledge/Suppress/Close
(interactive reply buttons → same SQL), playback/calendar links, and the
`bot_outbox.whatsapp` consumer (clips, links, recap buttons, suppress_actions).

## Platform limits (not bugs)

- No delete-sent-message API → on resolve we confirm instead of removing the
  alert (Telegram deletes it).
- One CTA-URL button per message → multiple recap links become a tappable
  text list.
- Typing indicator is one-shot (~25s), not refreshable.
- Free-form outbound delivers only inside the 24h customer-service window;
  proactive alerts/recaps outside it need approved templates (set up in
  Meta Business Manager).

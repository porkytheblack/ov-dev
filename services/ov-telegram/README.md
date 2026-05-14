# ov-telegram

Telegram bot adapter using long polling (`getUpdates`). Outbound:
consumes `bot_outbox.telegram` and posts messages with an inline keyboard
for incident ack. Inbound: routes user messages and callback queries to
`ov-agent`.

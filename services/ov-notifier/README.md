# ov-notifier

Consumes `incident.opened` and waits for `clip.ready` (with a configurable
timeout). Resolves per-camera subscribers, formats the notification body,
generates a signed deep-link, and pushes onto `bot_outbox.{channel}` streams
for the bot adapters to consume.

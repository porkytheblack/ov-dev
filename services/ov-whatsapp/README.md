# ov-whatsapp

WhatsApp Cloud API adapter. Outbound: consumes `bot_outbox.whatsapp` and
posts via the Graph API. Inbound: receives webhooks, forwards user messages
to `ov-agent`, renders the response back over WhatsApp.

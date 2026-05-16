# ov-vlm

Optional service. Consumes `clip.ready` for incident clips, samples a handful
of frames, asks the configured local VLM (LM Studio-compatible OpenAI API)
for a 1-2 sentence summary, writes back to `incidents.summary`.

# ov-agent

Single conversational runtime exposing the Overwatch toolset over HTTP.
`POST /chat { channel, handle, message }` runs an Anthropic tool-use loop
backed by the Glove-style tool registry in `src/tools.ts`.

Tools:
- `search_incidents` — past incidents by time / camera / class / status
- `get_incident_details` — full record for a single incident
- `get_compound_status` — current snapshot: cameras + open incidents
- `get_camera_context` — user-defined scene description for a camera
- `summarize_period` — counts grouped by camera + class for a window
- `acknowledge_incident` — mark an incident as acknowledged

Memory is kept in Postgres `agent_conversations`, keyed by (channel, handle).
Last 20 messages survive; older ones drop.

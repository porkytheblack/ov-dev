/**
 * Renders a mediamtx config that exposes each enabled camera as a publishable
 * path under /stream/{camera_id}. The gateway pulls the RTSP source eagerly so
 * the dashboard's WebRTC/HLS consumers connect to a normalized local feed.
 */
import postgres from "postgres";

export async function renderMediamtxYml(sql: ReturnType<typeof postgres>): Promise<string> {
  const rows = await sql<Array<{ id: string; rtsp_url: string }>>`
    SELECT id, rtsp_url FROM cameras WHERE enabled = true
  `;
  const paths = rows
    .map(
      (r) =>
        `  cam_${r.id.replaceAll("-", "_")}:\n` +
        `    source: ${r.rtsp_url}\n` +
        `    sourceOnDemand: yes\n`,
    )
    .join("");
  return [
    "logLevel: info",
    "rtsp: yes",
    "rtspAddress: :8554",
    "webrtc: yes",
    "webrtcAddress: :8889",
    "hls: yes",
    "hlsAddress: :8888",
    "hlsAlwaysRemux: yes",
    "paths:",
    paths || "  all_others:\n    source: publisher\n",
  ].join("\n");
}

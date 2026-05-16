/**
 * Renders a mediamtx config with two paths per camera:
 *   - `cam_<id>_raw`  pulls HEVC from the camera; pulled on demand
 *   - `cam_<id>`      transcoded H.264 path (browser-playable). On the first
 *                     LL-HLS or WHEP read, mediamtx spawns an ffmpeg that pulls
 *                     `cam_<id>_raw` and republishes H.264+baseline back to
 *                     this path. ffmpeg dies 10s after the last reader
 *                     disconnects so we don't burn CPU when nobody's watching.
 *
 * LL-HLS is configured for ~1s glass-to-glass: 200ms segments, 100ms parts.
 */
import postgres from "postgres";

export async function renderMediamtxYml(sql: ReturnType<typeof postgres>): Promise<string> {
  const rows = await sql<Array<{ id: string; rtsp_url: string; stream_fps: number | null }>>`
    SELECT id, rtsp_url, stream_fps FROM cameras WHERE enabled = true
  `;

  // Per-camera transcode pipeline. We don't use $MTX_PATH substitution
  // because mediamtx's parser would greedily match `$MTX_PATH_raw` as a
  // single (undefined) variable and feed ffmpeg an empty path. Hardcoding
  // both source and sink names per camera keeps the substitution surface
  // zero. Audio dropped (-an): Hikvision G.711 blows up libx264's muxing
  // queue. GOP = the camera's probed fps so LL-HLS parts align on keyframes
  // regardless of whether the source runs 12/15/25/30 fps. baseline profile
  // + yuv420p maximises Chrome/Firefox compat.
  function transcodeCmd(slug: string, fps: number): string {
    const gop = Math.max(1, Math.round(fps));
    return (
      "ffmpeg -rtsp_transport tcp -fflags nobuffer -flags low_delay " +
      `-i rtsp://127.0.0.1:8554/cam_${slug}_raw ` +
      "-map 0:v:0 -an " +
      "-c:v libx264 -preset ultrafast -tune zerolatency " +
      "-profile:v baseline -level 4.1 -pix_fmt yuv420p " +
      `-g ${gop} -keyint_min ${gop} -sc_threshold 0 ` +
      "-b:v 1500k -maxrate 1500k -bufsize 1500k " +
      `-f rtsp -rtsp_transport tcp rtsp://127.0.0.1:8554/cam_${slug}`
    );
  }

  const paths = rows
    .flatMap((r) => {
      const slug = r.id.replaceAll("-", "_");
      // Fall back to 25 when the camera hasn't been probed yet (offline at
      // add-time); a later restart picks up the real value.
      const fps = r.stream_fps && r.stream_fps > 0 ? r.stream_fps : 25;
      return [
        `  cam_${slug}_raw:`,
        `    source: ${r.rtsp_url}`,
        `    sourceOnDemand: yes`,
        `    sourceOnDemandCloseAfter: 30s`,
        `  cam_${slug}:`,
        `    source: publisher`,
        `    runOnDemand: ${transcodeCmd(slug, fps)}`,
        `    runOnDemandRestart: yes`,
        `    runOnDemandStartTimeout: 10s`,
        `    runOnDemandCloseAfter: 10s`,
      ];
    })
    .join("\n");

  // WebRTC media is peer-to-peer (ICE/SRTP) and cannot ride the Caddy HTTP
  // tunnel like the WHEP signaling does. Pin all ICE to a single UDP+TCP
  // port (8189, published to the host in compose) and advertise ONLY a
  // host-reachable address — Docker-internal interface IPs (172.x) are
  // useless to the browser and just slow ICE, so disable interface
  // gathering. WEBRTC_ADVERTISE_HOST is comma-separated (default localhost).
  const advertiseHosts = (process.env.WEBRTC_ADVERTISE_HOST ?? "127.0.0.1")
    .split(",")
    .map((h) => h.trim())
    .filter(Boolean);

  return [
    "logLevel: info",
    "rtsp: yes",
    "rtspAddress: :8554",
    "webrtc: yes",
    "webrtcAddress: :8889",
    "webrtcAllowOrigins: ['*']",
    "webrtcLocalUDPAddress: :8189",
    "webrtcLocalTCPAddress: :8189",
    "webrtcIPsFromInterfaces: no",
    `webrtcAdditionalHosts: [${advertiseHosts.join(", ")}]`,
    "hls: yes",
    "hlsAddress: :8888",
    "hlsAllowOrigins: ['*']",
    "hlsVariant: lowLatency",
    "hlsSegmentCount: 7",
    "hlsSegmentDuration: 200ms",
    "hlsPartDuration: 100ms",
    "hlsAlwaysRemux: yes",
    "paths:",
    paths || "  all_others:\n    source: publisher\n",
  ].join("\n");
}

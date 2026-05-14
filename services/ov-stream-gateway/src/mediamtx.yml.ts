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
  const rows = await sql<Array<{ id: string; rtsp_url: string }>>`
    SELECT id, rtsp_url FROM cameras WHERE enabled = true
  `;

  // Per-camera transcode pipeline. We don't use $MTX_PATH substitution
  // because mediamtx's parser would greedily match `$MTX_PATH_raw` as a
  // single (undefined) variable and feed ffmpeg an empty path. Hardcoding
  // both source and sink names per camera keeps the substitution surface
  // zero. Audio dropped (-an): Hikvision G.711 blows up libx264's muxing
  // queue. GOP = fps so LL-HLS parts can align on keyframes. baseline
  // profile + yuv420p maximises Chrome/Firefox compat.
  function transcodeCmd(slug: string): string {
    return (
      "ffmpeg -rtsp_transport tcp -fflags nobuffer -flags low_delay " +
      `-i rtsp://127.0.0.1:8554/cam_${slug}_raw ` +
      "-map 0:v:0 -an " +
      "-c:v libx264 -preset ultrafast -tune zerolatency " +
      "-profile:v baseline -level 4.1 -pix_fmt yuv420p " +
      "-g 25 -keyint_min 25 -sc_threshold 0 " +
      "-b:v 1500k -maxrate 1500k -bufsize 1500k " +
      `-f rtsp -rtsp_transport tcp rtsp://127.0.0.1:8554/cam_${slug}`
    );
  }

  const paths = rows
    .flatMap((r) => {
      const slug = r.id.replaceAll("-", "_");
      return [
        `  cam_${slug}_raw:`,
        `    source: ${r.rtsp_url}`,
        `    sourceOnDemand: yes`,
        `    sourceOnDemandCloseAfter: 30s`,
        `  cam_${slug}:`,
        `    source: publisher`,
        `    runOnDemand: ${transcodeCmd(slug)}`,
        `    runOnDemandRestart: yes`,
        `    runOnDemandStartTimeout: 10s`,
        `    runOnDemandCloseAfter: 10s`,
      ];
    })
    .join("\n");

  return [
    "logLevel: info",
    "rtsp: yes",
    "rtspAddress: :8554",
    "webrtc: yes",
    "webrtcAddress: :8889",
    "webrtcAllowOrigins: ['*']",
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

import { Hono } from "hono";
import postgres from "postgres";

export function makeSystemRoutes(sql: ReturnType<typeof postgres>) {
  const app = new Hono();

  app.get("/status", async (c) => {
    const services = [
      { name: "ov-ingestor", url: "http://ov-ingestor:8000/health" },
      { name: "ov-detector", url: "http://ov-detector:8000/health" },
      { name: "ov-clip-builder", url: "http://ov-clip-builder:8000/health" },
      { name: "ov-vlm", url: "http://ov-vlm:8000/health" },
      { name: "ov-incident-engine", url: "http://ov-incident-engine:8001/health" },
      { name: "ov-notifier", url: "http://ov-notifier:8002/health" },
      { name: "ov-agent", url: "http://ov-agent:3000/health" },
      { name: "ov-whatsapp", url: "http://ov-whatsapp:3010/health" },
      { name: "ov-telegram", url: "http://ov-telegram:8003/health" },
      // 8989 = the gateway's own control server (Hono /health). 8889 is
      // mediamtx's WebRTC port — no /health there → a false "offline".
      { name: "ov-stream-gateway", url: "http://ov-stream-gateway:8989/health" },
    ];
    const results = await Promise.all(
      services.map(async (s) => {
        try {
          const r = await fetch(s.url, { signal: AbortSignal.timeout(2000) });
          return { name: s.name, ok: r.ok, status: r.status };
        } catch {
          return { name: s.name, ok: false, status: "down" };
        }
      }),
    );
    const counts = await sql<any[]>`
      SELECT
        (SELECT count(*)::int FROM cameras) AS cameras,
        (SELECT count(*)::int FROM incidents WHERE status = 'open') AS open_incidents,
        (SELECT count(*)::int FROM subscribers WHERE enabled) AS subscribers
    `;
    return c.json({ services: results, counts: counts[0] ?? {} });
  });

  return app;
}

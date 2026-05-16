import { createServer } from "node:http";
import { makeLogger, makeRedis } from "@overwatch/shared-ts";
import { IncidentEngine } from "./engine.js";

const log = makeLogger("ov-incident-engine");
const databaseUrl = process.env.DATABASE_URL ?? "postgres://overwatch:overwatch@postgres:5432/overwatch";

async function main() {
  const redis = makeRedis();
  const engine = new IncidentEngine({ databaseUrl, redis });
  await engine.start();
  log.info("incident engine started");

  const server = createServer((req, res) => {
    if (req.url === "/health") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true, service: "ov-incident-engine" }));
      return;
    }
    res.writeHead(404);
    res.end();
  });
  server.listen(8001, () => log.info({ port: 8001 }, "health server"));

  const onSignal = async () => {
    log.info("shutting down");
    await engine.shutdown();
    server.close();
    await redis.quit();
    process.exit(0);
  };
  process.on("SIGINT", onSignal);
  process.on("SIGTERM", onSignal);
}

main().catch((e) => {
  log.error({ err: e }, "fatal");
  process.exit(1);
});

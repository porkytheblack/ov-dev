/**
 * station-kit server config (run by the `ov-station-api` container via the
 * `station` CLI). Exposes the Station v1 HTTP API (`/api/v1/*`) — remote
 * trigger-broadcast, run status, API-key management — and the dashboard.
 *
 * `runRunners: true`: this process runs the signal + broadcast runners
 * (so the v1 API's trigger-broadcast actually executes) plus the recurring
 * signals (window-summaries, r2-sweep, storage-prune). The `ov-station` container is now just
 * a thin Redis→remote-trigger bridge and runs no runners.
 *
 * Both the API-key store and the run-log store are Postgres-backed
 * (station-kit 1.1.0 pluggable adapters) — no SQLite, no native deps, no
 * volume; everything persists in the same Postgres as the rest of Station.
 */
import { defineConfig } from "station-kit";
import { PostgresAdapter } from "station-adapter-postgres";
import { BroadcastPostgresAdapter } from "station-adapter-postgres/broadcast";
import { PgKeyStorage } from "./src/pg-key-storage.js";
import { PgLogStorage } from "./src/pg-log-storage.js";

const connectionString =
  process.env.DATABASE_URL ?? "postgres://overwatch:overwatch@postgres:5432/overwatch";

export default defineConfig({
  host: "0.0.0.0",
  port: Number(process.env.STATION_API_PORT ?? 4400),
  // Postgres-backed key + log stores → stationDir holds nothing durable.
  stationDir: process.env.STATION_DIR ?? "/tmp/station",
  runRunners: true,
  open: false,
  signalsDir: "./src/signals",
  broadcastsDir: "./src/broadcasts",
  adapter: new PostgresAdapter({ connectionString, tableName: "station_runs" }),
  broadcastAdapter: new BroadcastPostgresAdapter({ connectionString }),
  logStorage: new PgLogStorage(connectionString),
  auth: {
    username: process.env.STATION_DASHBOARD_USER ?? "admin",
    password: process.env.STATION_DASHBOARD_PASSWORD ?? "overwatch",
    keyStorage: new PgKeyStorage(connectionString),
  },
});

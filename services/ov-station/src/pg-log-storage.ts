/**
 * Postgres-backed station-kit run-log store.
 *
 * station-kit 1.1.0's default `FileLogStorage` is single-process JSONL.
 * We back logs with the same Postgres as everything else — durable,
 * multi-process safe, no file volume, no native dep.
 */
import postgres from "postgres";
import type { LogStorageAdapter } from "station-kit/server";
import type { LogEntry } from "station-kit/server";

export class PgLogStorage implements LogStorageAdapter {
  private sql: ReturnType<typeof postgres>;
  private ready?: Promise<void>;

  constructor(connectionString: string) {
    this.sql = postgres(connectionString, { max: 2 });
  }

  private ensure(): Promise<void> {
    if (!this.ready) {
      this.ready = (async () => {
        await this.sql`
          CREATE TABLE IF NOT EXISTS station_logs (
            id          BIGSERIAL PRIMARY KEY,
            run_id      TEXT NOT NULL,
            signal_name TEXT NOT NULL,
            level       TEXT NOT NULL,
            message     TEXT NOT NULL,
            ts          TIMESTAMPTZ NOT NULL
          )
        `;
        await this.sql`
          CREATE INDEX IF NOT EXISTS idx_station_logs_run ON station_logs (run_id, id)
        `;
      })();
    }
    return this.ready;
  }

  async add(entry: LogEntry): Promise<void> {
    await this.ensure();
    await this.sql`
      INSERT INTO station_logs (run_id, signal_name, level, message, ts)
      VALUES (${entry.runId}, ${entry.signalName}, ${entry.level}, ${entry.message}, ${entry.timestamp})
    `;
  }

  async get(runId: string): Promise<LogEntry[]> {
    await this.ensure();
    const rows = await this.sql<
      { run_id: string; signal_name: string; level: string; message: string; ts: Date }[]
    >`
      SELECT run_id, signal_name, level, message, ts
        FROM station_logs WHERE run_id = ${runId} ORDER BY id ASC
    `;
    return rows.map((r) => ({
      runId: r.run_id,
      signalName: r.signal_name,
      level: r.level as LogEntry["level"],
      message: r.message,
      timestamp: new Date(r.ts).toISOString(),
    }));
  }

  async close(): Promise<void> {
    await this.sql.end({ timeout: 5 });
  }
}

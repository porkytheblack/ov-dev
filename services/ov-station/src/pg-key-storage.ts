/**
 * Postgres-backed station-kit API-key store.
 *
 * station-kit's default key store is SQLite (better-sqlite3). We don't want
 * a native dep or a separate file/volume, so we implement the pluggable
 * `ApiKeyStorageAdapter` against the same Postgres the rest of Station uses
 * — keys persist alongside everything else and survive restarts.
 */
import postgres from "postgres";
import type { ApiKey, ApiKeyPublic, ApiKeyStorageAdapter } from "station-kit/server";

export class PgKeyStorage implements ApiKeyStorageAdapter {
  private sql: ReturnType<typeof postgres>;
  private ready?: Promise<void>;

  constructor(connectionString: string) {
    this.sql = postgres(connectionString, { max: 2 });
  }

  private ensure(): Promise<void> {
    if (!this.ready) {
      this.ready = (async () => {
        await this.sql`
          CREATE TABLE IF NOT EXISTS station_api_keys (
            id          TEXT PRIMARY KEY,
            name        TEXT NOT NULL,
            key_hash    TEXT NOT NULL UNIQUE,
            key_prefix  TEXT NOT NULL,
            scopes      TEXT[] NOT NULL DEFAULT '{}',
            created_at  TIMESTAMPTZ NOT NULL,
            last_used   TIMESTAMPTZ,
            expires_at  TIMESTAMPTZ,
            revoked     BOOLEAN NOT NULL DEFAULT false
          )
        `;
      })();
    }
    return this.ready;
  }

  private static toApiKey(r: any): ApiKey {
    return {
      id: r.id,
      name: r.name,
      keyHash: r.key_hash,
      keyPrefix: r.key_prefix,
      scopes: r.scopes ?? [],
      createdAt: new Date(r.created_at).toISOString(),
      lastUsed: r.last_used ? new Date(r.last_used).toISOString() : null,
      expiresAt: r.expires_at ? new Date(r.expires_at).toISOString() : null,
      revoked: r.revoked,
    };
  }

  async insert(record: ApiKey): Promise<void> {
    await this.ensure();
    await this.sql`
      INSERT INTO station_api_keys
        (id, name, key_hash, key_prefix, scopes, created_at, last_used, expires_at, revoked)
      VALUES (
        ${record.id}, ${record.name}, ${record.keyHash}, ${record.keyPrefix},
        ${record.scopes as unknown as string[]}, ${record.createdAt},
        ${record.lastUsed}, ${record.expiresAt}, ${record.revoked}
      )
    `;
  }

  async findByHash(keyHash: string): Promise<ApiKey | null> {
    await this.ensure();
    const rows = await this.sql<any[]>`
      SELECT * FROM station_api_keys WHERE key_hash = ${keyHash} LIMIT 1
    `;
    return rows[0] ? PgKeyStorage.toApiKey(rows[0]) : null;
  }

  async list(): Promise<ApiKeyPublic[]> {
    await this.ensure();
    const rows = await this.sql<any[]>`
      SELECT * FROM station_api_keys ORDER BY created_at DESC
    `;
    return rows.map((r) => {
      const { keyHash: _drop, ...pub } = PgKeyStorage.toApiKey(r);
      return pub;
    });
  }

  async touch(id: string, lastUsedIso: string): Promise<void> {
    await this.ensure();
    await this.sql`
      UPDATE station_api_keys SET last_used = ${lastUsedIso} WHERE id = ${id}
    `;
  }

  async revoke(id: string): Promise<boolean> {
    await this.ensure();
    const rows = await this.sql<any[]>`
      UPDATE station_api_keys SET revoked = true
       WHERE id = ${id} AND revoked = false
       RETURNING id
    `;
    return rows.length > 0;
  }

  async close(): Promise<void> {
    await this.sql.end({ timeout: 5 });
  }
}

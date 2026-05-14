import { hash, verify } from "@node-rs/argon2";
import { randomBytes } from "node:crypto";
import postgres from "postgres";

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

const argonOpts = { memoryCost: 19456, timeCost: 2, outputLen: 32, parallelism: 1 };

export async function hashPassword(plain: string): Promise<string> {
  return await hash(plain, argonOpts);
}

export async function verifyPassword(stored: string, plain: string): Promise<boolean> {
  try {
    return await verify(stored, plain, argonOpts);
  } catch {
    return false;
  }
}

export function generateSessionId(): string {
  return randomBytes(32).toString("base64url");
}

export class AuthService {
  constructor(private sql: ReturnType<typeof postgres>) {}

  async createSession(userId: string): Promise<{ id: string; expiresAt: Date }> {
    const id = generateSessionId();
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    await this.sql`
      INSERT INTO sessions (id, user_id, expires_at)
      VALUES (${id}, ${userId}::uuid, ${expiresAt})
    `;
    return { id, expiresAt };
  }

  async getUserBySession(sessionId: string): Promise<{ id: string; username: string; role: string } | null> {
    const rows = await this.sql<Array<{ id: string; username: string; role: string; expiresAt: Date }>>`
      SELECT u.id, u.username, u.role, s.expires_at AS "expiresAt"
        FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.id = ${sessionId}
    `;
    const row = rows[0];
    if (!row) return null;
    if (row.expiresAt.getTime() < Date.now()) {
      await this.sql`DELETE FROM sessions WHERE id = ${sessionId}`;
      return null;
    }
    return { id: row.id, username: row.username, role: row.role };
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.sql`DELETE FROM sessions WHERE id = ${sessionId}`;
  }
}

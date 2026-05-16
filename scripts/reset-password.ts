/**
 * CLI password reset (no email recovery exists in v1).
 * Usage: tsx scripts/reset-password.ts <username> [<new-password>]
 *   If no password is provided, a random one is generated and printed.
 */
import { hash } from "@node-rs/argon2";
import { randomBytes } from "node:crypto";
import postgres from "postgres";

async function main() {
  const username = process.argv[2];
  if (!username) {
    console.error("Usage: tsx scripts/reset-password.ts <username> [<new-password>]");
    process.exit(2);
  }
  const password = process.argv[3] ?? randomBytes(12).toString("base64url");
  const sql = postgres(process.env.DATABASE_URL ?? "postgres://overwatch:overwatch@localhost:5432/overwatch");
  const hashed = await hash(password, { memoryCost: 19456, timeCost: 2, outputLen: 32, parallelism: 1 });
  const rows = await sql`
    UPDATE users SET password_hash = ${hashed} WHERE username = ${username}
    RETURNING id
  `;
  if (rows.length === 0) {
    console.error(`User '${username}' not found`);
    process.exit(1);
  }
  console.log(`Reset password for ${username}. New password: ${password}`);
  await sql.end();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});

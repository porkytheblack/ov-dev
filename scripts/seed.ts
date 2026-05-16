/**
 * Seed: ensures retention policies, registers a synthetic test RTSP camera
 * (if SEED_TEST_CAMERA=1), and writes a default WhatsApp/Telegram bot config
 * row (disabled by default).
 *
 * Run: `tsx scripts/seed.ts` from the repo root.
 */
import postgres from "postgres";
import { v4 as uuid } from "uuid";

const sql = postgres(
  process.env.DATABASE_URL ?? "postgres://overwatch:overwatch@localhost:5432/overwatch",
);

async function main() {
  // Retention defaults (idempotent).
  for (const [kind, days] of [
    ["segment", 7],
    ["clip_regular", 3],
    ["clip_incident", 90],
    ["detection", 14],
  ] as const) {
    const rows = await sql<{ count: number }[]>`SELECT count(*)::int AS count FROM retention_policies WHERE kind = ${kind}`;
    if ((rows[0]?.count ?? 0) === 0) {
      await sql`INSERT INTO retention_policies (id, kind, retention_days) VALUES (${uuid()}, ${kind}, ${days})`;
    }
  }

  if (process.env.SEED_TEST_CAMERA === "1") {
    const existing = await sql<{ id: string }[]>`SELECT id FROM cameras WHERE name = 'Test camera'`;
    if (existing.length === 0) {
      const id = uuid();
      await sql`
        INSERT INTO cameras (id, name, rtsp_url, sample_fps)
        VALUES (${id}, 'Test camera', 'rtsp://mediamtx:8554/test', 5)
      `;
      console.log(`Seeded test camera ${id}`);
    }
  }

  console.log("Seed complete.");
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

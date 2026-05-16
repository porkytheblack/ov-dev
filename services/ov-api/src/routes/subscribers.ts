import { Hono } from "hono";
import postgres from "postgres";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { v4 as uuid } from "uuid";

const subInput = z.object({
  channel: z.enum(["whatsapp", "telegram"]),
  handle: z.string().min(1),
  camera_ids: z.array(z.string().uuid()).optional(),
});

export function makeSubscriberRoutes(sql: ReturnType<typeof postgres>) {
  const app = new Hono();

  app.get("/", async (c) => {
    const rows = await sql<any[]>`SELECT * FROM subscribers ORDER BY created_at`;
    return c.json({ subscribers: rows });
  });

  app.post("/", zValidator("json", subInput), async (c) => {
    const b = c.req.valid("json");
    const userRows = await sql<any[]>`SELECT id FROM users ORDER BY created_at LIMIT 1`;
    const userId = userRows[0]?.id;
    if (!userId) return c.json({ error: "no user; complete the first-boot wizard" }, 400);
    const id = uuid();
    await sql`
      INSERT INTO subscribers (id, user_id, channel, handle, camera_ids)
      VALUES (${id}, ${userId}::uuid, ${b.channel}, ${b.handle},
              ${(b.camera_ids ?? []) as unknown as string[]}::uuid[])
      ON CONFLICT (channel, handle) DO UPDATE
         SET camera_ids = EXCLUDED.camera_ids, enabled = true
    `;
    return c.json({ id });
  });

  app.delete("/:id", async (c) => {
    const id = c.req.param("id");
    await sql`DELETE FROM subscribers WHERE id = ${id}::uuid`;
    return c.json({ ok: true });
  });

  return app;
}

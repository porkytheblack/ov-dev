import { Hono } from "hono";
import postgres from "postgres";

export function makeBotConfigRoutes(sql: ReturnType<typeof postgres>) {
  const app = new Hono();

  app.get("/:channel", async (c) => {
    const ch = c.req.param("channel");
    const rows = await sql<any[]>`SELECT * FROM bot_configs WHERE channel = ${ch}`;
    return c.json(rows[0] ?? null);
  });

  app.put("/:channel", async (c) => {
    const ch = c.req.param("channel");
    const body = await c.req.json();
    await sql`
      INSERT INTO bot_configs (channel, config, enabled)
      VALUES (${ch}, ${JSON.stringify(body.config ?? {})}::jsonb, ${!!body.enabled})
      ON CONFLICT (channel) DO UPDATE
         SET config = EXCLUDED.config, enabled = EXCLUDED.enabled
    `;
    return c.json({ ok: true });
  });

  return app;
}

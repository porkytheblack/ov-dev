import { createMiddleware } from "hono/factory";
import { getCookie } from "hono/cookie";
import postgres from "postgres";
import { AuthService } from "./auth.js";

export function requireAuth(sql: ReturnType<typeof postgres>) {
  const auth = new AuthService(sql);
  return createMiddleware<{ Variables: { user: { id: string; username: string; role: string } } }>(
    async (c, next) => {
      const session =
        getCookie(c, "ov_session") ?? c.req.header("authorization")?.replace(/^bearer\s+/i, "");
      if (!session) return c.json({ error: "unauthorized" }, 401);
      const user = await auth.getUserBySession(session);
      if (!user) return c.json({ error: "unauthorized" }, 401);
      c.set("user", user);
      await next();
    },
  );
}

import { Hono } from "hono";
import { setCookie, deleteCookie, getCookie } from "hono/cookie";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { v4 as uuid } from "uuid";
import postgres from "postgres";
import { AuthService, hashPassword, verifyPassword } from "../auth.js";

export function makeAuthRoutes(sql: ReturnType<typeof postgres>) {
  const auth = new AuthService(sql);
  const app = new Hono();

  const loginSchema = z.object({ username: z.string().min(1), password: z.string().min(1) });
  const wizardSchema = z.object({ username: z.string().min(1), password: z.string().min(8) });

  app.get("/me", async (c) => {
    const session =
      getCookie(c, "ov_session") ?? c.req.header("authorization")?.replace(/^bearer\s+/i, "");
    if (!session) return c.json({ user: null });
    const user = await auth.getUserBySession(session);
    return c.json({ user });
  });

  app.post("/login", zValidator("json", loginSchema), async (c) => {
    const { username, password } = c.req.valid("json");
    const rows = await sql<Array<{ id: string; passwordHash: string }>>`
      SELECT id, password_hash AS "passwordHash" FROM users WHERE username = ${username}
    `;
    const u = rows[0];
    if (!u || !(await verifyPassword(u.passwordHash, password))) {
      return c.json({ error: "invalid credentials" }, 401);
    }
    const sess = await auth.createSession(u.id);
    setCookie(c, "ov_session", sess.id, {
      httpOnly: true,
      sameSite: "Lax",
      path: "/",
      expires: sess.expiresAt,
    });
    return c.json({ session_id: sess.id, expires_at: sess.expiresAt.toISOString() });
  });

  app.post("/logout", async (c) => {
    const session = getCookie(c, "ov_session");
    if (session) await auth.deleteSession(session);
    deleteCookie(c, "ov_session", { path: "/" });
    return c.json({ ok: true });
  });

  // First-boot wizard: only succeeds when the users table is empty.
  app.post("/wizard", zValidator("json", wizardSchema), async (c) => {
    const { username, password } = c.req.valid("json");
    const count = await sql<Array<{ n: number }>>`SELECT count(*)::int AS n FROM users`;
    if ((count[0]?.n ?? 0) > 0) return c.json({ error: "already initialized" }, 409);
    const id = uuid();
    await sql`
      INSERT INTO users (id, username, password_hash, role)
      VALUES (${id}, ${username}, ${await hashPassword(password)}, 'operator')
    `;
    const sess = await auth.createSession(id);
    setCookie(c, "ov_session", sess.id, {
      httpOnly: true,
      sameSite: "Lax",
      path: "/",
      expires: sess.expiresAt,
    });
    return c.json({ user: { id, username, role: "operator" }, session_id: sess.id });
  });

  return { app, auth };
}

/**
 * Server-side fetch helper. Always called from server components, where we
 * talk to ov-api directly on the docker network — NOT through Caddy. The
 * browser uses relative URLs (e.g. `fetch("/api/auth/me")`) which Caddy
 * intercepts at `/api/*` and forwards to ov-api.
 *
 * INTERNAL_API_URL overrides the default. NEXT_PUBLIC_API_URL is no longer
 * read — keep browser calls relative.
 */
export const API_BASE = process.env.INTERNAL_API_URL ?? "http://ov-api:3001";

export async function api<T = unknown>(
  path: string,
  init?: RequestInit & { cookie?: string },
): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.cookie) headers.set("cookie", init.cookie);
  if (init?.body && !headers.has("content-type"))
    headers.set("content-type", "application/json");
  const url = `${API_BASE}${path.startsWith("/api") ? path : `/api${path}`}`;
  const res = await fetch(url, { ...init, headers, cache: "no-store" });
  if (!res.ok) {
    throw new Error(`api ${path} ${res.status}: ${await res.text()}`);
  }
  return (await res.json()) as T;
}

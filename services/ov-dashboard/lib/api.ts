/**
 * Server-side fetch helper. Forwards cookies from the incoming request so
 * authenticated requests work without exposing the API to the browser directly.
 */
export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://ov-api:3001";

export async function api<T = unknown>(
  path: string,
  init?: RequestInit & { cookie?: string },
): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.cookie) headers.set("cookie", init.cookie);
  if (init?.body && !headers.has("content-type"))
    headers.set("content-type", "application/json");
  const res = await fetch(`${API_BASE}${path.startsWith("/api") ? path : `/api${path}`}`, {
    ...init,
    headers,
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`api ${path} ${res.status}: ${await res.text()}`);
  }
  return (await res.json()) as T;
}

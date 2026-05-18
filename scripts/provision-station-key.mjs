/**
 * Provision a Station API key.
 *
 * Run inside the ov-station-api container (it serves station-kit on
 * localhost:STATION_API_PORT). Logs in with the configured admin
 * credentials, mints an API key with `trigger` + `read` scopes, and prints
 * the `sk_live_...` value on stdout (everything else goes to stderr so the
 * key can be captured cleanly).
 *
 *   make station-key
 *
 * The key store is SQLite under STATION_DIR (mounted on the station-data
 * volume), so the key survives container restarts.
 */
(async () => {
  const port = process.env.STATION_API_PORT || "4400";
  // 127.0.0.1, not localhost: the container resolves localhost to IPv6 ::1
  // but station-kit binds IPv4 0.0.0.0.
  const base = `http://127.0.0.1:${port}`;
  const username = process.env.STATION_DASHBOARD_USER || "admin";
  const password = process.env.STATION_DASHBOARD_PASSWORD || "overwatch";

  const login = await fetch(`${base}/api/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!login.ok) {
    console.error(`login failed: ${login.status} ${await login.text()}`);
    process.exit(1);
  }
  const setCookies =
    typeof login.headers.getSetCookie === "function"
      ? login.headers.getSetCookie()
      : [login.headers.get("set-cookie")].filter(Boolean);
  const cookie = setCookies
    .map((c) => String(c).split(";")[0])
    .join("; ");

  const res = await fetch(`${base}/api/v1/keys`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ name: "overwatch-ov-api", scopes: ["trigger", "read"] }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body?.data?.key) {
    console.error(`key creation failed: ${res.status} ${JSON.stringify(body)}`);
    process.exit(1);
  }
  console.error("Station API key provisioned (scopes: trigger, read).");
  console.error("Set this in .env as STATION_API_KEY and restart ov-api:");
  console.log(body.data.key);
})();

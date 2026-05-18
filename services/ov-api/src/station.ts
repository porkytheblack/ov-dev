/**
 * Thin client for the Station v1 HTTP API (served by the `ov-station-api`
 * container / station-kit). Used to remotely trigger the vision broadcast
 * and poll its run status with a provisioned API key.
 */
const ENDPOINT = (process.env.STATION_ENDPOINT ?? "http://ov-station-api:4400").replace(/\/+$/, "");
const API_KEY = process.env.STATION_API_KEY ?? "";

export function stationConfigured(): boolean {
  return API_KEY !== "";
}

function headers(): Record<string, string> {
  return {
    "content-type": "application/json",
    authorization: `Bearer ${API_KEY}`,
  };
}

export interface BroadcastRun {
  id: string;
  broadcastName?: string;
  status: string;
  createdAt?: string;
}

/** Trigger a broadcast; returns the broadcast run id. */
export async function triggerBroadcast(
  broadcastName: string,
  input: Record<string, unknown>,
): Promise<BroadcastRun> {
  const res = await fetch(`${ENDPOINT}/api/v1/trigger-broadcast`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ broadcastName, input }),
  });
  const body = (await res.json().catch(() => ({}))) as {
    data?: BroadcastRun;
    error?: string;
    message?: string;
  };
  if (!res.ok || !body.data) {
    throw new Error(
      `station trigger ${res.status}: ${body.message ?? body.error ?? "unknown"}`,
    );
  }
  return body.data;
}

/** Fetch a broadcast run's current status (null if not found / unreachable). */
export async function getBroadcastRun(id: string): Promise<BroadcastRun | null> {
  try {
    const res = await fetch(`${ENDPOINT}/api/v1/broadcast-runs/${encodeURIComponent(id)}`, {
      headers: headers(),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { data?: BroadcastRun };
    return body.data ?? null;
  } catch {
    return null;
  }
}

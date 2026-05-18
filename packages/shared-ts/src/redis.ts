import { Redis } from "ioredis";
import type { ZodTypeAny, z } from "zod";

export function makeRedis(): Redis {
  const url = process.env.REDIS_URL ?? "redis://redis:6379";
  return new Redis(url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    // Self-heal when Redis is recreated/restarted (host reboot, AOF
    // self-repair, config change). Without these, ioredis can wedge on a
    // dead socket and consumers (e.g. the Telegram outbox) silently stop
    // delivering. Re-resolve DNS + retry forever with bounded backoff.
    retryStrategy: (times: number) => Math.min(times * 200, 5000),
    reconnectOnError: () => true,
    connectTimeout: 10_000,
    keepAlive: 10_000,
    enableOfflineQueue: true,
  });
}

export type StreamMessage = {
  id: string;
  fields: Record<string, string>;
};

export async function ensureGroup(redis: Redis, stream: string, group: string) {
  try {
    await redis.xgroup("CREATE", stream, group, "$", "MKSTREAM");
  } catch (e) {
    const msg = (e as Error).message ?? "";
    if (!msg.includes("BUSYGROUP")) throw e;
  }
}

export async function publishEvent(
  redis: Redis,
  stream: string,
  payload: Record<string, unknown>,
): Promise<string> {
  const fields: string[] = [];
  for (const [k, v] of Object.entries(payload)) {
    fields.push(k);
    fields.push(typeof v === "string" ? v : JSON.stringify(v));
  }
  return (await redis.xadd(stream, "*", ...fields)) as string;
}

function decodeFields<T extends ZodTypeAny>(
  raw: string[],
  schema: T,
): z.infer<T> {
  const obj: Record<string, unknown> = {};
  for (let i = 0; i < raw.length; i += 2) {
    const key = raw[i]!;
    const val = raw[i + 1]!;
    if (val.startsWith("{") || val.startsWith("[")) {
      try {
        obj[key] = JSON.parse(val);
        continue;
      } catch {
        /* fallthrough */
      }
    }
    if (val === "true") obj[key] = true;
    else if (val === "false") obj[key] = false;
    else if (
      val !== "" &&
      !Number.isNaN(Number(val)) &&
      !key.endsWith("_id") &&
      key !== "type" &&
      // `handle` is a messenger id (e.g. a Telegram chat id) — always a
      // string in the schemas. Coercing an all-digit chat id to a number
      // makes Zod reject the whole event, silently dropping clips/alerts.
      key !== "handle"
    ) {
      const n = Number(val);
      // Keep ISO strings (they contain dashes/colons/etc) as strings; only coerce pure numerics.
      obj[key] = /^-?\d+(?:\.\d+)?$/.test(val) ? n : val;
    } else obj[key] = val;
  }
  return schema.parse(obj);
}

export type GroupConsumer<T extends ZodTypeAny> = {
  consume: (
    handler: (event: z.infer<T>, id: string) => Promise<void>,
    opts?: { signal?: AbortSignal; blockMs?: number; count?: number },
  ) => Promise<void>;
};

export function createGroupConsumer<T extends ZodTypeAny>(args: {
  redis: Redis;
  stream: string;
  group: string;
  consumer: string;
  schema: T;
  onParseError?: (id: string, err: Error, fields: string[]) => void;
}): GroupConsumer<T> {
  const { redis, stream, group, consumer, schema, onParseError } = args;
  return {
    async consume(handler, opts) {
      await ensureGroup(redis, stream, group);
      const count = opts?.count ?? 16;

      const process = async (messages: Array<[string, string[]]>) => {
        for (const [id, fields] of messages) {
          try {
            const event = decodeFields(fields, schema);
            await handler(event, id);
            await redis.xack(stream, group, id);
          } catch (e) {
            onParseError?.(id, e as Error, fields);
            // Ack to avoid poison-pill loops; messages persist via PEL.
            await redis.xack(stream, group, id);
          }
        }
      };

      // Reclaim messages orphaned by a consumer that died/restarted so
      // events are never silently lost. CRITICAL: this must never block
      // the main read. With `maxRetriesPerRequest: null` a command issued
      // during a reconnect queues forever, so a bare `await xautoclaim`
      // here would freeze the whole consumer (observed: clips/alerts
      // silently stopping). It is therefore throttled AND hard-timeboxed,
      // and the main xreadgroup always runs regardless.
      const RECLAIM_IDLE_MS = 30_000;
      const RECLAIM_EVERY_MS = 30_000;
      const RECLAIM_BUDGET_MS = 4_000;
      let lastReclaim = 0;
      const reclaimStale = async () => {
        let cursor = "0-0";
        for (let i = 0; i < 5; i++) {
          const out = (await redis.xautoclaim(
            stream,
            group,
            consumer,
            RECLAIM_IDLE_MS,
            cursor,
            "COUNT",
            String(count),
          )) as [string, Array<[string, string[]]>, string[]] | null;
          if (!out) break;
          const [next, claimed] = out;
          if (claimed?.length) await process(claimed);
          cursor = next;
          if (!cursor || cursor === "0-0") break;
        }
      };
      const tryReclaim = async () => {
        if (Date.now() - lastReclaim < RECLAIM_EVERY_MS) return;
        lastReclaim = Date.now();
        await Promise.race([
          reclaimStale(),
          new Promise((resolve) => setTimeout(resolve, RECLAIM_BUDGET_MS)),
        ]).catch(() => {
          /* timed out / unsupported / transient — never block consuming */
        });
      };

      while (!opts?.signal?.aborted) {
        try {
          await tryReclaim();
          const res = (await redis.xreadgroup(
            "GROUP",
            group,
            consumer,
            "COUNT",
            String(count),
            "BLOCK",
            String(opts?.blockMs ?? 5000),
            "STREAMS",
            stream,
            ">",
          )) as Array<[string, Array<[string, string[]]>]> | null;
          if (!res) continue;
          for (const [, messages] of res) {
            await process(messages);
          }
        } catch (e) {
          if (opts?.signal?.aborted) return;
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
    },
  };
}

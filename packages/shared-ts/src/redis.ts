import { Redis } from "ioredis";
import type { ZodTypeAny, z } from "zod";

export function makeRedis(): Redis {
  const url = process.env.REDIS_URL ?? "redis://redis:6379";
  return new Redis(url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
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
    else if (val !== "" && !Number.isNaN(Number(val)) && !key.endsWith("_id") && key !== "type") {
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
      while (!opts?.signal?.aborted) {
        try {
          const res = (await redis.xreadgroup(
            "GROUP",
            group,
            consumer,
            "COUNT",
            String(opts?.count ?? 16),
            "BLOCK",
            String(opts?.blockMs ?? 5000),
            "STREAMS",
            stream,
            ">",
          )) as Array<[string, Array<[string, string[]]>]> | null;
          if (!res) continue;
          for (const [, messages] of res) {
            for (const [id, fields] of messages) {
              try {
                const event = decodeFields(fields, schema);
                await handler(event, id);
                await redis.xack(stream, group, id);
              } catch (e) {
                onParseError?.(id, e as Error, fields);
                // Ack to avoid poison-pill loops; messages persist via PEL for inspection.
                await redis.xack(stream, group, id);
              }
            }
          }
        } catch (e) {
          if (opts?.signal?.aborted) return;
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
    },
  };
}

/**
 * Shared singletons for the Station service: the Postgres connection string
 * (Station's Postgres adapters create their own pools against it), a
 * `postgres` client for our own incident/camera/subscriber queries, a Redis
 * handle, and the logger.
 */
import postgres from "postgres";
import { makeLogger, makeRedis, type Logger } from "@overwatch/shared-ts";

export const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgres://overwatch:overwatch@postgres:5432/overwatch";

export const log: Logger = makeLogger("ov-station");

export const sql = postgres(DATABASE_URL, { max: 6 });

export const redis = makeRedis();

/** Minutes an analysis clip may live in R2 before the sweep reclaims it. */
export const R2_TTL_MINUTES = Number(process.env.R2_TTL_MINUTES ?? 30) || 30;

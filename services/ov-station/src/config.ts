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

/**
 * Budget/shape for the clip handed to the vision model. The OpenRouter path
 * base64-inlines the clip bytes into the request body (~+33% overhead), so a
 * raw >30MB clip blows the provider limit. We re-encode every clip to fit
 * ANALYSIS_MAX_MB, dropping audio and capping resolution/fps/duration. Keep
 * MAX_MB comfortably under the provider's hard limit to leave room for base64.
 */
export const ANALYSIS_MAX_MB = Number(process.env.ANALYSIS_MAX_MB ?? 20) || 20;
export const ANALYSIS_MAX_SECONDS =
  Number(process.env.ANALYSIS_MAX_SECONDS ?? 60) || 60;
export const ANALYSIS_MAX_HEIGHT =
  Number(process.env.ANALYSIS_MAX_HEIGHT ?? 720) || 720;
export const ANALYSIS_FPS = Number(process.env.ANALYSIS_FPS ?? 12) || 12;

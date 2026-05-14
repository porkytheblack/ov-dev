import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@overwatch/schemas/tables";

export function makeDb() {
  const url = process.env.DATABASE_URL ?? "postgres://overwatch:overwatch@postgres:5432/overwatch";
  const client = postgres(url, { max: 10 });
  return { client, db: drizzle(client, { schema }) };
}

export { schema };
export type Db = ReturnType<typeof makeDb>["db"];

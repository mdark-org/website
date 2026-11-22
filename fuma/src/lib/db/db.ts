import { env } from "cloudflare:workers";
import { createDB as createSourceDatabase, createPgClient, type DbBackend } from "@repo/source";
import { drizzle as drizzleD1 } from "drizzle-orm/d1";
import { drizzle as drizzlePg } from "drizzle-orm/postgres-js";
import * as d1 from "./d1";
import * as pg from "./pg";

export type RuntimeDbEnv = {
  DB?: D1Database;
  DB_BACKEND?: string;
  HYPERDRIVE?: Hyperdrive;
};

export function getDbBackend(
  runtimeEnv: Pick<RuntimeDbEnv, "DB_BACKEND" | "HYPERDRIVE"> = env,
): DbBackend {
  if (runtimeEnv.DB_BACKEND === "d1") return "d1";
  if (runtimeEnv.DB_BACKEND === "pg") return "pg";
  return runtimeEnv.HYPERDRIVE ? "pg" : "d1";
}

export const createDB = (binding?: Hyperdrive) => {
  if (getDbBackend() === "d1") {
    return drizzleD1(env.DB, { relations: d1.relations, logger: false });
  }
  const hd = binding ?? env.HYPERDRIVE;
  return drizzlePg({
    client: createPgClient(hd.connectionString),
    relations: pg.relations,
    logger: false,
  }) as unknown as ReturnType<typeof drizzleD1<typeof d1.relations>>;
};

export function createSourceDB(runtimeEnv: RuntimeDbEnv = env) {
  if (getDbBackend(runtimeEnv) === "d1") {
    if (!runtimeEnv.DB) throw new Error("Missing D1 DB binding for DB_BACKEND=d1");
    return createSourceDatabase(runtimeEnv.DB);
  }
  if (!runtimeEnv.HYPERDRIVE) {
    throw new Error("Missing HYPERDRIVE binding for DB_BACKEND=pg");
  }
  return createSourceDatabase(runtimeEnv.HYPERDRIVE);
}

export type DB = ReturnType<typeof createDB>;

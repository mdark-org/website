import { drizzle as drizzleD1 } from "drizzle-orm/d1";
import { drizzle as drizzlePg } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as d1 from "./schema/d1";
import * as pg from "./schema/pg";

export type DbBackend = "d1" | "pg";

export interface SourceDatabase {
  backend: DbBackend;
  db: d1.D1DB;
  tables: typeof d1.schema;
}

export type SourceDbInput = SourceDatabase | d1.D1DB;

export function asSourceDb(input: SourceDbInput): SourceDatabase {
  if ("backend" in input && "tables" in input) {
    return input;
  }
  return { backend: "d1", db: input, tables: d1.schema };
}

export function createPgClient(connectionString: string) {
  return postgres(connectionString, {
    max: 5,
    fetch_types: false,
    connection: {
      application_name: "Cloudflare Hyperdrive",
    },
  });
}

export function createDB(target: D1Database | Hyperdrive | string): SourceDatabase {
  if (typeof target === "string" || "connectionString" in target) {
    const connectionString = typeof target === "string" ? target : target.connectionString;
    const pgDb = drizzlePg({ client: createPgClient(connectionString), relations: pg.relations, logger: false });
    return {
      backend: "pg",
      db: pgDb as unknown as d1.D1DB,
      tables: pg.schema as unknown as typeof d1.schema,
    };
  }
  return {
    backend: "d1",
    db: drizzleD1(target, { relations: d1.relations, logger: false }),
    tables: d1.schema,
  };
}

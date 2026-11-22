import { defineRelations } from "drizzle-orm/relations";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "./schema";
import { authRelations } from "./auth";

export * from "./auth";
export * from "./schema";

const _relations = defineRelations(schema, () => ({}));

export const relations = { ..._relations, ...authRelations };
export type DB = PostgresJsDatabase<typeof relations>;
export type PgDB = DB;

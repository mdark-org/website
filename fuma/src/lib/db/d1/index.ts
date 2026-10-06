import {defineRelations} from "drizzle-orm/relations";
import * as schema from "./schema";
import {drizzle} from "drizzle-orm/d1";
import {authRelations} from "@/lib/db/d1/auth.ts";

export * from './auth'
export * from './schema'

const _relations = defineRelations(schema, (r) => ({

}));

export const relations = { ..._relations, ...authRelations };
export type DB = ReturnType<typeof drizzle<typeof relations>>
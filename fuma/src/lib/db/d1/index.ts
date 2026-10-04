import {defineRelations} from "drizzle-orm/relations";
import * as schema from "./schema";
import {drizzle} from "drizzle-orm/d1";
import {authRelations} from "@/lib/db/d1/auth.ts";
import {env} from "cloudflare:workers";
export * from './auth'
export * from './schema'

export const relations = defineRelations(schema, (r) => ({

}));

const _relations = { ...relations, ...authRelations };
export type DB = ReturnType<typeof drizzle<typeof _relations>>
export const createDB = () => {
  return drizzle(env.DB, { relations: _relations })
}
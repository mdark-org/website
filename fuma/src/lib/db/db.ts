import {env} from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import { relations } from "./d1";

export const createDB = () => {
  return drizzle(env.DB, { relations, logger: false })
}

export type DB = ReturnType<typeof drizzle<typeof relations>>
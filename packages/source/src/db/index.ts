import {drizzle} from "drizzle-orm/d1";
import {relations} from "./schema";

export const createDB = (db: D1Database) => drizzle(db, { relations: relations, logger: false })
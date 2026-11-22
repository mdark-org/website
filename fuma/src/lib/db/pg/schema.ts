import { boolean, index, integer, jsonb, primaryKey, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { mdarkSchema } from "../../../../../packages/source/src/db/schema/pg/namespace";

export const roles = mdarkSchema.table("roles", {
  userId: varchar("userId", { length: 256 }).primaryKey(),
  name: varchar("name", { length: 256 }).notNull(),
  canDelete: boolean("canDelete").notNull(),
});

export const comments = mdarkSchema.table("comments", {
  id: serial("id").primaryKey(),
  page: varchar("page", { length: 256 }).notNull(),
  thread: integer("thread"),
  author: varchar("author", { length: 256 }).notNull(),
  content: jsonb("content").notNull(),
  timestamp: timestamp("timestamp", { withTimezone: true }).defaultNow().notNull(),
});

export const rates = mdarkSchema.table(
  "rates",
  {
    userId: varchar("userId", { length: 256 }).notNull(),
    commentId: integer("commentId").notNull(),
    like: boolean("like").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.commentId] }),
    index("comment_idx").on(table.commentId),
  ],
);

export const cache = mdarkSchema.table(
  "cache",
  {
    id: serial("id").primaryKey(),
    key: text("key").unique().notNull(),
    value: jsonb("value"),
    insertedAt: timestamp("inserted_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("cache_key_idx").on(table.key)],
);

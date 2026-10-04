import {
  integer,
  primaryKey,
  index,
  text, sqliteTable
} from 'drizzle-orm/sqlite-core'

export const roles = sqliteTable("roles", {
  userId: text("userId", { length: 256 }).primaryKey(),
  name: text("name", { length: 256 }).notNull(),
  canDelete: integer("canDelete", {mode: 'boolean'}).notNull(),
});

export const comments = sqliteTable("comments", {
  id: integer("id").primaryKey().notNull(),
  page: text("page", { length: 256 }).notNull(),
  thread: integer("thread"),
  author: text("author", { length: 256 }).notNull(),
  content: text("content", { mode: 'json' }).notNull(),
  timestamp: integer("timestamp", { mode: 'timestamp' })
    .defaultNow()
    .notNull(),
});

export const rates = sqliteTable(
  "rates",
  {
    userId: text("userId", { length: 256 }).notNull(),
    commentId: integer("commentId").notNull(),
    like: integer("like", {mode: 'boolean'}).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.commentId] }),
    index("comment_idx").on(table.commentId),
  ],
);

export const cache = sqliteTable("cache", {
  id: integer().primaryKey(),
  key: text().unique().notNull(),
  value: text('value', {mode: 'json'}),
  insertedAt: integer('inserted_at', { mode: 'timestamp' }).notNull().defaultNow(),
}, (table) => [
  index('cache_key_idx').on(table.key)
])

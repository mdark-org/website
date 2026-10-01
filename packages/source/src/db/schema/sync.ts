import type { Root } from "../../types";
import { integer, sqliteTable, text, foreignKey,index } from "drizzle-orm/sqlite-core";


/** One run covers the complete configured datasource set. */
export const syncRun = sqliteTable('sync_runs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  baseRunId: integer('base_run_id'),
  datasourceIds: text('datasource_ids', { mode: 'json' }).$type<string[]>().notNull(),
  status: text('status', { enum: ['queued', 'running', 'ready', 'succeeded', 'superseded', 'failed'] }).notNull(),
  createdAt: integer('created_at').notNull(),
  startedAt: integer('started_at'),
  finishedAt: integer('finished_at'),
  error: text('error'),
}, (t) => [
  foreignKey({ columns: [t.baseRunId], foreignColumns: [t.id] }),
  index('sync_runs_status_created').on(t.status, t.createdAt)
])


// 管理端定义 datasource 的目标
export const datasource = sqliteTable('datasources', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  slug: text('slug').notNull(),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  icon: text('icon'),
  mountedPath: text('mounted_path').notNull(),
  sortOrder: integer('sort_order').notNull(),
  tree: text('tree', { mode: 'json' }).$type<Root>().notNull(),
  syncRunId: integer('sync_run_id'),
}, (t) => [
  index('datasource_snapshots_datasource').on(t.slug),
])

// 单行，当前指向的 syncRunId
export const sourceHeads = sqliteTable('source_heads', {
  id: text('id').notNull().primaryKey(),
  syncRunId: integer('sync_run_id').notNull(),
  publishedAt: integer('published_at').notNull(),
})

import type {Folder, Root} from "../../types";
import {integer, sqliteTable, text, foreignKey, index, uniqueIndex} from "drizzle-orm/sqlite-core";


export const syncRun = sqliteTable('sync_runs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  baseRunId: integer('base_run_id'),
  datasourceIds: text('datasource_ids', { mode: 'json' }).$type<string[]>().notNull(),
  status: text('status', { enum: ['queued', 'running', 'succeeded', 'failed'] }).notNull(),
  createdAt: integer('created_at', {mode: 'timestamp'}).notNull().defaultNow(),
  startedAt: integer('started_at', {mode: 'timestamp'}),
  finishedAt: integer('finished_at', {mode: 'timestamp'}),
  error: text('error'),
}, (t) => [
  index('sync_runs_status_created').on(t.status, t.createdAt)
])


// A datasource snapshot belongs to one sync run.
export const datasource = sqliteTable('datasources', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  slug: text('slug').notNull(),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  icon: text('icon'),
  mountedPath: text('mounted_path').notNull(),
  sortOrder: integer('sort_order').notNull(),
  tree: text('tree', { mode: 'json' }).$type<Folder>(),
  syncRunId: integer('sync_run_id'),
}, (t) => [
  uniqueIndex('datasource_slug_run_index').on(t.slug, t.syncRunId),
])


// Current published content run and its matching AI Search slot.
export const sourceHeads = sqliteTable('source_heads', {
  id: text('id').notNull().primaryKey(),
  syncRunId: integer('sync_run_id'),
  searchSlot: text('search_slot'),
  publishedAt: integer('published_at', {mode: 'timestamp'}),
})

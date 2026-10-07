
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import {Metadata} from "../../types";


/** Exact Markdown bytes are shared across page versions and runs. */
export const pageContent = sqliteTable('page_bodies', {
  hash: text('hash').notNull().primaryKey(),
  markdown: text('markdown').notNull(),
})

/** Immutable parsed output. Source identity and build rules form the reuse key. */
export const pageRevision = sqliteTable('page_versions', {
  revisionId: text('revision_id').notNull().primaryKey(),
  sourceKey: text('source_key').notNull(),
  sourceHash: text('source_hash').notNull(),
  contentHash: text('content_hash').notNull(),
  url: text('url').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  tags: text('tags', { mode: 'json' }).$type<string[]>(),
  metadata: text('metadata', { mode: 'json' }).$type<Metadata>(),
  filename: text('filename'),
  ext: text('ext'),
  publishedAt: integer('published_at', { mode: 'timestamp' }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('page_versions_source_build').on(t.sourceKey, t.sourceHash),
  index('page_versions_datasource_date').on(t.publishedAt, t.url),
])

//

export const pageRef = sqliteTable('page_ref', {
  syncRunId: integer('sync_run_id').notNull(),
  datasourceId: integer('datasource_id').notNull(),
  revisionId: text('revision_id').notNull(),
  url: text('url').notNull(),
  publishedAt: integer('published_at', { mode: 'timestamp' }).notNull().defaultNow(),
}, (t) => [
  index('page_ref_date_url').on(t.publishedAt, t.url, t.syncRunId),
])


export type PageSection = typeof pageSection.$inferSelect
export type PageSections = NewPageSection[]
export type NewPageSection = typeof pageSection.$inferInsert
export const pageSection = sqliteTable('page_sections', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  revisionId: text('revision_id').notNull(),
  headingId: text('heading_id'),
  headingTitle: text('heading_title'),
  content: text('content').notNull(),
  ordinal: integer('ordinal').notNull(),
}, (t) => [
  uniqueIndex('page_sections_revision_order').on(t.revisionId, t.ordinal),
  index('page_sections_revision').on(t.revisionId),
])
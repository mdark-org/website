
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

export type Metadata = {
  bvid?: string,
  ytid?: string,
  wbid?: string,
  xgid?: string,
  rss?: boolean,
}


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
  url: text('url').notNull(),
  contentHash: text('content_hash').notNull().references(() => pageContent.hash),
  title: text('title').notNull(),
  description: text('description'),
  tags: text('tags', { mode: 'json' }).$type<string[]>(),
  metadata: text('metadata', { mode: 'json' }).$type<Metadata>(),
  filename: text('filename'),
  ext: text('ext'),
  publishedAt: integer('published_at').notNull().default(0),
}, (t) => [
  uniqueIndex('page_versions_source_build').on(t.sourceKey, t.sourceHash),
  index('page_versions_datasource_date').on(t.publishedAt, t.url),
])

/** Section bodies are slices of pageContent.markdown, not separate copies. */
export const pageSection = sqliteTable('page_sections', {
  pageRevisionId: text('page_revision_id').notNull()
    .references(() => pageRevision.revisionId, { onDelete: 'cascade' }),
  sectionId: text('section_id').notNull(),
  sectionHash: text('section_hash').notNull(),
  bodyHash: text('body_hash').notNull(),
  title: text('title'),
  headingPath: text('heading_path', { mode: 'json' }).$type<string[]>().notNull(),
  anchor: text('anchor'),
  level: integer('level').notNull(),
  ordinal: integer('ordinal').notNull(),
  startOffset: integer('start_offset').notNull(),
  endOffset: integer('end_offset').notNull(),
}, (t) => [
  uniqueIndex('page_sections_identity').on(t.pageRevisionId, t.sectionId),
  uniqueIndex('page_sections_order').on(t.pageRevisionId, t.ordinal),
  index('page_sections_page').on(t.pageRevisionId),
  index('page_sections_section').on(t.sectionId),
])

export type PageSection = typeof pageSection.$inferSelect
export type PageSections = [PageSection, ...PageSection[]]


export const pageRef = sqliteTable('page_ref', {
  syncRunId: integer('sync_run_id').notNull(),
  datasourceId: integer('datasource_id').notNull(),
  revisionId: text('revision_id').notNull(),
  url: text('url').notNull(),
  publishedAt: integer('published_at').notNull().default(0),
}, (t) => [
  index('page_ref_date_url').on(t.publishedAt, t.url, t.syncRunId),
])

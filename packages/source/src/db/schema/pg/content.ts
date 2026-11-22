import { index, integer, jsonb, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import type { Metadata } from "../../../types";
import { mdarkSchema } from "./namespace";

/** Exact Markdown bytes are shared across page versions and runs. */
export const pageContent = mdarkSchema.table("page_bodies", {
  hash: text("hash").notNull().primaryKey(),
  markdown: text("markdown").notNull(),
});

/** Immutable parsed output. Source identity and build rules form the reuse key. */
export const pageRevision = mdarkSchema.table(
  "page_versions",
  {
    revisionId: text("revision_id").notNull().primaryKey(),
    sourceKey: text("source_key").notNull(),
    sourceHash: text("source_hash").notNull(),
    contentHash: text("content_hash").notNull(),
    url: text("url").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    tags: jsonb("tags").$type<string[]>(),
    metadata: jsonb("metadata").$type<Metadata>(),
    filename: text("filename"),
    ext: text("ext"),
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("page_versions_source_build").on(t.sourceKey, t.sourceHash),
    index("page_versions_datasource_date").on(t.publishedAt, t.url),
  ],
);

export const pageRef = mdarkSchema.table(
  "page_ref",
  {
    syncRunId: integer("sync_run_id").notNull(),
    datasourceId: integer("datasource_id").notNull(),
    revisionId: text("revision_id").notNull(),
    url: text("url").notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("page_ref_run_url").on(t.syncRunId, t.url),
    index("page_ref_run_date_url").on(t.syncRunId, t.publishedAt, t.url),
    index("page_ref_run_ds_date_url").on(t.syncRunId, t.datasourceId, t.publishedAt, t.url),
  ],
);

export type PageSection = typeof pageSection.$inferSelect;
export type PageSections = NewPageSection[];
export type NewPageSection = typeof pageSection.$inferInsert;

export const pageSection = mdarkSchema.table(
  "page_sections",
  {
    id: serial("id").primaryKey(),
    revisionId: text("revision_id").notNull(),
    headingId: text("heading_id"),
    headingTitle: text("heading_title"),
    content: text("content").notNull(),
    ordinal: integer("ordinal").notNull(),
  },
  (t) => [
    uniqueIndex("page_sections_revision_order").on(t.revisionId, t.ordinal),
    index("page_sections_revision").on(t.revisionId),
  ],
);

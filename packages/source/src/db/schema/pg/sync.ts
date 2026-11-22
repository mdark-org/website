import { index, integer, jsonb, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import type { Folder } from "../../../types";
import { mdarkSchema } from "./namespace";

export const syncRun = mdarkSchema.table(
  "sync_runs",
  {
    id: serial("id").primaryKey(),
    baseRunId: integer("base_run_id"),
    datasourceIds: jsonb("datasource_ids").$type<string[]>().notNull(),
    status: text("status", { enum: ["queued", "running", "succeeded", "failed"] }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    error: text("error"),
  },
  (t) => [index("sync_runs_status_created").on(t.status, t.createdAt)],
);

// A datasource snapshot belongs to one sync run.
export const datasource = mdarkSchema.table(
  "datasources",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    icon: text("icon"),
    mountedPath: text("mounted_path").notNull(),
    sortOrder: integer("sort_order").notNull(),
    tree: jsonb("tree").$type<Folder>(),
    syncRunId: integer("sync_run_id"),
  },
  (t) => [uniqueIndex("datasource_slug_run_index").on(t.slug, t.syncRunId)],
);

// Current published content run and its matching AI Search slot.
export const sourceHeads = mdarkSchema.table("source_heads", {
  id: text("id").notNull().primaryKey(),
  syncRunId: integer("sync_run_id"),
  searchSlot: text("search_slot"),
  publishedAt: timestamp("published_at", { withTimezone: true }),
});

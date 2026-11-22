import { defineRelationsPart } from "drizzle-orm/relations";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as sync from "./sync";
import * as content from "./content";

export * from "./namespace";
export * from "./content";
export * from "./sync";

export const schema = { ...sync, ...content };

export const relationPart = defineRelationsPart(schema, (r) => ({
  sourceHeads: {
    syncRun: r.one.syncRun({
      from: r.sourceHeads.syncRunId,
      to: r.syncRun.id,
      optional: false,
    }),
  },
  syncRun: {
    sourceHead: r.one.sourceHeads({
      from: r.syncRun.id,
      to: r.sourceHeads.syncRunId,
    }),
    datasources: r.many.datasource({
      from: r.syncRun.id,
      to: r.datasource.syncRunId,
    }),
    pageRefs: r.many.pageRef({
      from: r.syncRun.id,
      to: r.pageRef.syncRunId,
    }),
  },
  datasource: {
    syncRun: r.one.syncRun({
      from: r.datasource.syncRunId,
      to: r.syncRun.id,
    }),
    pageRefs: r.many.pageRef({
      from: [r.datasource.syncRunId, r.datasource.id],
      to: [r.pageRef.syncRunId, r.pageRef.datasourceId],
    }),
  },
  pageRef: {
    syncRun: r.one.syncRun({
      from: r.pageRef.syncRunId,
      to: r.syncRun.id,
      optional: false,
    }),
    datasource: r.one.datasource({
      from: [r.pageRef.syncRunId, r.pageRef.datasourceId],
      to: [r.datasource.syncRunId, r.datasource.id],
      optional: false,
    }),
    revision: r.one.pageRevision({
      from: r.pageRef.revisionId,
      to: r.pageRevision.revisionId,
      optional: false,
    }),
  },
  pageRevision: {
    content: r.one.pageContent({
      from: r.pageRevision.contentHash,
      to: r.pageContent.hash,
      optional: false,
    }),
    pageRefs: r.many.pageRef({
      from: r.pageRevision.revisionId,
      to: r.pageRef.revisionId,
    }),
    sections: r.many.pageSection({
      from: r.pageRevision.revisionId,
      to: r.pageSection.revisionId,
    }),
  },
  pageSection: {
    revision: r.one.pageRevision({
      from: r.pageSection.revisionId,
      to: r.pageRevision.revisionId,
      optional: false,
    }),
  },
  pageContent: {
    revisions: r.many.pageRevision({
      from: r.pageContent.hash,
      to: r.pageRevision.contentHash,
    }),
  },
}));

export const relations = { ...relationPart };
export type DB = PostgresJsDatabase<typeof relations>;
export type PgDB = DB;

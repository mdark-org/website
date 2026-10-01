import { and, eq, inArray, isNull, sql } from 'drizzle-orm'
import type { BatchItem } from 'drizzle-orm/batch'
import type { DrizzleD1Database } from 'drizzle-orm/d1'
import { pageContent, pageRef, pageRevision, pageSection, type PageSections } from './schema/content.ts'
import { datasource, sourceHeads, syncRun } from './schema/sync.ts'

export const SOURCE_HEAD_ID = 'current'
const MAX_PARAMETERS = 90

export class SourceSyncError extends Error {
  override name = 'SourceSyncError'
}

export type SyncRun = typeof syncRun.$inferSelect
export type DatasourceSnapshot = Omit<typeof datasource.$inferInsert, 'id' | 'syncRunId'> & {
  bodies: (typeof pageContent.$inferInsert)[]
  revisions: (typeof pageRevision.$inferInsert)[]
  sections: PageSections[]
  refs: Pick<typeof pageRef.$inferInsert, 'revisionId' | 'url' | 'publishedAt'>[]
}

function chunks<T>(items: T[], columns: number): T[][] {
  const size = Math.floor(MAX_PARAMETERS / columns)
  return Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, (i + 1) * size))
}

/** Only this repository writes content. D1 batches provide the transaction boundary. */
export class SourceWriteRepo {
  private readonly db: DrizzleD1Database

  constructor(db: DrizzleD1Database) {
    this.db = db
  }

  async createRun(datasourceIds: string[]): Promise<SyncRun> {
    if (new Set(datasourceIds).size !== datasourceIds.length || datasourceIds.some((id) => !id)) {
      throw new SourceSyncError('Datasource slugs must be non-empty and unique.')
    }
    const [run] = await this.db.insert(syncRun).values({
      baseRunId: sql`(select ${sourceHeads.syncRunId} from ${sourceHeads} where ${sourceHeads.id} = ${SOURCE_HEAD_ID})`,
      datasourceIds,
      status: 'queued',
      createdAt: Date.now(),
    }).returning()
    if (!run) throw new SourceSyncError('Could not create the sync run.')
    return run
  }

  async getRun(runId: number): Promise<SyncRun | null> {
    return await this.db.select().from(syncRun).where(eq(syncRun.id, runId)).get() ?? null
  }

  async startRun(runId: number): Promise<void> {
    await this.db.update(syncRun).set({ status: 'running', startedAt: Date.now() })
      .where(and(eq(syncRun.id, runId), eq(syncRun.status, 'queued')))
    await this.requireRunning(runId)
  }

  private async requireRunning(runId: number): Promise<SyncRun> {
    const run = await this.getRun(runId)
    if (!run || run.status !== 'running') throw new SourceSyncError(`Sync run ${runId} is not running.`)
    return run
  }

  async getSectionRevisionIds(revisionIds: string[]): Promise<Set<string>> {
    const completed = new Set<string>()
    for (const group of chunks(revisionIds, 1)) {
      const rows = await this.db.select({ id: pageSection.pageRevisionId }).from(pageSection)
        .where(and(inArray(pageSection.pageRevisionId, group), sql`${pageSection.ordinal} = 0`))
      rows.forEach((row) => completed.add(row.id))
    }
    return completed
  }

  async listRevisionsWithoutSections(limit: number) {
    return this.db.select({
      pageRevisionId: pageRevision.revisionId,
      sourceKey: pageRevision.sourceKey,
      markdown: pageContent.markdown,
    }).from(pageRevision)
      .innerJoin(pageContent, eq(pageContent.hash, pageRevision.contentHash))
      .leftJoin(pageSection, and(eq(pageSection.pageRevisionId, pageRevision.revisionId), sql`${pageSection.ordinal} = 0`))
      .where(isNull(pageSection.pageRevisionId))
      .orderBy(pageRevision.revisionId).limit(limit)
  }

  private sectionStatements(sections: PageSections): [BatchItem<'sqlite'>, ...BatchItem<'sqlite'>[]] {
    const statements: [BatchItem<'sqlite'>, ...BatchItem<'sqlite'>[]] = [
      this.db.delete(pageSection).where(eq(pageSection.pageRevisionId, sections[0].pageRevisionId)),
    ]
    for (const group of chunks(sections, 11)) statements.push(this.db.insert(pageSection).values(group))
    return statements
  }

  async writePageSections(sections: PageSections): Promise<void> {
    await this.db.batch(this.sectionStatements(sections))
  }

  async writeDatasource(runId: number, snapshot: DatasourceSnapshot): Promise<{ datasourceId: number; pages: number }> {
    const run = await this.requireRunning(runId)
    if (!run.datasourceIds.includes(snapshot.slug)) {
      throw new SourceSyncError(`Datasource ${snapshot.slug} is not part of sync run ${runId}.`)
    }
    const { bodies, revisions, sections, refs, ...info } = snapshot

    // These rows are immutable and reusable. Partial inserts are not visible without a published ref.
    for (const group of chunks(bodies, 2)) {
      await this.db.insert(pageContent).values(group).onConflictDoNothing()
    }
    const sectionsByRevision = new Map(sections.map((items) => [items[0].pageRevisionId, items]))
    for (const group of chunks(revisions, 13)) {
      const statements: [BatchItem<'sqlite'>, ...BatchItem<'sqlite'>[]] = [
        this.db.insert(pageRevision).values(group).onConflictDoNothing(),
      ]
      for (const revision of group) {
        const items = sectionsByRevision.get(revision.revisionId)
        if (items) statements.push(...this.sectionStatements(items))
      }
      // The root row marks a complete section set. Never commit it without the other sections.
      await this.db.batch(statements)
    }

    const previousIds = this.db.select({ id: datasource.id }).from(datasource)
      .where(and(eq(datasource.syncRunId, runId), eq(datasource.slug, info.slug)))
    const statements: [BatchItem<'sqlite'>, ...BatchItem<'sqlite'>[]] = [
      this.db.delete(pageRef).where(and(eq(pageRef.syncRunId, runId), inArray(pageRef.datasourceId, previousIds))),
      this.db.delete(datasource).where(and(eq(datasource.syncRunId, runId), eq(datasource.slug, info.slug))),
      this.db.insert(datasource).values({ ...info, syncRunId: runId }),
    ]
    const datasourceId = sql<number>`(select ${datasource.id} from ${datasource} where ${datasource.syncRunId} = ${runId} and ${datasource.slug} = ${info.slug})`
    for (const group of chunks(refs, 6)) {
      statements.push(this.db.insert(pageRef).values(group.map((ref) => ({ ...ref, syncRunId: runId, datasourceId }))))
    }
    // The datasource row is a completion marker. Replace it and all its refs atomically on retry.
    await this.db.batch(statements)
    const saved = await this.db.select({ id: datasource.id }).from(datasource)
      .where(and(eq(datasource.syncRunId, runId), eq(datasource.slug, info.slug))).get()
    if (!saved) throw new SourceSyncError(`Could not save datasource ${info.slug}.`)
    return { datasourceId: saved.id, pages: refs.length }
  }

  async publishRun(runId: number): Promise<void> {
    const existing = await this.getRun(runId)
    if (existing?.status === 'succeeded') return
    const run = await this.requireRunning(runId)
    const snapshots = await this.db.select({ slug: datasource.slug }).from(datasource)
      .where(eq(datasource.syncRunId, runId))
    const slugs = new Set(snapshots.map((snapshot) => snapshot.slug))
    if (snapshots.length !== run.datasourceIds.length || slugs.size !== snapshots.length
      || run.datasourceIds.some((id) => !slugs.has(id))) {
      throw new SourceSyncError('The run does not contain every configured datasource.')
    }
    const duplicate = await this.db.select({ url: pageRef.url }).from(pageRef)
      .where(eq(pageRef.syncRunId, runId)).groupBy(pageRef.url).having(sql`count(*) > 1`).get()
    if (duplicate) throw new SourceSyncError(`Duplicate page URL: ${duplicate.url}`)
    const incomplete = await this.db.select({ url: pageRef.url }).from(pageRef)
      .leftJoin(pageSection, and(eq(pageSection.pageRevisionId, pageRef.revisionId), sql`${pageSection.ordinal} = 0`))
      .where(and(eq(pageRef.syncRunId, runId), isNull(pageSection.pageRevisionId))).get()
    if (incomplete) throw new SourceSyncError(`Missing page sections: ${incomplete.url}`)

    const now = Date.now()
    await this.db.batch([
      this.db.insert(sourceHeads).select(this.db.select({
        id: sql<string>`${SOURCE_HEAD_ID}`.as('id'),
        syncRunId: sql<number>`${runId}`.as('sync_run_id'),
        publishedAt: sql<number>`${now}`.as('published_at'),
      }).from(syncRun).where(and(eq(syncRun.id, runId), eq(syncRun.status, 'running'))))
        .onConflictDoUpdate({
          target: sourceHeads.id,
          set: { syncRunId: runId, publishedAt: now },
          setWhere: run.baseRunId === null ? sql`0` : eq(sourceHeads.syncRunId, run.baseRunId),
        }),
      this.db.update(syncRun).set({ status: 'succeeded', finishedAt: now, error: null })
        .where(and(eq(syncRun.id, runId), eq(syncRun.status, 'running'),
          sql`exists (select 1 from ${sourceHeads} where ${sourceHeads.id} = ${SOURCE_HEAD_ID} and ${sourceHeads.syncRunId} = ${runId})`)),
    ])
    if ((await this.getRun(runId))?.status !== 'succeeded') {
      throw new SourceSyncError('The published head changed during synchronization.')
    }
  }

  async failRun(runId: number, error: unknown): Promise<void> {
    const message = error instanceof Error ? error.message : String(error)
    await this.db.update(syncRun).set({ status: 'failed', finishedAt: Date.now(), error: message })
      .where(and(eq(syncRun.id, runId), inArray(syncRun.status, ['queued', 'running', 'ready'])))
  }
}

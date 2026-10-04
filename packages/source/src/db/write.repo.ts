import { and, eq, inArray, sql } from 'drizzle-orm'
import type { BatchItem } from 'drizzle-orm/batch'
import { pageContent, pageRef, pageRevision, pageSection, type PageSections } from './schema/content'
import { datasource, sourceHeads, syncRun, type SearchSlotId } from './schema/sync'
import type { DB } from './schema'
import { chunkD1Columns } from '../utils/chunk'

export const SOURCE_HEAD_ID = 'current'

export class SourceSyncError extends Error {
  override name = 'SourceSyncError'
}

export type SyncRun = typeof syncRun.$inferSelect
export type DatasourceSnapshot = Omit<typeof datasource.$inferInsert, 'id' | 'syncRunId'> & {
  bodies: (typeof pageContent.$inferInsert)[]
  revisions: (typeof pageRevision.$inferInsert)[]
  sections: { revisionId: string; items: PageSections }[]
  refs: Pick<typeof pageRef.$inferInsert, 'revisionId' | 'url' | 'publishedAt'>[]
}

export class SourceWriteRepo {
  private readonly db: DB

  constructor(db: DB) {
    this.db = db
  }

  async createRun(datasourceIds: string[]): Promise<SyncRun> {
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

  async getHead() {
    return await this.db.select().from(sourceHeads).where(eq(sourceHeads.id, SOURCE_HEAD_ID)).get() ?? null
  }

  async isPublishedRun(runId: number, slot?: SearchSlotId): Promise<boolean> {
    const row = await this.db.select({ id: sourceHeads.id }).from(sourceHeads)
      .where(and(
        eq(sourceHeads.id, SOURCE_HEAD_ID),
        eq(sourceHeads.syncRunId, runId),
        slot === undefined ? undefined : eq(sourceHeads.searchSlot, slot),
      )).get()
    return row !== undefined
  }

  async startRun(runId: number): Promise<void> {
    await this.db.update(syncRun).set({ status: 'running', startedAt: Date.now() })
      .where(and(eq(syncRun.id, runId), eq(syncRun.status, 'queued')))
  }

  async getSectionRevisionIds(revisionIds: string[]): Promise<Set<string>> {
    const completed = new Set<string>()
    for (const group of chunkD1Columns(revisionIds, 1)) {
      const rows = await this.db.select({ id: pageSection.revisionId }).from(pageSection)
        .where(inArray(pageSection.revisionId, group))
      rows.forEach((row) => completed.add(row.id))
    }
    return completed
  }

  private sectionStatements(revisionId: string, sections: PageSections): BatchItem<'sqlite'>[] {
    if (sections.length === 0) return []
    const values = JSON.stringify(sections.map(({ headingId, headingTitle, content, ordinal }) => ({
      revisionId, headingId, headingTitle, content, ordinal,
    })))
    return [this.db.run(sql`
      INSERT INTO page_sections (revision_id, heading_id, heading_title, content, ordinal)
      SELECT
        json_extract(value, '$.revisionId'),
        json_extract(value, '$.headingId'),
        json_extract(value, '$.headingTitle'),
        json_extract(value, '$.content'),
        json_extract(value, '$.ordinal')
      FROM json_each(${values})
      WHERE 1
      ON CONFLICT (revision_id, ordinal) DO NOTHING
    `)]
  }

  async writeDatasource(runId: number, snapshot: DatasourceSnapshot): Promise<{ datasourceId: number; pages: number }> {
    const { bodies, revisions, sections, refs, slug, ...info } = snapshot
    for (const group of chunkD1Columns(bodies, 2)) {
      await this.db.insert(pageContent).values(group).onConflictDoNothing()
    }
    const sectionsByRevision = new Map(sections.map(({ revisionId, items }) => [revisionId, items]))
    for (const group of chunkD1Columns(revisions, 13)) {
      const statements: [BatchItem<'sqlite'>, ...BatchItem<'sqlite'>[]] = [
        this.db.insert(pageRevision).values(group).onConflictDoNothing(),
      ]
      for (const revision of group) {
        const items = sectionsByRevision.get(revision.revisionId)
        if (items) statements.push(...this.sectionStatements(revision.revisionId, items))
      }
      await this.db.batch(statements)
    }
    const statements: [BatchItem<'sqlite'>, ...BatchItem<'sqlite'>[]] = [
      this.db.insert(datasource).values({ slug, ...info, syncRunId: runId }).onConflictDoUpdate({
        target: datasource.slug,
        set: { syncRunId: runId, ...info },
      }),
    ]
    const datasourceId = sql<number>`(select ${datasource.id} from ${datasource} where ${datasource.syncRunId} = ${runId} and ${datasource.slug} = ${slug})`
    for (const group of chunkD1Columns(refs, 6)) {
      statements.push(this.db.insert(pageRef).values(group.map((ref) => ({ ...ref, syncRunId: runId, datasourceId }))))
    }
    // Replace the datasource snapshot in this run and its page references.
    await this.db.batch(statements)
    const [saved] = await this.db.select().from(datasource)
      .where(and(eq(datasource.syncRunId, runId), eq(datasource.slug, slug)))
    if (!saved) throw new SourceSyncError(`Could not save datasource ${slug}.`)
    return { datasourceId: saved.id, pages: refs.length }
  }

  async listSearchSectionKeys(runId: number) {
    return this.db.select({ sectionId: pageSection.id, revisionId: pageSection.revisionId })
      .from(pageRef)
      .innerJoin(pageSection, eq(pageSection.revisionId, pageRef.revisionId))
      .where(eq(pageRef.syncRunId, runId))
  }

  async listSearchFiles(runId: number) {
    return this.db.select({ revisionId: pageRef.revisionId })
      .from(pageRef)
      .where(eq(pageRef.syncRunId, runId))
  }

  async getSearchFiles(runId: number, fileHashes: string[]) {
    return this.db.select({
      revisionId: pageRevision.revisionId,
      headingId: pageRevision.title,
      headingTitle: pageRevision.title,
      content: pageContent.markdown,
      pageTitle: pageRevision.title,
      url: pageRef.url,
      tag: datasource.slug,
    }).from(pageRef)
    .innerJoin(pageRevision, eq(pageRevision.revisionId, pageRef.revisionId))
    .innerJoin(pageContent, eq(pageContent.hash, pageRevision.contentHash))
    .innerJoin(datasource, and(eq(datasource.id, pageRef.datasourceId), eq(datasource.syncRunId, pageRef.syncRunId)))
    .where(and(eq(pageRef.syncRunId, runId), inArray(pageRevision.revisionId, fileHashes)))
  }

  async getSearchSections(runId: number, sectionIds: number[]) {
    return this.db.select({
      id: pageSection.id,
      revisionId: pageSection.revisionId,
      headingId: pageSection.headingId,
      headingTitle: pageSection.headingTitle,
      content: pageSection.content,
      ordinal: pageSection.ordinal,
      pageTitle: pageRevision.title,
      url: pageRef.url,
      tag: datasource.slug,
    }).from(pageRef)
      .innerJoin(pageRevision, eq(pageRevision.revisionId, pageRef.revisionId))
      .innerJoin(pageSection, eq(pageSection.revisionId, pageRef.revisionId))
      .innerJoin(datasource, and(eq(datasource.id, pageRef.datasourceId), eq(datasource.syncRunId, pageRef.syncRunId)))
      .where(and(eq(pageRef.syncRunId, runId), inArray(pageSection.id, sectionIds)))
  }

  async publishRun(runId: number, slot: SearchSlotId): Promise<void> {
    const currentRun = await this.getRun(runId)
    const currentHead = await this.getHead()
    if (await this.isPublishedRun(runId, slot)) {
      if (currentRun?.status === 'running') {
        await this.db.update(syncRun).set({ status: 'succeeded', finishedAt: Date.now(), error: null })
          .where(and(eq(syncRun.id, runId), eq(syncRun.status, 'running')))
      }
      if ((await this.getRun(runId))?.status === 'succeeded') return
    }
    if (currentRun?.status === 'succeeded') {
      throw new SourceSyncError(`Sync run ${runId} has already completed.`)
    }
    const run = (await this.getRun(runId))!
    const baseIsCurrent = run.baseRunId === null
      ? currentHead === null
      : await this.db.select({ id: sourceHeads.id }).from(sourceHeads)
        .where(and(eq(sourceHeads.id, SOURCE_HEAD_ID), eq(sourceHeads.syncRunId, run.baseRunId))).get() !== undefined
    if (!baseIsCurrent) throw new SourceSyncError('The published head changed during synchronization.')

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

    const now = Date.now()
    await this.db.insert(sourceHeads).values({
      id: SOURCE_HEAD_ID,
      syncRunId: runId,
      searchSlot: slot,
      publishedAt: now,
    })
      .onConflictDoUpdate({
        target: sourceHeads.id,
        set: { syncRunId: runId, searchSlot: slot, publishedAt: now },
        setWhere: run.baseRunId === null ? sql`0` : eq(sourceHeads.syncRunId, run.baseRunId),
      })

    if (!await this.isPublishedRun(runId, slot)) {
      throw new SourceSyncError('The published head changed during synchronization.')
    }
    await this.db.update(syncRun).set({ status: 'succeeded', finishedAt: now, error: null })
      .where(and(eq(syncRun.id, runId), eq(syncRun.status, 'running')))
    if ((await this.getRun(runId))?.status !== 'succeeded') {
      throw new SourceSyncError('Could not complete the published sync run.')
    }
  }

  async failRun(runId: number, error: unknown): Promise<void> {
    const message = error instanceof Error ? error.message : String(error)
    await this.db.update(syncRun).set({ status: 'failed', finishedAt: Date.now(), error: message })
      .where(and(eq(syncRun.id, runId), inArray(syncRun.status, ['queued', 'running'])))
  }
}

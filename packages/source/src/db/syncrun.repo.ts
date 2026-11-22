import { and, eq, inArray, lt, sql } from 'drizzle-orm'
import { asSourceDb, type SourceDatabase, type SourceDbInput } from './index'
import type { DB, syncRun } from './schema'

export const SOURCE_HEAD_ID = 'current'

/** Head plus predecessors: enough for any still-running index workflow. */
export const RETAIN_RUNS = 8

export class SourceSyncError extends Error {
  override name = 'SourceSyncError'
}

export type SyncRun = typeof syncRun.$inferSelect

export class SyncRunRepo {
  private readonly ctx: SourceDatabase
  private readonly db: DB

  constructor(input: SourceDbInput) {
    this.ctx = asSourceDb(input)
    this.db = this.ctx.db
  }

  async createRun(datasourceIds: string[]): Promise<SyncRun> {
    const { sourceHeads, syncRun } = this.ctx.tables
    const [run] = await this.db.insert(syncRun).values({
      baseRunId: sql`(select ${sourceHeads.syncRunId} from ${sourceHeads} where ${sourceHeads.id} = ${SOURCE_HEAD_ID})`,
      datasourceIds,
      status: 'queued',
    }).returning()
    return run
  }

  async getRun(runId: number): Promise<SyncRun | null> {
    const { syncRun } = this.ctx.tables
    const [row] = await this.db.select().from(syncRun).where(eq(syncRun.id, runId)).limit(1)
    return row ?? null
  }

  async startRun(runId: number): Promise<void> {
    const { syncRun } = this.ctx.tables
    await this.db.update(syncRun).set({ status: 'running', startedAt: new Date() })
      .where(and(eq(syncRun.id, runId), eq(syncRun.status, 'queued')))
  }

  async getHead() {
    const { sourceHeads } = this.ctx.tables
    const [row] = await this.db.select().from(sourceHeads).where(eq(sourceHeads.id, SOURCE_HEAD_ID)).limit(1)
    return row ?? null
  }

  /**
   * Drops page refs and datasource snapshots that no read path can reach.
   * Public reads serve only the head run; older runs stay briefly so an
   * in-flight index workflow can finish against its own snapshot.
   */
  async pruneRuns(retain: number = RETAIN_RUNS): Promise<void> {
    const { datasource, pageRef } = this.ctx.tables
    const head = await this.getHead()
    if (!head?.syncRunId) return
    const cutoff = head.syncRunId - (retain - 1)
    if (this.ctx.backend === 'd1') {
      await this.db.batch([
        this.db.delete(pageRef).where(lt(pageRef.syncRunId, cutoff)),
        this.db.delete(datasource).where(lt(datasource.syncRunId, cutoff)),
      ])
      return
    }
    await this.db.transaction(async (tx) => {
      await tx.delete(pageRef).where(lt(pageRef.syncRunId, cutoff))
      await tx.delete(datasource).where(lt(datasource.syncRunId, cutoff))
    })
  }

  /**
   * The index a run must write. Indexing no longer alternates between A/B slots:
   * every run applies its diff to the published index, so the name never rotates.
   */
  async getIndexSlot(fallbackSlot: string): Promise<string> {
    const head = await this.getHead()
    return head?.searchSlot ?? fallbackSlot
  }

  /**
   * Commits a run once its content is synced. This is the point where the head
   * advances and the content becomes publicly readable; the search index catches
   * up afterwards.
   */
  async publishRun(runId: number, slot: string) {
    const { sourceHeads, syncRun } = this.ctx.tables
    const now = new Date()
    await this.db.insert(sourceHeads).values({
      id: SOURCE_HEAD_ID,
      syncRunId: runId,
      searchSlot: slot,
      publishedAt: now,
    })
      .onConflictDoUpdate({
        target: sourceHeads.id,
        set: { syncRunId: runId, searchSlot: slot, publishedAt: now },
      })
    await this.db.update(syncRun).set({ status: 'succeeded', finishedAt: now, error: null })
      .where(and(eq(syncRun.id, runId), eq(syncRun.status, 'running')))
  }

  async failRun(runId: number, error: unknown): Promise<void> {
    const { syncRun } = this.ctx.tables
    const message = error instanceof Error ? error.message : String(error)
    await this.db.update(syncRun).set({ status: 'failed', finishedAt: new Date(), error: message })
      .where(and(eq(syncRun.id, runId), inArray(syncRun.status, ['queued', 'running'])))
  }
}

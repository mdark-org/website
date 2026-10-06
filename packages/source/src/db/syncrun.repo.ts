
import { and, eq, inArray, sql } from 'drizzle-orm'
import { type DB, pageRef, datasource, sourceHeads, syncRun } from './schema'

export const SOURCE_HEAD_ID = 'current'

export class SourceSyncError extends Error {
  override name = 'SourceSyncError'
}

export type SyncRun = typeof syncRun.$inferSelect
export class SyncRunRepo {
  private readonly db: DB

  constructor(db: DB) {
    this.db = db
  }


  async createRun(datasourceIds: string[]): Promise<SyncRun> {
    const [run] = await this.db.insert(syncRun).values({
      baseRunId: sql`(select ${sourceHeads.syncRunId} from ${sourceHeads} where ${sourceHeads.id} = ${SOURCE_HEAD_ID})`,
      datasourceIds,
      status: 'queued',
    }).returning()
    return run
  }

  async getRun(runId: number): Promise<SyncRun | null> {
    return await this.db.select().from(syncRun).where(eq(syncRun.id, runId)).get() ?? null
  }

  async startRun(runId: number): Promise<void> {
    await this.db.update(syncRun).set({ status: 'running', startedAt: new Date() })
      .where(and(eq(syncRun.id, runId), eq(syncRun.status, 'queued')))
  }

  async getHead() {
    return await this.db.select().from(sourceHeads).where(eq(sourceHeads.id, SOURCE_HEAD_ID)).get() ?? null
  }
  async publishRun(runId: number, slot: string) {
    const run = (await this.getRun(runId))!
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
        setWhere: run.baseRunId === null ? sql`0` : eq(sourceHeads.syncRunId, run.baseRunId),
      })
    await this.db.update(syncRun).set({ status: 'succeeded', finishedAt: now, error: null })
      .where(and(eq(syncRun.id, runId), eq(syncRun.status, 'running')))
  }

  async failRun(runId: number, error: unknown): Promise<void> {
    const message = error instanceof Error ? error.message : String(error)
    await this.db.update(syncRun).set({ status: 'failed', finishedAt: new Date(), error: message })
      .where(and(eq(syncRun.id, runId), inArray(syncRun.status, ['queued', 'running'])))
  }
}
import { asSourceDb, type SourceDatabase, type SourceDbInput } from './index'
import type { DB } from './schema'
import type { pageContent, pageRef, pageRevision } from './schema/content'
import type { datasource as syncDatasource } from './schema/sync'
import { chunk, chunkD1Columns } from '../utils/chunk'

export const SOURCE_HEAD_ID = 'current'

export class SourceSyncError extends Error {
  override name = 'SourceSyncError'
}

export type DatasourceSnapshot = {
  datasource: Omit<typeof syncDatasource.$inferInsert, 'id' | 'syncRunId'>
  bodies: (typeof pageContent.$inferInsert)[]
  revisions: (typeof pageRevision.$inferInsert)[]
  refs: Pick<typeof pageRef.$inferInsert, 'revisionId' | 'url' | 'publishedAt'>[]
}

export class SourceWriteRepo {
  private readonly ctx: SourceDatabase
  private readonly db: DB

  constructor(input: SourceDbInput) {
    this.ctx = asSourceDb(input)
    this.db = this.ctx.db
  }

  async writeDatasource(runId: number, snapshot: DatasourceSnapshot): Promise<{ datasourceId: number; pages: number }> {
    const { datasource, pageContent, pageRef, pageRevision } = this.ctx.tables
    const { bodies, revisions, refs, datasource: ds } = snapshot
    const bodyGroups = this.ctx.backend === 'd1' ? chunkD1Columns(bodies, 2) : chunk(bodies, 200)
    for (const group of bodyGroups) {
      await this.db.insert(pageContent).values(group).onConflictDoNothing()
    }

    const revisionGroups = this.ctx.backend === 'd1' ? chunkD1Columns(revisions, 13) : chunk(revisions, 500)
    for (const group of revisionGroups) {
      await this.db.insert(pageRevision).values(group).onConflictDoNothing()
    }

    const [saved] = await this.db.insert(datasource).values({ ...ds, syncRunId: runId }).returning()
    if (refs.length > 0) {
      if (this.ctx.backend === 'd1') {
        const statements = chunkD1Columns(refs, 6).map((group) =>
          this.db.insert(pageRef).values(group.map((ref) => ({ ...ref, syncRunId: runId, datasourceId: saved.id }))),
        )
        // @ts-ignore drizzle D1 batch expects a non-empty tuple
        await this.db.batch(statements)
      } else {
        await this.db.transaction(async (tx) => {
          for (const group of chunk(refs, 1000)) {
            await tx.insert(pageRef).values(group.map((ref) => ({ ...ref, syncRunId: runId, datasourceId: saved.id })))
          }
        })
      }
    }

    return { datasourceId: saved.id, pages: refs.length }
  }
}

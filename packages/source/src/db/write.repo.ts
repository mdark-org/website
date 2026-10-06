import { and, eq, inArray, sql } from 'drizzle-orm'
import type { BatchItem } from 'drizzle-orm/batch'
import { pageContent, pageRef, pageRevision, pageSection, type PageSections } from './schema/content'
import { datasource, sourceHeads } from './schema/sync'
import type { DB } from './schema'
import { chunkD1Columns } from '../utils/chunk'

export const SOURCE_HEAD_ID = 'current'

export class SourceSyncError extends Error {
  override name = 'SourceSyncError'
}

export type DatasourceSnapshot = {
  datasource: Omit<typeof datasource.$inferInsert, 'id' | 'syncRunId'>,
  bodies: (typeof pageContent.$inferInsert)[]
  revisions: (typeof pageRevision.$inferInsert)[]
  refs: Pick<typeof pageRef.$inferInsert, 'revisionId' | 'url' | 'publishedAt'>[]
}

export class SourceWriteRepo {
  private readonly db: DB

  constructor(db: DB) {
    this.db = db
  }

  async writeDatasource(runId: number, snapshot: DatasourceSnapshot): Promise<{ datasourceId: number; pages: number }> {
    const { bodies, revisions, refs, datasource:ds } = snapshot
    for (const group of chunkD1Columns(bodies, 2)) {
      await this.db.insert(pageContent).values(group).onConflictDoNothing()
    }

    for (const group of chunkD1Columns(revisions, 13)) {
      await this.db.insert(pageRevision).values(group).onConflictDoNothing()
    }
    const [saved] = await this.db.insert(datasource).values({ ...ds, syncRunId: runId }).returning()
    const statements = chunkD1Columns(refs, 6)
    .map(group =>
      this.db.insert(pageRef)
        .values(group.map((ref) => ({ ...ref, syncRunId: runId, datasourceId: saved.id })))
    )
    if(statements.length > 0) {
      // @ts-ignore
      await this.db.batch(statements)
    }

    // Replace the datasource snapshot in this run and its page references.
    //       // .onConflictDoUpdate({
    //       //   target: datasource.slug,
    //       //   set: { syncRunId: runId, ...ds },
    //       // }),
    return { datasourceId: saved.id, pages: refs.length }
  }

}


//
// async getHead() {
//   return await this.db.select().from(sourceHeads).where(eq(sourceHeads.id, SOURCE_HEAD_ID)).get() ?? null
// }
//
// async getSectionRevisionIds(revisionIds: string[]): Promise<Set<string>> {
//   const completed = new Set<string>()
//   for (const group of chunkD1Columns(revisionIds, 1)) {
//   const rows = await this.db.select({ id: pageSection.revisionId }).from(pageSection)
//     .where(inArray(pageSection.revisionId, group))
//   rows.forEach((row) => completed.add(row.id))
// }
// return completed
// }
//
// private sectionStatements(revisionId: string, sections: PageSections): BatchItem<'sqlite'>[] {
//   if (sections.length === 0) return []
//   const values = JSON.stringify(sections.map(({ headingId, headingTitle, content, ordinal }) => ({
//     revisionId, headingId, headingTitle, content, ordinal,
//   })))
//   return [this.db.run(sql`
//       INSERT INTO page_sections (revision_id, heading_id, heading_title, content, ordinal)
//       SELECT
//         json_extract(value, '$.revisionId'),
//         json_extract(value, '$.headingId'),
//         json_extract(value, '$.headingTitle'),
//         json_extract(value, '$.content'),
//         json_extract(value, '$.ordinal')
//       FROM json_each(${values})
//       WHERE 1
//       ON CONFLICT (revision_id, ordinal) DO NOTHING
//     `)]
// }

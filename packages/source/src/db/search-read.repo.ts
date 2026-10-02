import { and, eq, inArray } from 'drizzle-orm'
import { pageRef, pageRevision, pageSection } from './schema/content'
import { datasource, sourceHeads, type SearchSlotId } from './schema/sync'
import type { DB } from './schema/index.ts'

export interface PublishedSearch {
  syncRunId: number
  slot: SearchSlotId
}

export interface SearchSectionResult {
  id: number
  revisionId: string
  headingId: string | null
  headingTitle: string | null
  content: string
  ordinal: number
  pageTitle: string
  url: string
}

export class SearchReadRepo {
  private readonly db: DB

  constructor(db: DB) {
    this.db = db
  }

  async getPublishedSearch(): Promise<PublishedSearch | null> {
    const head = await this.db.select({ syncRunId: sourceHeads.syncRunId, slot: sourceHeads.searchSlot })
      .from(sourceHeads).where(eq(sourceHeads.id, 'current')).get()
    if (!head?.slot) return null
    return { syncRunId: head.syncRunId, slot: head.slot }
  }

  async resolveSections(syncRunId: number, ids: number[]): Promise<SearchSectionResult[]> {
    if (ids.length === 0) return []
    const rows: SearchSectionResult[] = await this.db.select({
      id: pageSection.id,
      revisionId: pageSection.revisionId,
      headingId: pageSection.headingId,
      headingTitle: pageSection.headingTitle,
      content: pageSection.content,
      ordinal: pageSection.ordinal,
      pageTitle: pageRevision.title,
      url: pageRef.url,
    }).from(pageSection)
      .innerJoin(pageRef, and(
        eq(pageRef.revisionId, pageSection.revisionId),
        eq(pageRef.syncRunId, syncRunId),
      ))
      .where(inArray(pageSection.id, ids))
    return rows
  }
}

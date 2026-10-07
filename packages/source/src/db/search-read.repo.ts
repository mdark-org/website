import { and, eq, inArray } from 'drizzle-orm'
import {datasource, pageContent, pageRef, pageRevision, pageSection} from './schema'
import { sourceHeads } from './schema'
import type { DB } from './schema'
import { chunkD1Columns } from '../utils/chunk'

export interface PublishedSearch {
  syncRunId: number | null
  slot: string | null
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
    const groups = chunkD1Columns([...new Set(fileHashes)], 1)
    const rows = await Promise.all(groups.map((group) => {
      return this.db.select({
        revisionId: pageRevision.revisionId,
        headingId: pageRevision.title,
        headingTitle: pageRevision.title,
        content: pageContent.markdown,
        pageTitle: pageRevision.title,
        description: pageRevision.description,
        url: pageRef.url,
        tag: datasource.slug,
      }).from(pageRef)
        .innerJoin(pageRevision, eq(pageRevision.revisionId, pageRef.revisionId))
        .innerJoin(pageContent, eq(pageContent.hash, pageRevision.contentHash))
        .innerJoin(datasource, and(eq(datasource.id, pageRef.datasourceId), eq(datasource.syncRunId, pageRef.syncRunId)))
        .where(and(eq(pageRef.syncRunId, runId), inArray(pageRevision.revisionId, group)))
    }))
    return rows.flat()
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

}

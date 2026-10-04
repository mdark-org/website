import { sql } from 'drizzle-orm'
import type { DatasourceInfo, Page, Root } from '../types'
import type { DB, pageContent, pageRef, pageRevision } from './schema'

export interface ListPagesQuery {
  datasourceId?: number
  limit?: number
  offset?: number
  /** When true, exclude pages that explicitly opted out of RSS. */
  rss?: boolean
}

export interface ISourceReadRepo {
  listDatasource(): Promise<DatasourceInfo[]>
  getDatasource(idOrSlug: number | string): Promise<DatasourceInfo | null>
  getPageTree(datasourceId: number): Promise<Root | null>
  getPage(url: string, options?: { content?: boolean }): Promise<Page | null>
  listPages(query?: ListPagesQuery, options?: { content?: boolean }): Promise<Page[]>
}

const currentRun = { sourceHead: { id: 'current' } }
const datasourceColumns = { id: true, slug: true, name: true, description: true, icon: true, mountedPath: true, sortOrder: true } as const
const pageColumns = { url: true, datasourceId: true } as const
const revisionColumns = { title: true, description: true, tags: true, metadata: true, filename: true, ext: true, publishedAt: true } as const

type ReadPage = Pick<typeof pageRef.$inferSelect, keyof typeof pageColumns> & {
  revision: Pick<typeof pageRevision.$inferSelect, keyof typeof revisionColumns> & {
    content?: Pick<typeof pageContent.$inferSelect, 'markdown'>
  }
}

function toPage(ref: ReadPage): Page {
  const revision = ref.revision
  return {
    url: ref.url,
    datasourceId: ref.datasourceId,
    name: revision.title,
    title: revision.title,
    type: 'page',
    filename: revision.filename ?? undefined,
    ext: revision.ext ?? undefined,
    data: {
      title: revision.title,
      description: revision.description ?? undefined,
      tags: revision.tags ?? undefined,
      date: revision.publishedAt !== 0 ? new Date(revision.publishedAt) : undefined,
      ...revision.metadata,
      ...(revision.content ? { content: revision.content.markdown } : {}),
    },
  }
}

export class SourceReadRepo implements ISourceReadRepo {
  private readonly db: DB

  constructor(db: DB) {
    this.db = db
  }

  async listDatasource(): Promise<DatasourceInfo[]> {
    return this.db.query.datasource.findMany({
      columns: datasourceColumns,
      where: { syncRun: currentRun },
      orderBy: { sortOrder: 'asc', id: 'asc' },
    })
  }

  async getDatasource(idOrSlug: number | string): Promise<DatasourceInfo | null> {
    return await this.db.query.datasource.findFirst({
      columns: datasourceColumns,
      where: { ...(typeof idOrSlug === 'number' ? { id: idOrSlug } : { slug: idOrSlug }), syncRun: currentRun },
      orderBy: { sortOrder: 'asc', id: 'asc' },
    }) ?? null
  }

  async getPageTree(datasourceId: number): Promise<Root | null> {
    const row = await this.db.query.datasource.findFirst({
      columns: { tree: true },
      where: { id: datasourceId, syncRun: currentRun },
    })
    return row?.tree ?? null
  }

  async getPage(url: string, options: { content?: boolean } = {}): Promise<Page | null> {
    const ref = await this.db.query.pageRef.findFirst({
      columns: pageColumns,
      where: { url, syncRun: currentRun },
      with: { revision: { columns: revisionColumns, with: { content: options.content ? { columns: { markdown: true } } : false } } },
    })
    return ref ? toPage(ref) : null
  }

  async listPages(query: ListPagesQuery = {}, options: { content?: boolean } = {}): Promise<Page[]> {
    const refs = await this.db.query.pageRef.findMany({
      columns: pageColumns,
      where: {
        syncRun: currentRun,
        datasourceId: query.datasourceId,
        revision: query.rss ? { RAW: (revision) => sql`coalesce(json_extract(${revision.metadata}, '$.rss'), 1) = 1` } : undefined,
      },
      with: { revision: { columns: revisionColumns, with: { content: options.content ? { columns: { markdown: true } } : false } } },
      orderBy: { publishedAt: 'desc', url: 'desc' },
      limit: query.limit ?? 50,
      offset: query.offset ?? 0,
    })
    return refs.map(toPage)
  }
}

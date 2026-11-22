import { eq, sql } from 'drizzle-orm'
import { DatasourceInfo, Folder, Page, PageWithContent } from '../types'
import { asSourceDb, type SourceDatabase, type SourceDbInput } from './index'
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
  getPageTree(datasourceId: number): Promise<Folder | null>
  getPage(url: string, options?: { content?: boolean }): Promise<Page | null>
  listPages(query?: ListPagesQuery, options?: { content?: boolean }): Promise<PageWithContent[]>
}

const SOURCE_HEAD_ID = 'current'
const datasourceColumns = { id: true, slug: true, name: true, description: true, icon: true, mountedPath: true, sortOrder: true } as const
const pageColumns = { url: true, datasourceId: true } as const
const revisionColumns = { revisionId: true, title: true, description: true, tags: true, metadata: true, filename: true, ext: true, publishedAt: true } as const

type ReadPage = Pick<typeof pageRef.$inferSelect, keyof typeof pageColumns> & {
  revision: Pick<typeof pageRevision.$inferSelect, keyof typeof revisionColumns> & {
    content?: Pick<typeof pageContent.$inferSelect, 'markdown'>
  }
}


function toPage(ref: ReadPage): PageWithContent {
  const revision = ref.revision
  return {
    url: ref.url,
    datasourceId: ref.datasourceId,
    name: revision.title,
    $id: revision.revisionId,
    type: 'page',
    filename: revision.filename ?? undefined,
    ext: revision.ext ?? undefined,
    data: {
      title: revision.title,
      description: revision.description ?? undefined,
      tags: revision.tags ?? undefined,
      date: revision.publishedAt,
      ...revision.metadata,
    },
    ...(revision.content ? { content: revision.content.markdown } : {}),
  }
}

export class SourceReadRepo implements ISourceReadRepo {
  private readonly ctx: SourceDatabase
  private readonly db: DB

  constructor(input: SourceDbInput) {
    this.ctx = asSourceDb(input)
    this.db = this.ctx.db
  }

  private async currentSyncRunId(): Promise<number | null> {
    const { sourceHeads } = this.ctx.tables
    const [head] = await this.db.select({ syncRunId: sourceHeads.syncRunId })
      .from(sourceHeads)
      .where(eq(sourceHeads.id, SOURCE_HEAD_ID))
      .limit(1)
    return head?.syncRunId ?? null
  }

  async listDatasource(): Promise<DatasourceInfo[]> {
    const syncRunId = await this.currentSyncRunId()
    if (syncRunId === null) return []
    return this.db.query.datasource.findMany({
      columns: datasourceColumns,
      where: { syncRunId },
      orderBy: { sortOrder: 'asc', id: 'asc' },
    })
  }

  async getDatasource(idOrSlug: number | string): Promise<DatasourceInfo | null> {
    const syncRunId = await this.currentSyncRunId()
    if (syncRunId === null) return null
    return await this.db.query.datasource.findFirst({
      columns: datasourceColumns,
      where: { ...(typeof idOrSlug === 'number' ? { id: idOrSlug } : { slug: idOrSlug }), syncRunId },
      orderBy: { sortOrder: 'asc', id: 'asc' },
    }) ?? null
  }

  async getPageTree(datasourceId: number): Promise<Folder | null> {
    const syncRunId = await this.currentSyncRunId()
    if (syncRunId === null) return null
    const row = await this.db.query.datasource.findFirst({
      columns: { tree: true, syncRunId: true },
      where: { id: datasourceId, syncRunId },
    })
    return row?.tree ? { ...row.tree, $id: `datasource:${datasourceId}:run:${row.syncRunId}` } : null
  }

  async getPage(url: string, options: { content?: boolean } = {}): Promise<Page | null> {
    const syncRunId = await this.currentSyncRunId()
    if (syncRunId === null) return null
    const ref = await this.db.query.pageRef.findFirst({
      columns: { url: true, datasourceId: true },
      where: { url, syncRunId },
      with: { revision: { columns: revisionColumns, with: { content: options.content ? { columns: { markdown: true } } : false } } },
    })
    return ref ? toPage(ref) : null
  }

  async listPages(query: ListPagesQuery = {}, options: { content?: boolean } = {}): Promise<Page[]> {
    const syncRunId = await this.currentSyncRunId()
    if (syncRunId === null) return []
    const refs = await this.db.query.pageRef.findMany({
      columns: { url: true, datasourceId: true },
      where: {
        syncRunId,
        datasourceId: query.datasourceId,
        revision: query.rss
          ? {
              RAW: (revision) =>
                this.ctx.backend === 'pg'
                  ? sql`coalesce(${revision.metadata}->>'rss', 'true') not in ('false', '0')`
                  : sql`coalesce(json_extract(${revision.metadata}, '$.rss'), 1) = 1`,
            }
          : undefined,
      },
      with: { revision: { columns: revisionColumns, with: { content: options.content ? { columns: { markdown: true } } : false } } },
      orderBy: { publishedAt: 'desc', url: 'desc' },
      limit: query.limit ?? 50,
      offset: query.offset ?? 0,
    })
    return refs.map(toPage)
  }
}

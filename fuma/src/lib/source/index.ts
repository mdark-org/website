import type { DatasourceInfo, Page, ISourceReadRepo } from '@repo/source'
import { config } from '../../../config'
import { getReader } from './reader'
import { buildDatasourceFeed, buildSiteFeed } from './rss'

const PAGE_SIZE = 90

/**
 * Content facade used by pages and routes. Pages come back *without* markdown unless
 * `{ content: true }` is asked for.
 */
export function createSource(reader: ISourceReadRepo) {
  return {
    /** `slug` includes the mount prefix, e.g. `['docs', 'btnews', '2024', 'xxx']`. Loads markdown. */
    getPageBySlug(slug: string[] | undefined): Promise<Page | null> {
      return reader.getPage(`/${(slug ?? []).join('/')}`, { content: true })
    },

    /** Same lookup without the markdown: for metadata and existence checks. */
    getPageMetaBySlug(slug: string[] | undefined): Promise<Page | null> {
      return reader.getPage(`/${(slug ?? []).join('/')}`)
    },

    /** Every page, newest first. */
    async getContentPages(options: { content?: boolean } = {}): Promise<Page[]> {
      if (!options.content) return reader.listPages({ limit: 100_000 })
      const out: Page[] = []
      for (let offset = 0; ; offset += PAGE_SIZE) {
        const batch = await reader.listPages({ limit: PAGE_SIZE, offset }, { content: true })
        out.push(...batch)
        if (batch.length < PAGE_SIZE) return out
      }
    },

    async getRecentPages(count: number = 20): Promise<Page[]> {
      return reader.listPages({ limit: count })
    },

    /** Newest page of the first datasource that has any. */
    async getFirstPage(): Promise<Page | undefined> {
      for (const d of await reader.listDatasource()) {
        const [page] = await reader.listPages({ datasourceId: d.id, limit: 1 })
        if (page) return page
      }
    },

    async generateRSS(category?: string) {
      if (category) {
        const datasource = await reader.getDatasource(category)
        return datasource ? buildDatasourceFeed(reader, datasource, config.baseUrl) : null
      }
      return buildSiteFeed(reader, config.baseUrl)
    },

    /** The datasource that owns `slug` (e.g. `['docs', 'btnews', ...]`), if any. */
    async getDatasourceBySlug(slug: string[]): Promise<DatasourceInfo | undefined> {
      const url = `/${slug.join('/')}`
      return (await reader.listDatasource()).find((d) => url === d.mountedPath || url.startsWith(`${d.mountedPath}/`))
    },
  }
}

export type Source = ReturnType<typeof createSource>

let instance: Source | undefined

/** Lazy: the D1 binding is only touched when a method is first called, never at import time. */
export const source: Source = new Proxy({} as Source, {
  get: (_target, prop) => Reflect.get((instance ??= createSource(getReader())), prop),
})

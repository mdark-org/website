import type { DatasourceInfo, Folder, Page, Item, Node,Root, ISourceReadRepo } from '@repo/source'
import type * as PageTree from 'fumadocs-core/page-tree'
import type { LayoutTab } from 'fumadocs-ui/layouts/shared'
import { config } from '@/config'
import { buildDatasourceFeed, buildSiteFeed } from './rss'
import { icon } from './icon'

function findDatasourceByPath(datasources: DatasourceInfo[], url: string): DatasourceInfo | undefined {
  let matched: DatasourceInfo | undefined
  for (const datasource of datasources) {
    if (url !== datasource.mountedPath && !url.startsWith(`${datasource.mountedPath}/`)) continue
    if (!matched || datasource.mountedPath.length > matched.mountedPath.length) matched = datasource
  }
  return matched
}

export function createSource(reader: ISourceReadRepo) {

  return {
    /** The datasource that owns `slug` (e.g. `['docs', 'btnews', ...]`), if any. */
    async getDatasourceBySlug(slug: string[]): Promise<DatasourceInfo | undefined> {
      const url = `/${slug.join('/')}`
      return findDatasourceByPath(await reader.listDatasource(), url)
    },

    async getNavigation(slug?: string[]): Promise<{ tabs: LayoutTab[]; tree: PageTree.Root }> {
      const datasources = await reader.listDatasource()
      const active = findDatasourceByPath(datasources, `/docs/${(slug ?? []).join('/')}`)
      const snapshot = active ? await reader.getPageTree(active.id) : null
      return {
        tabs: datasources.map((datasource) => ({
          title: datasource.name,
          description: datasource.description,
          icon: icon(datasource.icon),
          url: `${datasource.mountedPath}`,
          props: {
            href: `${datasource.mountedPath}/index`,
          },
        })),
        tree: {
          type: 'root',
          name: 'root',
          children: snapshot?.children ?? [],
        } as PageTree.Root,
      }
    },

    getPageBySlug(slug: string[] | undefined): Promise<Page | null> {
      const slugs = `/${(slug ?? []).join('/')}`
      return reader.getPage(slugs, { content: true })
    },

    getPageMetaBySlug(slug: string[] | undefined): Promise<Page | null> {
      const slugs = `/${(slug ?? []).join('/')}`
      return reader.getPage(slugs)
    },

    async getContentPages(): Promise<Page[]> {
      return reader.listPages({ limit: 100_000 })
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
  }
}

export type Source = ReturnType<typeof createSource>

let instance: Source | undefined

import { env } from 'cloudflare:workers'
import {SourceReadRepo, createDB} from '@repo/source'

export const source: Source = new Proxy({} as Source, {
  get: (_target, prop) => Reflect.get(
    (instance ??= createSource(new SourceReadRepo(createDB(env.DB)))), prop),
})

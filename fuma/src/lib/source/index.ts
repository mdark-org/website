import type { DatasourceInfo, Folder, Page, ISourceReadRepo } from '@repo/source'
import type * as PageTree from 'fumadocs-core/page-tree'
import type { LayoutTab } from 'fumadocs-ui/layouts/shared'
import { config } from '../../../config'
import { getReader } from './reader'
import { buildDatasourceFeed, buildSiteFeed } from './rss'
import { icon } from './icon'

const PAGE_SIZE = 90

function findDatasourceByPath(datasources: DatasourceInfo[], url: string): DatasourceInfo | undefined {
  let matched: DatasourceInfo | undefined
  for (const datasource of datasources) {
    if (url !== datasource.mountedPath && !url.startsWith(`${datasource.mountedPath}/`)) continue
    if (!matched || datasource.mountedPath.length > matched.mountedPath.length) matched = datasource
  }
  return matched
}

function toNavigationPage(page: Page): PageTree.Item {
  return {
    type: 'page', $id: `page:${page.url}`, name: page.name, url: page.url,
    ...(page.external === undefined ? {} : { external: page.external }),
  }
}

function toNavigationNode(node: Folder | Page): PageTree.Node {
  if (node.type === 'page') return toNavigationPage(node)
  return {
    type: 'folder',
    $id: `folder:${node.url}`,
    name: node.name,
    ...(node.description ? { description: node.description } : {}),
    ...(node.icon ? { icon: icon(node.icon) } : {}),
    ...(node.root === undefined ? {} : { root: node.root }),
    ...(node.defaultOpen === undefined ? {} : { defaultOpen: node.defaultOpen }),
    ...(node.index ? { index: toNavigationPage(node.index) } : {}),
    children: node.children
      .filter((child) => child.type !== 'page' || child.url !== node.index?.url)
      .map(toNavigationNode),
  }
}

/**
 * Content facade used by pages and routes. Pages come back *without* markdown unless
 * `{ content: true }` is asked for.
 */
export function createSource(reader: ISourceReadRepo) {
  async function readPageByPath(url: string, options: Parameters<ISourceReadRepo['getPage']>[1] = {}): Promise<Page | null> {
    const page = await reader.getPage(url, options)
    if (page) return page

    const datasource = findDatasourceByPath(await reader.listDatasource(), url)
    if (!datasource || url !== datasource.mountedPath) return null

    // Tabs use the mount prefix, but existing index pages keep their stored URLs.
    const index = await reader.getPage(`${url}/index`, options)
    if (index) return index
    const [first] = await reader.listPages({ datasourceId: datasource.id, limit: 1 }, options)
    return first ?? null
  }

  return {
    async getNavigation(slug?: string[]): Promise<{ tabs: LayoutTab[]; tree: PageTree.Root }> {
      const datasources = await reader.listDatasource()
      const active = findDatasourceByPath(datasources, `/docs/${(slug ?? []).join('/')}`)
      const snapshot = active ? await reader.getPageTree(active.id) : null
      return {
        tabs: datasources.map((datasource) => ({
          title: datasource.name,
          description: datasource.description,
          icon: icon(datasource.icon),
          url: datasource.mountedPath,
        })),
        tree: {
          type: 'root',
          $id: snapshot?.$id ?? `datasource:${active?.id ?? 'none'}:empty`,
          name: active?.name ?? 'root',
          children: snapshot?.children.map(toNavigationNode) ?? [],
        },
      }
    },

    /** `slug` includes the mount prefix, e.g. `['docs', 'btnews', '2024', 'xxx']`. Loads markdown. */
    getPageBySlug(slug: string[] | undefined): Promise<Page | null> {
      return readPageByPath(`/${(slug ?? []).join('/')}`, { content: true })
    },

    /** Same lookup without the markdown: for metadata and existence checks. */
    getPageMetaBySlug(slug: string[] | undefined): Promise<Page | null> {
      return readPageByPath(`/${(slug ?? []).join('/')}`)
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
      return findDatasourceByPath(await reader.listDatasource(), url)
    },
  }
}

export type Source = ReturnType<typeof createSource>

let instance: Source | undefined

/** Lazy: the D1 binding is only touched when a method is first called, never at import time. */
export const source: Source = new Proxy({} as Source, {
  get: (_target, prop) => Reflect.get((instance ??= createSource(getReader())), prop),
})

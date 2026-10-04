import type { DatasourceInfo } from '@repo/source'
import { icon } from '@/lib/source/icon'
import { getReader } from '@/lib/source/reader'
import { Root } from "fumadocs-core/page-tree"
/** A datasource reduced to its root node (no children): cheap, and needs no tree query. */
const stub = (d: DatasourceInfo) => ({
  type: 'folder',
  root: true,
  name: d.name,
  title: d.name,
  url: d.mountedPath,
  description: d.description,
  icon: icon(d.icon),
  depth: d.mountedPath.split('/').length - 1,
  children: [],
})

export const sidebarSource = {
  /**
   * `slug` is the route's catch-all segments (without `docs`). Only the active datasource
   * gets its full tree; the others are collapsed roots, which keeps the RSC payload small.
   */
  async getSidebarTree(slug?: string[]) {
    const reader = getReader()
    const datasources = await reader.listDatasource()
    // const activeUrl = slug?.[0] ? `/docs/${slug[0]}` : undefined

    const children = await Promise.all(
      datasources.map(async (d) => {
        // if (d.mountedPath !== activeUrl) return stub(d)
        const tree = await reader.getPageTree(d.id)
        return tree ? { ...tree, icon: icon(tree.icon) } : stub(d)
      }),
    )
    return { name: 'root', children } as Root
  },
}


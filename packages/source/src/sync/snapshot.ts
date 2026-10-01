import type { Page, Root, TreeNode, TreePage } from '../types.ts'

/** What `SourceBuilder.build()` returns. Kept structural so this package never needs the builder's types at runtime. */
export interface BuiltDatasource {
  pageTree: Root
  pageMap: Map<string, Page>
  datasourceInfo: {
    id: string
    name: string
    mountedPath: string
    category?: string[]
    description: string
    github?: { repo: string; branch: string; dir: string }
    icon?: string
    config?: unknown
  }
}


function slimPage(p: Page | TreePage): TreePage {
  return {
    type: 'page',
    name: p.name ?? p.title,
    title: p.title ?? p.name,
    url: p.url,
    ...(p.external ? { external: true } : {}),
  }
}

function slimNode(n: TreeNode): TreeNode {
  if (n.type !== 'folder') return slimPage(n)
  return {
    type: 'folder',
    name: n.name,
    title: n.title ?? n.name,
    url: n.url,
    depth: n.depth,
    ...(n.description ? { description: n.description } : {}),
    ...(n.icon ? { icon: n.icon } : {}),
    ...(n.root ? { root: true } : {}),
    ...(n.defaultOpen !== undefined ? { defaultOpen: n.defaultOpen } : {}),
    ...(n.index ? { index: slimPage(n.index) } : {}),
    children: (n.children ?? []).map(slimNode),
  }
}

/**
 * The sidebar only needs structure. The builder's folder children embed whole page objects
 * (date, tags, ids, ...); strip them down so the stored tree stays small.
 */
export function slimTree(root: Root): Root {
  const node = slimNode(root)
  if (node.type !== 'folder') throw new Error('The datasource root must be a folder.')
  return { ...node, root: true }
}

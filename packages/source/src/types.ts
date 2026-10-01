export interface PageGithub {
  owner: string
  repo: string
  sha: string
  path: string
}

export interface PageData {
  title: string
  description?: string
  /** `undefined` when the source had no (valid) date. */
  date?: Date
  tags?: string[]
  rss?: boolean
  bvid?: string
  ytid?: string
  wbid?: string
  xgid?: string
  /** Raw markdown. Only present when the page was loaded with `{ content: true }`. */
  content?: string
}

export interface Page {
  url: string
  name: string
  title: string
  type: 'page'
  external?: boolean
  /** Provider key. It does not depend on the public URL. */
  sourceKey?: string
  filename?: string
  ext?: string
  datasourceId?: number
  data?: PageData
  github?: PageGithub
  [x: string]: any
}

export interface TreePage {
  type: 'page'
  name: string
  title: string
  url: string
  external?: boolean
  [x: string]: any
}

export interface TreeFolder {
  type: 'folder'
  name: string
  title: string
  url: string
  description?: string
  icon?: any
  root?: boolean
  defaultOpen?: boolean
  depth: number
  index?: TreePage
  children: TreeNode[]
  [x: string]: any
}

export type TreeNode = TreeFolder | TreePage
export type Root = TreeFolder & { root: true }

export interface DatasourceInfo {
  id: number
  /** Last segment of `mountedPath`, e.g. `btnews`. */
  slug: string
  name: string
  description: string
  icon?: string | null
  mountedPath: string
  sortOrder: number
}

import type { pageSchema } from "./schema";
import {z} from "zod";

export type Page = z.infer<typeof pageSchema>

export type Folder = {
  url: string,
  name: string,
  title: string,
  type: 'folder',
  defaultOpen?: boolean,
  root?: boolean,
  description?: string,
  icon?: any
  index?: Page
  depth: number,
  $source?: any,
  children: (Folder|Page) []
}


export type Node = (Folder | Page) & {
  children: Node[]
  [x: string]: any
}

export type Root = Folder & { root: true }


export type Item = Root | Folder | Page

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

export interface DatasourceInfo {
  id: number
  slug: string
  name: string
  description: string
  icon?: string | null
  mountedPath: string
  sortOrder: number
}


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

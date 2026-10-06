import {z} from "zod";
import {pageSchema, pageWithContentSchema, Metadata} from "./schema";
// 保存在 db 中，单行 page revision
export type Page = z.infer<typeof pageSchema>
export type PageWithContent = z.infer<typeof pageWithContentSchema>
// page content
// build 结果需要用来填充 pageTree。
export type Folder = {
  type: 'folder',
  $id: string,
  name: string,
  description?: string,
  index?: Item,
  // path
  icon?: string
  url: string,
  defaultOpen?: boolean,
  collapsible?: boolean,
  root?: boolean,
  // depth: number,
  // extend
  // data?: Metadata
  children: Node[]
}

export type Item = {
  type: 'page',
  $id: string,
  name: string,
  description?: string,
  // path
  icon?: string
  url: string,
  external?: boolean,
  // extend
  data?: Metadata
}

export type Separator = {
  type: 'separator',
  $id: string,
  name?: string,
  icon?: string
}


export type Root = {
  type: 'root',
  name: string,
  description?: string,
  children: Node[],
  fallback?: Root,
}

export type Node = Folder | Item | Separator

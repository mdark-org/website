import type { Page, Root } from '../types'

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


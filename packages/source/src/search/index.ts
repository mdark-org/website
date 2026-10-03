import type { SortedResult } from 'fumadocs-core/search'
import { visit } from 'unist-util-visit'
import { SearchReadRepo, type PublishedSearch, type SearchSectionResult } from '../db/search-read.repo'
import type { SearchSlotId } from '../db/schema/sync.ts'
import { createMarkdownParser } from '../markdown'

export { SearchReadRepo }
export type { PublishedSearch, SearchSectionResult }

export const SEARCH_INSTANCES = {
  a: 'mdark-a',
  b: 'mdark-b',
} satisfies Record<SearchSlotId, string>

export interface SearchManifest {
  syncRunId: number
  items: Record<string, string>
}

export interface SearchItemInput extends SearchSectionResult {
  tag: string
}

export interface SearchItem {
  key: string
  content: string
  metadata: { pagesectionid: string; locale: string, tag: string }
}

export interface SearchChunk {
  score: number
  text: string
  item: { metadata?: Record<string, unknown> }
}

export function inactiveSearchSlot(active: SearchSlotId | null): SearchSlotId {
  return active === 'a' ? 'b' : 'a'
}

export function sectionItemKey(section: Pick<SearchSectionResult, 'revisionId' | 'id'>): string {
  return `page/${section.revisionId}/section/${section.id}.md`
}

export function createSearchItem(section: SearchItemInput): SearchItem {
  const content = section.content.trim()
  if (!content) throw new Error(`Page section ${section.id} has no searchable content.`)
  const heading = section.headingTitle ? `\n\n## ${section.headingTitle}` : ''
  return {
    key: sectionItemKey(section),
    content: `# ${section.pageTitle}${heading}\n\n${content}`,
    metadata: { pagesectionid: String(section.id), locale: 'zh-cn', tag: section.tag },
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function parseSearchManifest(value: unknown): SearchManifest {
  if (!isRecord(value)) {
    throw new Error('The Search manifest has an invalid shape.')
  }
  const syncRunId = value.syncRunId
  const storedItems = value.items
  if (typeof syncRunId !== 'number' || !Number.isSafeInteger(syncRunId) || !isRecord(storedItems)) {
    throw new Error('The Search manifest has an invalid shape.')
  }
  const items: Record<string, string> = {}
  for (const [key, itemId] of Object.entries(storedItems)) {
    if (!key || typeof itemId !== 'string' || !itemId) {
      throw new Error('The Search manifest contains an invalid item.')
    }
    items[key] = itemId
  }
  return { syncRunId, items }
}

export function getPageSectionId(chunk: SearchChunk): number | null {
  const id = chunk.item.metadata?.pageSectionId
  return typeof id === 'number' && Number.isSafeInteger(id) && id > 0 ? id : null
}

export function collapseSearchChunks(chunks: SearchChunk[]) {
  const sections = new Map<number, SearchChunk>()
  for (const chunk of chunks) {
    const id = getPageSectionId(chunk)
    if (id === null || !Number.isFinite(chunk.score)) continue
    const current = sections.get(id)
    if (!current || chunk.score > current.score) sections.set(id, chunk)
  }
  return [...sections.entries()]
    .map(([id, chunk]) => ({ id, score: chunk.score, text: chunk.text }))
    .sort((left, right) => right.score - left.score)
    .slice(0, 20)
}

const markdown = createMarkdownParser()

function plainText(value: string): string {
  const tree = markdown.parse(value)
  const blocks: string[] = []
  for (const block of tree.children) {
    const parts: string[] = []
    visit(block, (node) => {
      if (node.type === 'text' || node.type === 'inlineCode' || node.type === 'code') parts.push(node.value)
      if (node.type === 'image' && node.alt) parts.push(node.alt)
    })
    if (parts.length) blocks.push(parts.join(''))
  }
  return blocks.join('\n\n').trim()
}

function queryTerms(query: string): string[] {
  return [...new Set(query.trim().split(/\s+/u).filter(Boolean))].sort((left, right) => right.length - left.length)
}

function regexLiteral(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function escapeMarkdown(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/[\\`*_{}[\]()#+.!|~-]/g, '\\$&')
}

export function createSearchSnippet(content: string, query: string, maxLength = 220): string {
  const text = plainText(content)
  if (text.length <= maxLength) return text
  const terms = queryTerms(query)
  const match = terms.length ? new RegExp(terms.map(regexLiteral).join('|'), 'iu').exec(text) : null
  let start = match ? Math.max(0, match.index - 80) : 0
  let end = Math.min(text.length, start + maxLength)
  const startUnit = text.charCodeAt(start)
  const endUnit = text.charCodeAt(end)
  if (startUnit >= 0xdc00 && startUnit <= 0xdfff) start--
  if (endUnit >= 0xdc00 && endUnit <= 0xdfff) end--
  return `${start > 0 ? '...' : ''}${text.slice(start, end).trim()}${end < text.length ? '...' : ''}`
}

export function highlightSearchText(value: string, query: string): string {
  const terms = queryTerms(query)
  if (terms.length === 0) return escapeMarkdown(value)
  const pattern = new RegExp(terms.map(regexLiteral).join('|'), 'giu')
  let cursor = 0
  let result = ''
  for (const match of value.matchAll(pattern)) {
    const index = match.index
    result += escapeMarkdown(value.slice(cursor, index))
    result += `<mark>${escapeMarkdown(match[0])}</mark>`
    cursor = index + match[0].length
  }
  return result + escapeMarkdown(value.slice(cursor))
}

export function toSearchResult(section: SearchSectionResult, query: string): SortedResult {
  const snippet = createSearchSnippet(section.content, query)
  const content = snippet || section.headingTitle || section.pageTitle
  return {
    id: String(section.id),
    url: section.headingId ? `${section.url}#${encodeURIComponent(section.headingId)}` : section.url,
    type: 'text',
    content: highlightSearchText(content, query),
    breadcrumbs: section.headingTitle ? [section.pageTitle, section.headingTitle] : [section.pageTitle],
  }
}

export function createSearchResults(
  chunks: SearchChunk[],
  sections: SearchSectionResult[],
  query: string,
): SortedResult[] {
  const canonical = new Map(sections.map((section) => [section.id, section]))
  return collapseSearchChunks(chunks).flatMap(({ id }) => {
    const section = canonical.get(id)
    return section ? [toSearchResult(section, query)] : []
  })
}

import type { AiSearchInstance } from '@cloudflare/workers-types'

type SearchParam = {
  syncRunId: number
  query: string,
  tag?: string,
}

export async function search(repo: SearchReadRepo, instance: AiSearchInstance, {syncRunId, query, tag}: SearchParam) {
  const response = await instance.search({
    query,
    ai_search_options: {
      retrieval: {
        retrieval_type: 'hybrid',
        fusion_method: 'rrf',
        keyword_match_mode: 'or',
        max_num_results: 30,
        match_threshold: 0,
        return_on_failure: false,
        ...(tag ? { filters: { tag } } : {}),
      },
      query_rewrite: { enabled: false },
      reranking: { enabled: false },
      cache: { enabled: false },
    },
  })
  const sectionIds = response.chunks.map(it => it.item.metadata!.pageSectionId as number)
  const sections = await repo.resolveSections(syncRunId, sectionIds)
  return sections
}
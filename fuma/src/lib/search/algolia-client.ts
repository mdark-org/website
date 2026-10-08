import type { SearchClient } from 'fumadocs-core/search/client'
import { z } from 'zod'

export const searchResults = z.array(z.object({
  id: z.string(),
  url: z.string(),
  type: z.enum(['page', 'heading', 'text']),
  content: z.string(),
  breadcrumbs: z.array(z.string()).optional(),
}))

export function createAlgoliaSearchClient({ tag, enabled = true, fetcher = fetch }: {
  tag?: string
  enabled?: boolean
  fetcher?: typeof fetch
} = {}): SearchClient & { cancel(): void } {
  let controller: AbortController | undefined
  return {
    deps: [tag, enabled],
    cancel() { controller?.abort() },
    async search(query) {
      controller?.abort()
      query = query.trim()
      const length = Array.from(query).length
      if (!enabled || length < 2 || length > 256) return []
      const current = new AbortController()
      controller = current
      const params = new URLSearchParams({ q: query })
      if (tag) params.set('tag', tag)
      const response = await fetcher(`/api/search/algolia?${params}`, {
        signal: current.signal,
      })
      current.signal.throwIfAborted()
      if (!response.ok) throw new Error(`Algolia search request failed (${response.status}).`)
      const data: unknown = await response.json()
      current.signal.throwIfAborted()
      return searchResults.parse(data)
    },
  }
}

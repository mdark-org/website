import type { SearchClient } from 'fumadocs-core/search/client'
import { z } from 'zod'

const results = z.array(z.object({
  id: z.string(), url: z.string(), type: z.enum(['page', 'heading', 'text']),
  content: z.string(), breadcrumbs: z.array(z.string()).optional(),
}))

export function createSearchClient({ tag, enabled = true, fetcher = fetch }: {
  tag?: string; enabled?: boolean; fetcher?: typeof fetch
} = {}): SearchClient & { cancel(): void } {
  let controller: AbortController | undefined
  return {
    deps: [tag, enabled],
    cancel() { controller?.abort() },
    async search(query) {
      controller?.abort()
      query = query.trim()
      if (!enabled || Array.from(query).length < 2) return []
      const current = new AbortController()
      controller = current
      const params = new URLSearchParams({ q: query })
      if (tag) params.set('tag', tag)
      const response = await fetcher(`/api/search?${params}`, { signal: current.signal, cache: 'no-store' })
      current.signal.throwIfAborted()
      if (!response.ok) throw new Error(`Search request failed (${response.status}).`)
      const data: unknown = await response.json()
      current.signal.throwIfAborted()
      return results.parse(data)
    },
  }
}

import { SearchReadRepo, type PublishedSearch, type SearchSectionResult } from '../../db/search-read.repo'
export { SearchReadRepo }
export type { PublishedSearch, SearchSectionResult }
import type { AiSearchInstance } from '@cloudflare/workers-types'

type SearchParam = {
  query: string,
  tag?: string,
}

export async function search(instance: AiSearchInstance, {query, tag}: SearchParam) {

  const filters: {tag: string} | {} = tag ? { tag: tag } : {}

  const options = {
    query,
    ai_search_options: {
      retrieval: {
        retrieval_type: 'hybrid',
        fusion_method: 'rrf',
        keyword_match_mode: 'and',
        max_num_results: 30,
        match_threshold: 0.4,
        return_on_failure: false,
        filters: filters,
      },
      query_rewrite: { enabled: false },
      reranking: { enabled: false },
      cache: { enabled: true },
    },
  } as const
  const response = await instance.search(options)
  return response
}

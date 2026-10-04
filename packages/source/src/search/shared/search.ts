import { SearchReadRepo, type PublishedSearch, type SearchSectionResult } from '../../db/search-read.repo'
export { SearchReadRepo }
export type { PublishedSearch, SearchSectionResult }
import type { AiSearchInstance } from '@cloudflare/workers-types'

type SearchParam = {
  syncRunId: number
  query: string,
  tag?: string,
}

export async function search(repo: SearchReadRepo, instance: AiSearchInstance, {syncRunId, query, tag}: SearchParam) {

  const options = {
    query,
    ai_search_options: {
      retrieval: {
        retrieval_type: 'hybrid',
        fusion_method: 'rrf',
        keyword_match_mode: 'and',
        max_num_results: 30,
        match_threshold: 0,
        return_on_failure: false,
        ...(tag ? { filters: { tag } } : {}),
      },
      query_rewrite: { enabled: false },
      reranking: { enabled: true },
      cache: { enabled: false },
    },
  } as const
  const response = await instance.search(options)
  const results = response.chunks.map(chunk => ({
    id: chunk.id,
    url: chunk.item.metadata!.url as string,
    type: 'text',
    content: chunk.text,
  }))
  // const revisionIds = response.chunks.map(it => it.item.metadata!.revisionid as number)
  // const sections = await repo.resolveSections(syncRunId, sectionIds)
  return results
}

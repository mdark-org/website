import { SearchReadRepo, type PublishedSearch, type SearchSectionResult } from '../db/search-read.repo'
export { SearchReadRepo }
export type { PublishedSearch, SearchSectionResult }
export { indexSearchSlot } from './index-search'
export { ManifestStore, slotManifestSchema, runManifestSchema, runCheckpointSchema } from './manifest'
export type { SlotManifest, RunManifest, RunCheckpoint } from './manifest'

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

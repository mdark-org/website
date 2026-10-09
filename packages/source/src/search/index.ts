import type { SearchAdapter } from './v2/adapter'
import { indexer } from './v2/indexer'
import { ManifestStoreV2, type ItemMetadata } from './v2/manifest'
export * from './v2/search'
export { AISearchAdapter } from './adapters/ai-search-file'
export { AlgoliaV2SearchAdapter, type AlgoliaV2SearchAdapterOptions } from './adapters/algolia-v2'

type SyncStatus = {
  slot: string
  syncRunId: number
}

export type UploadOptionsV2<TSource, TContent, TMetadata extends ItemMetadata> = {
  status: SyncStatus
  bucket: R2Bucket
  searchAdapter: SearchAdapter<TSource, TContent, TMetadata>
}

export function uploadToAISearchV2<TSource, TContent, TMetadata extends ItemMetadata>(
  options: UploadOptionsV2<TSource, TContent, TMetadata>,
) {
  return indexer({
    searchAdapter: options.searchAdapter,
    manifestStore: new ManifestStoreV2(options.bucket, options.status.slot, options.status.syncRunId, options.searchAdapter.itemMetadataSchema),
    runId: options.status.syncRunId,
    slot: options.status.slot,
  })
}

import type { R2Bucket } from '@cloudflare/workers-types'
import type { SearchAdapter } from './adapter'
import { indexer } from './indexer'
import { ManifestStoreV2, type ItemMetadata } from './manifest'

export type { SearchAdapter, SearchableContent } from './adapter'
export type { ItemMetadata } from './manifest'
export * from './search'

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

import {AiSearchInstance, AiSearchNamespace, R2Bucket} from "@cloudflare/workers-types";
import { ManifestStoreV2 } from "./manifest";
import {indexer} from "./indexer";
import {DB} from "../../db/schema";
import {createFileDocsLoader, createFileItemsLoader, revisionKey} from "./file";
import {SearchReadRepo} from "../../db/search-read.repo";
export * from './search'
type SyncStatus = {
  slot: string,
  syncRunId: number
}

type UploadOptionsV2 = {
  status: SyncStatus,
  aiSearch: AiSearchInstance,
  bucket: R2Bucket,
  db: DB,
}

export function uploadToAISearchV2(options: UploadOptionsV2) {
  const slot = options.status.slot
  const runId = options.status.syncRunId
  const instance = options.aiSearch
  const manifestStore = new ManifestStoreV2(options.bucket, slot, options.status.syncRunId)
  const repo = new SearchReadRepo(options.db)
  return indexer({
    instance,
    docsUploader: {
      runId,
      slot,
      manifestStore,
      keyGetter: revisionKey,
      docsLoader: createFileDocsLoader(repo, runId),
      itemsLoader: createFileItemsLoader(repo, runId),
    }
  })
}
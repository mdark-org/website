import {AiSearchInstance, AiSearchNamespace, R2Bucket} from "@cloudflare/workers-types";
import {ManifestStore} from "./shared/manifest";
import {indexer} from "./shared/indexer";
import {DB} from "../db/schema";
import {SourceWriteRepo} from "../db/write.repo";
import {createFileDocsLoader, createFileItemsLoader, revisionKey} from "./file";
import {createSectionDocsLoader, createSectionItemsLoader, sectionKey} from "./section";
export * from './shared/search'
type SyncStatus = {
  slot: string,
  syncRunId: number
}

type UploadOptions = {
  status: SyncStatus,
  aiSearch: AiSearchInstance,
  bucket: R2Bucket,
  db: DB,
  type: 'section' | 'file'
}

const keyGetterMap = {
  'section': sectionKey,
  'file': revisionKey,
}
const docsLoaderMap = {
  'section': createSectionDocsLoader,
  'file': createFileDocsLoader,
}

const itemsLoaderMap = {
  'section': createSectionItemsLoader,
  'file': createFileItemsLoader,
}


export function uploadToAISearch(options: UploadOptions) {
  const slot = options.status.slot
  const runId = options.status.syncRunId
  const instance = options.aiSearch
  const manifestStore = new ManifestStore(options.bucket, slot, options.status.syncRunId)
  const repo = new SourceWriteRepo(options.db)

  const keyGetter = keyGetterMap[options.type]
  const docsLoader = docsLoaderMap[options.type](repo, runId)
  const itemsLoader = itemsLoaderMap[options.type](repo, runId)
  return indexer({
    instance,
    docsUploader: {
      runId,
      slot,
      manifestStore,
      keyGetter,
      docsLoader,
      itemsLoader,
    }
  })
}
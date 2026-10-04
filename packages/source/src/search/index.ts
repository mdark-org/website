import {AiSearchNamespace, R2Bucket} from "@cloudflare/workers-types";
import {ManifestStore} from "./shared/manifest";
import {indexer} from "./shared/indexer";
import {DB} from "../db/schema";
import {SourceWriteRepo} from "../db/write.repo";
import {createFileDocsLoader, revisionKey} from "./file";
import {createSectionDocsLoader, sectionKey} from "./section";

type SyncStatus = {
  activeSlot?: 'a' | 'b' | null,
  syncRunId: number
}

type UploadOptions = {
  status: SyncStatus,
  aiSearch: AiSearchNamespace,
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
export function uploadToAISearch(options: UploadOptions) {
  const slot = options.status.activeSlot === 'b' ? 'a' : 'b'
  const runId = options.status.syncRunId
  const instance = options.aiSearch.get(`mdark-file-dev-${slot}`)
  const manifestStore = new ManifestStore(options.bucket, slot, options.status.syncRunId)
  const keyGetter = keyGetterMap[options.type]
  const repo = new SourceWriteRepo(options.db)
  const docsLoader = docsLoaderMap[options.type](repo, runId)
  return indexer({
    instance,
    docsUploader: {
      runId,
      slot,
      manifestStore,
      keyGetter,
      docsLoader,
      repo,
    }
  })
}
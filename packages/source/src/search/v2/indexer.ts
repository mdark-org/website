import type { AiSearchInstance } from '@cloudflare/workers-types'
import { chunk } from '../../utils/chunk'
import {uploadSearchBatch, deleteSearchBatch, SearchableContent} from './upload'
import {completedSlotManifest, prepareIndexPlan} from './plan'
import {ManifestStoreV2} from "./manifest";

export type DocsUploader<T = any> = {
  manifestStore: ManifestStoreV2,
  runId: number,
  slot: string,
  keyGetter: (item: T) => string,
  itemsLoader: () => Promise<T[]>,
  docsLoader: (itemKeys: string[]) => Promise<SearchableContent[]>
}

export async function indexer({ instance, docsUploader }: {
  docsUploader: DocsUploader
  instance: AiSearchInstance
}): Promise<void> {
  console.log(`preparing index plan`)
  const manifestStore = docsUploader.manifestStore
  const prepared = await prepareIndexPlan(docsUploader)
  console.log(`plan: add ${prepared.plan.upsert.length}, delete ${prepared.plan.delete.length}`)
  const plan = prepared.plan
  let checkpoint = prepared.checkpoint
  let total = 0

  for (const sectionKeys of chunk(plan.upsert, 100)) {
    const docs = await docsUploader.docsLoader(sectionKeys)
    const result = await uploadSearchBatch({ instance, docs })
    total += result.processed.length
    console.log(`upload: ${result.processed.length}, total: ${total}, rest: ${plan.upsert.length - total}`)
    if (result.processed.length) {
      checkpoint = { ...checkpoint, upserted: [...checkpoint.upserted, ...result.processed] }
      await manifestStore.saveCheckpoint( checkpoint)
    }
    if (result.failure) throw result.failure.reason
  }
  let totalDelete = 0
  for (const entries of chunk(plan.delete, 50)) {
    const result = await deleteSearchBatch(instance, entries)
    totalDelete += result.processed.length
    console.log(`delete: ${result.processed.length}, totalDelete: ${total}, rest: ${plan.delete.length - totalDelete}`)
    if (result.processed.length) {
      checkpoint = { ...checkpoint, removed: [...checkpoint.removed, ...result.processed] }
      await manifestStore.saveCheckpoint(checkpoint)
    }
    if (result.failure) throw result.failure.reason
  }
  // 全部完成
  const previous = await manifestStore.readSlotManifest()
  await manifestStore.saveManifest(completedSlotManifest(docsUploader.runId, previous, checkpoint))
}

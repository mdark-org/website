import { chunk } from '../../utils/chunk'
import type { SearchAdapter } from './adapter'
import type { ItemMetadata, ManifestStoreV2 } from './manifest'
import { completedSlotManifest, prepareIndexPlan } from './plan'
import { deleteSearchBatch, uploadSearchBatch } from './upload'

export type IndexerOptions<TSource, TContent, TMetadata extends ItemMetadata> = {
  searchAdapter: SearchAdapter<TSource, TContent, TMetadata>
  manifestStore: ManifestStoreV2<TMetadata>
  runId: number
  slot: string
}

export async function indexer<TSource, TContent, TMetadata extends ItemMetadata>({
  searchAdapter, manifestStore, runId, slot,
}: IndexerOptions<TSource, TContent, TMetadata>): Promise<void> {
  console.log('preparing index plan')
  const prepared = await prepareIndexPlan({
    manifestStore,
    runId,
    slot,
    itemsLoader: () => searchAdapter.itemsLoader(),
    keyGetter: (item: TSource) => searchAdapter.keyGetter(item),
  })
  console.log(`plan: add ${prepared.plan.upsert.length}, delete ${prepared.plan.delete.length}`)
  const plan = prepared.plan
  let checkpoint = prepared.checkpoint
  let total = 0

  for (const itemKeys of chunk(plan.upsert, 100)) {
    const docs = await searchAdapter.docsLoader(itemKeys)
    const result = await uploadSearchBatch({
      uploader: (item) => searchAdapter.uploader(item),
      docs,
    })
    total += result.processed.length
    console.log(`upload: ${result.processed.length}, total: ${total}, rest: ${plan.upsert.length - total}`)
    if (result.processed.length) {
      checkpoint = { ...checkpoint, upserted: [...checkpoint.upserted, ...result.processed] }
      await manifestStore.saveCheckpoint(checkpoint)
    }
    if (result.failure) throw result.failure.reason
  }
  let totalDelete = 0
  for (const entries of chunk(plan.delete, 50)) {
    const result = await deleteSearchBatch((item) => searchAdapter.deleter(item), entries)
    totalDelete += result.processed.length
    console.log(`delete: ${result.processed.length}, totalDelete: ${totalDelete}, rest: ${plan.delete.length - totalDelete}`)
    if (result.processed.length) {
      checkpoint = { ...checkpoint, removed: [...checkpoint.removed, ...result.processed.map((item) => item.itemKey)] }
      await manifestStore.saveCheckpoint(checkpoint)
    }
    if (result.failure) throw result.failure.reason
  }
  const previous = await manifestStore.readSlotManifest()
  await manifestStore.saveManifest(completedSlotManifest(runId, previous, checkpoint))
}

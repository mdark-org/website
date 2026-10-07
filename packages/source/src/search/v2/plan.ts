import {IndexPlanV2, ItemMetadata, ManifestStoreV2, RunCheckpointV2, RunManifestV2, SlotManifestV2} from "./manifest";

export type IndexPlanInput<TSource, TMetadata extends ItemMetadata> = {
  manifestStore: ManifestStoreV2<TMetadata>
  itemsLoader: () => Promise<TSource[]>
  runId: number
  slot: string,
  keyGetter: (item: TSource) => string
}

export async function prepareIndexPlan<TSource, TMetadata extends ItemMetadata>({ itemsLoader, manifestStore, runId, slot, keyGetter }: IndexPlanInput<TSource, TMetadata>) {
  let runManifest = await manifestStore.readRunManifest()
  console.log('runManifest', runManifest)
  if (!runManifest) {
    const previous = await manifestStore.readSlotManifest()
    console.log('slotManifest', runManifest)
    const current = await itemsLoader()
    runManifest = createRunManifest({ runId, slot, previous, current, keyGetter })
    await manifestStore.saveRunManifest(runManifest)
  }
  const checkpoint = await manifestStore.readCheckpoint() ?? { upserted: [], removed: [] }
  return { plan: remainingPlan(runManifest, checkpoint), checkpoint }
}

export function createRunManifest<TSource, TMetadata extends ItemMetadata = ItemMetadata>({ runId, slot, previous, current, keyGetter }: {
  runId: number
  slot: string
  previous: SlotManifestV2<TMetadata> | null
  current: TSource[]
  keyGetter: (item: TSource) => string
}): RunManifestV2<TMetadata> {
  const previousItems = previous?.items ?? []
  // 期望的所有 SectionItemKey
  const expectedItemKey = new Set(current.map((file) => (keyGetter(file))))
  // 实际包含的 ItemKey
  const previousItemKey = new Set(previousItems.map((item) => (item.itemKey)))
  const upsertItemKey = Array.from(expectedItemKey.difference(previousItemKey))
  const deleteItemKey = previousItemKey.difference(expectedItemKey)
  const deleteItems = previousItems.filter((item) => deleteItemKey.has(item.itemKey))
  return {
    syncRunId: runId,
    slot,
    previousSlotRunId: previous?.syncRunId ?? null,
    upsert: upsertItemKey,
    delete: deleteItems,
  }
}


export function remainingPlan<T extends ItemMetadata= ItemMetadata>(plan: IndexPlanV2<T>, checkpoint: RunCheckpointV2<T>): IndexPlanV2<T> {
  const upserted = new Set(checkpoint.upserted.map(it => it.itemKey))
  const removed = new Set(checkpoint.removed)
  return {
    upsert: plan.upsert.filter((item) => !upserted.has(item)),
    delete: plan.delete.filter((item) => !removed.has(item.itemKey)),
  }
}

export function completedSlotManifest<T extends ItemMetadata= ItemMetadata>(runId: number, previous: SlotManifestV2<T> | null, checkpoint: RunCheckpointV2<T>): SlotManifestV2<T> {
  const removed = new Set(checkpoint.removed)
  const keep = (previous?.items ?? []).filter(({itemKey}) => !removed.has(itemKey))
  const upserted = checkpoint.upserted
  return {
    syncRunId: runId,
    items: [
      ...keep,
      ...upserted,
    ],
  }
}

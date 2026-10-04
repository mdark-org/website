import {IndexPlan, ManifestStore, RunCheckpoint, RunManifest, SlotManifest} from "./manifest";
import type {SourceWriteRepo} from "../../db/write.repo";


export type IndexPlanInput = {
  repo: SourceWriteRepo
  manifestStore: ManifestStore
  runId: number
  slot: 'a' | 'b',
  keyGetter:  (item: any) => string
}

export async function prepareIndexPlan({ repo, manifestStore, runId, slot, keyGetter }: IndexPlanInput) {
  let runManifest = await manifestStore.readRunManifest()
  console.log('runManifest', runManifest)
  if (!runManifest) {
    const previous = await manifestStore.readSlotManifest()
    console.log('slotManifest', runManifest)
    const current = await repo.listSearchSectionKeys(runId)
    runManifest = createRunManifest({ runId, slot, previous, current, keyGetter })
    await manifestStore.saveRunManifest(runManifest)
  }
  const checkpoint = await manifestStore.readCheckpoint() ?? { upserted: [], removed: [] }
  return { plan: remainingPlan(runManifest, checkpoint), checkpoint }
}

export function createRunManifest<T>({ runId, slot, previous, current, keyGetter }: {
  runId: number
  slot: 'a' | 'b'
  previous: SlotManifest | null
  current: T[]
  keyGetter: (item: T) => string
}): RunManifest {
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


export function remainingPlan(plan: IndexPlan, checkpoint: RunCheckpoint): IndexPlan {
  const upserted = new Set(checkpoint.upserted.map((item) => item.itemKey))
  const removed = new Set(checkpoint.removed)
  return {
    upsert: plan.upsert.filter((item) => !upserted.has(item)),
    delete: plan.delete.filter((item) => !removed.has(item.itemKey)),
  }
}

export function completedSlotManifest(runId: number, previous: SlotManifest | null, checkpoint: RunCheckpoint): SlotManifest {
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

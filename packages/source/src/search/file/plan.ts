import type {RunCheckpoint, RunManifest, SlotManifest} from "./manifest";
import type {IndexPlan} from "./manifest";

type SearchFileItem = {
  revisionId: string;
}

const revisionKeyRegex = /page\/(.+)\.md/

export const parseRevisionKey = (item: string) => {
  const [, pageRevisionId] = item.match(revisionKeyRegex)!
  return { pageRevisionId }
}

export function createRunManifest({ runId, slot, previous, current }: {
  runId: number
  slot: 'a' | 'b'
  previous: SlotManifest | null
  current: SearchFileItem[]
}): RunManifest {
  const previousItems = previous?.items ?? []
  const fileKey = (file: SearchFileItem) => `page/${file.revisionId}.md`
  // 期望的所有 SectionItemKey
  const expectedItemKey = new Set(current.map((file) => (fileKey(file))))
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

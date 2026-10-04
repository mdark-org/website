import type { AiSearchInstance } from '@cloudflare/workers-types'
import type { SourceWriteRepo } from '../db/write.repo'
import { chunk } from '../utils/chunk'
import { ManifestStore } from './manifest'
import { uploadSearchBatch, deleteSearchBatch } from './execute'
import {createRunManifest, remainingPlan, completedSlotManifest, parseSectionKey} from './plan'


type IndexPlanInput = {
  repo: SourceWriteRepo
  manifestStore: ManifestStore
  runId: number
  slot: 'a' | 'b'
}

async function prepareIndexPlan({ repo, manifestStore, runId, slot }: IndexPlanInput) {
  let runManifest = await manifestStore.readRunManifest()
  console.log('runManifest', runManifest)
  if (!runManifest) {
    const previous = await manifestStore.readSlotManifest()
    console.log('slotManifest', runManifest)
    const current = await repo.listSearchSectionKeys(runId)
    runManifest = createRunManifest({ runId, slot, previous, current })
    await manifestStore.saveRunManifest(runManifest)
  }
  const checkpoint = await manifestStore.readCheckpoint() ?? { upserted: [], removed: [] }
  return { plan: remainingPlan(runManifest, checkpoint), checkpoint }
}

export async function indexSearchSlot({ instance, repo, manifestStore, runId, slot }: IndexPlanInput & {
  instance: AiSearchInstance
}): Promise<void> {
  const input = { repo, manifestStore, runId, slot }
  console.log(`preparing index plan`)
  const prepared = await prepareIndexPlan(input)
  console.log(`plan: add ${prepared.plan.upsert.length}, delete ${prepared.plan.delete.length}`)
  const plan = prepared.plan
  let checkpoint = prepared.checkpoint
  let total = 0

  for (const sectionKeys of chunk(plan.upsert, 100)) {
    const sectionItems = sectionKeys.map(parseSectionKey)
    const result = await uploadSearchBatch({ instance, repo, runId, sectionItems })
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
  await manifestStore.saveManifest(completedSlotManifest(runId, previous, checkpoint))
}

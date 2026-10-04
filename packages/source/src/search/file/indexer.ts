import type {AiSearchInstance} from "@cloudflare/workers-types";
import {chunk} from "../../utils/chunk";
import {completedSlotManifest, parseRevisionKey } from "./plan";
import {deleteSearchBatch, uploadSearchBatch} from "./execute";
import type {SourceWriteRepo} from "@/db/write.repo";
import {ManifestStore} from "./manifest";
import {prepareIndexPlan} from "./search";

type IndexPlanInput = {
  repo: SourceWriteRepo
  manifestStore: ManifestStore
  runId: number
  slot: 'a' | 'b'
}

export async function indexFileSlot({ instance, repo, manifestStore, runId, slot }: IndexPlanInput & {
  instance: AiSearchInstance
}): Promise<void> {
  const input = { repo, manifestStore, runId, slot }
  console.log(`preparing index plan`)
  const prepared = await prepareIndexPlan(input)
  console.log(`plan: add ${prepared.plan.upsert.length}, delete ${prepared.plan.delete.length}`)
  const plan = prepared.plan
  let checkpoint = prepared.checkpoint
  let total = 0

  for (const revisionKeys of chunk(plan.upsert, 100)) {
    const revisionItems = revisionKeys.map(parseRevisionKey)
    const result = await uploadSearchBatch({ instance, repo, runId, revisionItems })
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
  console.log(`load slot manifest`)
  const previous = await manifestStore.readSlotManifest()
  console.log(`saving manifest`)
  await manifestStore.saveManifest(completedSlotManifest(runId, previous, checkpoint))
}


import type {SourceWriteRepo} from "@/db/write.repo";
import {ManifestStore} from "./manifest";
import {createRunManifest, remainingPlan} from "./plan";

type IndexPlanInput = {
  repo: SourceWriteRepo
  manifestStore: ManifestStore
  runId: number
  slot: 'a' | 'b'
}
export async function prepareIndexPlan({ repo, manifestStore, runId, slot }: IndexPlanInput) {
  let runManifest = await manifestStore.readRunManifest()
  console.log('runManifest', runManifest)
  if (!runManifest) {
    const previous = await manifestStore.readSlotManifest()
    console.log('slotManifest', runManifest)
    // list files
    const current = await repo.listSearchFiles(runId)
    runManifest = createRunManifest({ runId, slot, previous, current })
    await manifestStore.saveRunManifest(runManifest)
  }
  const checkpoint = await manifestStore.readCheckpoint() ?? { upserted: [], removed: [] }
  return { plan: remainingPlan(runManifest, checkpoint), checkpoint }
}
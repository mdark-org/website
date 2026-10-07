import type {SyncEnv, SyncParams} from "./types.ts";
import { WorkflowEntrypoint, WorkflowEvent, WorkflowStep } from "cloudflare:workers";
import {createDB, SourceWriteRepo, SyncRunRepo} from "@repo/source";
import {uploadToAISearchV2} from "@repo/source/search";

export class IndexWorkflow extends WorkflowEntrypoint<SyncEnv, SyncParams> {
  async run(event: WorkflowEvent<SyncParams>, step: WorkflowStep) {
    const runId = event.payload.runId;
    const db = createDB(this.env.DB)
    const runRepo = new SyncRunRepo(db)

    // 获取 instance id
    const { searchInstanceName, slot } = await step.do('get-aisearch-instance', async () => {
      const head = await runRepo.getHead()
      const slot = head?.searchSlot === 'mdark-file-dev-a' ? 'mdark-file-dev-b' : 'mdark-file-dev-a'
      const searchInstanceName = slot
      return { searchInstanceName, slot } as { searchInstanceName: string, slot: string }
    })

    await step.do('index-search-slot', {
      retries: {
        limit: 5,
        backoff: 'constant',
        delay: '10 seconds',
      },
      timeout: '1 hour',
    }, () => uploadToAISearchV2({
      aiSearch: this.env.AI_SEARCH.get(searchInstanceName),
      bucket: this.env.SEARCH_MANIFESTS,
      db: db,
      status: { syncRunId: runId, slot: slot }
    }))

    await step.do('publish-run', () => runRepo.publishRun(runId, slot))
  }
}
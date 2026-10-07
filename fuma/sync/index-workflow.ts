import type {SyncEnv, SyncParams} from "./types.ts";
import { WorkflowEntrypoint, WorkflowEvent, WorkflowStep } from "cloudflare:workers";
import {createDB, SyncRunRepo} from "@repo/source";
import {AlgoliaV2SearchAdapter, SearchReadRepo, uploadToAISearchV2} from "@repo/source/search";

export class IndexWorkflow extends WorkflowEntrypoint<SyncEnv, SyncParams> {
  async run(event: WorkflowEvent<SyncParams>, step: WorkflowStep) {
    const runId = event.payload.runId;
    const db = createDB(this.env.DB)
    const runRepo = new SyncRunRepo(db)
    const nodeEnv = this.env.NODE_ENV
    const slot = await step.do('get-search-slot', async () => {
      const head = await runRepo.getHead()
      return head?.searchSlot === `mdark-algolia-${nodeEnv}-a` ? `mdark-algolia-${nodeEnv}-b` : `mdark-algolia-${nodeEnv}-a`
    })

    const adapter = new AlgoliaV2SearchAdapter({
      appId: this.env.ALGOLIA_APP_ID,
      apiKey: this.env.ALGOLIA_SECRET_API_KEY,
      indexName: slot,
      repo: new SearchReadRepo(db),
      runId,
    })

    await step.do('configure-algolia-search-slot', () => adapter.configureIndex())

    await step.do('index-search-slot', {
      retries: {
        limit: 5,
        backoff: 'constant',
        delay: '10 seconds',
      },
      timeout: '1 hour',
    }, () => uploadToAISearchV2({
      searchAdapter: adapter,
      bucket: this.env.SEARCH_MANIFESTS,
      status: { syncRunId: runId, slot: slot }
    }))

    await step.do('publish-run', () => runRepo.publishRun(runId, slot))
  }
}

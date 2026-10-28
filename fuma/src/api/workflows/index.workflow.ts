
import { WorkflowEntrypoint, WorkflowEvent, WorkflowStep } from "cloudflare:workers";
import {createDB, SyncRunRepo} from "@repo/source";
import {AlgoliaV2SearchAdapter, SearchReadRepo, uploadToAISearchV2} from "@repo/source/search";
import type { Env, SyncParams } from "@/worker";

export class IndexWorkflow extends WorkflowEntrypoint<Env, SyncParams> {
  async run(event: WorkflowEvent<SyncParams>, step: WorkflowStep) {
    const runId = event.payload.runId;
    const db = createDB(this.env.DB)
    const runRepo = new SyncRunRepo(db)
    const nodeEnv = this.env.NODE_ENV

    // 单索引就地更新：不再 A/B 切换，而是把本次 run 的差量写入当前索引。
    // 差量由 manifest（索引当前内容）与本次 run 的内容对比得出，写索引的同时原地推进 manifest。
    // head 在 sync 完成时已经前进，这里只负责让索引追平。
    const slot = await step.do('get-search-slot', () =>
      runRepo.getIndexSlot(`mdark-algolia-${nodeEnv}-a`))

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
      status: { syncRunId: runId, slot },
    }))
  }
}

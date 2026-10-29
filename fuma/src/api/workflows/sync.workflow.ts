import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from 'cloudflare:workers'
import { NonRetryableError } from 'cloudflare:workflows'
import { SourceSyncError, SourceWriteRepo, syncDatasource } from '@repo/source/sync'
import { datasources, devDatasource } from '@/datasource'
import type { Env, SyncParams } from '@/worker'
import { createDB } from '@repo/source'
import { SyncRunRepo } from "@repo/source/sync";

async function stopOnSyncError<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    if (error instanceof SourceSyncError) throw new NonRetryableError(error.message)
    throw error
  }
}

export class SourceSyncWorkflow extends WorkflowEntrypoint<Env, SyncParams> {
  async run(event: WorkflowEvent<SyncParams>, step: WorkflowStep) {
    const runId = event.payload.runId
    const db = createDB(this.env.DB)
    const repo = new SourceWriteRepo(db)
    const runRepo = new SyncRunRepo(db)
    const ds = this.env.NODE_ENV === 'production' ? datasources : devDatasource
    const state = await step.do('start-run', () => stopOnSyncError(async () => {
      const run = await runRepo.getRun(runId)
      const slugs = ds.map((source) => source.id)
      if (!run || JSON.stringify(run.datasourceIds) !== JSON.stringify(slugs)) {
        throw new SourceSyncError('The configured datasource set changed after the run was queued.')
      }
      if (run.status === 'succeeded') return 'succeeded'
      if (run.status === 'queued') await runRepo.startRun(runId)
      else if (run.status !== 'running') throw new SourceSyncError(`Sync run ${runId} cannot be started.`)
      return 'running'
    }))
    if (state === 'succeeded') return { runId, status: state }
    const results = []
    for (const [sortOrder, source] of ds.entries()) {
      const result = await step.do(`sync-${source.id}`, {
        retries: { limit: 3, delay: '10 seconds', backoff: 'exponential' },
        timeout: '30 minutes',
      }, () => stopOnSyncError(async () => syncDatasource(repo, runId, source, { sortOrder })))
      results.push(result)
    }

    // 内容同步完成即提交：head 前进，全站开始提供这个 run 的内容。
    // 搜索索引随后追平，因此中间态是「内容已上线、索引里还是旧的部分」，可以接受。
    await step.do('trigger-index-workflow', async () => {
      const slot = await runRepo.getIndexSlot(`mdark-algolia-${this.env.NODE_ENV}`)
      await runRepo.publishRun(runId, slot)
      await this.env.INDEX_WORKFLOW.create({
        id: `index-sync-run-${this.env.NODE_ENV}-${runId}`,
        params: { runId }
      })
    })
    return { runId, status: 'succeeded', pages: results.reduce((count, result) => count + result.pages, 0) }
  }
}

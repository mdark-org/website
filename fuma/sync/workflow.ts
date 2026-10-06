import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from 'cloudflare:workers'
import { NonRetryableError } from 'cloudflare:workflows'
import { SourceSyncError, SourceWriteRepo, syncDatasource } from '@repo/source/sync'
import { datasources } from '../datasource'
import type { SyncEnv, SyncParams } from './types.ts'
import { createDB } from '@repo/source'
import {SyncRunRepo} from "@repo/source/sync";

async function stopOnSyncError<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    if (error instanceof SourceSyncError) throw new NonRetryableError(error.message)
    throw error
  }
}

export class SourceSyncWorkflow extends WorkflowEntrypoint<SyncEnv, SyncParams> {
  async run(event: WorkflowEvent<SyncParams>, step: WorkflowStep) {
    const runId = event.payload.runId
    const db = createDB(this.env.DB)
    const repo = new SourceWriteRepo(db)
    const runRepo = new SyncRunRepo(db)

    const state = await step.do('start-run', () => stopOnSyncError(async () => {
      const run = await runRepo.getRun(runId)
      const slugs = datasources.map((source) => source.id)
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
    for (const [sortOrder, source] of datasources.entries()) {
      const result = await step.do(`sync-${source.id}`, {
        retries: { limit: 3, delay: '10 seconds', backoff: 'exponential' },
        timeout: '30 minutes',
      }, () => stopOnSyncError(async () => syncDatasource(repo, runId, source, { sortOrder })))
      results.push(result)
    }

    // 更新
    // 调用 search workflow
    await step.do('trigger-index-workflow',async () => {
      await this.env.INDEX_WORKFLOW.create({
        id: `index-sync-run-${runId}`,
        params: { runId }
      })
    })
    return { runId, status: 'succeeded', pages: results.reduce((count, result) => count + result.pages, 0) }
  }
}

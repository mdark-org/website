/// <reference types="@cloudflare/workers-types" />
import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep, type WorkflowStepConfig } from 'cloudflare:workers'
import { NonRetryableError } from 'cloudflare:workflows'
import { SourceBuilder } from '@repo/datasource/build'
import { getDatasourceSlug, SourceSyncError, SourceWriteRepo, syncDatasource } from '@repo/source/sync'
import { datasources } from '../datasource/index.ts'
import type { SyncEnv, SyncParams } from './types.ts'
import { createDB } from '@repo/source'
import { indexSearchSlot, ManifestStore } from '@repo/source/search'

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

    try {
      const state = await step.do('start-run', () => stopOnSyncError(async () => {
        const run = await repo.getRun(runId)
        const slugs = datasources.map((source) => getDatasourceSlug(source.mountedPath))
        if (!run || JSON.stringify(run.datasourceIds) !== JSON.stringify(slugs)) {
          throw new SourceSyncError('The configured datasource set changed after the run was queued.')
        }
        if (run.status === 'succeeded') return 'succeeded'
        if (run.status === 'queued') await repo.startRun(runId)
        else if (run.status !== 'running') throw new SourceSyncError(`Sync run ${runId} cannot be started.`)
        return 'running'
      }))
      if (state === 'succeeded') return { runId, status: state }

      const results = []
      for (const [sortOrder, source] of datasources.entries()) {
        const result = await step.do(`sync-${source.id}`, {
          retries: { limit: 3, delay: '10 seconds', backoff: 'exponential' },
          timeout: '30 minutes',
        }, () => stopOnSyncError(async () => {
          const built = await new SourceBuilder(source).build()
          return syncDatasource(repo, runId, built, { sortOrder })
        }))
        results.push(result)
      }

      const head = await step.do('capture-search-head', () => repo.getHead())
      const slot = head?.searchSlot === 'a' ? 'b' : 'a'
      const instance = this.env.AI_SEARCH.get(`mdark-dev-${slot}`)
      const manifestStore = new ManifestStore(this.env.SEARCH_MANIFESTS, slot, runId)
      await step.do('index-search-slot', {
        retries: {
          limit: 5,
          backoff: 'constant',
          delay: '10 seconds',
        },
        timeout: '1 hour',
      }, () => stopOnSyncError(() => indexSearchSlot({
        instance, repo, manifestStore, runId, slot,
      })))
      await step.do('publish-run', () => stopOnSyncError(() => repo.publishRun(runId, slot)))
      return { runId, status: 'succeeded', pages: results.reduce((count, result) => count + result.pages, 0) }
    } catch (error) {
      await step.do('fail-run', async () => {
        await repo.failRun(runId, error)
      })
      throw error
    }
  }
}

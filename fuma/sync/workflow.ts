
/// <reference types="@cloudflare/workers-types" />

import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from 'cloudflare:workers';
import { NonRetryableError } from 'cloudflare:workflows';
import { SourceBuilder } from '@repo/datasource/build';
import { getDatasourceSlug, SourceSyncError, SourceWriteRepo, syncDatasource } from '@repo/source/sync';
import { drizzle } from 'drizzle-orm/d1';
import { datasources } from '../datasource/index.ts';
import type { SyncEnv, SyncParams } from './types.ts';
import { relations } from '@repo/source'
async function stopOnSyncError<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof SourceSyncError) throw new NonRetryableError(error.message);
    throw error;
  }
}

export class SourceSyncWorkflow extends WorkflowEntrypoint<SyncEnv, SyncParams> {
  async run(event: WorkflowEvent<SyncParams>, step: WorkflowStep) {
    const runId = event.payload.runId;
    const repo = new SourceWriteRepo(drizzle(this.env.DB, { relations }));
    try {
      await step.do('start-run', () => stopOnSyncError(async () => {
        const run = await repo.getRun(runId);
        const slugs = datasources.map((source) => getDatasourceSlug(source.mountedPath));
        if (!run || JSON.stringify(run.datasourceIds) !== JSON.stringify(slugs)) {
          throw new SourceSyncError('The configured datasource set changed after the run was queued.');
        }
        await repo.startRun(runId);
      }));
      const results = [];
      for (const [sortOrder, source] of datasources.entries()) {
        const result = await step.do(`sync-${source.id}`, {
          retries: { limit: 3, delay: '10 seconds', backoff: 'exponential' },
          timeout: '30 minutes',
        }, () => stopOnSyncError(async () => {
          const built = await new SourceBuilder(source).build();
          return syncDatasource(repo, runId, built, { sortOrder });
        }));
        results.push(result);
      }

      await step.do('publish-run', () => stopOnSyncError(() => repo.publishRun(runId)));
      return { runId, status: 'succeeded', pages: results.reduce((count, result) => count + result.pages, 0) };
    } catch (error) {
      const status = await step.do('fail-run', async () => {
        const run = await repo.getRun(runId);
        // Publication can commit before the step result is acknowledged.
        if (run?.status === 'succeeded') return 'succeeded';
        await repo.failRun(runId, error);
        return 'failed';
      });
      if (status === 'succeeded') return { runId, status };
      throw error;
    }
  }
}

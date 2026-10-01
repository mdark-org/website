import { getDatasourceSlug, type SourceWriteRepo } from '@repo/source/sync';
import { datasources } from '../datasource/index.ts';
import type { SyncEnv } from './types.ts';

type HttpRepo = Pick<SourceWriteRepo, 'createRun' | 'getRun' | 'failRun'>;
type HttpEnv = Pick<SyncEnv, 'SYNC_TOKEN' | 'SYNC_WORKFLOW'>;

export async function handleSyncRequest(request: Request, env: HttpEnv, repo: HttpRepo): Promise<Response> {
  const path = new URL(request.url).pathname;
  const match = /^\/sync\/([1-9]\d*)$/.exec(path);
  if (path !== '/sync' && !match) return Response.json({ error: 'Not found.' }, { status: 404 });
  if (!env.SYNC_TOKEN) return Response.json({ error: 'Sync authentication is not configured.' }, { status: 503 });
  if (request.headers.get('Authorization') !== `Bearer ${env.SYNC_TOKEN}`) {
    return Response.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const method = match ? 'GET' : 'POST';
  if (request.method !== method) {
    return Response.json({ error: 'Method not allowed.' }, { status: 405, headers: { Allow: method } });
  }

  try {
    if (match) {
      const runId = Number(match[1]);
      if (!Number.isSafeInteger(runId)) return Response.json({ error: 'Not found.' }, { status: 404 });
      const run = await repo.getRun(runId);
      if (!run) return Response.json({ error: 'Not found.' }, { status: 404 });
      return Response.json({ run, workflowId: `sync-${run.id}` });
    }

    const run = await repo.createRun(datasources.map((source) => getDatasourceSlug(source.mountedPath)));
    const workflowId = `sync-${run.id}`;
    try {
      await env.SYNC_WORKFLOW.create({ id: workflowId, params: { runId: run.id } });
    } catch (error) {
      await repo.failRun(run.id, error);
      return Response.json({ error: 'Could not start the sync workflow.', runId: run.id }, { status: 503 });
    }
    return Response.json({ runId: run.id, workflowId, status: run.status }, {
      status: 202,
      headers: { Location: `/sync/${run.id}` },
    });
  } catch (e) {
    console.log(e);
    return Response.json({ error: 'Could not access the sync database.' }, { status: 500 });
  }
}

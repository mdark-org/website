import { getDatasourceSlug, SourceWriteRepo } from '@repo/source/sync';
import { datasources } from '../datasource/index.ts';
import type { SyncEnv } from './types.ts';
import { Hono } from 'hono';
import { relations } from '@repo/source';
import { drizzle } from 'drizzle-orm/d1';
import z from 'zod';

type Variables = {
  repo: SourceWriteRepo;
}
export const app = new Hono<{
  Bindings: SyncEnv;
  Variables: Variables
}>()
  .use('*', async (c, next) => {
    const env = c.env
    const token = env.SYNC_TOKEN
    if (!token) return c.json({ error: 'Sync authentication is not configured.' }, { status: 503 });
    if (c.req.header('Authorization') !== `Bearer ${token}`) {
      return c.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    c.set('repo', new SourceWriteRepo(drizzle(env.DB, {relations})))

    await next();
  })
  .post('/sync', async (c) => {
    const repo = c.get('repo')
    const env = c.env
    const run = await repo.createRun(datasources.map((source) => getDatasourceSlug(source.mountedPath)));
    const workflowId = `sync-${run.id}`;
    try {
      await env.SYNC_WORKFLOW.create({ id: workflowId, params: { runId: run.id } });
    } catch (error) {
      await repo.failRun(run.id, error);
      return c.json({ error: 'Could not start the sync workflow.', runId: run.id }, { status: 503 });
    }
    return c.json({ runId: run.id, workflowId, status: run.status }, {
      status: 202,
      headers: { Location: `/sync/${run.id}` },
    });
  })
  .get('/sync/:id', async (c) => {
    const { data, success } = z.number().safeParse(c.req.param('id'))
    if (!success) return c.notFound();
    const repo = c.get('repo')
    const run = await repo.getRun(data);
    if (!run) return c.notFound();
    return c.json({ run, workflowId: `sync-${run.id}` });
  })

import {Hono} from "hono";
import type {SyncEnv} from "../../../sync/types.ts";
import { SyncRunRepo } from "@repo/source";
import {env} from "cloudflare:workers";
import z from "zod";
import { datasources, devDatasource } from "../../../datasource";

type Variables = {
  repo: SyncRunRepo;
}

export const sync = new Hono<{
  Bindings: SyncEnv;
  Variables: Variables
}>()
  .use('*', async (c, next) => {
    const token = env.SYNC_TOKEN
    if (!token) return c.json({ error: 'Sync authentication is not configured.' }, { status: 503 });
    if (c.req.header('Authorization') !== `Bearer ${token}`) {
      return c.json({ error: 'Unauthorized.' }, { status: 401 });
    }
    c.set('repo', new SyncRunRepo(c.get('db')))
    await next();
  })
  .post('/sync', async (c) => {
    const repo = c.get('repo')
    const ds = env.NODE_ENV === 'production' ? datasources : devDatasource;
    const datasourceIds = ds.map((source) => source.id)
    const run = await repo.createRun(datasourceIds);
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
    const { data, success } = z.coerce.number().int().positive().safeParse(c.req.param('id'))
    if (!success) return c.notFound();
    const repo = c.get('repo')
    const run = await repo.getRun(data);
    if (!run) return c.notFound();
    return c.json({ run, workflowId: `sync-${run.id}` });
  })

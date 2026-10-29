import handler from "@tanstack/react-start/server-entry";
import { createDB, SyncRunRepo } from "@repo/source";
import { datasources, devDatasource } from "./datasource";

export default {
  fetch: handler.fetch,
  async scheduled(_controller: ScheduledController, env: Env) {
    const repo = new SyncRunRepo(createDB(env.DB));
    const ds = env.NODE_ENV === "production" ? datasources : devDatasource;
    const run = await repo.createRun(ds.map((source) => source.id));
    const workflowId = `sync-${env.NODE_ENV}-${run.id}`;
    try {
      await env.SYNC_WORKFLOW.create({ id: workflowId, params: { runId: run.id } });
    } catch (error) {
      await repo.failRun(run.id, error);
      throw error;
    }
    console.log("Scheduled sync queued", { runId: run.id, workflowId });
  },
};
export { SourceSyncWorkflow } from "./api/workflows/sync.workflow.ts";
export { IndexWorkflow } from "./api/workflows/index.workflow.ts";

export type SyncParams = { runId: number };
interface ENV {
  DB: D1Database;
  NODE_ENV: string;
  SYNC_WORKFLOW: Workflow<{ runId: number }>;
  INDEX_WORKFLOW: Workflow<{ runId: number }>;
  AI_SEARCH: AiSearchNamespace;
  SEARCH_MANIFESTS: R2Bucket;
  SYNC_TOKEN?: string;
  GITHUB_TOKEN?: string;
  BASE_URL: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  ALGOLIA_APP_ID: string;
  ALGOLIA_SECRET_API_KEY: string;
}
declare global {
  namespace Cloudflare {
    interface Env extends ENV {}
  }
}
export type Env = ENV;

export { default } from "vinext/server/fetch-handler";
export * from "vinext/server/fetch-handler";
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
  GOOGLE_CLIENT_ID: string
  GOOGLE_CLIENT_SECRET: string
  ALGOLIA_APP_ID: string;
  ALGOLIA_SECRET_API_KEY: string;
}
declare global {
  namespace Cloudflare {
    interface Env extends ENV {}
  }
}
export type Env = ENV
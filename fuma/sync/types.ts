import type { AiSearchNamespace, D1Database, R2Bucket, Workflow } from '@cloudflare/workers-types';

export type SyncParams = { runId: number };

export interface SyncEnv {
  DB: D1Database;
  SYNC_WORKFLOW: Workflow<{ runId: number }>;
  INDEX_WORKFLOW: Workflow<{ runId: number }>;
  AI_SEARCH: AiSearchNamespace;
  ALGOLIA_APP_ID: string;
  ALGOLIA_API_KEY: string;
  SEARCH_MANIFESTS: R2Bucket;
  SYNC_TOKEN?: string;
  GITHUB_TOKEN?: string;
  BASE_URL: string;
}

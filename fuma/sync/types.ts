import type { AiSearchNamespace, D1Database, R2Bucket, Workflow } from '@cloudflare/workers-types';

export type SyncParams = { runId: number };

export interface SyncEnv {
  DB: D1Database;
  SYNC_WORKFLOW: Workflow<{ runId: number }>;
  AI_SEARCH: AiSearchNamespace;
  SEARCH_MANIFESTS: R2Bucket;
  SYNC_TOKEN?: string;
  GITHUB_TOKEN?: string;
  BASE_URL: string;
}

import type { D1Database, Workflow } from '@cloudflare/workers-types';

export type SyncParams = { runId: number };

export interface SyncEnv {
  DB: D1Database;
  SYNC_WORKFLOW: Workflow<SyncParams>;
  SYNC_TOKEN?: string;
  GITHUB_TOKEN?: string;
  BASE_URL: string;
}

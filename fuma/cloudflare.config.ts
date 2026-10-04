import { bindings, defineConfig, defineWorker, exports as workerExports } from "cf/config";
import { createWorkersResponseStoreServiceBindingConfig } from "@vinext/cloudflare/cache/config";

const responseStore = await createWorkersResponseStoreServiceBindingConfig({
  worker: {
    name: "fuma-response-store",
    compatibilityDate: "2026-09-30",
    compatibilityFlags: ["nodejs_compat"],
  },
  bucket: "fuma-response-store-cache-bodies",
});

export const responseStoreServiceBinding = responseStore.serviceBindingWorker;

const databaseId = process.env.D1_DATABASE_ID ?? "b1f902ea-c16a-4850-b8a8-f93476167bec";

const aiSearchNamespace = 'mdark'
export const syncWorker = defineWorker({
  name: "fuma-sync",
  entrypoint: "./sync/worker.ts",
  compatibilityDate: "2026-09-30",
  compatibilityFlags: ["nodejs_compat"],
  observability: {
    enabled:true,
  },
  // Building + writing a datasource is CPU-heavy compared to serving a page (default 30s).
  limits: { cpuMs: 300_000, subrequests: 100_000 },
  exports: {
    SourceSyncWorkflow: workerExports.workflow({ name: "fuma-source-sync" }),
  },
  env: {
    DB: bindings.d1({ name: "mdark-dev-source", id: databaseId }),
    AI_SEARCH: bindings.aiSearchNamespace({ namespace: aiSearchNamespace, dev: { remote: true } }),
    SEARCH_MANIFESTS: bindings.r2({ name: 'fuma-search-manifests' }),
    SYNC_WORKFLOW: bindings.workflow({
      name: "fuma-source-sync",
      worker: "fuma-sync",
      exportName: "SourceSyncWorkflow",
    }),
    SYNC_TOKEN: bindings.secret(),
    GITHUB_TOKEN: bindings.secret(),
    BASE_URL: bindings.secret(),
  },
});
export default defineConfig(({mode, isPreview}) => ({
  worker: defineWorker({
    ...responseStore.applicationWorker,
    name: "fuma",
    entrypoint: "vinext/server/fetch-handler",
    compatibilityDate: "2026-09-30",
    compatibilityFlags: ["nodejs_compat"],
    assets: { notFoundHandling: "none" },
    observability: {
      enabled:true,
      logs: {
        invocationLogs: false,
      }
    },
    env: {
      ...responseStore.applicationWorker.env,
      ASSETS: bindings.assets(),
      IMAGES: bindings.images(),
      DATABASE_URL: bindings.secret(),
      SYNC_WORKFLOW: bindings.workflow({
        name: "fuma-source-sync",
        worker: "fuma-sync",
        exportName: "SourceSyncWorkflow",
      }),
      SYNC_TOKEN: bindings.secret(),
      GITHUB_TOKEN: bindings.secret(),
      // bindings.text(isStaging ? "staging" : "production"),
      // BASE_URL: bindings.text(mode === 'production'? 'https://mdark.org':`http://localhost:3000`),
      GOOGLE_CLIENT_ID: bindings.secret(),
      GOOGLE_CLIENT_SECRET: bindings.secret(),
      // Read-only content database; written by the sync Worker (@repo/source).
      // The fixed id is the *local* database (`pnpm d1:migrate:local`), so `vite dev` and the `cf d1 --local`
      // commands share one file under .cloudflare/state. Deploys override it with the real database id.
      DB: bindings.d1({ name: "mdark-dev-source", id: databaseId }),
      // CDB: bindings.d1({ name: "mdark-comment", id: '8311d274-cbb2-4fb0-b233-5840305e8775' }),
      AI_SEARCH: bindings.aiSearchNamespace({ namespace: aiSearchNamespace, dev: { remote: true } }),
    },
  }),
}));

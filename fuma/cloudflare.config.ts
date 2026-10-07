import { bindings, defineConfig, defineWorker, exports as workerExports } from "cf/config";
import { createWorkersResponseStoreServiceBindingConfig } from "@vinext/cloudflare/cache/config";

// binding

const name = 'mdark-dev';

const devDBId = '8e3e8697-7153-472c-97b5-9e7c1ef352c2'
const productionDBId = 'b1f902ea-c16a-4850-b8a8-f93476167bec'
const db = {
  DB: bindings.d1({ name ,id: devDBId }),
}


const ai = {
  AI_SEARCH: bindings.aiSearchNamespace({ namespace: 'mdark', dev: { remote: true } }),
}

const bucket = {
  SEARCH_MANIFESTS: bindings.r2({ name: `${name}-search-manifests` }),
}
const workflows = {
  SYNC_WORKFLOW: bindings.workflow({
    name: `${name}-sync`,
    worker: `${name}-sync`,
    exportName: "SourceSyncWorkflow",
  }),
  INDEX_WORKFLOW: bindings.workflow({
    name: `${name}-search-indexer`,
    worker: `${name}-sync`,
    exportName: "IndexWorkflow",
  })
}

const workflowExport = {
  SourceSyncWorkflow: workerExports.workflow({ name: `${name}-sync` }),
  IndexWorkflow:workerExports.workflow({ name: `${name}-search-indexer` }),
}


// workers
const responseStore = await createWorkersResponseStoreServiceBindingConfig({
  worker: {
    name: `${name}-response-store`,
    compatibilityDate: "2026-09-30",
    compatibilityFlags: ["nodejs_compat"],
  },
  bucket: `${name}-response-store-cache-bodies`,
});

export const responseStoreServiceBinding = responseStore.serviceBindingWorker;

export const syncWorker = defineWorker({
  name: `${name}-sync`,
  entrypoint: "./sync/worker.ts",
  compatibilityDate: "2026-09-30",
  compatibilityFlags: ["nodejs_compat"],
  observability: {
    enabled:true,
  },
  limits: { cpuMs: 300_000, subrequests: 100_000 },
  exports: {
    ...workflowExport
  },
  env: {
    ...db,
    ...ai,
    ...bucket,
    ...workflows,
    ALGOLIA_APP_ID: bindings.secret(),
    ALGOLIA_API_KEY: bindings.secret(),
    SYNC_TOKEN: bindings.secret(),
    GITHUB_TOKEN: bindings.secret(),
    BASE_URL: bindings.secret(),
  },
});

export default defineConfig(({mode, isPreview}) => ({
  worker: defineWorker({
    // domains: !isPreview ? [mode === 'production' ? 'preview.mdark.org':'preview.mdark.org'] : undefined,
    ...responseStore.applicationWorker,
    name: name,
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
      ...workflows,
      ...ai,
      ...db,
      ...responseStore.applicationWorker.env,
      ASSETS: bindings.assets(),
      IMAGES: bindings.images(),
      SYNC_TOKEN: bindings.secret(),
      GITHUB_TOKEN: bindings.secret(),
      BETTER_AUTH_SECRET: bindings.secret(),
      NEXT_PUBLIC_GAID: bindings.text(`G-ZJPDQWZKDS`),
      BASE_URL: bindings.text(mode === 'production'? 'https://mdark.org':`http://localhost:3000`),
      GOOGLE_CLIENT_ID: bindings.secret(),
      GOOGLE_CLIENT_SECRET: bindings.secret(),
      ALGOLIA_APP_ID: bindings.secret(),
      ALGOLIA_SEARCH_API_KEY: bindings.secret(),
    },
  }),
}));

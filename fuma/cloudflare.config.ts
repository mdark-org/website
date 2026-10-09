import { bindings, defineConfig, defineWorker, exports as workerExports } from "cf/config";
import { createWorkersResponseStoreServiceBindingConfig } from "@vinext/cloudflare/cache/config";

// binding


const isProd = process.env.MY_NODE_ENV === "production";
const nodeEnv = process.env.MY_NODE_ENV as string;

console.log('build in env:', nodeEnv);
const dbId = isProd ? undefined : '8e3e8697-7153-472c-97b5-9e7c1ef352c2'
const name = isProd ? 'mdark' : 'mdark-dev';


const db = {
  DB: bindings.d1({ name, id: dbId }),
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
    worker: name,
    exportName: "SourceSyncWorkflow",
  }),
  INDEX_WORKFLOW: bindings.workflow({
    name: `${name}-search-indexer`,
    worker: name,
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

export default defineConfig(({mode, isPreview}) => ({
  worker: defineWorker({
    domains: isProd ? ['prod.mdark.org', 'mdark.org'] : ['preview.mdark.org'],
    ...responseStore.applicationWorker,
    name: name,
    entrypoint: "./src/worker.ts",
    exports: { ...workflowExport },
    limits: { cpuMs: 300_000, subrequests: 100_000 },
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
      ...bucket,
      ...workflows,
      ...ai,
      ...db,
      ...responseStore.applicationWorker.env,
      ASSETS: bindings.assets(),
      NODE_ENV: bindings.text(nodeEnv),
      IMAGES: bindings.images(),
      SYNC_TOKEN: bindings.secret(),
      GITHUB_TOKEN: bindings.secret(),
      BETTER_AUTH_SECRET: bindings.secret(),
      NEXT_PUBLIC_GAID: bindings.text(`G-ZJPDQWZKDS`),
      BASE_URL: bindings.text(isProd ? `https://mdark.org`: mode === 'production'? 'https://preview.mdark.org':`http://localhost:3000`),
      GOOGLE_CLIENT_ID: bindings.secret(),
      GOOGLE_CLIENT_SECRET: bindings.secret(),
      ALGOLIA_APP_ID: bindings.secret(),
      ALGOLIA_SECRET_API_KEY: bindings.secret(),
    },
  }),
}));

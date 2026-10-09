import { bindings, defineConfig, defineWorker, exports as workerExports } from "cf/config";
import { createWorkersResponseStoreServiceBindingConfig } from "@vinext/cloudflare/cache/config";


const responseStore = await createWorkersResponseStoreServiceBindingConfig({
  worker: {
    name: `mdark-response-store`,
    compatibilityDate: "2026-09-30",
    compatibilityFlags: ["nodejs_compat"],
  },
  bucket: `mdark-response-store-cache-bodies`,
});

export const responseStoreServiceBinding = responseStore.serviceBindingWorker;

export default defineConfig(({mode, isPreview}) => {
  console.log(`build ctx: mode:${mode}, preview:${isPreview}`);
  const name = isPreview ? 'mdark-dev'  : 'mdark';
  const isProd = !isPreview && mode === 'production';
  // preview env 需要显式提供 dbId，否则 d1 binding 会被忽略
  const dbId = isPreview ? '8e3e8697-7153-472c-97b5-9e7c1ef352c2' : undefined

  return  {
    worker: defineWorker({
      domains: isPreview? undefined : isProd ? ['prod.mdark.org', 'mdark.org'] : ['preview.mdark.org'],
      workersDev: isPreview,
      previewUrls: true,
      ...responseStore.applicationWorker,
      name: 'mdark',
      entrypoint: "./src/worker.ts",
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
      exports: {
        SourceSyncWorkflow: workerExports.workflow({ name: `${name}-sync` }),
        IndexWorkflow:workerExports.workflow({ name: `${name}-search-indexer` }),
      },
      env: {
        ...responseStore.applicationWorker.env,
        DB: bindings.d1({ name, id: dbId }),
        AI_SEARCH: bindings.aiSearchNamespace({ namespace: 'mdark', dev: { remote: true } }),
        SEARCH_MANIFESTS: bindings.r2({ name: `${name}-search-manifests` }),
        SYNC_WORKFLOW: bindings.workflow({
          name: `${name}-sync`,
          worker: name,
          exportName: "SourceSyncWorkflow",
        }),
        INDEX_WORKFLOW: bindings.workflow({
          name: `${name}-search-indexer`,
          worker: name,
          exportName: "IndexWorkflow",
        }),
        ASSETS: bindings.assets(),
        NODE_ENV: bindings.text(mode ?? 'development'),
        IMAGES: bindings.images(),
        // preview deploy 会忽略 secret
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
}

});

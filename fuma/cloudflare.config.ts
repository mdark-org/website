import { bindings, defineConfig, defineWorker, exports as workerExports, triggers } from "cf/config";

export default defineConfig(({ mode, isPreview }) => {
  console.log(`build ctx: mode:${mode}, preview:${isPreview}`);
  const isProd = !isPreview && mode === "production";
  const name = isProd ? "mdark" : "mdark-dev";
  // preview env 需要显式提供 dbId，否则 d1 binding 会被忽略
  const dbId = (!isProd ? "bd1cb192-f494-43c0-a1e7-4ba3528935f8" : "bd1cb192-f494-43c0-a1e7-4ba3528935f8");

  return {
    worker: defineWorker({
      domains: isProd ? ["prod.koft.dev"] : ["preview.koft.dev"],
      workersDev: !isProd,
      previewUrls: true,
      name: name,
      entrypoint: "./src/worker.ts",
      triggers: isProd ? [triggers.scheduled({ schedule: "7 * * * *" })] : [],
      // Workers Free plan caps CPU at 10ms and rejects custom limits.
      compatibilityDate: "2026-09-30",
      compatibilityFlags: ["nodejs_compat"],
      assets: { notFoundHandling: "none" },
      observability: {
        enabled: true,
        logs: {
          enabled: true,
          invocationLogs: true,
          persist: true,
          headSamplingRate: 1,
        },
        headSamplingRate: 1,
      },
      exports: {
        // 两个 workflow 都串行：sync 串行保证 base→head 链式推进；
        // 索引串行保证同一时刻只有一个 run 在推进同一个索引的 manifest。
        SourceSyncWorkflow: workerExports.workflow({
          name: `${name}-sync`,
          concurrency: { limit: 1 },
        }),
        IndexWorkflow: workerExports.workflow({
          name: `${name}-search-indexer`,
          concurrency: { limit: 1 },
        }),
      },
      env: {
        DB: bindings.d1({  id: dbId }),
        AI_SEARCH: bindings.aiSearchNamespace({ namespace: "mdark", dev: { remote: true } }),
        SEARCH_MANIFESTS: bindings.r2({ name: `${name}-search-manifests` }),
        SYNC_WORKFLOW: bindings.workflow({
          name: `${name}-sync`,
          worker: `${name}`,
          exportName: "SourceSyncWorkflow",
        }),
        INDEX_WORKFLOW: bindings.workflow({
          name: `${name}-search-indexer`,
          worker: `${name}`,
          exportName: "IndexWorkflow",
        }),
        ASSETS: bindings.assets(),
        NODE_ENV: bindings.text(mode ?? "development"),
        IMAGES: bindings.images(),
        // preview deploy 会忽略 secret
        SYNC_TOKEN: bindings.secret(),
        GITHUB_TOKEN: bindings.secret(),
        BETTER_AUTH_SECRET: bindings.secret(),
        NEXT_PUBLIC_GAID: bindings.text(`G-ZJPDQWZKDS`),
        BASE_URL: bindings.text(
          isProd
            ? `https://mdark.org`
            : mode === "production"
              ? "https://preview.mdark.org"
              : `http://localhost:3000`,
        ),
        GOOGLE_CLIENT_ID: bindings.secret(),
        GOOGLE_CLIENT_SECRET: bindings.secret(),
        ALGOLIA_APP_ID: bindings.secret(),
        ALGOLIA_SECRET_API_KEY: bindings.secret(),
      },
    }),
  };
});

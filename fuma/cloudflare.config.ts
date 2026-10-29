import { bindings, defineConfig, defineWorker, exports as workerExports } from "cf/config";

export default defineConfig(({ mode, isPreview }) => {
  console.log(`build ctx: mode:${mode}, preview:${isPreview}`);
  const isProd = !isPreview && mode === "production";
  const name = isProd ? "mdark" : "mdark-dev";
  // preview env 需要显式提供 dbId，否则 d1 binding 会被忽略
  const dbId =
    process.env.CLOUDFLARE_D1_DATABASE_ID ??
    (!isProd ? "8e3e8697-7153-472c-97b5-9e7c1ef352c2" : undefined);

  return {
    worker: defineWorker({
      domains: isProd ? ["prod.mdark.org", "mdark.org"] : ["preview.mdark.org"],
      workersDev: !isProd,
      previewUrls: true,
      name: name,
      entrypoint: "./src/worker.ts",
      limits: { cpuMs: 300_000, subrequests: 100_000 },
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
        DB: bindings.d1({ name: name, id: dbId }),
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

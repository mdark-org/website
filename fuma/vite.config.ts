import { defineConfig } from "vite";
import vinext from "vinext";
import { cloudflare } from "@cloudflare/vite-plugin";
import { responseStoreServiceBinding, syncWorker } from "./cloudflare.config.ts";
import { responseStoreAdapter } from "@vinext/cloudflare/cache/response-store-adapter";
import { imagesOptimizer } from "@vinext/cloudflare/images/images-optimizer";
import tailwindcss from "@tailwindcss/vite";
export default defineConfig({
  server: {
    port: 3000,
  },
  resolve: {
    alias: [
    ],
  },
  optimizeDeps: {
    include: [
    ],
    exclude: ["fumadocs-ui", "fumadocs-core"],
  },
  plugins: [
    tailwindcss(),
    vinext({
      cache: responseStoreAdapter(),
      prerender: { routes: "*" },
      images: { optimizer: imagesOptimizer() },
    }),
    // Runs the RSC environment in workerd so `cloudflare:workers` bindings (D1 `DB`) work in dev and build.
    cloudflare({
      auxiliaryWorkers: [
        { config: responseStoreServiceBinding },
        { config: syncWorker }
      ],
      viteEnvironment: {
        name: "rsc",
        childEnvironments: ["ssr"],
      },
    }),
  ],
});

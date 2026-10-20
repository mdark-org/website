import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite-plus";
import { cloudflare } from "@cloudflare/vite-plugin";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    server: { port: 3000 },
    resolve: {
      alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
    },
    define: {
      "import.meta.env.VITE_BASE_URL": JSON.stringify(
        env.BASE_URL ?? (mode === "production" ? "https://mdark.org" : "http://localhost:3000"),
      ),
      "import.meta.env.VITE_SPONSOR_URL": JSON.stringify(
        env.SPONSOR_URL ?? "https://github.com/sponsors/mdark-org",
      ),
      "import.meta.env.VITE_GAID": JSON.stringify(env.NEXT_PUBLIC_GAID ?? "G-ZJPDQWZKDS"),
    },
    plugins: [
      tailwindcss(),
      cloudflare({
        viteEnvironment: { name: "ssr" },
        persistState: process.env.CLOUDFLARE_PERSIST_TO
          ? { path: process.env.CLOUDFLARE_PERSIST_TO }
          : true,
        remoteBindings: process.env.CLOUDFLARE_REMOTE_BINDINGS !== "false",
      }),
      tanstackStart({ server: { entry: "./worker.ts" } }),
      react(),
    ],
  };
});

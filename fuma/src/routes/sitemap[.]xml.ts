import { createFileRoute } from "@tanstack/react-router";
import { config } from "@/config";
import { buildSitemap } from "@/lib/sitemap";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const { source } = await import("@/lib/source");
        return new Response(buildSitemap(await source.getContentPages(), config.baseUrl), {
          headers: { "content-type": "application/xml; charset=utf-8" },
        });
      },
    },
  },
});

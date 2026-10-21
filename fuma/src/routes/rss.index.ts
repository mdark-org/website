import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/rss/")({
  server: {
    handlers: {
      GET: async () => {
        const { source } = await import("@/lib/source");
        const feed = await source.generateRSS();
        if (!feed) return new Response("404 not found", { status: 404 });
        return new Response(feed.rss2(), {
          headers: { "content-type": "application/xml; charset=utf-8" },
        });
      },
    },
  },
});

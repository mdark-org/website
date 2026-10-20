import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/rss/$category")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { source } = await import("@/lib/source");
        const feed = await source.generateRSS(params.category);
        if (!feed) return new Response("404 not found", { status: 404 });
        return new Response(feed.rss2(), {
          headers: { "content-type": "application/xml; charset=utf-8" },
        });
      },
    },
  },
});

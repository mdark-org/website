import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/llms.mdx/docs/$")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { source } = await import("@/lib/source");
        const page = await source.getPageBySlug(["docs", ...(params._splat?.split("/") ?? [])]);
        if (!page) return new Response("404 not found", { status: 404 });
        return new Response(page.content ?? "", {
          headers: { "content-type": "text/markdown; charset=utf-8" },
        });
      },
    },
  },
});

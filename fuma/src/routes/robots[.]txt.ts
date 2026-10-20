import { createFileRoute } from "@tanstack/react-router";
import { config } from "@/config";

export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: () =>
        new Response(
          [
            "User-agent: *",
            "Allow: /",
            "Disallow: /private/",
            `Sitemap: ${config.baseUrl}/sitemap.xml`,
            "",
          ].join("\n"),
          { headers: { "content-type": "text/plain; charset=utf-8" } },
        ),
    },
  },
});

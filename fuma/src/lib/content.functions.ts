import { createServerFn } from "@tanstack/react-start";
import { notFound, redirect } from "@tanstack/react-router";
import { z } from "zod";

// The Markdown pipeline produces plain HAST and TOC data; plugin typings also allow React nodes.
declare module "@tanstack/react-router" {
  interface SerializableExtensions {
    markdown: Awaited<ReturnType<typeof import("./markdown").compileMarkdown>>;
  }
}

export const getRecentPages = createServerFn({ method: "GET" }).handler(async () => {
  const { source } = await import("./source");
  return source.getRecentPages();
});

export const getDocument = createServerFn({ method: "GET" })
  .validator(z.string().optional())
  .handler(async ({ data: slug }) => {
    const { source } = await import("./source");
    const { compileMarkdown } = await import("./markdown");
    const slugs = slug?.split("/").filter(Boolean) ?? [];

    if (slugs.length === 0) {
      const first = await source.getFirstPage();
      if (!first) throw notFound();
      throw redirect({ href: encodeURI(first.url) });
    }

    const page = await source.getPageBySlug(["docs", ...slugs]);
    if (!page) throw notFound();
    if (page.url !== `/docs/${slugs.join("/")}`) {
      throw redirect({ href: encodeURI(page.url) });
    }

    const [navigation, datasource, compiled] = await Promise.all([
      source.getNavigation(slugs),
      source.getDatasourceBySlug(["docs", ...slugs]),
      compileMarkdown(page.content ?? ""),
    ]);
    return { page, navigation, datasource, compiled };
  });

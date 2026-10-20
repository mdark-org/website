import { createFileRoute } from "@tanstack/react-router";
import { Fragment, useMemo } from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import { toJsxRuntime } from "hast-util-to-jsx-runtime";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import {
  DocsPage,
  DocsDescription,
  DocsTitle,
  DocsBody,
  MarkdownCopyButton,
  ViewOptionsPopover,
} from "fumadocs-ui/layouts/docs/page";
import defaultMdxComponents from "fumadocs-ui/mdx";
import { getDocument } from "@/lib/content.functions";
import { baseOptions } from "@/lib/layout.shared";
import { icon } from "@/lib/source/icon";
import { config } from "@/config";
import Video from "@/components/video";
import { Comments } from "@/components/comment";
import { ImageZoom } from "@/components/image-zoom";

export const Route = createFileRoute("/docs/$")({
  loader: ({ params }) => getDocument({ data: params._splat }),
  head: ({ loaderData }) => {
    if (!loaderData) return {};
    const { page, datasource } = loaderData;
    const title = page.data?.title ?? page.name;
    const description = page.data?.description ?? "MDARK";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        {
          name: "keywords",
          content: [
            page.name,
            ...(page.data?.tags ?? []),
            datasource?.name,
            "MDARK",
            "mdark",
            "markdown-archive",
          ]
            .filter(Boolean)
            .join(","),
        },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:url", content: new URL(page.url, config.baseUrl).href },
        { property: "og:type", content: "article" },
      ],
      links: [{ rel: "icon", href: datasource?.icon ?? "/favicon.ico" }],
    };
  },
  component: DocumentPage,
});

function DocumentPage() {
  const { page, navigation, compiled } = Route.useLoaderData();
  const body = useMemo(
    () =>
      toJsxRuntime(compiled.tree, {
        Fragment,
        jsx,
        jsxs,
        components: {
          ...defaultMdxComponents,
          img: ({ src, alt, ...props }) =>
            typeof src === "string" ? (
              <ImageZoom {...props} src={src} alt={alt ?? ""} width={800} height={400} />
            ) : null,
        },
      }),
    [compiled.tree],
  );
  const metadata = page.data;
  const markdownUrl = encodeURI(`/llms.mdx${page.url}`);

  return (
    <DocsLayout
      {...baseOptions}
      tree={navigation.tree}
      tabs={navigation.tabs.map((tab) => ({ ...tab, icon: icon(tab.icon) }))}
    >
      <DocsPage
        toc={compiled.toc}
        tableOfContent={{ enabled: false }}
        footer={{
          enabled: true,
          component:
            config.enableComment && metadata?.bvid ? <Comments page={metadata.bvid} /> : undefined,
        }}
      >
        <DocsTitle>{metadata?.title ?? page.name}</DocsTitle>
        <DocsDescription>{metadata?.description}</DocsDescription>
        <div className="flex flex-wrap items-center gap-2 border-b pb-6">
          <MarkdownCopyButton markdownUrl={markdownUrl} />
          <ViewOptionsPopover markdownUrl={markdownUrl} />
        </div>
        <DocsBody>
          <Video
            bvid={metadata?.bvid}
            ytid={metadata?.ytid}
            wbid={metadata?.wbid}
            xgid={metadata?.xgid}
            className="rounded-md m-3"
            iframeClassname="rounded-md"
          />
          {body}
        </DocsBody>
      </DocsPage>
    </DocsLayout>
  );
}

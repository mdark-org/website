import { DocsLayout } from "fumadocs-ui/layouts/docs";
import type { ReactNode } from "react";
import { baseOptions } from "@/app/layout.config";
import { source } from "@/lib/source";

export default async function Layout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ slug?: string[] }>;
}) {
  const { slug } = await params;
  const slugs = slug?.map((it) => decodeURIComponent(it));
  const { tabs, tree } = await source.getNavigation(slugs);
  return (
    <DocsLayout {...baseOptions} tree={tree} tabs={tabs}>
      {children}
    </DocsLayout>
  );
}

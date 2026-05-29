import { DocsLayout } from "fumadocs-ui/layouts/docs";
import type { ReactNode } from "react";
import { baseOptions } from "@/app/layout.config";
import { sidebarSource } from "@/lib/sidebar-source";

export default async function Layout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ slug?: string[] }>;
}) {
  const { slug } = await params;
  const slugs = slug?.map((it) => decodeURIComponent(it));

  return (
    <DocsLayout tree={sidebarSource.tree} {...baseOptions}>
      {children}
    </DocsLayout>
  );
}

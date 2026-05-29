import sources from ".source/generated/sidebar/index.mjs";
import { Root } from "@repo/datasource/shared";
import { icons } from "lucide-react";
import { createElement } from "react";
import { sidebarDatasourceSchema } from "@/lib/sidebar-source/schema";

const icon = (icon: any) => {
  if (!icon) return;
  if (icon in icons) return createElement(icons[icon as keyof typeof icons]);
  return createElement("img", { src: icon, className: "w-5 h-5" });
};

type SidebarDatasource = {
  pageTree: Root;
  datasourceInfo: {
    id: string;
    [x: string]: any;
  };
};

const sourceMap = sources as Record<string, unknown>;

const datasources =
  Object.keys(sourceMap)
    .map((key) => {
      const item = sourceMap[key]
      return sidebarDatasourceSchema.parse(item)
    })
    .map((it) => {
      const i = it
      return {
        ...it,
        pageTree: {
          ...it.pageTree,
          icon: icon(it.pageTree.icon),
        },
      }
    }) as SidebarDatasource[];

const tree = {
  name: "root",
  children: datasources.map((it) => it.pageTree),
} satisfies { name: string; children: Root[] };

const shrinkRoot = (root: Root): Root => ({
  ...root,
  children: [],
});

export const sidebarSource = {
  tree,
  getSidebarTreeBySlug(slug?: string[]) {
    if (!slug || slug.length === 0) return tree;

    const category = slug[0];
    const activeUrl = `/docs/${category}`;
    const active = datasources.find((it) => it.pageTree.url === activeUrl);
    if (!active) return tree;

    return {
      ...tree,
      children: datasources.map((it) =>
        it.datasourceInfo.id === active.datasourceInfo.id ? it.pageTree : shrinkRoot(it.pageTree),
      ),
    };
  },
};

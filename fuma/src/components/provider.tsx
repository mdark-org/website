import { RootProvider } from "fumadocs-ui/provider/tanstack";
import type { ReactNode } from "react";
import AlgoliaDocsSearchDialog from "./algolia-search-dialog";

export function Provider({ children }: { children: ReactNode }) {
  return <RootProvider search={{ SearchDialog: AlgoliaDocsSearchDialog }}>{children}</RootProvider>;
}


import { RootProvider } from 'fumadocs-ui/provider/next';
import type { ReactNode } from 'react';
import type {SharedProps} from "fumadocs-ui/components/dialog/search";
import OramaSearchDialog from "fumadocs-ui/components/dialog/search-orama";
import {OramaClient} from "@oramacloud/client";
import {config} from "../../config";

// const client = new OramaClient({
//   endpoint: process.env.NEXT_PUBLIC_ORAMA_ENDPOINT as string,
//   api_key: process.env.NEXT_PUBLIC_ORAMA_API_KEY as string,
// });

// const Orama = (props: SharedProps) => {
//   return  <OramaSearchDialog client={client} tags={config.search.tags} defaultTag={config.search.defaultSearchTag} {...props} />
// }

export function Provider({ children }: { children: ReactNode }) {
  return (
    <RootProvider
    >
      {children}
    </RootProvider>
  );
}
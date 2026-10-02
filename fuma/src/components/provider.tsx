
import { RootProvider } from 'fumadocs-ui/provider/next';
import type { ReactNode } from 'react';
import DocsSearchDialog from './search-dialog';

export function Provider({ children }: { children: ReactNode }) {
  return (
    <RootProvider search={{ SearchDialog: DocsSearchDialog }}>
      {children}
    </RootProvider>
  );
}

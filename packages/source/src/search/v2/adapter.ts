import type { z } from 'zod'
import type { ItemMetadata } from './manifest'

export type SearchableContent<TContent> = {
  itemKey: string
  items: TContent
}

export interface SearchAdapter<TSource, TContent, TMetadata extends ItemMetadata> {
  readonly itemMetadataSchema: z.ZodType<TMetadata>
  keyGetter(item: TSource): string
  itemsLoader(): Promise<TSource[]>
  docsLoader(itemKeys: string[]): Promise<SearchableContent<TContent>[]>
  uploader(item: SearchableContent<TContent>): Promise<TMetadata>
  deleter(item: TMetadata): Promise<void>
}

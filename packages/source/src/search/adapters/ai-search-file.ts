import type { AiSearchInstance } from '@cloudflare/workers-types'
import { z } from 'zod'
import type { SearchReadRepo } from '../../db/search-read.repo'
import type { SearchAdapter, SearchableContent } from '../v2/adapter'
import {structure} from "fumadocs-core/mdx-plugins";
import {quickHash} from "../../utils/hash";

const itemMetadataSchema = z.object({
  itemKey: z.string(),
  itemIds: z.array(z.string()),
})
type SearchItemInput = Awaited<ReturnType<SearchReadRepo['getSearchFiles']>>[number]
type AISearchItemMetadata = z.infer<typeof itemMetadataSchema>

type FileContent = {
  itemKey: string;
  content: string;
  metadata: {
    revisionid: string;
    url: string;
    tag: string;
    locale: string;
  };
}

const revisionKeyRegex = /page\/(.+)\.md/

export const parseRevisionKey = (item: string) => {
  const [, pageRevisionId] = item.match(revisionKeyRegex)!
  return { pageRevisionId }
}

type SearchFileItem = {
  revisionId: string;
}


export class AISearchAdapter implements SearchAdapter<SearchFileItem, FileContent[], AISearchItemMetadata> {
  readonly itemMetadataSchema = itemMetadataSchema
  private readonly instance: AiSearchInstance
  private readonly repo: SearchReadRepo
  private readonly runId: number

  constructor(instance: AiSearchInstance, repo: SearchReadRepo, runId: number) {
    this.instance = instance
    this.itemsLoader = () => repo.listSearchFiles(runId)
    this.repo = repo
    this.runId = runId
  }

  readonly keyGetter =  (file: SearchFileItem) => `page/${file.revisionId}.md`

  async itemsLoader() {
    return this.repo.listSearchFiles(this.runId)
  }

  async docsLoader(sectionKeys: string[]) {
    const sectionItems = sectionKeys.map(parseRevisionKey)
    const contents = await this.repo.getSearchFiles(this.runId, sectionItems.map(it=>it.pageRevisionId))
    const docs = contents.map(createSearchItem)
    return docs
  }


  async uploader(input: SearchableContent<FileContent[]>): Promise<AISearchItemMetadata> {
    const itemIds: string[] = []
    for (const item of input.items) {
      const uploaded = await this.instance.items.upload(item.itemKey, item.content, { metadata: item.metadata })
      itemIds.push(uploaded.id)
    }
    return { itemKey: input.itemKey, itemIds }
  }

  async deleter(input: AISearchItemMetadata): Promise<void> {
    for (const itemId of input.itemIds) {
      try {
        await this.instance.items.delete(itemId)
      } catch (error) {
        if (!(error instanceof Error && error.name === 'AiSearchNotFoundError'
          && error.message === 'item_not_found')) {
          throw error
        }
      }
    }
  }
}



function createSearchItem(revision: SearchItemInput) {

  const items = structure(revision.content)
  const headings = items.headings.map(it => ({
    itemKey: `page/${revision.revisionId}/${quickHash(it.content)}.md`,
    content: it.content,
    metadata: { revisionid: String(revision.revisionId), url: revision.url, tag: revision.tag, locale: 'zh-cn' },
  }))

  const contents = items.contents.map(it => ({
    itemKey: `page/${revision.revisionId}/${quickHash(it.content)}.md`,
    content: it.content,
    metadata: { revisionid: String(revision.revisionId), url: revision.url, tag: revision.tag, locale: 'zh-cn' },
  }))

  const indexItems = [...headings, ...contents]

  return {
    itemKey: `page/${revision.revisionId}.md`,
    items: indexItems
  }
}


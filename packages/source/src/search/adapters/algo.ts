import { algoliasearch } from 'algoliasearch'
import { z } from 'zod'
import type { SearchReadRepo } from '../../db/search-read.repo'
import type { SearchAdapter, SearchableContent } from '../v2'
import {structure} from "fumadocs-core/mdx-plugins";
import {quickHash} from "../../utils/hash";
type SearchItemInput = Awaited<ReturnType<SearchReadRepo['getSearchFiles']>>[number]
const itemMetadataSchema = z.object({
  itemKey: z.string(),
  objectIDs: z.array(z.string()),
})

type AlgoliaItemMetadata = z.infer<typeof itemMetadataSchema>

export type AlgoliaSearchAdapterOptions = {
  appId: string
  apiKey: string
  indexName: string
  repo: SearchReadRepo
  runId: number
}

type SearchFileItem = {
  revisionId: string;
}
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

export class AlgoliaSearchAdapter implements SearchAdapter<SearchFileItem, FileContent[], AlgoliaItemMetadata> {
  private readonly repo: SearchReadRepo
  private readonly runId: number
  private readonly client: ReturnType<typeof algoliasearch>
  private readonly indexName: string

  constructor({ appId, apiKey, indexName, repo, runId }: AlgoliaSearchAdapterOptions) {
    this.client = algoliasearch(appId, apiKey)
    this.repo = repo
    this.runId = runId
    this.indexName = indexName
  }
  readonly itemMetadataSchema = itemMetadataSchema
  readonly keyGetter =  (file: SearchFileItem) => `page/${file.revisionId}.md`

  async itemsLoader() {
    return this.repo.listSearchFiles(this.runId)
  }

  async docsLoader(sectionKeys: string[]) {
    const revisionKeyRegex = /page\/(.+)\.md/
    const parseRevisionKey = (item: string) => {
      const [, pageRevisionId] = item.match(revisionKeyRegex)!
      return { pageRevisionId }
    }
    const sectionItems = sectionKeys.map(parseRevisionKey)
    const contents = await this.repo.getSearchFiles(this.runId, sectionItems.map(it=>it.pageRevisionId))
    const docs = contents.map(createSearchItem)
    return docs
  }
  async uploader(input: SearchableContent<FileContent[]>): Promise<AlgoliaItemMetadata> {
    const objects = input.items.map((item, index) => ({
      ...item.metadata,
      objectID: `${input.itemKey}/${index}`,
      itemKey: input.itemKey,
      content: item.content,
    }))
    if (objects.length) {
      await this.client.saveObjects({
        indexName: this.indexName,
        objects,
        waitForTasks: true,
      })
    }
    return { itemKey: input.itemKey, objectIDs: objects.map((item) => item.objectID) }
  }

  async deleter(input: AlgoliaItemMetadata): Promise<void> {
    if (!input.objectIDs.length) return
    await this.client.deleteObjects({
      indexName: this.indexName,
      objectIDs: input.objectIDs,
      waitForTasks: true,
    })
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
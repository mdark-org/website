import { algoliasearch } from 'algoliasearch'
import { structure } from 'fumadocs-core/mdx-plugins'
import { setIndexSettings, type BaseIndex, type DocumentRecord } from 'fumadocs-core/search/algolia'
import { z } from 'zod'
import type { SearchReadRepo } from '../../db/search-read.repo'
import type { SearchAdapter, SearchableContent } from '../v2'

type SearchFileItem = {
  revisionId: string
}

type SearchItemInput = Awaited<ReturnType<SearchReadRepo['getSearchFiles']>>[number]

const itemMetadataSchema = z.object({
  itemKey: z.string(),
  objectIDs: z.array(z.string()),
})

type AlgoliaV2ItemMetadata = z.infer<typeof itemMetadataSchema>
type AlgoliaRecord = BaseIndex & Record<string, unknown>

export type AlgoliaV2SearchAdapterOptions = {
  appId: string
  apiKey: string
  indexName: string
  repo: SearchReadRepo
  runId: number
}

export class AlgoliaV2SearchAdapter implements SearchAdapter<SearchFileItem, DocumentRecord, AlgoliaV2ItemMetadata> {
  readonly itemMetadataSchema = itemMetadataSchema

  private readonly client: ReturnType<typeof algoliasearch>
  private readonly indexName: string
  private readonly repo: SearchReadRepo
  private readonly runId: number

  constructor({ appId, apiKey, indexName, repo, runId }: AlgoliaV2SearchAdapterOptions) {
    this.client = algoliasearch(appId, apiKey)
    this.indexName = indexName
    this.repo = repo
    this.runId = runId
  }

  async configureIndex(): Promise<void> {
    await setIndexSettings(this.client, this.indexName)
  }

  keyGetter(file: SearchFileItem): string {
    return `page/${file.revisionId}.md`
  }

  async itemsLoader(): Promise<SearchFileItem[]> {
    return this.repo.listSearchFiles(this.runId)
  }

  async docsLoader(itemKeys: string[]): Promise<SearchableContent<DocumentRecord>[]> {
    const revisionKeyRegex = /^page\/(.+)\.md$/
    const revisionIds = itemKeys.map((itemKey) => {
      const match = revisionKeyRegex.exec(itemKey)
      if (!match) throw new Error(`Invalid search item key: ${itemKey}`)
      return match[1]
    })
    const revisions = await this.repo.getSearchFiles(this.runId, revisionIds)

    return revisions.map((revision) => ({
      itemKey: this.keyGetter(revision),
      items: createDocumentRecord(revision),
    }))
  }

  async uploader(input: SearchableContent<DocumentRecord>): Promise<AlgoliaV2ItemMetadata> {
    const objects = createAlgoliaRecords(input.itemKey, input.items)
    if (objects.length > 0) {
      await this.client.saveObjects({
        indexName: this.indexName,
        objects,
      })
    }

    return { itemKey: input.itemKey, objectIDs: objects.map((item) => item.objectID) }
  }

  async deleter(item: AlgoliaV2ItemMetadata): Promise<void> {
    if (item.objectIDs.length === 0) return

    await this.client.deleteObjects({
      indexName: this.indexName,
      objectIDs: item.objectIDs,
    })
  }
}

function createDocumentRecord(revision: SearchItemInput): DocumentRecord {
  return {
    _id: revision.url,
    title: revision.pageTitle,
    ...(revision.description === null ? {} : { description: revision.description }),
    url: revision.url,
    structured: mergeContents(structure(revision.content)),
    tag: revision.tag,
  }
}

function createAlgoliaRecords(itemKey: string, page: DocumentRecord): AlgoliaRecord[] {
  let recordIndex = 0
  const records: AlgoliaRecord[] = []
  const headings = new Map(page.structured.headings.map((heading) => [heading.id, heading]))
  const indexedHeadings = new Set<string>()

  function createRecord(section: string | undefined, sectionId: string | undefined, content: string): AlgoliaRecord {
    return {
      objectID: `${itemKey}-${(recordIndex++).toString()}`,
      breadcrumbs: page.breadcrumbs,
      title: page.title,
      url: page.url,
      page_id: page._id,
      tag: page.tag,
      section,
      section_id: sectionId,
      content,
      ...page.extra_data,
    }
  }

  if (page.description) records.push(createRecord(undefined, undefined, page.description))

  for (const paragraph of page.structured.contents) {
    const heading = paragraph.heading ? headings.get(paragraph.heading) : undefined
    records.push(createRecord(heading?.content, heading?.id, paragraph.content))

    if (heading && !indexedHeadings.has(heading.id)) {
      indexedHeadings.add(heading.id)
      records.splice(records.length - 1, 0, createRecord(heading.content, heading.id, heading.content))
    }
  }

  return records
}

type StructuredData = ReturnType<typeof structure>;

function mergeContents(data: StructuredData, maxChars = 300): StructuredData {
  const contents: StructuredData['contents'] = [];
  for (const item of data.contents) {
    const content = item.content.trim();
    if (!content) continue;
    if (/^https?:\/\/\S+$/i.test(content)) continue;
    const prev = contents.at(-1);
    if (prev && prev.heading === item.heading) {
      const combined = `${prev.content}\n\n${content}`;
      if (Array.from(combined).length <= maxChars) {
        prev.content = combined;
        continue;
      }
    }
    contents.push({ ...item, content });
  }
  return { ...data, contents };
}

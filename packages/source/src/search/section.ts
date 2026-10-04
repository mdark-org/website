import { SearchableContent} from './shared/upload'
import type {SourceWriteRepo} from "../db/write.repo";


const sectionKeyRegex = /page\/(.+)\/section\/(.+)\.md/

export const parseSectionKey = (item: string) => {
  const [, pageRevisionId, sectionId] = item.match(sectionKeyRegex)!
  return {
    pageRevisionId,
    pageSectionId: Number(sectionId),
  }
}

export const sectionKey = (item: Item) => {
  return `/page/${item.pageRevisionId}/section/${item.pageSectionId}.md`
}

type Item = {
  pageRevisionId: string,
  pageSectionId: number
}




export const createSectionDocsLoader = (repo: SourceWriteRepo, runId: number) => async (sectionKeys: string[]) => {
  const sectionItems = sectionKeys.map(parseSectionKey)
  const contents = await repo.getSearchSections(runId, sectionItems.map(it=>it.pageSectionId))
  const docs = contents.map(createSearchItem)
  return docs
}

export type SearchItemInput = Awaited<ReturnType<SourceWriteRepo['getSearchSections']>>[number]

export function createSearchItem(section: SearchItemInput): SearchableContent {
  const heading = section.headingTitle ? `\n\n## ${section.headingTitle}` : ''
  return {
    itemKey: `page/${section.revisionId}/section/${section.id}.md`,
    content: `# ${section.pageTitle}${heading}\n\n${section.content}`,
    metadata: { pagesectionid: String(section.id), tag: section.tag, url: section.url, locale: 'zh-cn' },
  }
}
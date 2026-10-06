import type {SearchReadRepo} from "../db/search-read.repo";

type SearchFileItem = {
  revisionId: string;
}

const revisionKeyRegex = /page\/(.+)\.md/

export const parseRevisionKey = (item: string) => {
  const [, pageRevisionId] = item.match(revisionKeyRegex)!
  return { pageRevisionId }
}

export const revisionKey = (file: SearchFileItem) => `page/${file.revisionId}.md`

export type SearchItemInput = Awaited<ReturnType<SearchReadRepo['getSearchFiles']>>[number]

function createSearchItem(revision: SearchItemInput) {
  return {
    itemKey: `page/${revision.revisionId}.md`,
    content: revision.content,
    metadata: { revisionid: String(revision.revisionId), url: revision.url, tag: revision.tag, locale: 'zh-cn' },
  }
}


export const createFileDocsLoader = (repo: SearchReadRepo, runId: number) => async (sectionKeys: string[]) => {
  const sectionItems = sectionKeys.map(parseRevisionKey)
  const contents = await repo.getSearchFiles(runId, sectionItems.map(it=>it.pageRevisionId))
  const docs = contents.map(createSearchItem)
  return docs
}

export const createFileItemsLoader = (repo: SearchReadRepo, runId: number) => () => {
  return repo.listSearchFiles(runId)
}
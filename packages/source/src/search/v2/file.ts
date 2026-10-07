import type {SearchReadRepo} from "../../db/search-read.repo";
import {structure} from "fumadocs-core/mdx-plugins";
import {hash, quickHash} from "../../utils/hash";

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


export const createFileDocsLoader = (repo: SearchReadRepo, runId: number) => async (sectionKeys: string[]) => {
  const sectionItems = sectionKeys.map(parseRevisionKey)
  const contents = await repo.getSearchFiles(runId, sectionItems.map(it=>it.pageRevisionId))
  const docs = contents.map(createSearchItem)
  return docs
}

export const createFileItemsLoader = (repo: SearchReadRepo, runId: number) => () => {
  return repo.listSearchFiles(runId)
}
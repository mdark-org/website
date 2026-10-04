import type { SourceWriteRepo } from '../db/write.repo'

export type SearchItemInput = Awaited<ReturnType<SourceWriteRepo['getSearchSections']>>[number]

export function createSearchItem(section: SearchItemInput) {
  const heading = section.headingTitle ? `\n\n## ${section.headingTitle}` : ''
  return {
    itemKey: `page/${section.revisionId}/section/${section.id}.md`,
    content: `# ${section.pageTitle}${heading}\n\n${section.content}`,
    metadata: { pagesectionid: String(section.id), tag: section.tag, locale: 'zh-cn' },
  }
}

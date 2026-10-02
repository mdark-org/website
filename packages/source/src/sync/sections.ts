import { structure } from 'fumadocs-core/mdx-plugins'
import type { NewPageSection, PageSections } from '../db/schema/content.ts'

export const SECTION_PARSER_VERSION = 1

// 将 content 转为 section[]

export async function parsePageSections(input: {
  revisionId: string
  markdown: string
}): Promise<PageSections> {
  const { revisionId, markdown } = input
  const data = structure(markdown)
  const headingTitles = new Map(data.headings.map(({ id, content }) => [id, content]))

  return data.contents.map((item, ordinal): NewPageSection => ({
    revisionId,
    headingId: item.heading ?? null,
    headingTitle: item.heading ? headingTitles.get(item.heading) ?? null : null,
    content: item.content,
    ordinal,
  }))
}

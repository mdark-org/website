import { structure } from 'fumadocs-core/mdx-plugins'
import type { NewPageSection, PageSections } from '../db/schema/content.ts'

export const SECTION_PARSER_VERSION = 1

type Section = {
  revisionId: string;
  content: string;
  ordinal: number;
  headingId?: string | null | undefined;
  headingTitle?: string | null | undefined;
}

// 将 content 按 section 拆分。
export function parsePageSections(input: {
  revisionId: string
  markdown: string
}): Section[] {
  const { revisionId, markdown } = input
  const data = structure(markdown)
  const contentsByHeading = new Map<string | null, string[]>()

  for (const item of data.contents) {
    const headingId = item.heading ?? null
    const contents = contentsByHeading.get(headingId)
    if (contents) contents.push(item.content)
    else contentsByHeading.set(headingId, [item.content])
  }

  const sections: PageSections = []
  const appendSection = (headingId: string | null, headingTitle: string | null) => {
    const contents = contentsByHeading.get(headingId)
    if (!contents) return

    const content = contents.map((item) => item.trim()).filter(Boolean).join('\n\n')
    if (!content) return

    const section: NewPageSection = {
      revisionId,
      headingId,
      headingTitle,
      content,
      ordinal: sections.length,
    }
    sections.push(section)
  }
  appendSection(null, null)
  data.headings.forEach(heading => appendSection(heading.id, heading.content))
  return sections
}

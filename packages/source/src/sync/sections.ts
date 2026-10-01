import type { Heading } from 'mdast'
import { visit } from 'unist-util-visit'
import { VFile } from 'vfile'
import type { PageSection, PageSections } from '../db/schema/content.ts'
import { createMarkdownParser } from '../markdown'
import { hash } from './hash'

export const SECTION_PARSER_VERSION = 1

type SectionRange = Pick<PageSection, 'title' | 'headingPath' | 'anchor' | 'level' | 'startOffset' | 'endOffset'>

const processor = createMarkdownParser()

export async function parsePageSections(input: {
  pageRevisionId: string
  sourceKey: string
  markdown: string
}): Promise<PageSections> {
  const { pageRevisionId, sourceKey, markdown } = input
  const file = new VFile(markdown)
  const tree = processor.runSync(processor.parse(file), file)
  const headings: Heading[] = []
  visit(tree, 'heading', (heading) => { headings.push(heading) })

  const root: SectionRange = {
    title: null,
    headingPath: [],
    anchor: null,
    level: 0,
    startOffset: 0,
    endOffset: markdown.length,
  }
  const ranges: SectionRange[] = []
  const ancestors: SectionRange[] = []
  const anchors = new Set<string>()
  for (const [index, heading] of headings.entries()) {
    const item = file.data.toc?.[index]
    const start = heading.position?.start.offset
    const end = heading.position?.end.offset
    if (!item || typeof item.title !== 'string' || start === undefined || end === undefined) {
      throw new Error('The Markdown parser did not provide heading text and offsets.')
    }
    const anchor = item.url.slice(1)
    if (anchors.has(anchor)) throw new Error(`Duplicate heading anchor: ${anchor}`)
    anchors.add(anchor)
    if (index === 0) root.endOffset = start

    // Close each subtree at the next heading with the same or a lower depth.
    let parent = ancestors.at(-1)
    while (parent && parent.level >= heading.depth) {
      parent.endOffset = start
      ancestors.pop()
      parent = ancestors.at(-1)
    }
    const range: SectionRange = {
      title: item.title,
      headingPath: [...(parent?.headingPath ?? []), item.title],
      anchor,
      level: heading.depth,
      startOffset: end,
      endOffset: markdown.length,
    }
    ranges.push(range)
    ancestors.push(range)
  }

  async function toSection(range: SectionRange, ordinal: number): Promise<PageSection> {
    const bodyHash = await hash(markdown.slice(range.startOffset, range.endOffset))
    const sectionHash = await hash(JSON.stringify({ title: range.title, headingPath: range.headingPath, bodyHash }))
    const locator = range.anchor === null ? ['root'] : ['heading', range.anchor]
    const sectionId = await hash(JSON.stringify([sourceKey, locator]))
    return { pageRevisionId, sectionId, sectionHash, bodyHash, ...range, ordinal }
  }

  const sections: PageSections = [await toSection(root, 0)]
  for (const [index, range] of ranges.entries()) sections.push(await toSection(range, index + 1))
  return sections
}

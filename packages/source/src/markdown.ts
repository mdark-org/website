import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import { remarkHeading } from 'fumadocs-core/mdx-plugins/remark-heading'

export function createMarkdownParser() {
  return unified().use(remarkParse).use(remarkGfm).use(remarkHeading)
}

import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import { remarkHeading } from 'fumadocs-core/mdx-plugins/remark-heading';
import { rehypeCode } from 'fumadocs-core/mdx-plugins/rehype-code';
import { toJsxRuntime, type Options } from 'hast-util-to-jsx-runtime';
import { Fragment, jsx, jsxs } from 'react/jsx-runtime';
import { VFile } from 'vfile';

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkHeading)
  .use(remarkRehype)
  .use(rehypeCode);

export async function renderMarkdown(content: string, components: Options['components'] = {}) {
  const file = new VFile(content);
  const tree = await processor.run(processor.parse(file), file);
  return {
    body: toJsxRuntime(tree, { Fragment, jsx, jsxs, components }),
    toc: file.data.toc ?? [],
  };
}

import remarkRehype from "remark-rehype";
import {
  rehypeCodeDefaultOptions,
  rehypeCodeFromHighlighter,
  transformerTab,
} from "fumadocs-core/mdx-plugins/rehype-code.core";
import { createShikiHighlighter } from "fumadocs-core/highlight/shiki";
import { createHighlighterCore } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import { toJsxRuntime, type Options } from "hast-util-to-jsx-runtime";
import { toHtml, type Options as HTMLOption } from "hast-util-to-html";

import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { VFile } from "vfile";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import { remarkHeading } from "fumadocs-core/mdx-plugins/remark-heading";

export function createMarkdownParser() {
  return unified().use(remarkParse).use(remarkGfm).use(remarkHeading);
}

// Keep Shiki scoped to JS regex engine + common languages so the Worker bundle stays under Workers Free 3 MiB gzip.
const shikiCorePromise = createHighlighterCore({
  themes: [
    import("shiki/themes/github-light.mjs"),
    import("shiki/themes/github-dark.mjs"),
  ],
  langs: [
    import("shiki/langs/bash.mjs"),
    import("shiki/langs/c.mjs"),
    import("shiki/langs/cpp.mjs"),
    import("shiki/langs/css.mjs"),
    import("shiki/langs/diff.mjs"),
    import("shiki/langs/docker.mjs"),
    import("shiki/langs/go.mjs"),
    import("shiki/langs/html.mjs"),
    import("shiki/langs/java.mjs"),
    import("shiki/langs/javascript.mjs"),
    import("shiki/langs/json.mjs"),
    import("shiki/langs/jsonc.mjs"),
    import("shiki/langs/jsx.mjs"),
    import("shiki/langs/markdown.mjs"),
    import("shiki/langs/mdx.mjs"),
    import("shiki/langs/python.mjs"),
    import("shiki/langs/rust.mjs"),
    import("shiki/langs/shellscript.mjs"),
    import("shiki/langs/sql.mjs"),
    import("shiki/langs/toml.mjs"),
    import("shiki/langs/tsx.mjs"),
    import("shiki/langs/typescript.mjs"),
    import("shiki/langs/xml.mjs"),
    import("shiki/langs/yaml.mjs"),
  ],
  engine: createJavaScriptRegexEngine(),
});

const defaultCodeOptions = rehypeCodeDefaultOptions();

const processor = createMarkdownParser()
  .use(remarkRehype)
  .use(rehypeCodeFromHighlighter, ({ transformers }) =>
    createShikiHighlighter(() => shikiCorePromise, {
      themes: {
        light: "github-light",
        dark: "github-dark",
      },
      defaultColor: false,
      fallbackLanguage: "plaintext",
      transformers,
    }),
    {
      transformers: [...(defaultCodeOptions.transformers ?? []), transformerTab()],
      defaultLanguage: defaultCodeOptions.defaultLanguage,
      parseMetaString: defaultCodeOptions.parseMetaString,
    },
  );

export async function compileMarkdown(content: string) {
  const file = new VFile(content);
  const tree = await processor.run(processor.parse(file), file);
  return {
    tree,
    toc: file.data.toc ?? [],
  };
}

export async function renderMarkdown(content: string, components: Options["components"] = {}) {
  const { tree, toc } = await compileMarkdown(content);
  return { body: toJsxRuntime(tree, { Fragment, jsx, jsxs, components }), toc };
}

export async function renderMarkdownRSS(content: string, options: HTMLOption = {}) {
  const file = new VFile(content);
  const tree = await processor.run(processor.parse(file), file);
  return {
    body: toHtml(tree, options),
  };
}

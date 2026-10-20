import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { compileMarkdown, renderMarkdown } from "../src/lib/markdown.ts";
import { Fragment } from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import { toJsxRuntime } from "hast-util-to-jsx-runtime";

test("heading anchors match the TOC and reset for each document", async () => {
  const content = "# Intro\n\n## Repeat\n\n## Repeat\n\n## Custom [#custom]";
  const first = await renderMarkdown(content);
  const second = await renderMarkdown(content);
  assert.deepEqual(first.toc, [
    { title: "Intro", url: "#intro", depth: 1 },
    { title: "Repeat", url: "#repeat", depth: 2 },
    { title: "Repeat", url: "#repeat-1", depth: 2 },
    { title: "Custom", url: "#custom", depth: 2 },
  ]);
  assert.deepEqual(second.toc, first.toc);
  const html = renderToStaticMarkup(first.body);
  for (const item of first.toc) assert.ok(html.includes(`id="${item.url.slice(1)}"`));
});

test("renders GFM, links, images and fenced code without code generation", async () => {
  const { body } = await renderMarkdown(
    [
      "| Name | Value |",
      "| --- | --- |",
      "| A | B |",
      "",
      "- [x] Done",
      "",
      "~~Removed~~",
      "",
      "[Link](https://example.com) ![Image](/image/test.png)",
      "",
      "```js",
      'const value = "<tag>";',
      "```",
      "",
      "{notJavaScript()} <Video />",
    ].join("\n"),
  );
  const html = renderToStaticMarkup(body);
  assert.match(html, /<table>/);
  assert.match(html, /type="checkbox"/);
  assert.match(html, /<del>Removed<\/del>/);
  assert.match(html, /href="https:\/\/example.com"/);
  assert.match(html, /src="\/image\/test.png"/);
  assert.match(html, /class="shiki shiki-themes/);
  assert.match(html, /&lt;tag&gt;/);
  assert.match(html, /\{notJavaScript\(\)\}/);
  assert.doesNotMatch(html, /<Video/);
});

test("empty documents have an empty TOC", async () => {
  const result = await renderMarkdown("");
  assert.deepEqual(result.toc, []);
  assert.equal(renderToStaticMarkup(result.body), "");
});

test("compiled documents retain headings and highlighted code across the server boundary", async () => {
  const content = "# Heading\n\n## A [link](https://example.com)\n\n```ts\nconst value = 1;\n```";
  const compiled = await compileMarkdown(content);
  const payload = JSON.parse(JSON.stringify(compiled));
  assert.deepEqual(payload.toc, compiled.toc);
  assert.equal(
    renderToStaticMarkup(toJsxRuntime(payload.tree, { Fragment, jsx, jsxs })),
    renderToStaticMarkup((await renderMarkdown(content)).body),
  );
});

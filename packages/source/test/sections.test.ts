import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { test } from 'node:test'
import { parsePageSections } from '../src/sync/sections.ts'

const sourceKey = JSON.stringify(['archive', 'docs:guide.md'])

function parse(markdown: string, pageRevisionId = 'revision-1', key = sourceKey) {
  return parsePageSections({ markdown, pageRevisionId, sourceKey: key })
}

test('every document has a root section, including empty documents', async () => {
  for (const markdown of ['', 'A document without headings.']) {
    const sections = await parse(markdown)
    assert.equal(sections.length, 1)
    const root = sections[0]
    assert.equal(root.pageRevisionId, 'revision-1')
    assert.equal(root.title, null)
    assert.equal(root.anchor, null)
    assert.equal(root.level, 0)
    assert.equal(root.ordinal, 0)
    assert.deepEqual(root.headingPath, [])
    assert.equal(root.startOffset, 0)
    assert.equal(root.endOffset, markdown.length)
    assert.equal(root.bodyHash, createHash('sha256').update(markdown).digest('hex'))
  }
})

test('sections end at the next heading with the same or a lower depth', async () => {
  const markdown = 'Preamble\n\n# A\n\nintro\n\n## B\n\nbbb\n\n### C\n\nccc\n\n## D\n\nddd\n\n# E\n\neee\n'
  const sections = await parse(markdown)
  assert.deepEqual(sections.map(({ title }) => title), [null, 'A', 'B', 'C', 'D', 'E'])
  assert.deepEqual(sections.map(({ headingPath }) => headingPath), [
    [], ['A'], ['A', 'B'], ['A', 'B', 'C'], ['A', 'D'], ['E'],
  ])
  assert.deepEqual(sections.map(({ ordinal }) => ordinal), [0, 1, 2, 3, 4, 5])
  assert.deepEqual(sections.map(({ level }) => level), [0, 1, 2, 3, 2, 1])
  assert.deepEqual(sections.map(({ startOffset, endOffset }) => markdown.slice(startOffset, endOffset)), [
    'Preamble\n\n',
    '\n\nintro\n\n## B\n\nbbb\n\n### C\n\nccc\n\n## D\n\nddd\n\n',
    '\n\nbbb\n\n### C\n\nccc\n\n',
    '\n\nccc\n\n',
    '\n\nddd\n\n',
    '\n\neee\n',
  ])
  for (const section of sections) {
    const body = markdown.slice(section.startOffset, section.endOffset)
    assert.equal(section.bodyHash, createHash('sha256').update(body).digest('hex'))
    assert.equal(section.sectionHash, createHash('sha256').update(JSON.stringify({
      title: section.title,
      headingPath: section.headingPath,
      bodyHash: section.bodyHash,
    })).digest('hex'))
  }
})

test('AST parsing ignores fenced headings and supports setext and formatted headings', async () => {
  const markdown = '```md\n# Not a heading\n```\n\nSetext\n======\n\n## *Bold* `code` [Link](https://example.com)\n\nbody\n'
  const sections = await parse(markdown)
  assert.deepEqual(sections.map(({ title }) => title), [null, 'Setext', 'Bold code Link'])
  assert.deepEqual(sections.map(({ anchor }) => anchor), [null, 'setext', 'bold-code-link'])
  assert.equal(markdown.slice(sections[1].startOffset, sections[1].endOffset), '\n\n## *Bold* `code` [Link](https://example.com)\n\nbody\n')
})

test('duplicate heading slugs reset for each document', async () => {
  const markdown = '## Repeat\n\none\n\n## Repeat\n\ntwo\n'
  const first = await parse(markdown)
  const second = await parse(markdown)
  assert.deepEqual(first.map(({ anchor }) => anchor), [null, 'repeat', 'repeat-1'])
  assert.deepEqual(second, first)
  assert.equal(new Set(first.map(({ sectionId }) => sectionId)).size, first.length)
})

test('explicit Fumadocs anchors keep identity when a heading is renamed', async () => {
  const before = await parse('## Snapshot [#stable]\n\nbody', 'before')
  const after = await parse('## Snapshot Model [#stable]\n\nbody', 'after')
  assert.equal(before[1].anchor, 'stable')
  assert.equal(after[1].anchor, 'stable')
  assert.equal(before[1].title, 'Snapshot')
  assert.equal(after[1].title, 'Snapshot Model')
  assert.equal(before[1].sectionId, after[1].sectionId)
  assert.equal(before[1].bodyHash, after[1].bodyHash)
  assert.notEqual(before[1].sectionHash, after[1].sectionHash)
})

test('a heading rename without an explicit anchor changes section identity', async () => {
  const before = await parse('## Snapshot\n\nbody')
  const after = await parse('## Snapshot Model\n\nbody')
  assert.notEqual(before[1].sectionId, after[1].sectionId)
})

test('offsets use JavaScript string indices and preserve Unicode and CRLF', async () => {
  const markdown = '\u4e2d\u6587 \ud83d\ude80\r\n\r\n## \u6807\u9898\r\n\r\n\u6b63\u6587 \ud83d\ude80\r\n'
  const sections = await parse(markdown)
  assert.equal(sections[0].endOffset, markdown.indexOf('##'))
  assert.equal(sections[1].startOffset, markdown.indexOf('\r\n', markdown.indexOf('##')))
  assert.equal(markdown.slice(sections[1].startOffset, sections[1].endOffset), '\r\n\r\n\u6b63\u6587 \ud83d\ude80\r\n')
})

test('revision changes preserve section identity and unchanged sibling hashes', async () => {
  const markdown = '# Parent\n\nintro\n\n## Changed\n\nbefore\n\n## Kept\n\nsame'
  const before = await parse(markdown, 'before')
  const after = await parse(markdown.replace('before', 'after'), 'after')
  assert.deepEqual(before.map(({ sectionId }) => sectionId), after.map(({ sectionId }) => sectionId))
  assert.notEqual(before[1].sectionHash, after[1].sectionHash)
  assert.notEqual(before[2].sectionHash, after[2].sectionHash)
  assert.equal(before[3].sectionHash, after[3].sectionHash)
  const same = await parse(markdown, 'another-revision')
  assert.deepEqual(before.map(({ pageRevisionId, ...section }) => section), same.map(({ pageRevisionId, ...section }) => section))
})

test('section identity is scoped to the source, with a separate root locator', async () => {
  const first = await parse('## Root [#@root]\n\nbody')
  const second = await parse('## Root [#@root]\n\nbody', 'revision-1', 'other-source')
  assert.notEqual(first[0].sectionId, first[1].sectionId)
  assert.notEqual(first[1].sectionId, second[1].sectionId)
})

test('ambiguous explicit anchors are rejected', async () => {
  await assert.rejects(parse('## One [#same]\n\n## Two [#same]'), /Duplicate heading anchor: same/)
  await assert.rejects(parse('## Custom [#same]\n\n## Same'), /Duplicate heading anchor: same/)
})

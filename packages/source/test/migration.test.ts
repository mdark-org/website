import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { test } from 'node:test'

test('the section migration is additive and preserves the previous schema snapshot', async () => {
  const root = new URL('../../../fuma/drizzle/migrations/', import.meta.url)
  const dirs = (await readdir(root)).sort()
  const sectionIndex = dirs.findIndex((name) => name.endsWith('_page_sections'))
  assert.ok(sectionIndex > 0)
  const previous = JSON.parse(await readFile(new URL(`${dirs[sectionIndex - 1]}/snapshot.json`, root), 'utf8'))
  const current = JSON.parse(await readFile(new URL(`${dirs[sectionIndex]}/snapshot.json`, root), 'utf8'))
  const added = current.ddl.filter((entry: { table?: string; entityType: string; name: string }) =>
    entry.table === 'page_sections' || (entry.entityType === 'tables' && entry.name === 'page_sections'))
  assert.equal(added.length, 17)
  assert.deepEqual(current.ddl.filter((entry: unknown) => !added.includes(entry)), previous.ddl)
  assert.deepEqual(current.prevIds, [previous.id])
  const migration = await readFile(new URL(`${dirs[sectionIndex]}/migration.sql`, root), 'utf8')
  const d1Migration = await readFile(new URL('../../../fuma/drizzle/d1/0002_page_sections.sql', import.meta.url), 'utf8')
  assert.equal(migration, d1Migration)
  assert.doesNotMatch(migration, /^\s*(?:DROP|ALTER|UPDATE|DELETE FROM)\b/im)
  assert.equal((migration.match(/CREATE TABLE/g) ?? []).length, 1)
  assert.equal((migration.match(/CREATE (?:UNIQUE )?INDEX/g) ?? []).length, 4)
})

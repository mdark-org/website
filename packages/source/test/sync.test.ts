import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import { after, before, beforeEach, test } from 'node:test'
import { eq, sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/d1'
import { Miniflare } from 'miniflare'
import { relations, type DB } from '../src/db/schema/index.ts'
import { pageContent, pageRef, pageRevision, pageSection } from '../src/db/schema/content.ts'
import { datasource, sourceHeads } from '../src/db/schema/sync.ts'
import { backfillPageSections, parsePageSections, SourceWriteRepo, syncDatasource, type BuiltDatasource } from '../src/sync/index.ts'
import type { Page } from '../src/types.ts'

let mf: Miniflare
let client: Awaited<ReturnType<Miniflare['getD1Database']>>
let db: DB
let repo: SourceWriteRepo

before(async () => {
  mf = new Miniflare({
    modules: true,
    script: 'export default { fetch() { return new Response("ok") } }',
    compatibilityDate: '2026-07-30',
    d1Databases: ['DB'],
  })
  client = await mf.getD1Database('DB')
  const dir = new URL('../../../fuma/drizzle/d1/', import.meta.url)
  const files = (await readdir(dir)).filter((name) => name.endsWith('.sql')).sort()
  for (const file of files) {
    const migration = await readFile(new URL(file, dir), 'utf8')
    const statements = migration.split('--> statement-breakpoint').filter((statement) => statement.trim())
    await client.batch(statements.map((statement) => client.prepare(statement)))
  }
  db = drizzle(client, { relations })
  repo = new SourceWriteRepo(db)
})

after(async () => { await mf?.dispose() })

beforeEach(async () => {
  await client.batch([
    'DROP TRIGGER IF EXISTS fail_sections',
    'DROP TRIGGER IF EXISTS reject_section_reuse',
    'DELETE FROM page_ref',
    'DELETE FROM datasources',
    'DELETE FROM source_heads',
    'DELETE FROM page_versions',
    'DELETE FROM page_bodies',
    'DELETE FROM sync_runs',
  ].map((statement) => client.prepare(statement)))
})

function page(options: Partial<Page> = {}): Page {
  return {
    type: 'page', name: 'Guide', title: 'Guide', url: '/docs/guide', sourceKey: 'guide.md',
    data: { title: 'Guide', content: 'Preamble\n\n## One\n\nfirst\n\n## Two\n\nsecond' },
    ...options,
  }
}

function built(pages: Page[] = [page()]): BuiltDatasource {
  return {
    datasourceInfo: { id: 'archive', name: 'Docs', mountedPath: '/docs', description: '' },
    pageMap: new Map(pages.map((item) => [item.url, item])),
    pageTree: {
      type: 'folder', root: true, depth: 1, name: 'Docs', title: 'Docs', url: '/docs',
      children: pages.map((item) => ({ type: 'page', name: item.name, title: item.title, url: item.url })),
    },
  }
}

async function startRun() {
  const run = await repo.createRun(['docs'])
  await repo.startRun(run.id)
  return run
}

async function sectionsFor(runId: number) {
  const ref = await db.select().from(pageRef).where(eq(pageRef.syncRunId, runId)).get()
  assert.ok(ref)
  return db.select().from(pageSection).where(eq(pageSection.pageRevisionId, ref.revisionId)).orderBy(pageSection.ordinal)
}

async function seedRevision(id: string, markdown = 'Intro\n\n## Heading\n\nbody') {
  const contentHash = createHash('sha256').update(markdown).digest('hex')
  const sourceKey = JSON.stringify(['legacy', id])
  await db.insert(pageContent).values({ hash: contentHash, markdown }).onConflictDoNothing()
  await db.insert(pageRevision).values({
    revisionId: id, sourceKey, sourceHash: id, contentHash, url: `/legacy/${id}`, title: id,
  })
  return { pageRevisionId: id, sourceKey, markdown }
}

test('sync writes complete sections and exposes them through revision relations', async () => {
  const run = await startRun()
  const result = await syncDatasource(repo, run.id, built())
  assert.equal(result.pages, 1)
  assert.equal(result.parsedPages, 1)
  const sections = await sectionsFor(run.id)
  assert.deepEqual(sections.map(({ title }) => title), [null, 'One', 'Two'])
  const ref = await db.query.pageRef.findFirst({
    where: { syncRunId: run.id },
    with: { revision: { with: { sections: { orderBy: { ordinal: 'asc' } }, content: true } } },
  })
  assert.ok(ref)
  assert.deepEqual(ref.revision.sections, sections)
  for (const section of sections) {
    const body = ref.revision.content.markdown.slice(section.startOffset, section.endOffset)
    assert.equal(section.bodyHash, createHash('sha256').update(body).digest('hex'))
  }
  assert.equal((await db.select().from(pageContent)).length, 1)
  await repo.publishRun(run.id)
  assert.equal((await repo.getRun(run.id))?.status, 'succeeded')
  assert.equal(Number((await db.select().from(sourceHeads).get())?.syncRunId), run.id)
})

test('unchanged revisions skip parsing and section inserts on retries and later runs', async () => {
  const first = await startRun()
  await syncDatasource(repo, first.id, built())
  const original = await sectionsFor(first.id)
  await client.prepare("CREATE TRIGGER reject_section_reuse BEFORE INSERT ON page_sections BEGIN SELECT RAISE(ABORT, 'Sections must be reused'); END").run()
  assert.equal((await syncDatasource(repo, first.id, built())).parsedPages, 0)
  await repo.publishRun(first.id)
  const second = await startRun()
  assert.equal((await syncDatasource(repo, second.id, built())).parsedPages, 0)
  assert.deepEqual(await sectionsFor(second.id), original)
  assert.equal((await db.select().from(pageRevision)).length, 1)
})

test('URL-only changes preserve section identities and hashes without changing the active snapshot', async () => {
  const first = await startRun()
  await syncDatasource(repo, first.id, built())
  await repo.publishRun(first.id)
  const before = await sectionsFor(first.id)
  const second = await startRun()
  await syncDatasource(repo, second.id, built([page({ url: '/docs/renamed' })]))
  const after = await sectionsFor(second.id)
  assert.deepEqual(before.map(({ pageRevisionId, ...item }) => item), after.map(({ pageRevisionId, ...item }) => item))
  assert.notEqual(before[0].pageRevisionId, after[0].pageRevisionId)
  assert.equal((await db.select().from(pageRevision)).length, 2)
  assert.equal((await db.select().from(pageContent)).length, 1)
  assert.equal(Number((await db.select().from(sourceHeads).get())?.syncRunId), first.id)
  assert.equal((await db.select().from(pageRef).where(eq(pageRef.syncRunId, first.id)).get())?.url, '/docs/guide')
})

test('content changes preserve unchanged sibling hashes', async () => {
  const first = await startRun()
  await syncDatasource(repo, first.id, built())
  const before = await sectionsFor(first.id)
  const second = await startRun()
  await syncDatasource(repo, second.id, built([page({ data: { title: 'Guide', content: 'Preamble\n\n## One\n\nchanged\n\n## Two\n\nsecond' } })]))
  const after = await sectionsFor(second.id)
  assert.deepEqual(before.map(({ sectionId }) => sectionId), after.map(({ sectionId }) => sectionId))
  assert.equal(before[0].sectionHash, after[0].sectionHash)
  assert.notEqual(before[1].sectionHash, after[1].sectionHash)
  assert.equal(before[2].sectionHash, after[2].sectionHash)
})

test('provider identities are required and must be unique within a datasource', async () => {
  const run = await startRun()
  await assert.rejects(syncDatasource(repo, run.id, built([page({ sourceKey: undefined })])), /source key/)
  await assert.rejects(syncDatasource(repo, run.id, built([page(), page({ url: '/docs/duplicate' })])), /source key/)
  assert.equal((await db.select().from(pageContent)).length, 0)
  assert.equal((await db.select().from(pageRevision)).length, 0)
})

test('shared Markdown bodies have separate section identities for separate sources', async () => {
  const run = await startRun()
  await syncDatasource(repo, run.id, built([page(), page({ url: '/docs/other', sourceKey: 'other.md' })]))
  assert.equal((await db.select().from(pageContent)).length, 1)
  assert.equal((await db.select().from(pageRevision)).length, 2)
  const sections = await db.select().from(pageSection)
  assert.equal(sections.length, 6)
  assert.equal(new Set(sections.map(({ sectionId }) => sectionId)).size, 6)
})

test('a failed section batch rolls back its revision and can be retried', async () => {
  const run = await startRun()
  const markdown = Array.from({ length: 20 }, (_, i) => `## Heading ${i}\n\nbody ${i}`).join('\n\n')
  await client.prepare("CREATE TRIGGER fail_sections BEFORE INSERT ON page_sections WHEN NEW.ordinal >= 9 BEGIN SELECT RAISE(ABORT, 'Interrupted section write'); END").run()
  await assert.rejects(syncDatasource(repo, run.id, built([page({ data: { title: 'Guide', content: markdown } })])))
  assert.equal((await db.select().from(pageRevision)).length, 0)
  assert.equal((await db.select().from(pageSection)).length, 0)
  assert.equal((await db.select().from(pageRef)).length, 0)
  assert.equal((await db.select().from(datasource)).length, 0)
  await client.prepare('DROP TRIGGER fail_sections').run()
  assert.equal((await syncDatasource(repo, run.id, built([page({ data: { title: 'Guide', content: markdown } })]))).parsedPages, 1)
  assert.equal((await sectionsFor(run.id)).length, 21)
})

test('backfill repairs incomplete rows and resumes without rewriting completed revisions', async () => {
  const input = await seedRevision('a')
  await seedRevision('b', '')
  await seedRevision('c')
  const sections = await parsePageSections(input)
  await db.insert(pageSection).values({ ...sections[1], sectionId: 'partial-row' })
  assert.equal((await repo.getSectionRevisionIds(['a'])).size, 0)
  assert.deepEqual(await backfillPageSections(repo, { limit: 1 }), { revisions: 1, sections: 2 })
  assert.equal((await db.select().from(pageSection).where(eq(pageSection.sectionId, 'partial-row'))).length, 0)
  await client.prepare("CREATE TRIGGER reject_section_reuse BEFORE INSERT ON page_sections WHEN NEW.page_revision_id = 'a' BEGIN SELECT RAISE(ABORT, 'Completed revision was parsed again'); END").run()
  assert.deepEqual(await backfillPageSections(repo), { revisions: 2, sections: 3 })
  assert.deepEqual(await backfillPageSections(repo), { revisions: 0, sections: 0 })
  assert.deepEqual(await repo.getSectionRevisionIds(['a', 'b', 'c']), new Set(['a', 'b', 'c']))
})

test('backfill does not commit a root completion marker on a partial batch failure', async () => {
  const markdown = Array.from({ length: 20 }, (_, i) => `## Heading ${i}\n\nbody`).join('\n\n')
  await seedRevision('legacy', markdown)
  await client.prepare("CREATE TRIGGER fail_sections BEFORE INSERT ON page_sections WHEN NEW.ordinal >= 9 BEGIN SELECT RAISE(ABORT, 'Interrupted backfill'); END").run()
  await assert.rejects(backfillPageSections(repo))
  assert.equal((await repo.getSectionRevisionIds(['legacy'])).size, 0)
  assert.equal((await db.select().from(pageSection)).length, 0)
  assert.equal((await db.select().from(pageRevision)).length, 1)
  await client.prepare('DROP TRIGGER fail_sections').run()
  assert.deepEqual(await backfillPageSections(repo), { revisions: 1, sections: 21 })
})

test('publication requires complete sections and keeps the previous head on failure', async () => {
  const first = await startRun()
  await syncDatasource(repo, first.id, built())
  await repo.publishRun(first.id)
  const second = await startRun()
  await syncDatasource(repo, second.id, built([page({ title: 'New title' })]))
  const sections = await sectionsFor(second.id)
  await db.delete(pageSection).where(eq(pageSection.pageRevisionId, sections[0].pageRevisionId))
  await assert.rejects(repo.publishRun(second.id), /Missing page sections/)
  assert.equal(Number((await db.select().from(sourceHeads).get())?.syncRunId), first.id)
  assert.equal((await repo.getRun(second.id))?.status, 'running')
  await backfillPageSections(repo)
  await repo.publishRun(second.id)
  assert.equal(Number((await db.select().from(sourceHeads).get())?.syncRunId), second.id)
})

test('section constraints reject duplicate identity and order, and revision deletion cascades', async () => {
  const input = await seedRevision('legacy')
  const sections = await parsePageSections(input)
  await repo.writePageSections(sections)
  await assert.rejects(db.insert(pageSection).values({ ...sections[0], ordinal: 9 }))
  await assert.rejects(db.insert(pageSection).values({ ...sections[0], sectionId: 'duplicate-order' }))
  await assert.rejects(db.insert(pageSection).values({ ...sections[0], pageRevisionId: 'missing' }))
  await db.delete(pageRevision).where(eq(pageRevision.revisionId, 'legacy'))
  assert.equal((await db.select().from(pageSection)).length, 0)
})

test('revision reuse lookups and writes respect D1 parameter limits', async () => {
  const pages = Array.from({ length: 95 }, (_, i) => page({ url: `/docs/${i}`, sourceKey: `${i}.md` }))
  const run = await startRun()
  assert.equal((await syncDatasource(repo, run.id, built(pages))).parsedPages, 95)
  assert.equal((await syncDatasource(repo, run.id, built(pages))).parsedPages, 0)
  assert.equal((await db.select({ count: sql<number>`count(*)` }).from(pageSection).get())?.count, 285)
})

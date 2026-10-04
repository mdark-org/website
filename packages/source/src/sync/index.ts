
import { SourceSyncError, SourceWriteRepo, type DatasourceSnapshot } from '../db/write.repo'
import { hash } from '../utils/hash'
import { parsePageSections, SECTION_PARSER_VERSION } from './sections'
import {Datasource, Page} from "../types";
import { SourceBuilder } from "../builder";
export { SOURCE_HEAD_ID, SourceSyncError, SourceWriteRepo } from '../db/write.repo'
export type { SyncRun } from '../db/write.repo'

export function getDatasourceSlug(mountedPath: string): string {
  const slug = mountedPath.split('/').filter(Boolean).pop()
  if (!slug) throw new SourceSyncError('The datasource mount must have a slug.')
  return slug
}

async function createRevisionFromPage(page: Page) {
  const sourceHash = await hash(JSON.stringify(['source-build-v2', SECTION_PARSER_VERSION, page]))
  const revisionId = await hash(JSON.stringify([page.sourceKey, sourceHash]))
  const data = page.data!
  const date = data.date?.getTime()
  const publishedAt = date !== undefined && Number.isFinite(date) ? date : 0
  const markdown = data.content!
  const contentHash = await hash(markdown)
  const sourceKey = page.sourceKey!
  return {
    revisionId,
    sourceHash,
    sourceKey,
    contentHash,
    url: page.url,
    title: page.title,
    description: data.description ?? null,
    tags: data.tags ?? null,
    metadata: {
      bvid: data.bvid,
      ytid: data.ytid,
      wbid: data.wbid,
      xgid: data.xgid,
      rss: data.rss
    },
    filename: page.filename ?? null,
    ext: page.ext ?? null,
    publishedAt,
    markdown,
  }
}

export async function syncDatasource(repo: SourceWriteRepo, runId: number, datasource: Datasource, options: { sortOrder?: number } = {}) {
  const built = await new SourceBuilder(datasource).build()
  const info = built.datasourceInfo
  const snapshot: DatasourceSnapshot = {
    slug: getDatasourceSlug(info.mountedPath),
    name: info.name,
    description: info.description,
    icon: info.icon ?? null,
    mountedPath: info.mountedPath,
    sortOrder: options.sortOrder ?? 0,
    tree: built.pageTree,
    bodies: [],
    revisions: [],
    sections: [],
    refs: [],
  }
  const urls = new Set<string>()
  const sourceKeys = new Set<string>()
  const bodies = new Map<string, string>()
  const tasks = built.pageMap.entries()
    .filter(([url, page], index) => page.external)
    .map(async ([url, page]) => {
      if (url !== page.url
        || urls.has(page.url)
        || typeof page.data?.content !== 'string'
        || typeof page.sourceKey !== 'string'
        || !page.sourceKey
        || sourceKeys.has(page.sourceKey)) {
        throw new SourceSyncError(`Invalid page content, source key or URL: ${url}`)
      }
      return await createRevisionFromPage(page)
    })
  const revisions = await Promise.all(tasks)

  revisions.forEach(revision => {
    urls.add(revision.url)
    sourceKeys.add(revision.sourceKey)
    snapshot.bodies.push({ hash: revision.contentHash, markdown: revision.markdown })
    bodies.set(revision.contentHash, revision.markdown)
    snapshot.revisions.push(revision)
    snapshot.refs.push({ revisionId: revision.revisionId, url: revision.url, publishedAt: revision.publishedAt })
  })

  // create section
  const completed = await repo.getSectionRevisionIds(snapshot.revisions.map((revision) => revision.revisionId))
  snapshot.sections = snapshot.revisions
    .filter(revision => !completed.has(revision.revisionId))
    .map((revision) => {
      const markdown = bodies.get(revision.contentHash)!
      const sections = parsePageSections({ revisionId: revision.revisionId, markdown })
      return { revisionId: revision.revisionId, items: sections }
    })

  const result = await repo.writeDatasource(runId, snapshot)
  return { ...result, parsedPages: snapshot.sections.length }
}


import { SourceSyncError, SourceWriteRepo, type DatasourceSnapshot } from '../db/write.repo'
import { hash } from '../utils/hash'
import { parsePageSections, SECTION_PARSER_VERSION } from './sections'
import {Datasource} from "../types";
import {SourceBuilder} from "../builder";
export { SOURCE_HEAD_ID, SourceSyncError, SourceWriteRepo } from '../db/write.repo'
export type { SyncRun } from '../db/write.repo'
export { parsePageSections, SECTION_PARSER_VERSION } from './sections'

export function getDatasourceSlug(mountedPath: string): string {
  const slug = mountedPath.split('/').filter(Boolean).pop()
  if (!slug) throw new SourceSyncError('The datasource mount must have a slug.')
  return slug
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
  for (const [url, page] of built.pageMap) {
    if (page.external) continue
    if (url !== page.url || urls.has(page.url) || typeof page.data?.content !== 'string'
      || typeof page.sourceKey !== 'string' || !page.sourceKey || sourceKeys.has(page.sourceKey)) {
      throw new SourceSyncError(`Invalid page content, source key or URL: ${url}`)
    }
    urls.add(page.url)
    sourceKeys.add(page.sourceKey)
    const data = page.data
    const markdown = page.data.content
    const date = data.date?.getTime()
    const publishedAt = date !== undefined && Number.isFinite(date) ? date : 0
    const contentHash = await hash(markdown)
    const sourceKey = JSON.stringify([info.id, page.sourceKey])
    const revision = {
      sourceKey,
      contentHash,
      url: page.url,
      title: page.title,
      description: data.description ?? null,
      tags: data.tags ?? null,
      metadata: {
        ...(data.bvid !== undefined ? { bvid: data.bvid } : {}),
        ...(data.ytid !== undefined ? { ytid: data.ytid } : {}),
        ...(data.wbid !== undefined ? { wbid: data.wbid } : {}),
        ...(data.xgid !== undefined ? { xgid: data.xgid } : {}),
        ...(data.rss !== undefined ? { rss: data.rss } : {}),
      },
      filename: page.filename ?? null,
      ext: page.ext ?? null,
      publishedAt,
    }
    const sourceHash = await hash(JSON.stringify(['source-build-v2', SECTION_PARSER_VERSION, revision]))
    const revisionId = await hash(JSON.stringify([sourceKey, sourceHash]))
    snapshot.bodies.push({ hash: contentHash, markdown })
    bodies.set(contentHash, markdown)
    snapshot.revisions.push({ ...revision, sourceHash, revisionId })
    snapshot.refs.push({ revisionId, url: page.url, publishedAt })
  }
  const completed = await repo.getSectionRevisionIds(snapshot.revisions.map((revision) => revision.revisionId))
  for (const revision of snapshot.revisions) {
    if (completed.has(revision.revisionId)) continue
    const markdown = bodies.get(revision.contentHash)
    if (markdown === undefined) throw new SourceSyncError(`Missing page body: ${revision.url}`)
    try {
      snapshot.sections.push({
        revisionId: revision.revisionId,
        items: parsePageSections({ revisionId: revision.revisionId, markdown }),
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      throw new SourceSyncError(`Could not parse page sections for ${revision.url}: ${message}`, { cause: error })
    }
  }
  return { ...await repo.writeDatasource(runId, snapshot), parsedPages: snapshot.sections.length }
}

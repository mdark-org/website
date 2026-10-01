import { slimTree, type BuiltDatasource } from './snapshot'
import { SourceSyncError, SourceWriteRepo, type DatasourceSnapshot } from '../db/write.repo'
import type { Root } from '../types.ts'
export type { BuiltDatasource } from './snapshot'
export { SOURCE_HEAD_ID, SourceSyncError, SourceWriteRepo } from '../db/write.repo'
export type { SyncRun } from '../db/write.repo'

export function getDatasourceSlug(mountedPath: string): string {
  const slug = mountedPath.split('/').filter(Boolean).pop()
  if (!slug) throw new SourceSyncError('The datasource mount must have a slug.')
  return slug
}

async function hash(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function syncDatasource(repo: SourceWriteRepo, runId: number, built: BuiltDatasource, options: { sortOrder?: number } = {}) {
  const info = built.datasourceInfo
  const snapshot: DatasourceSnapshot = {
    slug: getDatasourceSlug(info.mountedPath),
    name: info.name,
    description: info.description,
    icon: info.icon ?? null,
    mountedPath: info.mountedPath,
    sortOrder: options.sortOrder ?? 0,
    tree: slimTree(built.pageTree),
    bodies: [],
    revisions: [],
    refs: [],
  }
  const urls = new Set<string>()
  for (const [url, page] of built.pageMap) {
    if (page.external) continue
    if (url !== page.url || urls.has(page.url) || typeof page.data?.content !== 'string') {
      throw new SourceSyncError(`Invalid page content or URL: ${url}`)
    }
    urls.add(page.url)
    const data = page.data
    const markdown = page.data.content
    const date = data.date?.getTime()
    const publishedAt = date !== undefined && Number.isFinite(date) ? date : 0
    const contentHash = await hash(markdown)
    const sourceKey = JSON.stringify([info.id, page.url])
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
    const sourceHash = await hash(JSON.stringify(['source-build-v1', revision]))
    const revisionId = await hash(JSON.stringify([sourceKey, sourceHash]))
    snapshot.bodies.push({ hash: contentHash, markdown })
    snapshot.revisions.push({ ...revision, sourceHash, revisionId })
    snapshot.refs.push({ revisionId, url: page.url, publishedAt })
  }

  const checkTree = (node: Root | Root['children'][number]): void => {
    if (node.type === 'page') {
      if (!node.external && !urls.has(node.url)) throw new SourceSyncError(`Missing page in datasource tree: ${node.url}`)
      return
    }
    if (node.index) checkTree(node.index)
    node.children.forEach(checkTree)
  }
  checkTree(snapshot.tree)
  return repo.writeDatasource(runId, snapshot)
}

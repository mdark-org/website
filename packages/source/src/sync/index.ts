
import { SourceSyncError, SourceWriteRepo, type DatasourceSnapshot } from '../db/write.repo'
import { hash } from '../utils/hash'
import { SECTION_PARSER_VERSION } from './sections'
import { PageWithContent } from "../types";
import { SourceBuilder } from "../builder";
import {Datasource} from "../builder/type";
export { SourceSyncError, SourceWriteRepo } from '../db/write.repo'
export * from '../db/syncrun.repo'

async function createRevisionFromPage(page: PageWithContent) {
  const sourceHash = await hash(JSON.stringify(['source-build-v2', SECTION_PARSER_VERSION, page]))
  const revisionId = await hash(JSON.stringify([page.sourceKey, sourceHash]))
  const data = page.data!
  const publishedAt = data.date
  const markdown = page.content!
  const contentHash = await hash(markdown)
  const sourceKey = page.sourceKey!
  return {
    revisionId,
    sourceHash,
    sourceKey,
    contentHash,
    url: page.url,
    title: page.name,
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
  const {id, ...ds} = built.datasourceInfo
  const snapshot: DatasourceSnapshot = {
    datasource: {...ds, tree: built.pageTree, sortOrder: options.sortOrder ?? 0 },
    bodies: [],
    revisions: [],
    refs: [],
  }
  const urls = new Set<string>()
  const sourceKeys = new Set<string>()
  const bodies = new Map<string, string>()
  const tasks = built.pageMap.entries()
    .filter(([url, page], index) => !page.external)
    .map(async ([url, page]) => {
      if (url !== page.url
        || urls.has(page.url)
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


  const result = await repo.writeDatasource(runId, snapshot)
  return result
}

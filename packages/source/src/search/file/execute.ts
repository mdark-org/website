import type { AiSearchInstance } from '@cloudflare/workers-types'
import pLimit from 'p-limit'
import { SourceSyncError, type SourceWriteRepo } from '../../db/write.repo'
import type { RunCheckpoint, RunManifest } from './manifest'

export type SearchItemInput = Awaited<ReturnType<SourceWriteRepo['getSearchFiles']>>[number]

export function createSearchItem(revision: SearchItemInput) {
  return {
    itemKey: `page/${revision.revisionId}.md`,
    content: revision.content,
    metadata: { revisionid: String(revision.revisionId), url: revision.url, tag: revision.tag, locale: 'zh-cn' },
  }
}
type BatchResult<T> = {
  processed: T[]
  failure: PromiseRejectedResult | null
}

type SearchableFile = {
  pageRevisionId: string
}

export async function uploadSearchBatch({ instance, repo, runId, revisionItems }: {
  instance: AiSearchInstance
  repo: SourceWriteRepo
  runId: number
  revisionItems: SearchableFile[]
}): Promise<BatchResult<RunCheckpoint['upserted'][number]>> {
  const revisionIds = revisionItems.map((entry) => entry.pageRevisionId)
  const revisions = await repo.getSearchFiles(runId, revisionIds)
  const limit = pLimit({ concurrency: 10, rejectOnClear: true })
  const result: BatchResult<RunCheckpoint['upserted'][number]> = { processed: [], failure: null }
  await Promise.allSettled(revisions.map((revision) => limit(async () => {
    try {
      const input = createSearchItem(revision)
      const item = await instance.items.upload(input.itemKey, input.content, { metadata: input.metadata })
      result.processed.push({ itemKey: input.itemKey, itemId: item.id })
    } catch (reason) {
      console.error(reason)
      result.failure ??= { status: 'rejected', reason }
      limit.clearQueue()
    }
  })))
  return result
}

export async function deleteSearchBatch(instance: AiSearchInstance, items: RunManifest['delete']): Promise<BatchResult<string>> {
  const result: BatchResult<string> = { processed: [], failure: null }
  await Promise.all(items.map(async ({ itemKey, itemId }) => {
    try {
      await instance.items.delete(itemId)
    } catch (error) {
      if (!(error instanceof Error && error.name === 'AiSearchNotFoundError'
        && error.message === 'item_not_found')) {
        result.failure ??= { status: 'rejected', reason: error }
        return
      }
    }
    result.processed.push(itemKey)
  }))
  return result
}

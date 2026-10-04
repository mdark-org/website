import type { AiSearchInstance } from '@cloudflare/workers-types'
import pLimit from 'p-limit'
import { SourceSyncError, type SourceWriteRepo } from '../db/write.repo'
import { createSearchItem } from './item'
import type { RunCheckpoint, RunManifest } from './manifest'

type BatchResult<T> = {
  processed: T[]
  failure: PromiseRejectedResult | null
}

type SearchableSection = {
  pageSectionId: number
  pageRevisionId: string
}

export async function uploadSearchBatch({ instance, repo, runId, sectionItems }: {
  instance: AiSearchInstance
  repo: SourceWriteRepo
  runId: number
  sectionItems: SearchableSection[]
}): Promise<BatchResult<RunCheckpoint['upserted'][number]>> {
  const sectionIds = sectionItems.map((entry) => entry.pageSectionId)
  const sections = await repo.getSearchSections(runId, sectionIds)
  const limit = pLimit({ concurrency: 10, rejectOnClear: true })
  const result: BatchResult<RunCheckpoint['upserted'][number]> = { processed: [], failure: null }
  await Promise.allSettled(sections.map((section) => limit(async () => {
    try {
      const input = createSearchItem(section)
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

import type { AiSearchInstance } from '@cloudflare/workers-types'
import pLimit from 'p-limit'
import type { RunCheckpointV2, RunManifestV2 } from './manifest'

type BatchResult<T> = {
  processed: T[]
  failure: PromiseRejectedResult | null
}

export type SearchableContent = {
  itemKey: string,
  items: {
    itemKey: string,
    content: string,
    metadata: { [key: string]: string },
  }[]
}
export async function uploadSearchBatch({ instance, docs }: {
  instance: AiSearchInstance
  docs: SearchableContent[]
}): Promise<BatchResult<RunCheckpointV2['upserted'][number]>> {
  const limit = pLimit({ concurrency: 10, rejectOnClear: true })
  const result: BatchResult<RunCheckpointV2['upserted'][number]> = { processed: [], failure: null }
  await Promise.allSettled(docs.map((input) => limit(async () => {
    try {
      const itemIds: string[] = []
      console.log(`uploading ${input.itemKey}`)
      for (const it of input.items) {
        const item = await instance.items.upload(it.itemKey, it.content, { metadata: it.metadata })
        itemIds.push(item.id)
      }
      console.log(`uploaded ${input.itemKey}`)
      result.processed.push({ itemKey: input.itemKey, itemIds })
    } catch (reason) {
      console.error(reason)
      result.failure ??= { status: 'rejected', reason }
      limit.clearQueue()
    }
  })))
  return result
}

export async function deleteSearchBatch(instance: AiSearchInstance, items: RunManifestV2['delete']): Promise<BatchResult<string>> {
  const result: BatchResult<string> = { processed: [], failure: null }
  await Promise.all(items.map(async ({ itemKey, itemIds }) => {
    try {
      for (const itemId of itemIds) {
        await instance.items.delete(itemId)
      }
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

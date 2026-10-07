import pLimit from 'p-limit'
import type { SearchableContent } from './adapter'
import type { ItemMetadata } from './manifest'

export type { SearchableContent } from './adapter'

type BatchResult<T> = {
  processed: T[]
  failure: PromiseRejectedResult | null
}

export async function uploadSearchBatch<TContent, TMetadata extends ItemMetadata>({ uploader, docs }: {
  uploader: (item: SearchableContent<TContent>) => Promise<TMetadata>
  docs: SearchableContent<TContent>[]
}): Promise<BatchResult<TMetadata>> {
  const limit = pLimit({ concurrency: 10, rejectOnClear: true })
  const result: BatchResult<TMetadata> = { processed: [], failure: null }
  await Promise.allSettled(docs.map((input) => limit(async () => {
    try {
      console.log(`uploading ${input.itemKey}`)
      const item = await uploader(input)
      console.log(`uploaded ${input.itemKey}`)
      result.processed.push(item)
    } catch (reason) {
      console.error(reason)
      result.failure ??= { status: 'rejected', reason }
      limit.clearQueue()
    }
  })))
  return result
}

export async function deleteSearchBatch<TMetadata extends ItemMetadata>(
  deleter: (item: TMetadata) => Promise<void>,
  items: TMetadata[],
): Promise<BatchResult<TMetadata>> {
  const result: BatchResult<TMetadata> = { processed: [], failure: null }
  await Promise.all(items.map(async (item) => {
    try {
      await deleter(item)
      result.processed.push(item)
    } catch (reason) {
      console.error(reason)
      result.failure ??= { status: 'rejected', reason }
    }
  }))
  return result
}

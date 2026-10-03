/// <reference types="@cloudflare/workers-types" />
import pLimit from 'p-limit';
import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep, type WorkflowStepConfig } from 'cloudflare:workers'
import { NonRetryableError } from 'cloudflare:workflows'
import { SourceBuilder } from '@repo/datasource/build'
import { getDatasourceSlug, SourceSyncError, SourceWriteRepo, syncDatasource } from '@repo/source/sync'
import {
  createSearchItem,
  inactiveSearchSlot,
  parseSearchManifest,
  SEARCH_INSTANCES,
  sectionItemKey,
  type SearchItemInput,
  type SearchManifest,
} from '@repo/source/search'
import { datasources } from '../datasource/index.ts'
import type { SyncEnv, SyncParams } from './types.ts'
import { createDB } from '@repo/source'

const searchStepOptions: WorkflowStepConfig = {
  retries: { limit: 3, delay: '10 seconds', backoff: 'exponential' },
  timeout: '30 minutes',
}

const SEARCH_PAGE_SIZE = 100
const SEARCH_UPLOAD_BATCH_SIZE = 10
const SEARCH_DELETE_BATCH_SIZE = 50

function manifestKey(slot: 'a' | 'b'): string {
  return `search/manifests/v2/${slot}.json`
}

async function readManifest(env: SyncEnv, slot: 'a' | 'b'): Promise<SearchManifest | null> {
  const object = await env.SEARCH_MANIFESTS.get(manifestKey(slot))
  if (!object) return null
  return parseSearchManifest(await object.json<unknown>())
}

async function indexSearchSlot({ env, repo, runId, slot }: {
  env: SyncEnv
  repo: SourceWriteRepo
  runId: number
  slot: 'a' | 'b'
}): Promise<void> {
  const storedManifest = await readManifest(env, slot)
  const previous = storedManifest ?? { syncRunId: 0, items: {} }
  const instance = env.AI_SEARCH.get(SEARCH_INSTANCES[slot])
  const nextItems: Record<string, string> = {}
  let afterId = 0
  const limiter = pLimit(4);
  for (;;) {
    const sections = await repo.listSearchSections(runId, afterId, SEARCH_PAGE_SIZE)

    console.log(`upload section to search engine ${sections.length}`)
    if (sections.length === 0) break

    const additions: SearchItemInput[] = []
    for (const section of sections) {
      const key = sectionItemKey(section)
      const itemId = previous.items[key]
      if (itemId) nextItems[key] = itemId
      else additions.push(section)
    }
    const handleItem = async function (section: SearchItemInput) {
      const input = createSearchItem(section)
      const item = await instance.items.upload(input.key, input.content, {
        metadata: input.metadata,
      })
      nextItems[item.key] = item.id
    }
    const batch = additions.map((it) => limiter(() => handleItem(it)))
    await Promise.all(batch)
    afterId = sections[sections.length - 1]?.id ?? afterId
    if (sections.length < SEARCH_PAGE_SIZE) break
  }

  const removals = storedManifest
    ? Object.entries(previous.items).filter(([key]) => nextItems[key] === undefined)
    : []
  for (let start = 0; start < removals.length; start += SEARCH_DELETE_BATCH_SIZE) {
    const batch = removals.slice(start, start + SEARCH_DELETE_BATCH_SIZE)
    await Promise.all(batch.map(async ([key, itemId]) => {
      const { result } = await instance.items.list({ item_id: itemId, source: 'builtin', per_page: 1 })
      if (result.some((item) => item.id === itemId && item.key === key)) {
        await instance.items.delete(itemId)
      }
    }))
  }

  if (!storedManifest) {
    const stale: { id: string; key: string }[] = []
    for (let page = 1; ; page++) {
      const { result } = await instance.items.list({ page, per_page: 50, source: 'builtin' })
      stale.push(...result.filter((item) => nextItems[item.key] === undefined).map(({ id, key }) => ({ id, key })))
      if (result.length < 50) break
    }
    for (let start = 0; start < stale.length; start += SEARCH_DELETE_BATCH_SIZE) {
      await Promise.all(stale.slice(start, start + SEARCH_DELETE_BATCH_SIZE).map(({ id }) => instance.items.delete(id)))
    }
  }

  const next: SearchManifest = { syncRunId: runId, items: nextItems }
  await env.SEARCH_MANIFESTS.put(
    manifestKey(slot),
    JSON.stringify(next),
    { httpMetadata: { contentType: 'application/json' } },
  )
}

async function stopOnSyncError<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    if (error instanceof SourceSyncError) throw new NonRetryableError(error.message)
    throw error
  }
}

export class SourceSyncWorkflow extends WorkflowEntrypoint<SyncEnv, SyncParams> {
  async run(event: WorkflowEvent<SyncParams>, step: WorkflowStep) {
    const runId = event.payload.runId
    const db = createDB(this.env.DB)
    const repo = new SourceWriteRepo(db)

    try {
      const state = await step.do('start-run', () => stopOnSyncError(async () => {
        const run = await repo.getRun(runId)
        const slugs = datasources.map((source) => getDatasourceSlug(source.mountedPath))
        if (!run || JSON.stringify(run.datasourceIds) !== JSON.stringify(slugs)) {
          throw new SourceSyncError('The configured datasource set changed after the run was queued.')
        }
        if (run.status === 'succeeded') return 'succeeded'
        if (run.status === 'queued') await repo.startRun(runId)
        else if (run.status !== 'running') throw new SourceSyncError(`Sync run ${runId} cannot be started.`)
        return 'running'
      }))
      if (state === 'succeeded') return { runId, status: state }

      const results = []
      for (const [sortOrder, source] of datasources.entries()) {
        const result = await step.do(`sync-${source.id}`, {
          retries: { limit: 3, delay: '10 seconds', backoff: 'exponential' },
          timeout: '30 minutes',
        }, () => stopOnSyncError(async () => {
          const built = await new SourceBuilder(source).build()
          return syncDatasource(repo, runId, built, { sortOrder })
        }))
        results.push(result)
      }

      const head = await step.do('capture-search-head', () => repo.getHead())
      const slot = head?.searchSlot === 'a' ? 'b' : 'a'
      await step.do('index-search-slot', searchStepOptions, () => indexSearchSlot({
        env: this.env, repo, runId, slot,
      }))
      await step.do('publish-run', () => stopOnSyncError(() => repo.publishRun(runId, slot)))
      return { runId, status: 'succeeded', pages: results.reduce((count, result) => count + result.pages, 0) }
    } catch (error) {
      await step.do('fail-run', async () => {
        await repo.failRun(runId, error)
      })
      throw error
    }
  }
}

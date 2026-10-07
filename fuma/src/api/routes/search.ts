import {Hono} from "hono";
import {search, SearchReadRepo} from "@repo/source/search";
import {SyncRunRepo} from "@repo/source";
import {env} from "cloudflare:workers";
import {liteClient} from "algoliasearch/lite";
import {algoliaClient} from "fumadocs-core/search/client/algolia";
import {config} from "../../../config";

export const searchRoute = new Hono()
searchRoute.get('/search', async (c) => {
  c.header('Cache-Control', 'no-store')
  const q = c.req.queries('q')
  const _tag = c.req.queries('tag')
  if ((q?.length ?? 0) > 1 || (c.req.queries('tag')?.length ?? 0) > 1) {
    return c.json({ error: 'invalid_query' }, 400)
  }
  const tag = _tag ? _tag[0] : undefined
  const query = (c.req.query('q') ?? '').trim()
  if (Array.from(query).length > 256) return c.json({ error: 'invalid_query' }, 400)
  if (Array.from(query).length < 2) return c.json([])
  const repo = new SearchReadRepo(c.get('db'))
  const slot = await repo.getPublishedSearch()
  if(!slot || !slot.syncRunId || !slot.slot) return c.json([])

  const res = await  search(env.AI_SEARCH, { query, slot: slot.slot, tag })
  const results = res.chunks.map(chunk => ({
    id: chunk.id,
    url: chunk.item.metadata!.url as string,
    type: 'text',
    content: chunk.text,
  }))
  // const revisionIds = response.chunks.map(it => it.item.metadata!.revisionid as number)
  // const results = await repo.resolveSections(syncRunId, sectionIds)
  return c.json(results)
})

searchRoute.get('/search/algolia', async (c) => {
  c.header('Cache-Control', 'no-store')
  const queries = c.req.queries('q')
  const tags = c.req.queries('tag')
  const query = (queries?.[0] ?? '').trim()
  const tag = tags?.[0]

  if ((queries?.length ?? 0) > 1 || (tags?.length ?? 0) > 1
    || Array.from(query).length > 256
    || (tag !== undefined && !config.search.tags.some((item) => item.value === tag))) {
    return c.json({error: 'invalid_query'}, 400)
  }
  if (Array.from(query).length < 2) return c.json([])
  if (!env.ALGOLIA_APP_ID || !env.ALGOLIA_SEARCH_API_KEY) {
    return c.json({error: 'algolia_search_not_configured'}, 503)
  }

  try {
    const published = await new SyncRunRepo(c.get('db')).getHead()
    if (!published?.syncRunId || !published.searchSlot) return c.json([])

    const searchClient = algoliaClient({
      client: liteClient(env.ALGOLIA_APP_ID, env.ALGOLIA_SEARCH_API_KEY),
      indexName: published.searchSlot,
      tag,
    })
    return c.json(await searchClient.search(query))
  } catch (error) {
    console.error('Algolia search failed:', error instanceof Error ? error.message : 'Unknown error')
    return c.json({error: 'algolia_search_unavailable'}, 502)
  }
})

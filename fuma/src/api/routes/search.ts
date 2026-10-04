import {Hono} from "hono";
import {search, SearchReadRepo} from "@repo/source/search/file";
import {env} from "cloudflare:workers";

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
  if(!slot) return c.json([])
  const instance = env.AI_SEARCH.get(`mdark-file-dev-${slot.slot}`)
  // @ts-ignore
  const res = await  search(repo, instance, { syncRunId: slot.syncRunId, query, tag })
  return c.json(res)
})
import { env } from 'cloudflare:workers'
import {SourceReadRepo, type ISourceReadRepo, createDB} from '@repo/source'

let reader: ISourceReadRepo | undefined

/**
 * The read-only content database: D1 binding `DB` (cloudflare.config.ts) through drizzle-orm.
 * Lazy, because `vite build` has no bindings.
 */
export function getReader(): ISourceReadRepo {
  return (reader ??= new SourceReadRepo(createDB(env.DB)))
}

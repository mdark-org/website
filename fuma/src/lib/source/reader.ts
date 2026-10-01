import { env } from 'cloudflare:workers'
import { SourceReadRepo, type ISourceReadRepo } from '@repo/source'
import { relations } from '@repo/source'
import { drizzle } from 'drizzle-orm/d1'

let reader: ISourceReadRepo | undefined

/**
 * The read-only content database: D1 binding `DB` (cloudflare.config.ts) through drizzle-orm.
 * Lazy, because `vite build` has no bindings.
 */
export function getReader(): ISourceReadRepo {
  return (reader ??= new SourceReadRepo(drizzle((env as any).DB, { relations })))
}

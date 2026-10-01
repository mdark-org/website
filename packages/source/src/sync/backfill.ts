import type { SourceWriteRepo } from '../db/write.repo'
import { parsePageSections } from './sections'

/** Process one batch. A completed root row makes retries and concurrent backfills safe. */
export async function backfillPageSections(repo: SourceWriteRepo, options: { limit?: number } = {}) {
  const revisions = await repo.listRevisionsWithoutSections(options.limit ?? 25)
  let sectionCount = 0
  for (const revision of revisions) {
    const sections = await parsePageSections(revision)
    await repo.writePageSections(sections)
    sectionCount += sections.length
  }
  return { revisions: revisions.length, sections: sectionCount }
}

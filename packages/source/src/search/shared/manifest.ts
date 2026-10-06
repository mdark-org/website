import type { R2Bucket } from '@cloudflare/workers-types'
import { z } from 'zod'
export const slotManifestSchema = z.object({
  syncRunId: z.number().int().positive(),
  // itemId, itemKey
  items: z.array(z.object({
    itemId: z.string(),
    itemKey: z.string()
  })),
})

export const runManifestSchema = z.object({
  syncRunId: z.number().int().positive(),
  slot: z.string(),
  previousSlotRunId: z.number().int().positive().nullable(),
  // 需要写入的 itemKey
  upsert: z.array(z.string()),
  // 需要移除的 itemId
  delete: z.array(z.object({
    itemKey: z.string(),
    itemId: z.string(),
  })),
})

export const runCheckpointSchema = z.object({
  upserted: z.array(z.object({
    itemKey: z.string(),
    itemId: z.string(),
  })),
  // itemId
  removed: z.array(z.string()),
})

export type SlotManifest = z.infer<typeof slotManifestSchema>
export type RunManifest = z.infer<typeof runManifestSchema>
export type RunCheckpoint = z.infer<typeof runCheckpointSchema>
export type IndexPlan = Pick<RunManifest, 'upsert' | 'delete'>
export class ManifestStore {
  constructor(private readonly r2: R2Bucket, private slot: string, private runId: number) {

  }

  async readSlotManifest() {
    const object = await this.r2.get(`search/manifests/v2/${this.slot}.json`)
    if (!object) return null
    const body = await object.json<unknown>()
    return slotManifestSchema.parse(body)
  }

  async readRunManifest() {
    const object = await this.r2.get(`search/builds/${this.runId}/${this.slot}/manifest.json`)
    if (!object) return null
    const body = await object.json<unknown>()
    return runManifestSchema.parse(body)
  }

  async saveRunManifest(content: RunManifest) {
    await this.r2.put(`search/builds/${this.runId}/${this.slot}/manifest.json`, JSON.stringify(content), {
      httpMetadata: { contentType: 'application/json' },
    })
  }

  async saveManifest(content: SlotManifest) {
    await this.r2.put(`search/manifests/v2/${this.slot}.json`, JSON.stringify(content), {
      httpMetadata: { contentType: 'application/json' },
    })
  }

  async saveCheckpoint(content: RunCheckpoint) {
    const key = `search/builds/${this.runId}/${this.slot}/checkpoint.json`
    await this.r2.put(key, JSON.stringify(content), {
      httpMetadata: { contentType: 'application/json' },
    })
  }

  async readCheckpoint() {
    const key = `search/builds/${this.runId}/${this.slot}/checkpoint.json`
    const object = await this.r2.get(key)
    if (object) return runCheckpointSchema.parse(await object.json<unknown>())
    return null
  }
}

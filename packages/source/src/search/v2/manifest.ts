import type { R2Bucket } from '@cloudflare/workers-types'
import { z } from 'zod'
export const slotManifestV2Schema = z.object({
  syncRunId: z.number().int().positive(),
  // itemId, itemKey
  items: z.array(z.object({
    itemIds: z.string().array(),
    itemKey: z.string()
  })),
})

export const runManifestV2Schema = z.object({
  syncRunId: z.number().int().positive(),
  slot: z.string(),
  previousSlotRunId: z.number().int().positive().nullable(),
  // 需要写入的 itemKey
  upsert: z.array(z.string()),
  // 需要移除的 itemId
  delete: z.array(z.object({
    itemKey: z.string(),
    itemIds: z.string().array(),
  })),
})

export const runCheckpointV2Schema = z.object({
  upserted: z.array(z.object({
    itemKey: z.string(),
    itemIds: z.string().array(),
  })),
  // itemId
  removed: z.array(z.string()),
})

export type SlotManifestV2 = z.infer<typeof slotManifestV2Schema>
export type RunManifestV2 = z.infer<typeof runManifestV2Schema>
export type RunCheckpointV2 = z.infer<typeof runCheckpointV2Schema>
export type IndexPlanV2 = Pick<RunManifestV2, 'upsert' | 'delete'>
export class ManifestStoreV2 {
  constructor(private readonly r2: R2Bucket, private slot: string, private runId: number) {

  }

  async readSlotManifest() {
    const object = await this.r2.get(`search/v2/manifests/${this.slot}.json`)
    if (!object) return null
    const body = await object.json<unknown>()
    return slotManifestV2Schema.parse(body)
  }

  async readRunManifest() {
    const object = await this.r2.get(`search/v2/builds/${this.runId}/${this.slot}/manifest.json`)
    if (!object) return null
    const body = await object.json<unknown>()
    return runManifestV2Schema.parse(body)
  }

  async saveRunManifest(content: RunManifestV2) {
    await this.r2.put(`search/v2/builds/${this.runId}/${this.slot}/manifest.json`, JSON.stringify(content), {
      httpMetadata: { contentType: 'application/json' },
    })
  }

  async saveManifest(content: SlotManifestV2) {
    await this.r2.put(`search/v2/manifests/v2/${this.slot}.json`, JSON.stringify(content), {
      httpMetadata: { contentType: 'application/json' },
    })
  }

  async saveCheckpoint(content: RunCheckpointV2) {
    const key = `search/v2/builds/${this.runId}/${this.slot}/checkpoint.json`
    await this.r2.put(key, JSON.stringify(content), {
      httpMetadata: { contentType: 'application/json' },
    })
  }

  async readCheckpoint() {
    const key = `search/v2/builds/${this.runId}/${this.slot}/checkpoint.json`
    const object = await this.r2.get(key)
    if (object) return runCheckpointV2Schema.parse(await object.json<unknown>())
    return null
  }
}

import { z } from 'zod'

export type ItemMetadata = {
  itemKey: string
}

export type SlotManifestV2<TMetadata extends ItemMetadata = ItemMetadata> = {
  syncRunId: number
  items: TMetadata[]
}

export type RunManifestV2<TMetadata extends ItemMetadata = ItemMetadata> = {
  syncRunId: number
  slot: string
  previousSlotRunId: number | null
  upsert: string[]
  delete: TMetadata[]
}

export type RunCheckpointV2<TMetadata extends ItemMetadata = ItemMetadata> = {
  removed: string[]
  upserted: TMetadata[]
}

export type IndexPlanV2<TMetadata extends ItemMetadata = ItemMetadata> = Pick<RunManifestV2<TMetadata>, 'upsert' | 'delete'>

export type ManifestBucket = {
  get(key: string): Promise<{ json(): Promise<unknown> } | null>
  put(key: string, value: string, options: { httpMetadata: { contentType: string } }): Promise<unknown>
}

function createManifestSchemas<TMetadata extends ItemMetadata>(itemMetadataSchema: z.ZodType<TMetadata>) {
  return {
    slotManifest: z.object({
      syncRunId: z.number().int().positive(),
      items: z.array(itemMetadataSchema),
    }),
    runManifest: z.object({
      syncRunId: z.number().int().positive(),
      slot: z.string(),
      previousSlotRunId: z.number().int().positive().nullable(),
      upsert: z.array(z.string()),
      delete: z.array(itemMetadataSchema),
    }),
    checkpoint: z.object({
      upserted: z.array(itemMetadataSchema),
      removed: z.array(z.string()),
    }),
  }
}

const defaultManifestSchemas = createManifestSchemas(z.object({ itemKey: z.string() }).catchall(z.unknown()))

export const slotManifestV2Schema = defaultManifestSchemas.slotManifest
export const runManifestV2Schema = defaultManifestSchemas.runManifest
export const runCheckpointV2Schema = defaultManifestSchemas.checkpoint

export class ManifestStoreV2<TMetadata extends ItemMetadata> {
  private readonly schemas

  constructor(
    private readonly r2: ManifestBucket,
    private readonly slot: string,
    private readonly runId: number,
    itemMetadataSchema: z.ZodType<TMetadata>,
  ) {
    this.schemas = createManifestSchemas(itemMetadataSchema)
  }

  async readSlotManifest(): Promise<SlotManifestV2<TMetadata> | null> {
    const object = await this.r2.get(`search/v2/manifests/${this.slot}.json`)
    if (!object) return null
    return this.schemas.slotManifest.parse(await object.json())
  }

  async readRunManifest(): Promise<RunManifestV2<TMetadata> | null> {
    const object = await this.r2.get(`search/v2/builds/${this.runId}/${this.slot}/manifest.json`)
    if (!object) return null
    return this.schemas.runManifest.parse(await object.json())
  }

  async saveRunManifest(content: RunManifestV2<TMetadata>) {
    await this.r2.put(`search/v2/builds/${this.runId}/${this.slot}/manifest.json`, JSON.stringify(content), {
      httpMetadata: { contentType: 'application/json' },
    })
  }

  async saveManifest(content: SlotManifestV2<TMetadata>) {
    await this.r2.put(`search/v2/manifests/${this.slot}.json`, JSON.stringify(content), {
      httpMetadata: { contentType: 'application/json' },
    })
  }

  async saveCheckpoint(content: RunCheckpointV2<TMetadata>) {
    const key = `search/v2/builds/${this.runId}/${this.slot}/checkpoint.json`
    await this.r2.put(key, JSON.stringify(content), {
      httpMetadata: { contentType: 'application/json' },
    })
  }

  async readCheckpoint(): Promise<RunCheckpointV2<TMetadata> | null> {
    const key = `search/v2/builds/${this.runId}/${this.slot}/checkpoint.json`
    const object = await this.r2.get(key)
    if (object) return this.schemas.checkpoint.parse(await object.json())
    return null
  }
}

import {z} from "zod";
import parser from 'any-date-parser'

const metaPreprocess = (x: any) => {
  if(x.date !== undefined) {
    try {
      if(!Number.isNaN(Number(x.date)) && String(x.date).length === 10) {
        x.date  = parser.fromAny(Number(x.date) * 1000)
      }
      x.date = parser.fromAny(x.date)
    }catch (e) {
      x.date = new Date(NaN)
    }
  }
  if(x.tag && !x.tags) {
    x.tags = x.tag
  }
  return x
}

export const metaSchema = z.preprocess(metaPreprocess, z.object({
  rss: z.coerce.boolean().optional(),
  date: z.coerce.date().optional(),
  title: z.coerce.string(),
  description: z.coerce.string().optional(),
  tags: z.string().array().optional(),
  bvid: z.coerce.string().optional(),
  ytid: z.coerce.string().optional(),
  wbid: z.coerce.string().optional(),
  xgid: z.coerce.string().optional(),
  content: z.coerce.string().optional()
}))


export const pageSchema = z.object({
  url: z.string(),
  sourceKey: z.string().optional(),
  name: z.string(),
  title: z.string(),
  type: z.literal('page'),
  external: z.coerce.boolean().optional(),
  data: metaSchema.optional(),
  github: z.object({
    owner: z.string(),
    repo: z.string(),
    sha: z.string(),
    path: z.string()
  }).optional(),
}).catchall(z.any())

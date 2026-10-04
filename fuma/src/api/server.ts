import { createDB, DB } from "@repo/source";
import {Hono} from "hono";
import {env} from 'cloudflare:workers'
import {searchRoute} from "@/api/routes/search.ts";
import {syncApp} from "../../sync/http.ts";

declare global {
  namespace Cloudflare {
    interface Env {
      DB: D1Database
      AI_SEARCH: AiSearchNamespace
      SYNC_WORKFLOW: Workflow
      SYNC_TOKEN: string
      BASE_URL: string
      GOOGLE_CLIENT_ID: string
      GOOGLE_CLIENT_SECRET: string
    }
  }
}
declare module 'hono' {
  interface ContextVariableMap {
    db: DB
    AI_SEARCH: AiSearchNamespace
  }
}


const app = new Hono().basePath('/api');

app.use(async (c, next) => {
  c.set('db', createDB(env.DB))
  await next();
})


app.route('/', searchRoute)
app.route('/', syncApp)

export default app;
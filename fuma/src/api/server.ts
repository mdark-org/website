import { createDB, DB } from "@repo/source";
import {Hono} from "hono";
import {env} from 'cloudflare:workers'
import {searchRoute} from "@/api/routes/search.ts";
import {sync} from "../api/routes/sync.ts";
import {createAuth} from "@/lib/auth.ts";
import {uploadHandler} from "@/lib/uploadthing.ts";

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

app.on(["POST", "GET"], "/api/auth/*", (c) => {
  return createAuth().handler(c.req.raw);
});
app.route('/', searchRoute)
app.route('/', sync)
app.all("/api/uploadthing", (context) => uploadHandler(context.req.raw));

export default app;
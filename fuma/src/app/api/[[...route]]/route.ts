
import { handle } from 'hono/vercel'
import app from "@/api/server.ts";

export const GET = handle(app)
export const POST = handle(app)
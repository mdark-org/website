import {createAuth} from "@/lib/auth";
import { Hono } from "hono";
import { handle } from "hono/vercel";

const app = new Hono();

app.on(["POST", "GET"], "/api/auth/*", (c) => {
  return createAuth().handler(c.req.raw);
});

export const GET = handle(app);
export const POST = handle(app);
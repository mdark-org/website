import { Hono } from "hono";
import { HonoComment } from "@fuma-comment/server/hono";
import { createDrizzleAdapter } from "@fuma-comment/server/adapters/drizzle";
import { createBetterAuthAdapter } from "@fuma-comment/server/adapters/better-auth";
import { comments, rates, roles, users } from "@/lib/db/d1";
import { createAuth } from "@/lib/auth";
import { createDB } from "@/lib/db/db";

export function createComments() {
  const app = new Hono({ strict: false });
  HonoComment({
    app,
    baseUrl: "/api",
    auth: createBetterAuthAdapter(createAuth()),
    storage: createDrizzleAdapter({
      db: createDB(),
      schemas: { user: users, comments, rates, roles },
      auth: "better-auth",
    }),
  });
  return app;
}

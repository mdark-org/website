import { Hono } from "hono";
import { HonoComment } from "@fuma-comment/server/hono";
import { createDrizzleAdapter } from "@fuma-comment/server/adapters/drizzle";
import { createBetterAuthAdapter } from "@fuma-comment/server/adapters/better-auth";
import * as d1Table from "@/lib/db/d1";
import * as pgTable from "@/lib/db/pg";
import { createAuth } from "@/lib/auth";
import { createDB, getDbBackend } from "@/lib/db/db";

export function createComments() {
  const app = new Hono({ strict: false });
  const table = getDbBackend() === "d1" ? d1Table : pgTable;
  HonoComment({
    app,
    baseUrl: "/api",
    auth: createBetterAuthAdapter(createAuth()),
    storage: createDrizzleAdapter({
      db: createDB(),
      schemas: {
        user: table.users,
        comments: table.comments,
        rates: table.rates,
        roles: table.roles,
      },
      auth: "better-auth",
    }),
  });
  return app;
}

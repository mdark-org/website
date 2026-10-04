import { NextComment } from "@fuma-comment/server/next";
import { createDrizzleAdapter } from "@fuma-comment/server/adapters/drizzle";
import {comments, createDB, rates, roles, users} from "@/lib/db/d1/index.ts";
import { createBetterAuthAdapter } from "@fuma-comment/server/adapters/better-auth";
import { createAuth } from "@/lib/auth";


export const createCommentRoute = () => {
  const db = createDB()
  const auth = createBetterAuthAdapter(createAuth())
  const storage = createDrizzleAdapter({
    db,
    schemas: { user: users, comments, rates, roles },
    auth: 'better-auth',
  });

  return NextComment({
    auth: auth,
    storage,
  });
}
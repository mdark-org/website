import { NextRequest } from 'next/server'
import { NextComment } from "@fuma-comment/server/next";
import { createDrizzleAdapter } from "@fuma-comment/server/adapters/drizzle";
import {comments, rates, roles, users} from "@/lib/db/d1/index.ts";
import { createBetterAuthAdapter } from "@fuma-comment/server/adapters/better-auth";
import { createAuth } from "@/lib/auth";
import {createDB } from "@/lib/db/db";


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

const route = createCommentRoute()

export async function GET(_req: NextRequest, context: { params: Promise<{ comment?: string[] | undefined; }> }) {
  // @ts-ignore
  return route.GET(_req, context)
}

export async function DELETE(_req: NextRequest, context: { params: Promise<{ comment?: string[] | undefined; }> }) {
  // @ts-ignore
  return route.DELETE(_req, context)
}

export async function PATCH(_req: NextRequest, context: { params: Promise<{ comment?: string[] | undefined; }> }) {
  // @ts-ignore
  return route.PATCH(_req, context)
}

export async function POST(_req: NextRequest, context: { params: Promise<{ comment?: string[] | undefined; }> }) {
  // @ts-ignore
  return route.POST(_req, context)
}

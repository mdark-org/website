import { createCommentRoute } from '@/comment'


import { NextRequest } from 'next/server'
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

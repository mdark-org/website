import {source} from "@/lib/source";

export const revalidate = 3600;

export async function GET(request: Request) {
  const feed = await source.generateRSS()
  if(!feed) {
    return new Response('404 not found', {
      headers: { 'content-type': 'text/plain' },
      status: 404
    })
  }
  return new Response(feed.rss2(), {
    headers: {
      'content-type': 'application/xml',
    },
  })
}

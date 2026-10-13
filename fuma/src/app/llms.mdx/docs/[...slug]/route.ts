import { source } from '@/lib/source';
// 3600 x 24 x 3
export const revalidate = 259200;

export async function GET(_request: Request, context: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await context.params;
  const page = await source.getPageBySlug(['docs', ...slug]);
  if (!page) {
    return new Response('Document not found', { status: 404 });
  }

  return new Response(page.content ?? '', {
    headers: { 'content-type': 'text/markdown; charset=utf-8' },
  });
}

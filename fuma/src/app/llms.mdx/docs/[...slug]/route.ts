import { source } from '../../../../lib/source/index.ts';

export const revalidate = 600;

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

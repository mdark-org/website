import { NextResponse } from 'next/server';
import { source } from '@/lib/source';
import { structure } from 'fumadocs-core/mdx-plugins';

export const revalidate = 3600;

export async function GET(): Promise<Response> {
  const pages = await source.getContentPages({ content: true });
  const results = await Promise.all(
    pages.flatMap(async (page) => {
      const structuredData = structure(page.data?.content!);
      const getHeading = (it?: string) => structuredData.headings.find(heading => heading.id === it)
      return structuredData.contents.map((it, idx) => ({
        id: `${page.url}-${idx + 1}`,
        page_id: page.url,
        section_id: it.heading,
        section: getHeading(it.heading)?.content,
        tag: page.url.split('/')?.[1],
        url: page.url,
        title: page.data!.title,
        content: it.content,
        description: page.data!.description,
      }))
    }),
  );
  const res = results.flat()
  return NextResponse.json(res);
}
import { source } from "@/lib/source";
import type { Metadata } from "next";
import { DocsPage, DocsDescription, DocsTitle, DocsBody } from 'fumadocs-ui/layouts/docs/page';
import { notFound, redirect } from 'next/navigation'
import defaultMdxComponents from "fumadocs-ui/mdx";
import Video from '@/app/docs/[[...slug]]/video'
import { Comments } from '@/components/comment.tsx'
import { config } from '../../../../config'
import { renderMarkdown } from '@/lib/markdown';
import {ImageZoom} from "@/components/image-zoom.tsx";

export default async function Page(props: {
  params: Promise<{ slug?: string[] }>;
}) {

  const params = await props.params;
  const slugs = params.slug?.map(it => decodeURIComponent(it));
  if(slugs == undefined || slugs.length == 0) {
    const first = await source.getFirstPage()
    if (!first) notFound();
    return redirect(encodeURI(first.url));
  }
  const page = await source.getPageBySlug(['docs',...slugs])
  if (!page) notFound();
  if (page.url !== `/docs/${slugs.join('/')}`) redirect(encodeURI(page.url));
  const compiled = await renderMarkdown(page.data?.content ?? '', {
    ...defaultMdxComponents,
    img: ({ src, alt, ...props }) => typeof src === 'string'
      ? <ImageZoom {...props} src={src} alt={alt ?? ''} width={800} height={400} />
      : null,
  });
  return (
    <DocsPage
      // editOnGithub={page.github}
      toc={compiled.toc}
      tableOfContent={{enabled: false}}
      footer={{
        enabled: true,
        component: <>
          {config.enableComment && <Comments page={page.data!.bvid!}/>}
        </>
      }}
    >
      <DocsTitle>{page.data!.title}</DocsTitle>
      <DocsDescription>{page.data!.description}</DocsDescription>
      <DocsBody>
        { (page.data!.bvid || page.data!.ytid || page.data!.wbid || page.data!.xgid) &&
          <Video
            bvid={page.data!.bvid}
            ytid={page.data!.ytid}
            wbid={page.data!.wbid}
            xgid={page.data!.xgid}
            className={"rounded-md m-3"}
            iframeClassname={"rounded-md"}
          />
        }
        {compiled.body}
      </DocsBody>

      </DocsPage>
  );
}


// Content lives in D1 and is synced out-of-band: render on demand, cache, refresh in the background.
export const revalidate = 600;
export const dynamicParams = true;

// Nothing is prerendered at build time (there is no D1 binding during `vite build`).
export async function generateStaticParams() {
  return []
}

export async function generateMetadata(props: {
  params: Promise<{ slug?: string[] }>;
}) {
  const params = await props.params;
  const slugs = params.slug?.map(it => decodeURIComponent(it));
  if(slugs == undefined || slugs.length == 0) {
    const first = await source.getFirstPage()
    if (!first) notFound();
    return redirect(encodeURI(first.url));
  }
  const [page, datasource] = await Promise.all([
    source.getPageMetaBySlug(['docs', ...slugs]),
    source.getDatasourceBySlug(['docs', ...slugs]),
  ]);
  if (!page) notFound();
  if (page.url !== `/docs/${slugs.join('/')}`) redirect(encodeURI(page.url));
  const icons = {
      icon: [{
          url: datasource?.icon ? `${config.baseUrl}${datasource.icon}` : `${config.baseUrl}/favicon.ico`,
        }]
    }
  if(!page.data) {
    return {
      icons: icons,
      title: page.title,
      description: 'MDARK',
      keywords: ['MDARK','mdark','markdown-archive'],
    } satisfies Metadata;
  }
  return {
    title: page.data.title,
    description: page.data.description,
    icons: icons,
    keywords: [
      page.data.title,
      ...(page.data.tags ?? []),
      ...(datasource?.name ? [datasource.name] : []),
      'MDARK',
      'mdark',
      'markdown-archive'
      ],
    openGraph: {
      title: page.data.title,
      description: page.data.description,
      url: `${config.baseUrl}${page.url}`,
      type: 'article',
    },

  } satisfies Metadata;
}

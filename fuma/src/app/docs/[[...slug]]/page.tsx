import { source } from "@/lib/source";
import type { Metadata } from "next";
import {
  DocsPage,
  DocsBody,
  DocsTitle,
  DocsDescription,
} from "fumadocs-ui/page";
import { notFound, redirect } from 'next/navigation'
import defaultMdxComponents from "fumadocs-ui/mdx";
import Video from '@/app/docs/[[...slug]]/video'
import { Comments } from '@/comment/comment'
import { config } from '../../../../config'
import { createCompiler } from '@fumadocs/mdx-remote';
import {ImageZoom} from "@/components/image-zoom.tsx";


const compiler = createCompiler({
  remarkImageOptions: false,
})
export const dynamic = 'force-static'
export default async function Page(props: {
  params: Promise<{ slug?: string[] }>;
}) {
  const params = await props.params;
  const slugs = params.slug?.map(it => decodeURIComponent(it));
  let page = await source.getPageBySlug(['docs',...slugs ?? []])
  if(slugs == undefined || slugs.length == 0) {

    page = await source.getFirstPage()
    return redirect(encodeURI(page!.url));
  }
  console.log(`compiling: ${page?.name}`)
  const compiled = await compiler.compile({
    source: page?.data?.content ?? ''
  });
  const MdxContent = compiled.body;
  if (!page) notFound();
  return (
    <DocsPage
      editOnGithub={page.github}
      toc={compiled.toc}
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
        <MdxContent
          components={{
            ...defaultMdxComponents,
            img: (props) => <ImageZoom width={800} height={400} {...(props as any)} />,
          }}
        />
      </DocsBody>

    </DocsPage>
  );
}


export const revalidate = false;
export const dynamicParams = true;

export async function generateStaticParams() {
  const res = await source.generateParams();
  const slugs = res.map(it => ({slug: it.slug.slice(1)}))
    .slice(0, 30)
  return [...slugs, { slug: [] }]
}

export async function generateMetadata(props: {
  params: Promise<{ slug?: string[] }>;
}) {
  const params = await props.params;
  const slugs = params.slug?.map(it => decodeURIComponent(it));
  let page = await source.getPageBySlug(['docs', ...slugs ?? []]);
  if(slugs == undefined || slugs.length == 0) {
    // @ts-ignore
    page = await source.getFirstPage()
    return redirect(encodeURI(page!.url));
  }
  if (!page) notFound();


  const datasource = source.getDatasourceBySlug(['docs', ...slugs ?? []])
  const icons = {
      icon: [{
          url: datasource?.datasourceInfo?.icon ? `${config.baseUrl}${datasource?.datasourceInfo?.icon}` : `${config.baseUrl}/favicon.ico`,
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
      ...(datasource?.datasourceInfo?.name ? [datasource?.datasourceInfo?.name] : []), 
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

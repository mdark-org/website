import { Feed, type FeedOptions } from 'feed'
import type { DatasourceInfo, ISourceReadRepo } from '@repo/source'
import { config } from '@/config'
import { parserAsDate } from '@/lib/date'
import {renderMarkdownRSS} from "@/lib/markdown.ts";

export function generateRssFeed(category: string, feedOption?: Partial<FeedOptions>) {
  const site = config.baseUrl
  return new Feed({
    title: config.feed?.title ?? `${config.title} | RSS Feed`,
    description: config.feed?.description ?? `${category} RSS feed | mdark.org`,
    id: config.feed?.id ?? site,
    link: config.feed?.link ?? site,
    language: config.feed?.language ?? 'zh-CN',
    image: config.feed?.image ?? `${site}/logo.png`,
    favicon: config.feed?.favicon ?? `${site}/favicon.ico`,
    copyright: config.feed?.copyright,
    ...feedOption,
  })
}

function datasourceFeed(info: DatasourceInfo, baseUrl: string) {
  return new Feed({
    title: `${info.name} | RSS Feed`,
    description: info.description,
    id: info.name ?? baseUrl,
    link: baseUrl,
    language: 'zh-CN',
    image: `${baseUrl}${info.icon}`,
    favicon: `${baseUrl}${info.icon ?? '/favicon.ico'}`,
    copyright: `All rights reserved ${new Date().getFullYear()}`,
  })
}

export async function collectRssItems(reader: ISourceReadRepo, info: DatasourceInfo, baseUrl: string, limit = 30) {
  const items = await reader.listPages({ datasourceId: info.id, rss: true, limit }, { content: true })
  return Promise.all(
    items.map(async (p) => ({
      id: p.data!.bvid!,
      date: parserAsDate(p.data?.date) ?? new Date(0),
      title: p.data!.title,
      description: p.data!.description ?? '',
      link: `${baseUrl}${p.url}`,
      content: (await renderMarkdownRSS(p.content!)).body,
    })),
  )
}

export async function buildDatasourceFeed(reader: ISourceReadRepo, info: DatasourceInfo, baseUrl: string) {
  const feed = datasourceFeed(info, baseUrl)
  const rssItems = await collectRssItems(reader, info, baseUrl, 30)
  // @ts-ignore
  rssItems.forEach((it) => feed.addItem(it))
  return feed
}

export async function buildSiteFeed(reader: ISourceReadRepo, baseUrl: string) {
  const feed = generateRssFeed('')
  const datasources = await reader.listDatasource()
  const items = (await Promise.all(datasources.map((d) => collectRssItems(reader, d, baseUrl, 30)))).flat()
  items.sort((a, b) => b.date.getTime() - a.date.getTime())
  // @ts-ignore
  items.forEach((it) => feed.addItem(it))
  return feed
}

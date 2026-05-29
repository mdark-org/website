import sources from ".source/generated/index.mjs";
import {DataSource} from "@repo/datasource/source";
import { Root } from "@repo/datasource/shared";
import {icons} from "lucide-react";
import {createElement} from "react";
import {Feed, FeedOptions} from "feed";
import {config} from "../../../config";
import {datasourceSchema} from "@/lib/source/schema.ts";
import * as parser from 'any-date-parser'
const icon = (icon: any) => {
  if (!icon) return
  if (icon in icons) return createElement(icons[icon as keyof typeof icons])
  return createElement('img', {src: icon, className: 'w-5 h-5'})
}

export function generateRssFeed(category: string, feedOption?: Partial<FeedOptions>) {
  const site = config.baseUrl
  const feedOptions = {
    title: config.feed?.title ?? `${config.title} | RSS Feed`,
    description: config.feed?.description ?? `${category} RSS feed powered by Auto2Doc`,
    id: config.feed?.id ??  site,
    link: config.feed?.link ?? site,
    language: config.feed?.language ?? "zh-CN",
    image: config.feed?.image ?? `${site}/logo.png`,
    favicon: config.feed?.favicon ?? `${site}/favicon.ico`,
    copyright: config.feed?.copyright ?? 'Auto2Doc',
    ...feedOption,
  };
  const feed = new Feed(feedOptions);
  return feed;
}

export const buildSource = () => {
  const source = sources
  const base = { name: 'root', children: [] as Root[] }

  const keys = Object.keys(source)
  const datasources =keys
    .map(key => datasourceSchema.parse(source[key]))
  .map(it => new DataSource(it.pageTree, it.pageMap, it.datasourceInfo))
  datasources.forEach(it => {
    it.pageTree.icon = icon(it.pageTree.icon)
    base.children.push(it.pageTree)
  })
  return {
    tree: base,
    getPageBySlug: async (slug: string[] | undefined) => {
      const pages = await Promise.all(datasources.map(it => it.getPageBySlug(slug)))
      const page = pages.find(it => it !== null)
      return page
    },
    getPages: async () => {
      const res =  await Promise.all(datasources.flatMap(it => it.getPages()))
      return res.flat()
    },
    getDatasourceAndLatestPages: async (count: number = 5) => {
      const datasourceToRecentCollection = async (datasource: DataSource, count: number) => {
        const all = await datasource.getPages()
        const pages = all.sort((a,b) => dateComparator(b.data?.date,a.data?.date)).slice(0, count)
        return {
          name: datasource.pageTree.title,
          url: datasource.pageTree.url,
          icon: datasource.pageTree.icon,
          description: datasource.pageTree.description,
          latestPages: pages
        }
      }
      return Promise.all(datasources.map(it => datasourceToRecentCollection(it, count)))
    },
    getRecentPages: async (count: number = 20) => {
      const res = await Promise.all(datasources.flatMap(it => it.getPages()))
      const pages = res.flat().sort((a,b) => dateComparator(b.data?.date,a.data?.date)).slice(0, count)
      return pages
    },
    getFirstPage: async () => {
      const res =  await Promise.all(datasources.flatMap(it => it.getFirstPages()))
      return res[0]
    },

    getContentPages: async () => {
      const res =  await Promise.all(datasources.flatMap(it => it.getPages()))
      return res.flat().filter(it => it && !it.external)
    },
    generateParams: async () => {
      const pages = await Promise.all(datasources.flatMap(it => it.generateStaticParams()))
      const res = pages.flatMap(it => it)
      return res
    },
    generateRSS: async(category?: string) => {
      if(category) {
        const datasource = datasources.find(it => it.pageTree.url === `/docs/${category}`)
        if(datasource) {
          return datasource.buildRSS(config.baseUrl)
        }
        return null
      }

      const feed = generateRssFeed('')
      const rssItems =await Promise.all(datasources.map(it => it.collectRssItem(config.baseUrl, 30)))
        .then(res => res.flat())
      rssItems.sort((a,b) => dateComparator(b.date,a.date))
      rssItems.forEach(it => feed.addItem(it))
      return feed
    },
    getDatasourceBySlug: (slug: string[]) => {
      const url = `/${slug.join('/')}`
      return datasources.find(it => url.startsWith(it.pageTree.url))
    }
  }
}
const zero = new Date(0)
const dateComparator = (a?: Date, b?: Date) => {
  return parserAsDate(a, zero).getTime() - parserAsDate(b, zero).getTime()
}
export const parserAsDate = <T = null>(x: Date|string | undefined | null, fallback: T | null= null): Date | T => {
  if(typeof x === 'string') {
    return parser.fromString(x)
  }
  if(x === undefined || x === null) return fallback ?? new Date(0) as T
  return x
}

export const source = buildSource()
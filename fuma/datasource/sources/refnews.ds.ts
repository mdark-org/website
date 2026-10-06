import {addRSSPage, indexFolderTransformer} from "../transformer.ts";
import {type Context} from "../shared.ts";
import {type DatasourceCreator} from "@repo/source/builder";

const refnews : DatasourceCreator<'github'>= (ctx: Context) => ({
  id: 'btnews_refnews',
  slug: 'refnews',
  name: '参考信息',
  description: "资讯连连看，消灭信息差",
  mountedPath: '/docs/refnews',
  category: [],
  icon: "/image/refnews.png",
  provider: {
    type: 'unstorage',
    driver: 'github' as const,
    options: { repo: "mdark-org/btnews", branch: "master", dir: "/docs/btnews/refnews", token: ctx.env.GITHUB_TOKEN },
    includes: ['*.md', '*.mdx'],
  },
  github: { repo: "mdark-org/btnews", branch: "master", dir: "/docs/btnews/refnews" },
  transformers: {
    root: [
      addRSSPage(`${ctx.env.BASE_URL}/rss/refnews`),
      indexFolderTransformer
    ],
    folder:[ indexFolderTransformer ]
  }
})

export default refnews
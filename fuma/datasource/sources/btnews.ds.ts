import {addRSSPage, indexFolderTransformer} from "../transformer.ts";
import type {Context} from "../shared.ts";


export default (ctx: Context) => ({
  id: 'btnews_btnews',
  slug: 'btnews',
  name: '睡前消息',
  description: "热河省蛮子，刘亦菲粉丝",
  mountedPath: '/docs/btnews',
  category: [],
  icon: "/image/btnews.png",
  provider: {
    type: 'unstorage',
    driver: 'github' as const,
    options: { repo: "mdark-org/btnews", branch: "master", dir: "/docs/btnews/btnews", token: ctx.env.GITHUB_TOKEN },
    includes: ['*.md', '*.mdx'],
  },
  github: { repo: "mdark-org/btnews", branch: "master", dir: "/docs/btnews/btnews" },
  transformers: {
    root: [ addRSSPage(`${ctx.env.BASE_URL}/rss/btnews`), indexFolderTransformer ],
    folder:[ indexFolderTransformer ]
  }
})
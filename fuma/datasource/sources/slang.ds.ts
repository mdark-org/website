import {addRSSPage, indexFolderTransformer} from "../transformer.ts";
import {type Context} from "../shared.ts";

export default (ctx: Context) => ({
  id: 'btnews_slang',
  slug: 'slang',
  name: '讲点黑话',
  description: "讲点黑话",
  mountedPath: '/docs/slang',
  category: [],
  icon: "/image/slang.png",
  provider: {
    type: 'unstorage',
    driver: 'github' as const,
    options: { repo: "mdark-org/btnews", branch: "master", dir: "/docs/btnews/slang", token: ctx.env.GITHUB_TOKEN },
    includes: ['*.md', '*.mdx'],
  },
  github: { repo: "mdark-org/btnews", branch: "master", dir: "/docs/btnews/slang" },
  transformers: {
    root: [
      addRSSPage(`${ctx.env.BASE_URL}/rss/slang`),
      indexFolderTransformer
    ],
      folder:[ indexFolderTransformer ]
  }
})
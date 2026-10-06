import type {Context} from "../shared.ts";
import {addRSSPage, dateFolderTransformer} from "../transformer.ts";

export default (ctx: Context) => ({
  id: 'archive_koala_oss',
  mountedPath: '/docs/koala-oss',
  slug: 'koala-oss',
  category: [],
  name: 'Koala聊开源',
  icon: "/image/koala.png",
  description: "了解科技资讯、把握行业脉搏。每周快速浏览 Hacker News 精选。",
  provider: {
    type: 'unstorage',
    driver: 'github' as const,
    options: { repo: "mdark-org/bili-koala-oss", branch: "main", dir: "/docs/Koala聊开源", token: ctx.env.GITHUB_TOKEN },
    includes: ['*.md', '*.mdx'],
  },
  github: { repo: "mdark-org/bili-koala-oss", branch: "main", dir: "/docs/Koala聊开源" },
  transformers: {
    root: [ addRSSPage(`${ctx.env.BASE_URL}/rss/koala-oss`), dateFolderTransformer ],
    folder: [ dateFolderTransformer ]
  }
})
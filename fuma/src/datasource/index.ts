import type { Datasource } from "@repo/source/builder";
import {addRSSPage, imagePageTransformer, dateFolderTransformer, indexFolderTransformer} from "./transformer.ts";

type DatasourceEnv = {
  GITHUB_TOKEN?: string
  BASE_URL?: string
}

// Secrets only exist on the runtime env, so build the source list per invocation.
const createDatasourceList = ({ env }: { env: DatasourceEnv }): Datasource[] => [
  {
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
      options: { repo: "mdark-org/btnews", branch: "master", dir: "/docs/btnews/btnews", token: env.GITHUB_TOKEN },
      includes: ['*.md', '*.mdx'],
    },
    github: { repo: "mdark-org/btnews", branch: "master", dir: "/docs/btnews/btnews" },
    transformers: {
      root: [ addRSSPage(`${env.BASE_URL}/rss/btnews`), indexFolderTransformer ],
      folder:[ indexFolderTransformer ],
      page: [ imagePageTransformer ],
    },
  },
  {
    id: 'archive_john_khan',
    mountedPath: '/docs/john-khan',
    slug: 'john-khan',
    category: [],
    name: '小约翰可汗',
    icon: "/image/john-khan.png",
    description: "谁是周更up？！说话！look at me！",
    provider: {
      type: 'unstorage',
      driver: 'github' as const,
      options: { repo: "mdark-org/bili-john-khan", branch: "main", dir: "/docs/john-khan", token: env.GITHUB_TOKEN },
      includes: ['*.md', '*.mdx'],
    },
    github: { repo: "mdark-org/bili-john-khan", branch: "main", dir: "/docs/john-khan" },
    transformers: {
      root: [ addRSSPage(`${env.BASE_URL}/rss/john-khan`) ],
    }
  },
  {
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
      options: { repo: "mdark-org/bili-koala-oss", branch: "main", dir: "/docs/Koala聊开源", token: env.GITHUB_TOKEN },
      includes: ['*.md', '*.mdx'],
    },
    github: { repo: "mdark-org/bili-koala-oss", branch: "main", dir: "/docs/Koala聊开源" },
    transformers: {
      root: [ addRSSPage(`${env.BASE_URL}/rss/koala-oss`), dateFolderTransformer ],
      folder: [ dateFolderTransformer ]
    }
  },
  {
    id: 'btnews_opinion',
    slug: 'opinion',
    name: '高见',
    description: "技术解构旧世界，技术建构新世界",
    mountedPath: '/docs/opinion',
    category: [],
    icon: "/image/opinion.png",
    provider: {
      type: 'unstorage',
      driver: 'github' as const,
      options: { repo: "mdark-org/btnews", branch: "master", dir: "/docs/btnews/opinion", token: env.GITHUB_TOKEN },
      includes: ['*.md', '*.mdx'],
    },
    github: { repo: "mdark-org/btnews", branch: "master", dir: "/docs/btnews/opinion" },
    transformers: {
      root: [
        addRSSPage(`${env.BASE_URL}/rss/opinion`),
        indexFolderTransformer
      ],
      folder:[ indexFolderTransformer ],
      page: [ imagePageTransformer ]
    }
  },
  {
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
      options: { repo: "mdark-org/btnews", branch: "master", dir: "/docs/btnews/refnews", token: env.GITHUB_TOKEN },
      includes: ['*.md', '*.mdx'],
    },
    github: { repo: "mdark-org/btnews", branch: "master", dir: "/docs/btnews/refnews" },
    transformers: {
      root: [
        addRSSPage(`${env.BASE_URL}/rss/refnews`),
        indexFolderTransformer
      ],
      folder:[ indexFolderTransformer ]
    }
  },
  {
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
      options: { repo: "mdark-org/btnews", branch: "master", dir: "/docs/btnews/slang", token: env.GITHUB_TOKEN },
      includes: ['*.md', '*.mdx'],
    },
    github: { repo: "mdark-org/btnews", branch: "master", dir: "/docs/btnews/slang" },
    transformers: {
      root: [
        addRSSPage(`${env.BASE_URL}/rss/slang`),
        indexFolderTransformer
      ],
      folder:[ indexFolderTransformer ]
    }
  }
] as Datasource[]

export const createDatasources = (env: DatasourceEnv) => createDatasourceList({ env })

const createDevDatasourceList = ({ env }: { env: DatasourceEnv }): Datasource[] => [
  {
    id: 'btnews_opinion',
    slug: 'opinion',
    name: '高见',
    description: "技术解构旧世界，技术建构新世界",
    mountedPath: '/docs/opinion',
    category: [],
    icon: "/image/opinion.png",
    provider: {
      type: 'unstorage',
      driver: 'github' as const,
      options: { repo: "mdark-org/btnews", branch: "master", dir: "/docs/btnews/opinion", token: env.GITHUB_TOKEN },
      includes: ['*.md', '*.mdx'],
    },
    github: { repo: "mdark-org/btnews", branch: "master", dir: "/docs/btnews/opinion" },
    transformers: {
      root: [
        addRSSPage(`${env.BASE_URL}/rss/opinion`),
        indexFolderTransformer
      ],
      folder:[ indexFolderTransformer ]
    }
  },
  {
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
      options: { repo: "mdark-org/btnews", branch: "master", dir: "/docs/btnews/slang", token: env.GITHUB_TOKEN },
      includes: ['*.md', '*.mdx'],
    },
    github: { repo: "mdark-org/btnews", branch: "master", dir: "/docs/btnews/slang" },
    transformers: {
      root: [
        addRSSPage(`${env.BASE_URL}/rss/slang`),
        indexFolderTransformer
      ],
      folder:[ indexFolderTransformer ]
    }
  }
] as Datasource[]

export const createDevDatasource = (env: DatasourceEnv) => createDevDatasourceList({ env })

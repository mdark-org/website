import btnewsDs from "./sources/btnews.ds.ts";
import koalaOssDs from "./sources/koala-oss.ds.ts";
import refnewsDs from "./sources/refnews.ds.ts";
import opinionDs from "./sources/opinion.ds.ts";
import slangDs from "./sources/slang.ds.ts";
import type { Datasource } from "@repo/source/types";
import jhonKhanDs from "./sources/jhon-khan.ds.ts";

const ctx = {
  env: {
    GITHUB_TOKEN: process.env.GITHUB_TOKEN,
    BASE_URL: process.env.BASE_URL
  }
}

export const datasources = [
  refnewsDs(ctx),
  btnewsDs(ctx),
  opinionDs(ctx),
  slangDs(ctx),
  koalaOssDs(ctx),
  jhonKhanDs(ctx)
] as Datasource[]

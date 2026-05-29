
import serialize from "serialize-javascript";
import * as fs from "node:fs";
import {Datasource} from "../shared";
import {SourceBuilder} from "./builder";

export const createDatasourceContents = (datasource: any) => {
  const sourceFile = fs.openSync(`.source/generated/${datasource.datasourceInfo.id}.json`, 'w+')
  // const pageMaps = JSON.stringify(sourceFile)
  fs.writeSync(sourceFile,
    JSON.stringify(datasource, (k, v) => {
      if(v === null) return null
      if(v === undefined) return undefined
      if(typeof v === 'string'
        || typeof v === 'number'
        || typeof v === 'boolean') return v
      if(typeof v === 'bigint') return String(v)
      if(typeof v === 'function' || typeof v === 'symbol') return undefined
      // for map return kv map
      if(v instanceof Map) {
        let ans = {}
        // @ts-ignore
        v.entries().forEach(([k,v])=> ans[k] = v)
        return ans
      }
      return v
    }))
    // `export const source = ${pageMaps}`)
}

export const createSidebarContents = (datasource: any) => {
  const sourceFile = fs.openSync(`.source/generated/sidebar/${datasource.datasourceInfo.id}.json`, 'w+')
  fs.writeSync(
    sourceFile,
    JSON.stringify({
      pageTree: datasource.pageTree,
      datasourceInfo: datasource.datasourceInfo,
    }),
  )
}

export const build = async (datasources: Datasource[]) => {
  // const sources = []

  fs.mkdirSync('.source/generated', { recursive: true })
  fs.mkdirSync('.source/generated/sidebar', { recursive: true })
  const res = await Promise.all(datasources.map(it => new SourceBuilder(it).build()))
  const keys = res.map(it => it.datasourceInfo.id)
  for ( const source of res) {
    createDatasourceContents(source)
    createSidebarContents(source)
  }
  const importLines = keys.map(it => `import ${it} from "./${it}.json" with {type: "json"};`)
    .join("\n")
  const sourceLine = `const source = { ${keys.join(',')} }`
  const exportLine = `export default source`
  const indexFile = fs.openSync(`.source/generated/index.mjs`, 'w+')

  const sidebarImportLines = keys.map(it => `import ${it} from "./${it}.json" with {type: "json"};`)
    .join("\n")
  const sidebarIndexFile = fs.openSync(`.source/generated/sidebar/index.mjs`, 'w+')
  fs.writeSync(indexFile, `
  ${importLines}
  ${sourceLine}
  ${exportLine}
`)
  fs.writeSync(sidebarIndexFile, `
  ${sidebarImportLines}
  ${sourceLine}
  ${exportLine}
`)
  const dts = `
type Page = {
  url: string,
  name: string,
  [x: string]: any
}
type Folder = {
  url: string,
  name: string,
  root: boolean,
  [x: string]: any,
  children: Tree[]
}
type Tree = (Folder | Page) & {
  children: Tree[]
}

type DatasourceInfo = {
  id: string
  name: string
  mountedPath: string
  category?: string[],
  description: string,
  github?: { repo: string, branch: string, dir: string }
  config?: any,
  icon?: string,
}

type Source = {
  pageMap: Map<string, Page>,
  pageTree: Tree,
  datasourceInfo: DatasourceInfo
}
`
  const dtsFile = fs.openSync(`.source/generated/index.d.ts`, 'w+')
  const sidebarDtsFile = fs.openSync(`.source/generated/sidebar/index.d.ts`, 'w+')
  fs.writeSync(dtsFile,dts)
  fs.writeSync(sidebarDtsFile,dts)

}

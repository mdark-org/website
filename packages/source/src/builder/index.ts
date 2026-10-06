import matter from "gray-matter";
import {metaSchema, PageWithContent} from "../types";
import type { Folder } from '../types/fuma'
import {createFSProvider, FSProvider} from "./fs-provider";
import {Datasource, Transformers, VFilePath} from "./type";
export * from './type'

export class SourceBuilder {
  private root: Folder & { depth: number }
  private transformers?: Transformers
  private source : Omit<Datasource, 'transformer'>
  private fsProvider: FSProvider
  constructor(source: Datasource) {
    this.fsProvider = createFSProvider(source)
    let { transformers, ...restSource} = source
    this.source = restSource
    this.transformers = transformers
    this.root = this.createRootNodeFromSource()
  }
  private createRootNodeFromSource() {
    let node: Folder & { depth: number } = {
      description: this.source.description,
      icon: this.source.icon,
      url: this.source.mountedPath,
      name: this.source.name,
      type: 'folder' as const,
      $id: this.source.id,
      index: {
        type: 'page',
        $id: `${this.source.id}:index`,
        name: this.source.name,
        url: `${this.source.mountedPath}/index`,
      },
      root: true,
      depth: this.source.mountedPath.split('/').length - 1,
      children: [],
    }
    return this.applyFolderTransformer(node, 'before-build-tree')
  }

  applyFolderTransformer<T extends Folder>(node: T, type: 'before-build-tree' | 'post-build-tree') {
    if(node.type != 'folder') throw new Error("Node type should be folder")
    let transformers = this.transformers?.folder ?? []
    if(node.root) {
      transformers = this.transformers?.root ?? []
    }
    let cur = node
    for (const transform of transformers) {
      if (type === 'post-build-tree') {
        cur = transform.postBuildTree?.(cur) ?? cur
      }
      if (type === 'before-build-tree') {
        cur = transform.beforeBuildTree?.(cur) ?? cur
      }
    }
    return cur
  }
  applyPageTransformer<T extends PageWithContent>(node: T) : T {
    const transformers = this.transformers?.page ?? []
    let cur = node
    for (const transform of transformers) {
      cur = transform?.(cur) ?? cur
    }
    return cur
  }

  async buildFolders(folderPaths: string[]) {
    const folderMap = new Map<string,Folder & {depth: number}>()
    for (const path of folderPaths) {
      const folder = {
        url: path,
        $id: path,
        name: path.split('/').pop()!,
        title: path.split('/').pop()!,
        children: [],
        type: 'folder' as const,
        depth: path.split('/').length - 1,
      }
      folderMap.set(path, this.applyFolderTransformer(folder, 'before-build-tree'))
    }
    return folderMap
  }

  async buildFolderTree(folderMap: Map<string, Folder & {depth: number}>) {
    let folders = Array.from(folderMap.values())
    folders.sort((a,b) => b.depth - a.depth)
    while(folders.length > 0) {
      let folder = folders.pop()!
      const children = folders
        .filter(it => it.depth === folder.depth + 1)
        .filter(it => it.url.startsWith(`${folder.url}/`))
      folder.children = [...folder.children, ...children]
    }
  }

  async fulfillFolders(folderMap: Map<string, Folder>, filePaths: VFilePath[]) {
    const pageMap = new Map<string, PageWithContent>
    const handlerVFilePath = async (vFilePath: typeof filePaths[number]) => {
      const source = await this.fsProvider.getVFileContent(vFilePath)
      const page = this.applyPageTransformer(this.VFileToPage(vFilePath, source))
      const { content, ...pageWithoutContent } = page
      return {
        page,
        pageWithoutContent,
        vFilePath
      }
    }

    const res = await Promise.all(filePaths.map(it => handlerVFilePath(it)))
    for (const item of res) {
      const { page, pageWithoutContent, vFilePath } = item
      if (pageMap.has(page.url)) {
        throw new Error(`Duplicate page URL: ${page.url}`)
      }
      console.log('vFilePath.path', vFilePath.path)
      const folder = folderMap.get(vFilePath.path)!
      console.log('got it', vFilePath.path)
      folder.children.push(pageWithoutContent)
      console.log('push', vFilePath.path)
      pageMap.set(page.url, page)
    }
    return pageMap
  }

  private VFileToPage(vFileMeta: VFilePath, item: string): PageWithContent {
    const frontmatter = matter(item)
    const data = metaSchema.parse(frontmatter.data)
    const [owner, repo] = (this.source.github?.repo ?? '/').split('/')
    return {
      url: vFileMeta.url,
      $id: vFileMeta.key,
      sourceKey: vFileMeta.key,
      name: data.title ?? vFileMeta.filename!,
      type: 'page' as const,
      filename: vFileMeta.filename,
      ext: vFileMeta.ext,
      data: data,
      content: frontmatter.content,
      github: this.source.github ? {
        owner: owner,
        repo: repo,
        sha: this.source.github.branch,
        path: this.source.github.dir.concat(`/${vFileMeta.sourcePath}/${vFileMeta.fullName}`)
      } : undefined
    }
  }

  async build() {
    console.log("start build folder")
    const { folderPaths, filePaths } = await this.fsProvider.getFiles()
    const folderMap = await this.buildFolders(folderPaths)

    // add root to folderMap
    folderMap.set(this.root.url, this.root)
    console.log("start build folder tree")
    await this.buildFolderTree(folderMap)
    console.log("start fulfill folder tree")
    const pageMap = await this.fulfillFolders(folderMap, filePaths)
    folderMap.values().forEach(it => {
      this.applyFolderTransformer(it, 'post-build-tree')
    })
    console.log(`build finished: ${this.root.name}`)
    const slug = this.source.mountedPath.split('/').filter(Boolean).pop()
    return {
      pageTree: this.root,
      pageMap,
      datasourceInfo: {
        id: this.source.id,
        name: this.source.name,
        mountedPath: this.source.mountedPath,
        slug: slug!,
        category: this.source.category,
        description: this.source.description,
        github: this.source.github,
        icon: this.source.icon,
        config: this.source.config,
      },
    }
  }


}

import matter from "gray-matter";
import {Datasource, Transformers, Page, Root, Folder, metaSchema } from "../shared";
import {VFilePath} from "../shared";
import {createFSProvider, FSProvider} from "./fs-provider";


export class SourceBuilder {
  private root: Root
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
    let node: Root = {
      title: this.source.name,
      description: this.source.description,
      icon: this.source.icon,
      url: this.source.mountedPath,
      name: this.source.name,
      type: 'folder' as const,
      // @ts-ignore
      $id: this.source.id,
      // @ts-ignore
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

  applyFolderTransformer<T extends Folder | Root>(node: T, type: 'before-build-tree' | 'after-build-tree') {
    if(node.type != 'folder') throw new Error("Node type should be folder")
    let transformers = this.transformers?.folder ?? []
    if(node.root) {
      transformers = this.transformers?.root ?? []
    }
    let cur = node
    for (const transform of transformers) {
      if(type == 'after-build-tree') {
        cur = transform.afterBuildTree?.(cur) ?? cur
      }
      if(type === 'before-build-tree') {
        cur = transform.beforeBuildTree?.(cur) ?? cur
      }
    }
    return cur
  }
  applyPageTransformer<T extends Page>(node: T) : T {
    const transformers = this.transformers?.page ?? []
    let cur = node
    for (const transform of transformers) {
      cur = transform?.(cur) ?? cur
    }
    return cur
  }

  async buildFolders(folderPaths: string[]) {
    const folderMap = new Map<string,Folder>()
    for (const path of folderPaths) {
      const folder = {
        url: path,
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

  async buildFolderTree(folderMap: Map<string, Folder>) {
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
    const pageMap = new Map<string, Page>
    const handlerVFilePath = async (vFilePath: typeof filePaths[number]) => {
      const source = await this.fsProvider.getVFileContent(vFilePath)
      const page = {
        ...this.applyPageTransformer(this.VFileToPage(vFilePath, source)),
        sourceKey: vFilePath.key,
      }
      const {content, ...rest} = page.data!
      let pageWithoutContent = { ...page, data: rest }

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
      const folder = folderMap.get(vFilePath.path)!
      // @ts-ignore
      folder.children.push(pageWithoutContent)
      pageMap.set(page.url, page)
    }
    return pageMap
  }

  private VFileToPage(vFileMeta: VFilePath, item: string): Page {
    const frontmatter = matter(item)
    const data = metaSchema.parse(frontmatter.data)
    const [owner, repo] = (this.source.github?.repo ?? '/').split('/')
    return {
      url: vFileMeta.url,
      sourceKey: vFileMeta.key,
      name: data.title ?? vFileMeta.filename!,
      title: data.title ?? vFileMeta.filename!,
      type: 'page' as const,
      filename: vFileMeta.filename,
      ext: vFileMeta.ext,
      data: { ...data, content: frontmatter.content },
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
    console.log("start build folder tree")
    // add root to folderMap
    folderMap.set(this.root.url, this.root as Folder)
    await this.buildFolderTree(folderMap)
    console.log("start fulfill folder tree")
    const pageMap = await this.fulfillFolders(folderMap, filePaths)
    folderMap.values().forEach(it => {
      this.applyFolderTransformer(it, 'after-build-tree')
    })
    console.log(`build finished: ${this.root.name}`)
    return {
      pageTree: this.root,
      pageMap,
      datasourceInfo: {
        id: this.source.id,
        name: this.source.name,
        mountedPath: this.source.mountedPath,
        category: this.source.category,
        description: this.source.description,
        github: this.source.github,
        icon: this.source.icon,
        config: this.source.config,
      },
    }
  }


}

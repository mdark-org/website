import { Storage } from "unstorage";
import micromatch from "micromatch";
import { Datasource, VFilePath } from "../../shared";
import { FSProvider } from "./index";

import pLimit from "p-limit";

const limit = pLimit(200);

export class UnStorageSourceBuilder implements FSProvider {
  private readonly basePath: string
  constructor( private source: Datasource, private readonly storage: Storage) {
    this.basePath = source.mountedPath
  }
  private unStorageKeyToPath(key: string) {
    const segments = key.split(':')
    const filename = segments.pop()!
    const path = [this.basePath, ...segments].join('/')
    const lastidx = filename?.lastIndexOf('.')
    const ext = lastidx ? filename?.slice(lastidx) : ''
    const filenameWithoutExt = lastidx ? filename?.slice(0, lastidx) : filename
    return {
      filename: filenameWithoutExt,
      fullName: filename,
      ext,
      path,
      sourcePath: segments.join('/'),
      url: path.concat(`/${filenameWithoutExt}`),
      key
    }
  }

  async getFiles() {
    let keys = await this.storage.getKeys('')
    const includes = (this.source.provider.includes) as string[]
    if(includes) keys = micromatch(keys, includes)
    const vFilePaths = keys.map(key => this.unStorageKeyToPath(key))
    const paths = keys.flatMap(it => it.split(':').slice(0, -1)
      .reduce((acc, cur) => ({pre: acc.pre + '/' + cur, arr: [...acc.arr, acc.pre + '/' + cur]}), {pre: '', arr: [] as string[]}).arr
    )
      .map(it => this.basePath + it)
    return {
      filePaths: vFilePaths,
      folderPaths: paths,
    }
  }

  async getVFileContent(vfile: VFilePath) {
      const item = await limit(() => this.storage.getItem(vfile.key))
      if (typeof item !== 'string') {
        throw new Error(`Expected Markdown content for ${vfile.key}`)
      }
      return item
  }

}

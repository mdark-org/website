import {VFilePath, Datasource } from "../type";
import {UnStorageSourceBuilder} from "./unstorage";
import {createStorage} from "unstorage";
import githubDriver from "unstorage/drivers/github";

export interface FSProvider {
  getFiles() : Promise<{folderPaths: string[], filePaths: VFilePath[]}>;
  getVFileContent(vFile: VFilePath):Promise<string>
}

export const createFSProvider = (source: Datasource): FSProvider => {
  switch (source.provider.driver) {
    case 'github':
      const storage = createStorage({driver: githubDriver(source.provider.options as any)})
      return new UnStorageSourceBuilder(source, storage)
  }
  throw new Error(`Unsupported fs provider: ${source.provider}`)
}
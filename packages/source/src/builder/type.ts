import type {BuiltinDriverOptions} from "unstorage";

import { Folder, Item, Node } from "../types/fuma";

export type VFilePath = {
  path: string
  sourcePath: string,
  url: string
  filename: string
  ext: string
  fullName: string
  key: string
}

type DatasourceInfo = {
  id: string
  name: string
  slug?: string
  mountedPath: string
  category?: string[],
  description: string,
  github?: { repo: string, branch: string, dir: string }
  config?: any,
  icon?: string,
}

export type Datasource<T extends keyof BuiltinDriverOptions | unknown = unknown> = {
  provider: Provider<T>,
  transformers?: Transformers
} & DatasourceInfo

export type DatasourceCreator<Opt extends keyof BuiltinDriverOptions, T extends any[] = any[]> = (...param:T) => Datasource<Opt>

type CommonOption = {
  includes?: string[],
  excludes?: string[],
}

type Provider<T extends keyof BuiltinDriverOptions | unknown = unknown> = UnStorageProvider<T>  & CommonOption

export type UnStorageProvider<Driver extends keyof BuiltinDriverOptions | unknown = unknown> = {
  type: 'unstorage';
  driver: Driver;
  options: Driver extends keyof BuiltinDriverOptions ? BuiltinDriverOptions[Driver] : unknown
}
// type D = K<'github'>
// type K<Driver extends keyof BuiltinDriverOptions> = {
//   [K in keyof BuiltinDriverOptions[Driver]]: BuiltinDriverOptions[Driver][K];
// }




export type Transformer<P extends Node = Node> =  <T extends P>(node: T) => T | void

export type RootTransformer = Partial<{
  beforeBuildTree: Transformer<Folder>,
  postBuildTree: Transformer<Folder>
}>

export type FolderTransformer = Partial<{
  beforeBuildTree: Transformer<Folder>,
  postBuildTree: Transformer<Folder>
}>

export type Transformers = Partial<{
  root: RootTransformer[]
  folder: FolderTransformer[]
  page: Transformer<Item>[]
}>


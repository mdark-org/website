'use client'

import { useEffect, useMemo, useState } from 'react'
import { useDocsSearch } from 'fumadocs-core/search/client'
import {
  SearchDialog, SearchDialogClose, SearchDialogContent, SearchDialogFooter, SearchDialogHeader,
  SearchDialogIcon, SearchDialogInput, SearchDialogList, SearchDialogListItem, SearchDialogOverlay,
  TagsList, TagsListItem, type SharedProps,
} from 'fumadocs-ui/components/dialog/search'
import { RefreshCw, X } from 'lucide-react'
import { config } from '../../config'
import { createSearchClient } from '../lib/search/client.ts'

export default function DocsSearchDialog(props: SharedProps) {
  const [tag, setTag] = useState(config.search.defaultSearchTag)
  const [retry, setRetry] = useState(0)
  const client = useMemo(() => createSearchClient({ tag, enabled: props.open }), [tag, props.open])
  const { search, setSearch, query } = useDocsSearch({ client, delayMs: 200 }, [tag, props.open, retry])
  useEffect(() => () => client.cancel(), [client])
  const short = Array.from(search.trim()).length < 2
  const error = query.error?.name === 'AbortError' ? undefined : query.error
  const message = '搜索暂不可用，请稍后重试。'

  return (
    <SearchDialog {...props} search={search} onSearchChange={(value) => { client.cancel(); setSearch(value) }}
      isLoading={!short && query.isLoading}>
      <SearchDialogOverlay />
      <SearchDialogContent className="max-h-[calc(100dvh-2rem)] flex flex-col">
        <SearchDialogHeader>
          <SearchDialogIcon />
          <SearchDialogInput maxLength={256} placeholder="搜索" />
          <SearchDialogClose title="关闭搜索"><X className="size-4" /></SearchDialogClose>
        </SearchDialogHeader>
        {!short && query.isLoading && <div role="status" className="py-8 text-center text-sm text-fd-muted-foreground">搜索中...</div>}
        {!short && !query.isLoading && error && <div role="alert" className="flex items-center justify-center gap-2 px-4 py-8 text-sm text-fd-muted-foreground">
          <span>{message}</span>
          <button type="button" aria-label="重试" title="重试" className="size-8 shrink-0 rounded-md p-2 hover:bg-fd-accent"
            onClick={() => setRetry((value) => value + 1)}><RefreshCw className="size-4" /></button>
        </div>}
        <SearchDialogList className="min-h-0 overflow-y-auto" items={short || query.isLoading || error || query.data === 'empty' ? null : query.data}
          Empty={() => <div role="status" className="py-8 text-center text-sm text-fd-muted-foreground">没有找到结果</div>}
          Item={({ item, onClick }) => <SearchDialogListItem item={item} onClick={onClick} className="[&>div:first-child]:flex-wrap [&_*]:break-words" />} />
        <SearchDialogFooter className="shrink-0">
          <TagsList tag={tag} onTagChange={setTag} allowClear aria-label="搜索范围">
            {config.search.tags.map((item) => <TagsListItem key={item.value} value={item.value} tabIndex={0} aria-pressed={tag === item.value}>{item.name}</TagsListItem>)}
          </TagsList>
        </SearchDialogFooter>
      </SearchDialogContent>
    </SearchDialog>
  )
}

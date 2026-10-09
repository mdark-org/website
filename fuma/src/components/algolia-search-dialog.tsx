'use client'

import { useEffect, useMemo, useState } from 'react'
import { useDocsSearch } from 'fumadocs-core/search/client'
import {
  SearchDialog, SearchDialogClose, SearchDialogContent, SearchDialogFooter, SearchDialogHeader,
  SearchDialogIcon, SearchDialogInput, SearchDialogList, SearchDialogOverlay,
  TagsList, TagsListItem, type SharedProps,
} from 'fumadocs-ui/components/dialog/search'
import { config } from '@/config'
import { createAlgoliaSearchClient } from '../lib/search/algolia-client'

export default function AlgoliaDocsSearchDialog(props: SharedProps) {
  const [tag, setTag] = useState(config.search.defaultSearchTag)
  const client = useMemo(() => createAlgoliaSearchClient({ tag, enabled: props.open }), [tag, props.open])
  const { search, setSearch, query } = useDocsSearch({ client, delayMs: 200 }, [tag, props.open])
  useEffect(() => () => client.cancel(), [client])

  return (
    <SearchDialog search={search} onSearchChange={setSearch} isLoading={query.isLoading} {...props}>
      <SearchDialogOverlay />
      <SearchDialogContent>
        <SearchDialogHeader>
          <SearchDialogIcon />
          <SearchDialogInput maxLength={256} placeholder="搜索" />
          <SearchDialogClose title="关闭搜索" />
        </SearchDialogHeader>
        <SearchDialogList
          items={query.data !== 'empty' ? query.data : null}
          Empty={() => <div role="status" className="py-8 text-center text-sm text-fd-muted-foreground">没有找到结果</div>}
        />
        <SearchDialogFooter>
          <TagsList tag={tag} onTagChange={setTag} allowClear aria-label="搜索范围">
            {config.search.tags.map((item) => <TagsListItem key={item.value} value={item.value} tabIndex={0} aria-pressed={tag === item.value}>{item.name}</TagsListItem>)}
          </TagsList>
        </SearchDialogFooter>
      </SearchDialogContent>
    </SearchDialog>
  )
}

import { cn } from '@/lib/cn';
import { Page } from '@repo/source/types';
import Link from 'fumadocs-core/link';
import React from 'react';
import {parserAsDate} from "@/lib/date";

type PageItemProps = {
  data: Page;
} & React.ComponentProps<typeof Link>;

const formatRelativeTime = (date: Date) => {
  if (date === undefined) return '';
  return date.toLocaleString('zh-CN', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
const PageItem: React.FC<PageItemProps> = ({ data, className, ...rest}) => {
  return (
    <Link href={data.url} className={cn(
      " hover:bg-fd-accent px-2 py-1 my-2 rounded-md transition-colors",
      "flex",
      "flex-col justify-start items-start gap-0",
      "md:flex-row md:justify-between  md:items-center md:gap-4",
      className
    )} {...rest}>
      <div className="text-fd-foreground grow font-medium text-sm shrink-0 ellipsis line-clamp-1 overflow-ellipsis">
        {data.name}
      </div>
      <div className='h-[1px] grow w-full border-t border-t-fd-muted-foreground/70 border-dashed hidden md:block'/>
      <time dateTime={parserAsDate(data.data?.date)?.toISOString()} className="text-xs text-fd-muted-foreground whitespace-nowrap self-end">
        {formatRelativeTime(data.data?.date!)}
      </time>
    </Link>
  );
};

export default PageItem;
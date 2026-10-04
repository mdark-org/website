import React from 'react';
import type { Page } from '@repo/source/types';
import Link from 'fumadocs-core/link';
import PageItem from './page-item';

interface CollectionProps {
  name: string;
  icon?: React.ReactNode;
  link?: string;
  latestPages: Page[];
}

const RecentCollection: React.FC<CollectionProps> = ({ name, icon, link, latestPages }) => {
  return (
    <div className='mt-4'>
      <div className='flex justify-between'>
        {
          link ? (
            <Link href={link} className='text-lg font-semibold'>{name}</Link>
          ): (
            <span className='text-lg font-semibold'>{name}</span>
          )
        }
        <Link href={link} className='text-xs underline decoration-dashed'>所有内容</Link>
      </div>
      <div>
        {latestPages.map((page) => (
          <PageItem
            key={page.url}
            data={page}
          />
        ))}
      </div>
    </div>
  );
};

export default RecentCollection;
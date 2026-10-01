
import { buttonVariants } from '@/components/ui/button';
import { config } from '../../../config/index';
import Link from 'fumadocs-core/link';
import { source } from '@/lib/source';
import PageItem from '@/components/page-item';
import { Metadata } from 'next';

const gridColor =
'color-mix(in oklab, var(--color-fd-primary) 10%, transparent)';

export const revalidate = 600

export const metadata: Metadata = {
  title: 'MDARK',
  description: 'MDARK',
  keywords: ['MDARK', 'mdark', 'markdown-archive'],
  openGraph: {
    title: 'MDARK',
    type: 'website',
  },
}

export default async function Page() {
  return <>
  <div
    className="absolute inset-x-0 top-90 h-62.5 max-md:hidden"
    style={{
      background: `repeating-linear-gradient(to right, ${gridColor}, ${gridColor} 1px,transparent 1px,transparent 50px), repeating-linear-gradient(to bottom, ${gridColor}, ${gridColor} 1px,transparent 1px,transparent 50px)`,
    }}
  />
  <main className="container mx-auto relative max-w-275 px-2 py-4 z-2 lg:py-8">
    <div
      style={{
        background:
          'repeating-linear-gradient(to bottom, transparent, color-mix(in oklab, var(--color-fd-primary) 1%, transparent) 500px, transparent 1000px)',
      }}
    >
      <div className="relative">
        <Hero />
      </div>
      <div
        className="relative overflow-hidden border-x border-t px-8 py-8 sm:py-12"
        style={{
          backgroundImage:
            'radial-gradient(circle at center, var(--color-fd-secondary), var(--color-fd-background) 40%)',
        }}
      >
        <h2 className="text-center text-2xl font-semibold sm:text-3xl">
          最近更新
        </h2>
        <Recent />
      </div>
    </div>
  </main>
</>
}
function Hero() {
  return (
    <div className="relative z-2 pb-4 flex flex-col border-x border-t bg-fd-background/80 px-4 pt-12 max-md:text-center md:px-12 md:pt-16 [.uwu_&]:hidden overflow-hidden">
      <div
        className="absolute inset-0 z-[-1] blur-2xl hidden dark:block"
        style={{
          maskImage:
            'linear-gradient(to bottom, transparent, white, transparent)',
          background:
            'repeating-linear-gradient(65deg, var(--color-blue-500), var(--color-blue-500) 12px, color-mix(in oklab, var(--color-blue-600) 30%, transparent) 20px, transparent 200px)',
        }}
      />
      <div
        className="absolute inset-0 z-[-1] blur-2xl dark:hidden"
        style={{
          maskImage:
            'linear-gradient(to bottom, transparent, white, transparent)',
          background:
            'repeating-linear-gradient(65deg, var(--color-purple-300), var(--color-purple-300) 12px, color-mix(in oklab, var(--color-blue-600) 30%, transparent) 20px, transparent 200px)',
        }}
      />
      <h1 className="mb-8 max-w-[600px] text-4xl font-medium">
        MDARK
      </h1>
      <p className="mb-8 text-fd-muted-foreground md:max-w-[80%] md:text-xl">
        a project that transform interest video into markdown and archive it, just for fun.
      </p>
      <div className="inline-flex items-center gap-3 max-md:mx-auto">
        <Link
          href="/docs"
          className={buttonVariants({size: 'lg', className: 'rounded-full'})}
        >
          所有文稿
        </Link>
        <a
          href={`https://github.com/${config.github.owner}/${config.github.repo}`}
          target="_blank"
          rel="noreferrer noopener"
          className={buttonVariants({
            size: 'lg',
            variant: 'outline',
            className: 'rounded-full bg-fd-background',
          })}
        >
          GitHub
        </a>
      </div>
    </div>
  );
}

async function Recent() {
  
  const pages = await source.getRecentPages()
  return (
    <div className='flex flex-col w-full gap-2'>
      {pages.map(page => (
        <PageItem
          key={page.url}
          data={page}
          className='my-0'
        />
      ))}
    </div>
  );

}

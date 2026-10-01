import type { MetadataRoute } from 'next'
import { source } from '@/lib/source';
import {config} from "../../config";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const url = (path: string): string => new URL(path, config.baseUrl).toString();
  return [
    {
      url: url('/'),
      changeFrequency: 'weekly',
      priority: 1,
    },
    ...(await source.getContentPages()).map((page) => {
      return {
        url: url(page.url),
        changeFrequency: 'weekly',
        lastModified: page.data?.date,
        priority: 0.5,
      } as MetadataRoute.Sitemap[number];
    }),
  ];
}
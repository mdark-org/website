import type { Page } from "@repo/source";
import { parserAsDate } from "./date.ts";

function escapeXml(value: string) {
  return value.replace(/[<>&"']/g, (character) => {
    switch (character) {
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "&":
        return "&amp;";
      case '"':
        return "&quot;";
      default:
        return "&apos;";
    }
  });
}

export function buildSitemap(pages: Page[], baseUrl: string) {
  const entries = [
    `<url><loc>${escapeXml(new URL("/", baseUrl).href)}</loc><changefreq>weekly</changefreq><priority>1</priority></url>`,
    ...pages.map((page) => {
      const date = page.data?.date ? parserAsDate(page.data.date) : undefined;
      const lastModified =
        date && !Number.isNaN(date.getTime()) ? `<lastmod>${date.toISOString()}</lastmod>` : "";
      return `<url><loc>${escapeXml(new URL(page.url, baseUrl).href)}</loc>${lastModified}<changefreq>weekly</changefreq><priority>0.5</priority></url>`;
    }),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries.join("")}</urlset>`;
}

import assert from "node:assert/strict";
import { test } from "node:test";
import { buildSitemap } from "../src/lib/sitemap.ts";

test("sitemap encodes document URLs, escapes XML, and includes publication dates", () => {
  const xml = buildSitemap(
    [
      {
        type: "page",
        $id: "one",
        name: "Test",
        url: "/docs/中文?a=1&b=2",
        data: { date: new Date("2026-10-14T00:00:00Z") },
      },
      { type: "page", $id: "two", name: "No date", url: "/docs/no-date" },
      {
        type: "page",
        $id: "three",
        name: "Invalid date",
        url: "/docs/invalid-date",
        data: { date: new Date(NaN) },
      },
    ],
    "https://mdark.org",
  );
  assert.match(xml, /<loc>https:\/\/mdark.org\/<\/loc>/);
  assert.match(xml, /%E4%B8%AD%E6%96%87\?a=1&amp;b=2/);
  assert.match(xml, /<lastmod>2026-10-14T00:00:00.000Z<\/lastmod>/);
  assert.equal(xml.match(/<lastmod>/g)?.length, 1);
  assert.equal(xml.match(/<url>/g)?.length, 4);
});

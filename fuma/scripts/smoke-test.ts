import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout } from "node:timers/promises";
import { z } from "zod";

const storage = await mkdtemp(join(tmpdir(), "bili-tanstack-"));
const baseUrl = "http://localhost:3100";
const explorer = `${baseUrl}/cdn-cgi/local/explorer/api`;
let databaseId = "";
let logs = "";
const server = spawn("pnpm", ["exec", "vp", "dev", "--port", "3100", "--strictPort"], {
  cwd: new URL("..", import.meta.url),
  detached: true,
  env: {
    ...process.env,
    CLOUDFLARE_PERSIST_TO: storage,
    CLOUDFLARE_REMOTE_BINDINGS: "false",
    SYNC_TOKEN: "smoke-test-token",
    BETTER_AUTH_SECRET: "smoke-test".repeat(4),
  },
  stdio: ["ignore", "pipe", "pipe"],
});
const serverClosed = new Promise<void>((resolve) => server.once("close", () => resolve()));
server.stdout.on("data", (chunk) => {
  logs = (logs + chunk).slice(-12000);
});
server.stderr.on("data", (chunk) => {
  logs = (logs + chunk).slice(-12000);
});

async function query(sql: string, params: (string | number)[] = []) {
  const response = await fetch(`${explorer}/d1/database/${databaseId}/raw`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sql, params }),
  });
  const result = z
    .object({ success: z.boolean(), errors: z.unknown().optional() })
    .parse(await response.json());
  assert.equal(result.success, true, JSON.stringify(result.errors));
}

async function check(path: string, status: number, content?: string | RegExp) {
  const response = await fetch(new URL(path, baseUrl), { redirect: "manual" });
  const body = await response.text();
  assert.equal(response.status, status, `${path}: ${body.slice(-2000)}`);
  if (typeof content === "string") assert.ok(body.includes(content), path);
  else if (content) assert.match(body, content);
  console.log(`${response.status} ${path}`);
  return response;
}

try {
  let ready = false;
  for (let attempt = 0; attempt < 150; attempt++) {
    assert.equal(server.exitCode, null, logs);
    try {
      ready = (await fetch(`${explorer}/d1/database`)).ok;
      if (ready) break;
    } catch {}
    await setTimeout(200);
  }
  assert.ok(ready, `Development server did not start.\n${logs}`);

  const databases = z
    .object({
      result: z.array(z.object({ name: z.string(), uuid: z.string() })),
    })
    .parse(await (await fetch(`${explorer}/d1/database`)).json());
  const database = databases.result.find((database) => database.name === "DB");
  assert.ok(database, "The local DB binding is missing.");
  databaseId = database.uuid;

  const migrations = new URL("../drizzle/d1/", import.meta.url);
  for (const file of (await readdir(migrations)).filter((file) => file.endsWith(".sql")).sort()) {
    for (const sql of (await readFile(new URL(file, migrations), "utf8")).split(
      "--> statement-breakpoint",
    )) {
      if (sql.trim()) await query(sql);
    }
  }

  const url = "/docs/test/中文文稿";
  const markdown = "# Smoke heading\n\n## Code\n\n```ts\nconst value = 1;\n```\n\n[Home](/)";
  const tree = {
    type: "folder",
    $id: "test",
    name: "Test",
    url: "/docs/test",
    children: [{ type: "page", $id: "page", name: "Smoke document", url }],
  };
  await query("INSERT INTO sync_runs (id, datasource_ids, status) VALUES (1, '[1]', 'succeeded')");
  await query("INSERT INTO source_heads (id, sync_run_id) VALUES ('current', 1)");
  await query(
    "INSERT INTO datasources (id, slug, name, mounted_path, sort_order, tree, sync_run_id) VALUES (1, ?, ?, ?, 0, ?, 1)",
    ["test", "Smoke source", "/docs/test", JSON.stringify(tree)],
  );
  await query("INSERT INTO page_bodies (hash, markdown) VALUES (?, ?)", ["body", markdown]);
  await query(
    "INSERT INTO page_versions (revision_id, source_key, source_hash, content_hash, url, title, metadata) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [
      "page",
      "test",
      "source",
      "body",
      url,
      "Smoke document",
      JSON.stringify({ bvid: "BV_SMOKE", date: "2026-10-14" }),
    ],
  );
  await query(
    "INSERT INTO page_ref (sync_run_id, datasource_id, revision_id, url) VALUES (1, 1, ?, ?)",
    ["page", url],
  );

  await check("/", 200, "Smoke document");
  await check("/changelog", 200, "更新日志");
  assert.equal((await check("/docs", 307)).headers.get("location"), encodeURI(url));
  await check(encodeURI(url), 200, /id="smoke-heading"/);
  await check("/docs/test/missing", 404);
  await check(`/llms.mdx${encodeURI(url)}`, 200, markdown);
  await check("/rss", 200, "<rss");
  await check("/rss/test", 200, "Smoke document");
  await check("/rss/missing", 404);
  await check("/sitemap.xml", 200, encodeURI(url));
  await check("/robots.txt", 200, "Sitemap:");
  assert.equal((await check("/tg", 301)).headers.get("location"), "https://t.me/mdark_org");
  await check("/api/auth/get-session", 200, "null");
  await check("/api/comments/BV_SMOKE", 200);
  await check("/api/comments/BV_SMOKE/", 200);
  await check("/api/comments/BV_SMOKE/auth", 401);
  await check("/api/search?q=a", 200, "[]");
  await check("/api/search?q=a&q=b", 400, "invalid_query");
  await check("/api/search/algolia?q=a", 200, "[]");
  await check("/api/missing", 401);
  await check("/missing", 404);
  console.log("TanStack Start smoke checks passed.");
} catch (error) {
  console.error(logs);
  throw error;
} finally {
  if (server.pid && server.exitCode === null) process.kill(-server.pid, "SIGTERM");
  await serverClosed;
  await rm(storage, { recursive: true, force: true });
}

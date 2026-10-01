import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { test } from 'node:test';
import { SourceBuilder } from '@repo/datasource/build';

test('provider keys survive mount changes and page transforms', async (t) => {
  const server = createServer((request, response) => {
    if (request.url === '/repos/test/docs/git/trees/main?recursive=1') {
      response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify({ tree: [{ type: 'blob', path: 'content/nested/guide.md', sha: 'fixture', mode: '100644', size: 64 }] }));
    } else if (request.url === '/test/docs/main/content/nested/guide.md') {
      response.setHeader('Content-Type', 'text/plain');
      response.end('---\ntitle: Guide\n---\n\n## Heading\n\nBody');
    } else {
      response.writeHead(404).end();
    }
  });
  t.after(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const baseURL = `http://127.0.0.1:${address.port}`;

  for (const mountedPath of ['/docs/archive', '/docs/renamed']) {
    const built = await new SourceBuilder({
      id: 'archive', name: 'Docs', description: '', mountedPath,
      provider: {
        type: 'unstorage', driver: 'github',
        options: { repo: 'test/docs', branch: 'main', dir: 'content', apiURL: baseURL, cdnURL: baseURL },
      },
      transformers: { page: [(page) => ({ ...page, url: `${page.url}-public`, sourceKey: 'rewritten' })] },
    }).build();
    const page = built.pageMap.get(`${mountedPath}/nested/guide-public`);
    assert.ok(page);
    assert.equal(page.sourceKey, 'nested:guide.md');
    assert.equal(page.data?.content, '\n## Heading\n\nBody');
  }
});

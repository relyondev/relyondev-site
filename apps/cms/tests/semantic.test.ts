import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { documentText, targetKey, type Target } from '../services/contentDocuments.ts';
import { chunks, normalized, similarity } from '../services/embeddings.ts';

test('edited page text is indexed without historical originals or media IDs', () => {
  const text = documentText('site-pages', { title: 'Existing Room', copy: [{ id: 'private', original: 'Stillroom', value: 'New description' }], images: [{ original: 'old.jpg', image: 455, alt: 'Updated photo' }] });
  assert.equal(text, 'Existing Room\nNew description\nUpdated photo');
});
test('long and multilingual content is chunked without losing its end', () => {
  const text = '你好'.repeat(4000) + 'Last paragraph';
  assert.ok(chunks(text).at(-1)?.endsWith('Last paragraph'));
  assert.ok(chunks(text).every(part => Array.from(part).length <= 600));
  assert.equal(similarity(normalized([3, 4]), normalized([3, 4])), 1);
  assert.throws(() => normalized([NaN]));
});
test('durable queue retries, reuses vectors, and rejects stale writes', async () => {
  process.env.SEMANTIC_DATA_DIR = mkdtempSync(join(tmpdir(), 'onsite-test-'));
  const { enqueue, store, removeTarget } = await import('../services/vectorStore.ts');
  const { processOne } = await import('../services/indexing.ts');
  const target: Target = { kind: 'collection', slug: 'projects', id: '99', locale: 'en' };
  let calls = 0;
  let mutateDuringEmbedding = false;
  let fail = false;
  let doc = { title: 'Existing Room' };
  const server = createServer(async (req, res) => {
    calls++;
    if (fail) { res.writeHead(503).end(); return; }
    let input = ''; for await (const chunk of req) input += chunk;
    const body = JSON.parse(input);
    if (mutateDuringEmbedding) { doc = { title: 'Newer edit' }; enqueue(target); }
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ embeddings: body.input.map(() => [0.6, 0.8]) }));
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  process.env.OLLAMA_URL = `http://127.0.0.1:${(server.address() as any).port}`;
  const payload = { findByID: async () => doc } as any;
  const row = () => store().prepare('SELECT * FROM documents WHERE key=?').get(targetKey(target));
  try {
    enqueue(target); await processOne(payload);
    assert.equal(row()?.status, 'ready');
    enqueue(target); await processOne(payload); assert.equal(calls, 1, 'unchanged content reuses vectors');
    doc = { title: 'Intermediate edit' }; mutateDuringEmbedding = true;
    enqueue(target); await processOne(payload); assert.equal(row()?.status, 'pending', 'old job cannot mark new revision ready');
    mutateDuringEmbedding = false; fail = true;
    await processOne(payload); assert.equal(row()?.status, 'retry');
    assert.ok(Number(row()?.next_attempt) > Date.now());
    removeTarget(target); assert.equal(row(), undefined);
  } finally { server.close(); store().close(); rmSync(process.env.SEMANTIC_DATA_DIR, { recursive: true, force: true }); }
});

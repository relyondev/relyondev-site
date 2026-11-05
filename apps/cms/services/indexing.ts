import { randomUUID } from 'node:crypto';
import type { Payload } from 'payload';
import { collectionFields, globalFields, locales, documentText, digest, readTarget, targetKey, type Target } from './contentDocuments.ts';
import { claimLease, releaseLease, store, enqueue } from './vectorStore.ts';
import { chunks, embed, modelKey } from './embeddings.ts';

// Reconciliation repairs missed hooks and removes deleted records after a crash.
export async function reconcile(payload: Payload, force = false) {
  const seen = new Set<string>();
  async function inspect(t: Target, doc: any) {
    const key = targetKey(t);
    seen.add(key);
    const row = store().prepare('SELECT hash,model,status FROM documents WHERE key=?').get(key);
    const changed = row?.hash !== digest(documentText(t.slug, doc)) || row?.model !== modelKey();
    if (!row || force || (row.status === 'ready' && changed)) enqueue(t);
  }
  for (const slug of Object.keys(collectionFields)) {
    for (const locale of locales) {
      let page = 1;
      while (true) {
        const result = await payload.find({ collection: slug, locale, draft: true, depth: 0, limit: 50, page, overrideAccess: true });
        for (const doc of result.docs) await inspect({ kind: 'collection', slug, id: String(doc.id), locale }, doc);
        if (!result.hasNextPage) break;
        page++;
      }
    }
  }
  for (const slug of Object.keys(globalFields)) for (const locale of locales) {
    const target: Target = { kind: 'global', slug, id: slug, locale };
    await inspect(target, await readTarget(payload, target));
  }
  // New saves can enqueue while scanning. Only prune after confirming the target is absent.
  for (const row of store().prepare('SELECT key,target FROM documents').all()) {
    if (!seen.has(String(row.key))) {
      try { await readTarget(payload, JSON.parse(String(row.target))); }
      catch (error: any) { if (error.status === 404) store().prepare('DELETE FROM documents WHERE key=?').run(row.key); }
    }
  }
  return seen.size;
}

export async function processOne(payload: Payload) {
  const owner = randomUUID();
  if (!claimLease('worker', owner)) return false;
  try {
    const row = store().prepare(`SELECT * FROM documents WHERE status IN ('pending','retry') AND next_attempt<=? ORDER BY updated LIMIT 1`).get(Date.now());
    if (!row) return false;
    try {
      const target: Target = JSON.parse(String(row.target));
      const doc = await readTarget(payload, target);
      const text = documentText(target.slug, doc);
      const hash = digest(text);
      let vectors = row.vectors;
      if (row.hash !== hash || row.model !== modelKey() || !vectors) {
        const parts = chunks(text);
        const result: number[][] = [];
        // Bounded batches, one worker lease across processes, no dropped long-form text.
        for (let offset = 0; offset < parts.length; offset += 8) {
          if (!claimLease('worker', owner)) throw new Error('Worker lease lost');
          result.push(...await embed(parts.slice(offset, offset + 8)));
          await new Promise(resolve => setTimeout(resolve, 150));
        }
        vectors = JSON.stringify(result);
      }
      // Compare-and-swap prevents a slow embedding from overwriting a newer save or delete.
      store().prepare(`UPDATE documents SET hash=?,model=?,vectors=?,status='ready',attempts=0,error=NULL
        WHERE key=? AND revision=?`).run(hash, modelKey(), vectors, row.key, row.revision);
    } catch (error: any) {
      if (error.status === 404) {
        store().prepare('DELETE FROM documents WHERE key=? AND revision=?').run(row.key, row.revision);
      } else {
        const attempts = Number(row.attempts) + 1;
        const delay = Math.min(3_600_000, 10_000 * 2 ** Math.min(attempts, 8));
        store().prepare(`UPDATE documents SET status='retry',attempts=?,next_attempt=?,error=? WHERE key=? AND revision=?`)
          .run(attempts, Date.now() + delay + Math.floor(Math.random() * 1000), 'Embedding unavailable; automatic retry scheduled.', row.key, row.revision);
      }
    }
    return true;
  } finally { releaseLease('worker', owner); }
}

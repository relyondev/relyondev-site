import type { Endpoint, PayloadRequest } from 'payload';
import { randomUUID } from 'node:crypto';
import { store, health, claimLease, releaseLease } from './vectorStore.ts';
import { digest, documentText, readTarget, editURL, type Target } from './contentDocuments.ts';
import { embed, modelKey, similarity } from './embeddings.ts';
import { reconcile } from './indexing.ts';

function authorized(req: PayloadRequest) {
  return req.user?.collection === 'users';
}
function sameOrigin(req: PayloadRequest) {
  const origin = req.headers.get('origin');
  return !!origin && origin === new URL(req.url!).origin;
}
const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
export const semanticEndpoints: Endpoint[] = [
  { path: '/semantic/status', method: 'get', handler: async req => {
    if (!authorized(req)) return json({ error: 'Sign in required' }, 401);
    return json({ counts: health(), model: modelKey(), provider: 'Local Ollama' });
  } },
  { path: '/semantic/search', method: 'post', handler: async req => {
    if (!authorized(req)) return json({ error: 'Sign in required' }, 401);
    if (!sameOrigin(req)) return json({ error: 'Same-origin request required' }, 403);
    const body = await req.json?.().catch(() => null);
    const query = typeof body?.query === 'string' ? body.query.trim() : '';
    if (!query || query.length > 500) return json({ error: 'Enter a query of 1–500 characters.' }, 400);
    const locale = body.locale === 'id' ? 'id' : 'en';
    // Global request lock limits inference to one admin query at a time, across processes.
    const owner = randomUUID();
    if (!claimLease('search', owner, 60_000)) return json({ error: 'Another search is running. Please try again shortly.' }, 429);
    try {
      const rows = store().prepare("SELECT target,hash,vectors FROM documents WHERE status='ready' AND model=?").all(modelKey());
      if (!rows.length) return json({ results: [], message: 'No vectors are ready. Start Ollama and the index worker, then re-index.' });
      const [vector] = await embed([query], true);
      const ranked = rows.map(row => ({ row, target: JSON.parse(String(row.target)) as Target,
        score: Math.max(...(JSON.parse(String(row.vectors)) as number[][]).map(v => similarity(vector, v)))
      })).filter(item => item.target.locale === locale).sort((a, b) => b.score - a.score);
      const results: any[] = [];
      for (const item of ranked) {
        if (results.length >= 15) break;
        try {
          // Never return stored excerpts: resolve access control and freshness first.
          const doc = await readTarget(req.payload, item.target, req);
          const text = documentText(item.target.slug, doc);
          if (digest(text) !== item.row.hash) continue;
          results.push({ key: `${item.target.slug}:${item.target.id}`, title: doc.title || doc.name || doc.headline || item.target.slug,
            collection: item.target.slug, excerpt: text.slice(0, 240), score: item.score,
            href: editURL(item.target), status: doc._status || 'Content' });
        } catch { /* Inaccessible, deleted, or stale content is omitted. */ }
      }
      return json({ results });
    } catch {
      return json({ error: 'Local embedding model unavailable. Start Ollama and install the configured model.' }, 503);
    } finally { releaseLease('search', owner); }
  } },
  { path: '/semantic/reindex', method: 'post', handler: async req => {
    if (!authorized(req)) return json({ error: 'Sign in required' }, 401);
    if (!sameOrigin(req)) return json({ error: 'Same-origin request required' }, 403);
    // Current installation has a single trusted Users admin class; add a role check when roles are introduced.
    const owner = randomUUID();
    if (!claimLease('reconcile', owner, 300_000)) return json({ error: 'Re-index is already running.' }, 409);
    try { return json({ queued: await reconcile(req.payload, true) }, 202); }
    finally { releaseLease('reconcile', owner); }
  } },
];

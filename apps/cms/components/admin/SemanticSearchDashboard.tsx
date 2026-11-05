'use client';
import { useEffect, useState, type FormEvent } from 'react';

type Result = { key: string; title: string; collection: string; excerpt: string; score: number; href: string; status: string };
export function SemanticSearchDashboard() {
  const [query, setQuery] = useState('');
  const [locale, setLocale] = useState('en');
  const [results, setResults] = useState<Result[]>([]);
  const [message, setMessage] = useState('');
  const [health, setHealth] = useState('Checking index…');
  const [busy, setBusy] = useState(false);
  const [reindexing, setReindexing] = useState(false);
  async function status() {
    try {
      const response = await fetch('/api/semantic/status');
      if (!response.ok) throw new Error();
      const data = await response.json();
      setHealth(data.counts.map((row: any) => `${row.count} ${row.status}`).join(' · ') || 'Index not populated');
    } catch { setHealth('Index status unavailable'); }
  }
  useEffect(() => { status(); const timer = setInterval(status, 15_000); return () => clearInterval(timer); }, []);
  async function search(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/semantic/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query, locale }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setResults(data.results); setMessage(data.message || (data.results.length ? '' : 'No current, accessible results. Indexing may still be pending.'));
    } catch (error: any) { setResults([]); setMessage(error.message || 'Search unavailable'); }
    finally { setBusy(false); }
  }
  async function reindex() {
    setReindexing(true);
    try {
      const response = await fetch('/api/semantic/reindex', { method: 'POST' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setMessage(`${data.queued} content records queued. Unchanged vectors are reused.`); await status();
    } catch (error: any) { setMessage(error.message || 'Re-index unavailable'); }
    finally { setReindexing(false); }
  }
  return <section className="onsite-column onsite-semantic" aria-label="AI content search">
    <h2>AI content search</h2>
    <p>Find content by meaning, then open its editor to save or publish changes.</p>
    <form onSubmit={search} style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
      <input aria-label="Search website content" value={query} maxLength={500} onChange={event => setQuery(event.target.value)} placeholder="Find pricing sections mentioning cloud storage" style={{ flex: '1 1 320px', padding: 12 }} />
      <select aria-label="Search language" value={locale} onChange={event => setLocale(event.target.value)}><option value="en">English</option><option value="id">Indonesia</option></select>
      <button className="onsite-primary" type="submit" disabled={busy || !query.trim()}>{busy ? 'Searching…' : 'Search'}</button>
      <button type="button" disabled={reindexing} onClick={reindex}>{reindexing ? 'Queuing…' : 'Re-index & Vectorize All'}</button>
    </form>
    <p><small>Local Ollama · {health}</small></p>
    <p role="status">{message}</p>
    <div className="onsite-cards">{results.map(result => <a className="onsite-card" key={result.key} href={result.href}>
      <span className="onsite-card-title">{result.title}<span>Open editor ↗</span></span>
      <small>{result.collection} · {result.status} · Similarity {result.score.toFixed(3)}</small>
      <span className="onsite-card-description">{result.excerpt}</span>
    </a>)}</div>
  </section>;
}

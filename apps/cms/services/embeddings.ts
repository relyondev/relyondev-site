// Local-only by default. No API keys or website text leave this machine.
export const model = () => process.env.EMBEDDING_MODEL || 'nomic-embed-text';
export const modelKey = () => `ollama:${model()}:chunks-v1`;
export function chunks(text: string): string[] {
  const chars = Array.from(text);
  const result: string[] = [];
  // Conservative character bound for multilingual text; reject provider truncation.
  for (let offset = 0; offset < chars.length; offset += 500) result.push(chars.slice(offset, offset + 600).join(''));
  return result.length ? result : ['Empty content'];
}
export function normalized(vector: number[]) {
  if (!Array.isArray(vector) || !vector.length || vector.some(n => !Number.isFinite(n))) throw new Error('Invalid embedding');
  const length = Math.hypot(...vector);
  if (!length) throw new Error('Empty embedding');
  return vector.map(n => n / length);
}
export function similarity(a: number[], b: number[]) {
  if (a.length !== b.length) return -1;
  return a.reduce((sum, n, i) => sum + n * b[i], 0);
}
export async function embed(input: string[], query = false): Promise<number[][]> {
  const base = new URL(process.env.OLLAMA_URL || 'http://127.0.0.1:11434');
  if (!['localhost', '127.0.0.1', '[::1]'].includes(base.hostname)) throw new Error('Embedding endpoint must be local');
  const prefix = model().startsWith('nomic-embed-text') ? (query ? 'search_query: ' : 'search_document: ') : '';
  const response = await fetch(new URL('/api/embed', base), {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: model(), input: input.map(text => prefix + text), truncate: false }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!response.ok) throw new Error(`Local embedding service returned ${response.status}`);
  const data = await response.json();
  if (!Array.isArray(data.embeddings) || data.embeddings.length !== input.length) throw new Error('Incomplete embedding response');
  const vectors = data.embeddings.map(normalized);
  if (vectors.some(v => v.length !== vectors[0].length)) throw new Error('Embedding dimensions changed');
  return vectors;
}

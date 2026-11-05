import { createHash } from 'node:crypto';
import type { Payload, PayloadRequest } from 'payload';

// Explicitly exclude credentials, historical copy, original titles, and internal IDs.
export const collectionFields: Record<string, string[]> = {
  'site-pages': ['title', 'copy', 'images'],
  posts: ['title', 'summary', 'body', 'copy', 'content'],
  projects: ['title', 'summary', 'overview', 'body', 'facts', 'brief', 'approach', 'outcome', 'about', 'pages', 'features', 'content'],
  testimonials: ['title', 'summary', 'body', 'content'],
  'reusable-sections': ['name', 'heading', 'body', 'questions'],
  'page-templates': ['name', 'path'],
  media: ['alt', 'filename'],
};
export const globalFields: Record<string, string[]> = {
  homepage: ['headline', 'intro', 'sections'],
  'site-builder': ['header', 'footer'],
};
export type Target = { kind: 'collection' | 'global'; slug: string; id: string; locale: 'en' | 'id' };
export const locales = ['en', 'id'] as const;
const excluded = /^(id|original.*|image|cover|url|href|link|sourceKey|createdAt|updatedAt|type|version|format|indent|direction|mode|style|detail)$/i;
function strings(value: unknown): string[] {
  if (typeof value === 'string') return [value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === 'object') return Object.entries(value).filter(([key]) => !excluded.test(key)).flatMap(([, val]) => strings(val));
  return typeof value === 'number' ? [String(value)] : [];
}
export function documentText(slug: string, doc: Record<string, any>): string {
  const fields = collectionFields[slug] ?? globalFields[slug] ?? [];
  return fields.flatMap(field => strings(doc[field])).filter(Boolean).join('\n');
}
export const digest = (text: string) => createHash('sha256').update(text).digest('hex');
export const targetKey = (target: Target) => [target.kind, target.slug, target.id, target.locale].join(':');
export function validTarget(t: Target) {
  return locales.includes(t.locale) && (t.kind === 'collection' ? !!collectionFields[t.slug] : t.kind === 'global' && !!globalFields[t.slug]);
}
// Admin search uses the caller's access rules; the background indexer is a trusted system task.
export async function readTarget(payload: Payload, t: Target, req?: PayloadRequest): Promise<any> {
  if (!validTarget(t)) throw new Error('Unsupported content target');
  const common = { locale: t.locale, depth: 0, draft: true, overrideAccess: !req, ...(req ? { req } : {}) };
  return t.kind === 'global'
    ? payload.findGlobal({ ...common, slug: t.slug })
    : payload.findByID({ ...common, collection: t.slug, id: t.id });
}
export function editURL(t: Target) {
  const route = t.kind === 'global' ? `globals/${t.slug}` : `collections/${t.slug}/${encodeURIComponent(t.id)}`;
  return `/admin/${route}?locale=${t.locale}`;
}

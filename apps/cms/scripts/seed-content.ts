import { readFileSync, writeFileSync, existsSync, renameSync } from 'node:fs';
import { resolve, basename } from 'node:path';
import { getPayload } from 'payload';
process.env.PAYLOAD_SECRET ||= readFileSync('.local-secret', 'utf8');
// Only a fresh database needs schema push. Never alter an existing database implicitly.
process.env.PAYLOAD_SCHEMA_PUSH = existsSync('relyon.sqlite') ? '0' : '1';
const { default: config } = await import('../payload.config.ts');
const payload = await getPayload({ config });
const source = JSON.parse(readFileSync('../../content/site-content.json', 'utf8'));
if (source.format !== 1) throw new Error('Unsupported seed export format');
const manifestFile = '.seed-map.json';
const map: Record<string, any> = existsSync(manifestFile) ? JSON.parse(readFileSync(manifestFile, 'utf8')) : {};
const saveMap = () => { writeFileSync(manifestFile + '.tmp', JSON.stringify(map, null, 2)); renameSync(manifestFile + '.tmp', manifestFile); };
const idKey = (collection: string, id: unknown) => `${collection}:${id}`;
const reserved = new Set(['id', 'createdAt', 'updatedAt', 'deletedAt']);

function relation(value: any, relationTo: any): any {
  if (value == null) return value;
  if (Array.isArray(value)) return value.map(v => relation(v, relationTo));
  const collection = typeof relationTo === 'string' ? relationTo : value.relationTo;
  const original = typeof relationTo === 'string' ? (value.id ?? value) : (value.value?.id ?? value.value);
  const mapped = map[idKey(collection, original)];
  if (mapped == null) throw new Error(`Missing relationship ${collection}:${original}`);
  return typeof relationTo === 'string' ? mapped : { relationTo: collection, value: mapped };
}
function fieldsData(fields: any[], raw: any, locale: string): any {
  const result: Record<string, any> = {};
  for (const field of fields) {
    if (field.type === 'tabs') {
      for (const tab of field.tabs) {
        if (tab.name) result[tab.name] = fieldsData(tab.fields, raw?.[tab.name] || {}, locale);
        else Object.assign(result, fieldsData(tab.fields, raw, locale));
      }
      continue;
    }
    if (!field.name) { if (field.fields) Object.assign(result, fieldsData(field.fields, raw, locale)); continue; }
    if (reserved.has(field.name) || field.type === 'ui') continue;
    let value = raw?.[field.name];
    if (value === undefined) continue;
    if (field.localized && value && typeof value === 'object' && !Array.isArray(value)) value = value[locale] ?? value.en;
    if (field.type === 'upload' || field.type === 'relationship') value = relation(value, field.relationTo);
    else if (field.type === 'group' && value) value = fieldsData(field.fields, value, locale);
    else if (field.type === 'array' && value) value = value.map((item: any) => fieldsData(field.fields, item, locale));
    result[field.name] = value;
  }
  return result;
}
try {
  // Preserve old->new IDs, then resolve uploads/relationships in dependent content.
  for (const slug of ['media', 'reusable-sections', 'page-templates', 'site-pages', 'posts', 'projects', 'testimonials']) {
    const schema = payload.config.collections.find(c => c.slug === slug)!;
    for (const record of source.collections[slug]) {
      const key = idKey(slug, record.id);
      if (map[`done:${key}`]) continue; // Re-running setup never overwrites later editor changes.
      let id = map[key];
      if (!id) {
        const stableField = record.sourceKey ? 'sourceKey' : record.path ? 'path' : null;
        if (stableField) {
          const existing = await payload.find({ collection: slug, where: { [stableField]: { equals: record[stableField] } }, limit: 1, depth: 0, draft: true, overrideAccess: true });
          id = existing.docs[0]?.id;
          if (id) { map[key] = id; map[`done:${key}`] = true; saveMap(); continue; }
        }
      }
      for (const locale of ['en', 'id'] as const) {
        const data = fieldsData(schema.fields, record, locale);
        if (record._status) data._status = record._status;
        if (!id) {
          const filename = record.filename;
          if (slug === 'media' && (typeof filename !== 'string' || basename(filename) !== filename)) throw new Error('Invalid media filename');
          const doc = await payload.create({ collection: slug, locale, data, overrideAccess: true,
            ...(slug === 'media' ? { filePath: resolve('../../content/media', filename) } : {}) });
          id = doc.id; map[key] = id; saveMap();
        } else if (slug !== 'media') await payload.update({ collection: slug, id, locale, data, overrideAccess: true });
      }
      map[`done:${key}`] = true; saveMap();
    }
    console.log(`Seeded ${slug}: ${source.collections[slug].length}`);
  }
  for (const [slug, record] of Object.entries(source.globals)) {
    if (map[`global:${slug}`]) continue;
    const schema = payload.config.globals.find(g => g.slug === slug)!;
    for (const locale of ['en', 'id'] as const) await payload.updateGlobal({ slug, locale, data: fieldsData(schema.fields, record, locale), overrideAccess: true });
    map[`global:${slug}`] = true; saveMap();
  }
  console.log('Content restored; create a new admin account on first login.');
} finally { await payload.destroy(); }

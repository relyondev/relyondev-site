import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
process.env.PAYLOAD_SECRET ||= readFileSync('.local-secret', 'utf8');
process.env.PAYLOAD_SCHEMA_PUSH = '0';
const { getPayload } = await import('payload');
const { default: config } = await import('../payload.config.ts');
const { reconcile } = await import('../services/indexing.ts');
const { claimLease, releaseLease } = await import('../services/vectorStore.ts');
const payload = await getPayload({ config });
const inputFlag = process.argv.indexOf('--input');
const apply = process.argv.includes('--apply');
const updateExisting = process.argv.includes('--update-existing');
const owner = crypto.randomUUID();
if (!claimLease('sync-import', owner, 3_600_000)) throw new Error('Another import is running');

// Existing site data is already in Payload. Default operation only reconciles the index.
// For a legacy JSON import, stable path/sourceKey values prevent duplicate entries.
const keys: Record<string, string> = { 'site-pages': 'path', posts: 'sourceKey', projects: 'sourceKey', testimonials: 'sourceKey' };
const protectedKeys = new Set(['id', 'createdAt', 'updatedAt', '_status']);
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
try {
  if (inputFlag >= 0) {
    const input = JSON.parse(readFileSync(process.argv[inputFlag + 1], 'utf8'));
    if (!Array.isArray(input.records)) throw new Error('Input must contain a records array');
    for (const record of input.records) {
      const key = keys[record.collection];
      if (!key || !record.data?.[key] || !['en', 'id'].includes(record.locale ?? 'en')) throw new Error('Invalid collection, stable key, or locale');
      const locale = record.locale ?? 'en';
      const data = Object.fromEntries(Object.entries(record.data).filter(([name]) => !protectedKeys.has(name)));
      const result = await payload.find({ collection: record.collection, where: { [key]: { equals: data[key] } }, locale, draft: true, depth: 0, limit: 2, overrideAccess: true });
      if (result.totalDocs > 1) throw new Error('Duplicate stable key in source database');
      const existing = result.docs[0];
      if (existing) {
        const comparable = Object.fromEntries(Object.keys(data).map(name => [name, existing[name]]));
        if (hash(comparable) === hash(data)) { console.log('Unchanged:', record.collection, data[key]); continue; }
        // Do not silently overwrite edits made in the admin after the original import.
        if (updateExisting) {
          if (!record.expectedUpdatedAt || record.expectedUpdatedAt !== existing.updatedAt) throw new Error('Import conflict: expectedUpdatedAt must match the current CMS entry');
          console.log(apply ? 'Updating:' : 'Would update:', record.collection, data[key]);
          if (apply) await payload.update({ collection: record.collection, id: existing.id, locale, data,
            draft: record.collection !== 'site-pages', overrideAccess: true,
            context: { syncExpectedUpdatedAt: record.expectedUpdatedAt } });
        } else console.log('Preserved existing CMS entry:', record.collection, data[key]);
        continue;
      }
      console.log(apply ? 'Creating:' : 'Would create:', record.collection, data[key]);
      if (apply) await payload.create({ collection: record.collection, locale, data, draft: record.collection !== 'site-pages', overrideAccess: true });
    }
  }
  if (inputFlag < 0 || apply) console.log('Reconciled records:', await reconcile(payload));
} finally {
  releaseLease('sync-import', owner);
  await payload.destroy();
}

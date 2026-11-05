import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
process.env.PAYLOAD_SECRET ||= readFileSync('.local-secret', 'utf8');
process.env.PAYLOAD_SCHEMA_PUSH = '0';
const { getPayload } = await import('payload');
const { default: config } = await import('../payload.config.ts');
const { processOne, reconcile } = await import('../services/indexing.ts');
const { claimLease, releaseLease } = await import('../services/vectorStore.ts');
const payload = await getPayload({ config });
let stopping = false;
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => { stopping = true; });
let nextScan = 0;
while (!stopping) {
  try {
    if (Date.now() >= nextScan) {
      const owner = randomUUID();
      if (claimLease('reconcile', owner, 300_000)) {
        try { await reconcile(payload); } finally { releaseLease('reconcile', owner); }
      }
      nextScan = Date.now() + 300_000;
    }
    await processOne(payload);
  } catch { console.error('Index worker will retry after a local service error.'); }
  await new Promise(resolve => setTimeout(resolve, 1000));
}
await payload.destroy();

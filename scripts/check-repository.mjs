import { readdirSync, readFileSync } from 'node:fs';
import { resolve, relative } from 'node:path';
const root = resolve(new URL('../', import.meta.url).pathname);
const skip = new Set(['.git', 'node_modules', '.next', '.semantic', '.downloads', 'dist', 'media']);
const patterns = [ /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, /gh[pousr]_[A-Za-z0-9]{30,}/, /sk-(?:proj-)?[A-Za-z0-9_-]{40,}/ ];
let count = 0;
function visit(folder) {
  for (const item of readdirSync(folder, { withFileTypes: true })) {
    if (skip.has(item.name) || item.name === '.local-secret' || item.name === '.seed-map.json' || /\.(sqlite.*|log|tsbuildinfo)$/.test(item.name)) continue;
    const path = resolve(folder, item.name);
    if (item.isDirectory()) visit(path);
    else if (/\.(json|m?js|tsx?|md|ya?ml)$/.test(item.name)) {
      const text = readFileSync(path, 'utf8');
      if (patterns.some(pattern => pattern.test(text))) throw new Error(`Credential-like content in ${relative(root, path)}`);
      count++;
    }
  }
}
visit(root);
const content = JSON.parse(readFileSync(resolve(root, 'content/site-content.json'), 'utf8'));
const allowed = new Set(['media', 'site-pages', 'posts', 'projects', 'testimonials', 'reusable-sections', 'page-templates']);
if (Object.keys(content.collections).some(key => !allowed.has(key))) throw new Error('Unexpected content collection in export');
if (content.collections.users || content.users) throw new Error('Authentication export must not be shipped');
for (const [slug, rows] of Object.entries(content.collections)) {
  if (new Set(rows.map(row => row.id)).size !== rows.length) throw new Error(`Duplicate seed IDs in ${slug}`);
}
console.log(`Checked ${count} source/documentation files and content export.`);

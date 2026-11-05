import { cp, mkdir, readdir, readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
const source = path.resolve('../Relyon Dev/site');
const staging = path.resolve('.dist-staging');
await rm(staging, { recursive: true, force: true });
await mkdir(staging);
try { await cp(source, staging, { recursive: true }); }
catch (error) {
  if (error.code !== 'ENOENT') throw error;
  await cp('dist', staging, { recursive: true });
}
let pages = 0;
async function inspect(folder) {
  for (const item of await readdir(folder, { withFileTypes: true })) {
    const file = path.join(folder, item.name);
    if (item.isDirectory()) await inspect(file);
    else if (item.name === 'index.html') {
      let html = await readFile(file, 'utf8');
      if (!html.includes('<html')) throw new Error('Invalid page: ' + file);
      // Next.js scripts contain serialized records whose lengths must stay intact.
      html = html.split(/(<script\b[^>]*>[\s\S]*?<\/script>)/gi)
        .map((part, index) => index % 2 ? part : part.replaceAll('Relyon Developer', 'Relyon Dev')
          .replaceAll('Visuvate', 'Relyon Dev').replaceAll('visuvate', 'relyon dev'))
        .join('');
      if (!html.includes('/brand/relyon.css')) {
        html = html.replace('</head>', '<link rel="stylesheet" href="/brand/relyon.css" /></head>');
      }
      await writeFile(file, html);
      pages++;
    }
  }
}
await inspect(staging);
await writeFile(path.join(staging, 'build.json'), JSON.stringify({ builtAt: new Date().toISOString(), pages }, null, 2));
await rm('dist', { recursive: true, force: true });
await cp(staging, 'dist', { recursive: true });
await rm(staging, { recursive: true, force: true });
console.log('Built ' + pages + ' pages into dist/');

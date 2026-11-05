import http from 'node:http';
import { createReadStream } from 'node:fs';
import { stat, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
const root = path.resolve('dist');
async function publishedProject(field, value) {
  const endpoint = new URL('http://127.0.0.1:3001/api/projects');
  endpoint.search = new URLSearchParams({
    ['where[' + field + '][equals]']:value,
    'where[_status][equals]':'published',limit:'1',depth:'0'
  }).toString();
  try {
    const response = await fetch(endpoint,{signal:AbortSignal.timeout(3000)});
    return response.ok ? (await response.json()).docs?.[0] : undefined;
  } catch { return undefined; }
}
const types = { '.html':'text/html; charset=utf-8', '.js':'text/javascript', '.mjs':'text/javascript', '.css':'text/css', '.rsc':'text/x-component', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.webp':'image/webp', '.avif':'image/avif', '.ico':'image/x-icon', '.mp4':'video/mp4', '.woff2':'font/woff2', '.otf':'font/otf', '.ttf':'font/ttf', '.json':'application/json', '.xml':'application/xml' };
async function exists(file) { try { return await stat(file); } catch { return null; } }
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (!['GET','HEAD'].includes(req.method)) {
      res.writeHead(503, {'Content-Type':'application/json'});
      return res.end(JSON.stringify({ok:false,error:'Contact delivery requires configuration.'}));
    }
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === '/content/site-builder' || /^\/content\/builder-section\/\d+$/.test(pathname)) {
      try {
        const cms = 'http://127.0.0.1:3001/api/';
        const read = async endpoint => {
          const upstream = await fetch(cms + endpoint,{signal:AbortSignal.timeout(5000)});
          if (!upstream.ok) throw Error('Site Builder is unavailable');
          return upstream.json();
        };
        let data;
        if (pathname !== '/content/site-builder') {
          data = await read('reusable-sections/' + pathname.split('/').at(-1) + '?depth=1');
        } else {
          const page = url.searchParams.get('path') ?? '/';
          const query = new URLSearchParams({'where[path][equals]':page,'where[enabled][equals]':'true',limit:'1',depth:'2'});
          const [settings, templates] = await Promise.all([read('globals/site-builder?depth=1'),read('page-templates?' + query)]);
          data = {settings,template:templates.docs[0]};
        }
        res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});
        return res.end(JSON.stringify(data));
      } catch {
        res.writeHead(503,{'Cache-Control':'no-store'});
        return res.end();
      }
    }
    const previewAsset = /^\/content\/preview-image\/(\d+)$/.exec(pathname)?.[1];
    if (previewAsset) {
      try {
        const upstream = await fetch('http://127.0.0.1:3001/api/media/' + previewAsset,
          {signal:AbortSignal.timeout(4000)});
        const asset = upstream.ok ? await upstream.json() : null;
        if (!asset?.filename || /[\/\\]/.test(asset.filename)) throw Error('Invalid asset');
        res.writeHead(302,{Location:'/content/media/' + encodeURIComponent(asset.filename),'Cache-Control':'no-store'});
        return res.end();
      } catch {
        res.writeHead(404);
        return res.end();
      }
    }
    // Exported snapshots include the public CMS projection and run offline.
    if (pathname.startsWith('/content/') && await exists(path.join(root,'snapshot-content'))) {
      const page = url.searchParams.get('path') ?? '';
      if (pathname === '/content/page' &&
          /^\/(about-us|works|services|blog|templates)(\/[a-zA-Z0-9_-]+)*$/.test(page)) {
        pathname = '/snapshot-content/pages' + page + '.json';
      } else if (pathname === '/content/homepage') {
        pathname = '/snapshot-content/homepage-' + (url.searchParams.get('locale') === 'id' ? 'id' : 'en') + '.json';
      } else {
        pathname = pathname.replace('/content/', '/snapshot-content/');
        if (pathname === '/snapshot-content/project-titles') pathname += '.json';
      }
    }
    if (pathname === '/content/post-cards') {
      try {
        const cards = {};
        for (let page = 1; ; page++) {
          const endpoint = new URL('http://127.0.0.1:3001/api/posts');
          endpoint.search = new URLSearchParams({
            'where[_status][equals]':'published',depth:'1',limit:'100',page:String(page),
            'select[path]':'true','select[title]':'true','select[cover]':'true',
            'select[originalCover]':'true','select[summary]':'true','select[originalSummary]':'true'
          }).toString();
          const upstream = await fetch(endpoint,{signal:AbortSignal.timeout(4000)});
          if (!upstream.ok) throw new Error('Payload unavailable');
          const result = await upstream.json();
          for (const post of result.docs) {
            if (!/^\/blog\/[a-z0-9-]+$/.test(post.path)) continue;
            const id = value => typeof value === 'object' ? value?.id : value;
            cards[post.path] = {title:post.title,
              summary:post.summary !== post.originalSummary ? post.summary : undefined,
              cover:id(post.cover) !== id(post.originalCover) ? post.cover?.filename : undefined};
          }
          if (!result.hasNextPage) break;
        }
        res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});
        return res.end(JSON.stringify(cards));
      } catch {
        res.writeHead(503,{'Cache-Control':'no-store'});
        return res.end();
      }
    }
    if (pathname === '/content/project-titles') {
      try {
        const titles = {};
        for (let page = 1; ; page++) {
          const endpoint = new URL('http://127.0.0.1:3001/api/projects');
          endpoint.search = new URLSearchParams({
            'where[_status][equals]':'published', depth:'0', limit:'100', page:String(page),
            'select[title]':'true', 'select[sourceKey]':'true'
          }).toString();
          const upstream = await fetch(endpoint, {signal:AbortSignal.timeout(4000)});
          if (!upstream.ok) throw new Error('Payload unavailable');
          const result = await upstream.json();
          for (const project of result.docs) {
            const slug = /^home-([a-z0-9_-]+)$/.exec(project.sourceKey ?? '')?.[1];
            if (slug && project.title) titles['/works/' + slug] = project.title;
          }
          if (!result.hasNextPage) break;
        }
        res.writeHead(200, {'Content-Type':'application/json','Cache-Control':'no-store'});
        return res.end(JSON.stringify(titles));
      } catch {
        res.writeHead(503, {'Cache-Control':'no-store'});
        return res.end();
      }
    }
    if (pathname === '/content/page') {
      let page = url.searchParams.get('path') ?? '';
      if (!/^\/(about-us|works|services|blog|templates)(\/[a-zA-Z0-9_-]+)*$/.test(page)) {
        res.writeHead(404);
        return res.end();
      }
      try {
        if (/^\/blog\/[a-z0-9-]+$/.test(page)) {
          const endpoint = new URL('http://127.0.0.1:3001/api/posts');
          endpoint.search = new URLSearchParams({'where[path][equals]':page,
            'where[_status][equals]':'published',limit:'1',depth:'1'}).toString();
          const response = await fetch(endpoint,{signal:AbortSignal.timeout(4000)});
          const post = response.ok ? (await response.json()).docs?.[0] : null;
          if (post) {
            res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});
            return res.end(JSON.stringify({
              path:page,title:post.originalTitle,originalTitle:post.originalTitle,
              copy:post.copy,images:post.images,
              postTitle:post.title !== post.originalHeading ? post.title : undefined,
              postSummary:post.summary !== post.originalSummary ? post.summary : undefined
            }));
          }
        }
        const slug = /^\/works\/([a-z0-9_-]+)$/.exec(page)?.[1];
        let project;
        if (slug) {
          project = await publishedProject('sourceKey','home-' + slug)
            ?? await publishedProject('urlSlug',slug);
          if (project?.sourceKey?.startsWith('home-')) page = '/works/' + project.sourceKey.slice(5);
        }
        const endpoint = new URL('http://127.0.0.1:3001/api/site-pages');
        endpoint.search = new URLSearchParams({'where[path][equals]':page, limit:'1', depth:'1'}).toString();
        const upstream = await fetch(endpoint, {signal:AbortSignal.timeout(5000)});
        if (!upstream.ok) throw new Error('Payload is unavailable');
        const { docs } = await upstream.json();
        res.writeHead(docs.length ? 200 : 404, {'Content-Type':'application/json','Cache-Control':'no-store'});
        return res.end(JSON.stringify(docs[0] ? {...docs[0],path:url.searchParams.get('path'),
          projectTitle:project?.title,project} : null));
      } catch {
        res.writeHead(503, {'Cache-Control':'no-store'});
        return res.end();
      }
    }
    if (pathname.startsWith('/content/media/')) {
      const filename = pathname.slice('/content/media/'.length);
      if (!filename || /[\/\\]/.test(filename) || filename === '.' || filename === '..') {
        res.writeHead(404);
        return res.end();
      }
      try {
        const upstream = await fetch('http://127.0.0.1:3001/api/media/file/' + encodeURIComponent(filename),
          { signal: AbortSignal.timeout(10000) });
        const type = upstream.headers.get('content-type') ?? '';
        if (!upstream.ok || !type.startsWith('image/')) throw new Error('Image unavailable');
        const bytes = Buffer.from(await upstream.arrayBuffer());
        res.writeHead(200, {'Content-Type':type,'X-Content-Type-Options':'nosniff','Cache-Control':'no-cache'});
        return res.end(bytes);
      } catch {
        res.writeHead(404);
        return res.end();
      }
    }
    if (pathname === '/content/homepage') {
      try {
        const endpoint = new URL('http://127.0.0.1:3001/api/globals/homepage');
        endpoint.searchParams.set('depth', '1');
        endpoint.searchParams.set('locale', url.searchParams.get('locale') === 'id' ? 'id' : 'en');
        const upstream = await fetch(endpoint, { signal: AbortSignal.timeout(4000) });
        if (!upstream.ok) throw new Error('Payload is unavailable');
        const data = await upstream.json();
        res.writeHead(200, {'Content-Type':'application/json', 'Cache-Control':'no-store'});
        return res.end(JSON.stringify({headline:data.headline, intro:data.intro, sections:data.sections}));
      } catch {
        res.writeHead(503, {'Cache-Control':'no-store'});
        return res.end();
      }
    }
    if (pathname === '/healthz') { res.writeHead(200); return res.end('ok'); }
    if (pathname === '/vendor/demo') pathname = '/vendor/demo/';
    if (pathname === '/_next/image') {
      const key = createHash('sha256').update(url.pathname + url.search).digest('hex');
      let cached;
      for (const ext of ['webp','png','jpg']) {
        if (await exists(path.join(root,'_image_cache',key+'.'+ext))) { cached='/_image_cache/'+key+'.'+ext; break; }
      }
      pathname = cached || url.searchParams.get('url') || '';
      if (!pathname.startsWith('/')) { res.writeHead(400); return res.end(); }
    }
    let file = path.resolve(root, '.' + pathname);
    if (file !== root && !file.startsWith(root + path.sep)) { res.writeHead(403); return res.end(); }
    let info = await exists(file);
    const alias = !info && /^\/works\/([a-z0-9-]+)\/?$/.exec(pathname)?.[1];
    if (alias) {
      const project = await publishedProject('urlSlug',alias);
      const source = /^home-([a-z0-9_-]+)$/.exec(project?.sourceKey ?? '')?.[1];
      if (source) {
        file = path.join(root,'works',source);
        info = await exists(file);
      }
    }
    if (info?.isDirectory()) {
      file = path.join(file, req.headers.rsc === '1' ? 'route.rsc' : 'index.html');
      info = await exists(file);
    }
    let status = 200;
    if (!info?.isFile()) { file=path.join(root,'404.html'); info=await stat(file); status=404; }
    const etag = '"' + info.size.toString(16) + '-' + Math.floor(info.mtimeMs).toString(16) + '"';
    const headers = {
      'Content-Type':types[path.extname(file)] || 'application/octet-stream',
      'X-Content-Type-Options':'nosniff',
      'Referrer-Policy':'strict-origin-when-cross-origin',
      'X-DNS-Prefetch-Control':'off',
      'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; media-src 'self' blob: data:; connect-src 'self'; frame-src 'self' blob:; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'",
      'Cache-Control': file.includes(path.sep+'_next'+path.sep) && !file.endsWith('.html') ? 'public, max-age=3600' : 'no-cache',
      'ETag':etag, 'Vary':'RSC', 'Accept-Ranges':'bytes'
    };
    if (req.headers['if-none-match'] === etag) { res.writeHead(304,headers); return res.end(); }
    let start=0, end=info.size-1;
    if (req.headers.range && status===200) {
      const match=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
      if (match) {
        start=match[1] ? Number(match[1]) : Math.max(0,info.size-Number(match[2]));
        end=match[1] && match[2] ? Number(match[2]) : end;
        if (start>end || start>=info.size || end>=info.size) { res.writeHead(416,{'Content-Range':'bytes */'+info.size}); return res.end(); }
        status=206; headers['Content-Range']='bytes '+start+'-'+end+'/'+info.size;
      }
    }
    headers['Content-Length']=end-start+1;
    res.writeHead(status,headers);
    if (req.method==='HEAD') return res.end();
    const stream=createReadStream(file,{start,end});
    stream.on('error',()=>res.destroy());
    res.on('close',()=>stream.destroy());
    stream.pipe(res);
  } catch { if (!res.headersSent) res.writeHead(500); res.end('Unable to serve this request.'); }
});
server.listen(Number(process.env.PORT || 3000),process.env.HOST || '0.0.0.0',()=>console.log('Relyon Dev ready on port '+(process.env.PORT || 3000)));

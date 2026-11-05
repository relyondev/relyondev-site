import { createHash } from 'node:crypto';
import imageMap from '../image-map.json' with { type: 'json' };
import mediaMap from '../media-map.json' with { type: 'json' };
import cacheMap from '../cache-map.json' with { type: 'json' };
export default function handler(req,res){
 const url=new URL(req.url,'https://local.invalid');
 const route=url.searchParams.get('__route')||url.pathname;
 if(!['GET','HEAD'].includes(req.method)){res.status(503).json({ok:false,error:'Contact delivery requires configuration.'});return;}
 let target;
 if(route==='/_next/image'){
  url.searchParams.delete('__route');
  const original='/_next/image'+url.search;
  target=imageMap[original]||cacheMap[createHash('sha256').update(original).digest('hex')];
  if(!target){const fallback=url.searchParams.get('url');if(fallback?.startsWith('/')&&!fallback.startsWith('//')&&!fallback.includes('\\'))target=fallback;}
 }else if(route==='/content/page'||route==='/content/site-builder'){
  const page=url.searchParams.get('path')||'/';
  if(/^\/(?:[a-zA-Z0-9_-]+\/?)*$/.test(page)){
   const key=page==='/'?'home':page.replace(/^\//,'').replace(/\/$/,'');
   target=route==='/content/page'?'/content/pages/'+key+'.json':'/content/builder/'+key+'.json';
  }
 }else if(route==='/content/homepage')target='/content/homepage-'+(url.searchParams.get('locale')==='id'?'id':'en')+'.json';
 else if(route==='/content/project-titles'||route==='/content/post-cards')target=route+'.json';
 else if(/^\/content\/builder-section\/\d+$/.test(route))target=route+'.json';
 else if(/^\/content\/preview-image\/\d+$/.test(route)){
  const filename=mediaMap[route.split('/').at(-1)];if(filename)target='/content/media/'+encodeURIComponent(filename);
 }
 if(!target){res.status(404).json({error:'Not found'});return;}
 res.setHeader('Cache-Control','public, max-age=60');res.redirect(307,target);
}

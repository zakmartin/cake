import {mkdir, readFile, readdir, rm, writeFile} from 'node:fs/promises';
import {dirname, extname, join, relative, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const site=join(root,'site');
const dist=join(root,'dist');

async function walk(dir){
  const entries=await readdir(dir,{withFileTypes:true});
  const files=[];
  for(const entry of entries){
    const full=join(dir,entry.name);
    if(entry.isDirectory())files.push(...await walk(full));
    else if(entry.name!=='workbook-preview.jpg')files.push(full);
  }
  return files;
}

const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.webp':'image/webp','.jpg':'image/jpeg'};
const assets=[];
for(const file of await walk(site)){
  const path='/'+relative(site,file).split('\\').join('/');
  assets.push([path,{type:mime[extname(file)]||'application/octet-stream',body:(await readFile(file)).toString('base64')}]);
}

const shared=(await readFile(join(root,'server','subscribe.mjs'),'utf8')).replace(/^export /m,'');

const worker=`const ASSETS=new Map(${JSON.stringify(assets)});
${shared}
function asset(path,method){
  const key=path==='/'?'/index.html':path;
  const item=ASSETS.get(key);
  if(!item)return null;
  const bytes=Uint8Array.from(atob(item.body),c=>c.charCodeAt(0));
  const headers={'Content-Type':item.type,'X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','Permissions-Policy':'camera=(), microphone=(), geolocation=()'};
  headers['Cache-Control']=key.endsWith('.html')?'no-cache':'public, max-age=604800, immutable';
  return new Response(method==='HEAD'?null:bytes,{headers});
}

export default {async fetch(request,env){
  const url=new URL(request.url);
  if(url.pathname==='/api/subscribe-result')return subscribe(request,env,url);
  if(request.method!=='GET'&&request.method!=='HEAD')return new Response('Method not allowed',{status:405});
  return asset(url.pathname,request.method)||new Response('Not found',{status:404,headers:{'Content-Type':'text/plain; charset=utf-8'}});
}};
`;

await rm(dist,{recursive:true,force:true});
await mkdir(join(dist,'server'),{recursive:true});
await mkdir(join(dist,'.openai'),{recursive:true});
await writeFile(join(dist,'server','index.js'),worker);
await writeFile(join(dist,'.openai','hosting.json'),await readFile(join(root,'.openai','hosting.json')));
console.log('Built server-backed Cake Quote Kit site.');

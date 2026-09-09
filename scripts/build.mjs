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

const worker=`const ASSETS=new Map(${JSON.stringify(assets)});
const ALLOWED_CURRENCIES=new Set(['USD','GBP','EUR','CAD','AUD']);
const INPUT_KEYS=['ingredients','hours','rate','extras','price','feePercent','feeFixed','margin'];

function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}})}
function calculate(v){
  if(INPUT_KEYS.some(k=>typeof v[k]!=='number'||!Number.isFinite(v[k])||v[k]<0||v[k]>1000000))throw new RangeError('Invalid calculation values.');
  if(v.hours>1000||v.feePercent>99||v.margin>99||v.feePercent+v.margin>=100)throw new RangeError('Invalid calculation values.');
  const labour=v.hours*v.rate;
  const cost=v.ingredients+labour+v.extras;
  const fees=v.price*v.feePercent/100+v.feeFixed;
  const surplus=v.price-cost-fees;
  const target=Math.max(0,Math.ceil(((cost+v.feeFixed)/(1-(v.feePercent+v.margin)/100)-1e-9)*100)/100);
  const floor=Math.max(0,Math.ceil(((cost+v.feeFixed)/(1-v.feePercent/100)-1e-9)*100)/100);
  return {labour,fees,surplus,target,floor};
}
function money(value,currency){return new Intl.NumberFormat('en-US',{style:'currency',currency}).format(value)}
function optinTime(){return new Date().toISOString().slice(0,19).replace('T',' ')}

async function subscribe(request,env,url){
  if(request.method!=='POST')return json({message:'Method not allowed.'},405);
  const origin=request.headers.get('Origin');
  if(origin&&origin!==url.origin)return json({message:'Request not allowed.'},403);
  if(!(request.headers.get('Content-Type')||'').toLowerCase().includes('application/json'))return json({message:'Send JSON.'},415);
  const length=Number(request.headers.get('Content-Length')||0);
  if(length>12000)return json({message:'Request is too large.'},413);
  let body;
  try{body=JSON.parse(await request.text())}catch{return json({message:'Invalid request.'},400)}
  if(body.company)return json({ok:true});
  const email=String(body.email||'').trim().toLowerCase();
  if(body.consent!==true||email.length>254||!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$/.test(email))return json({message:'Enter a valid email and confirm your subscription.'},400);
  const currency=String(body.currency||'');
  if(!ALLOWED_CURRENCIES.has(currency)||!body.inputs||typeof body.inputs!=='object')return json({message:'Please calculate your price again.'},400);
  let result;
  try{result=calculate(body.inputs)}catch{return json({message:'Please calculate your price again.'},400)}
  if(!env.MAILERLITE_API_TOKEN||!env.MAILERLITE_GROUP_ID)return json({message:'Email delivery is temporarily unavailable.'},503);
  const gap=result.target-body.inputs.price;
  const verdict=result.surplus<-.001?'Your current price does not cover all entered costs, including your chosen pay.':body.inputs.price+.001<result.target?'Your costs are covered, but your target margin is not.':'Your current price meets your chosen margin for the costs entered.';
  const fields={
    cq_currency:currency,
    cq_target_price:money(result.target,currency),
    cq_break_even:money(result.floor,currency),
    cq_current_price:money(body.inputs.price,currency),
    cq_price_gap:gap>.005?money(gap,currency)+' below target':gap<-.005?money(Math.abs(gap),currency)+' above target':'On target',
    cq_cost_breakdown:'Ingredients '+money(body.inputs.ingredients,currency)+' · Your pay '+money(result.labour,currency)+' · Overheads '+money(body.inputs.extras,currency)+' · Fees '+money(result.fees,currency),
    cq_verdict:verdict
  };
  const ip=request.headers.get('CF-Connecting-IP');
  const payload={email,fields,groups:[env.MAILERLITE_GROUP_ID],status:'active',opted_in_at:optinTime()};
  if(ip){payload.ip_address=ip;payload.optin_ip=ip}
  let response;
  try{response=await fetch('https://connect.mailerlite.com/api/subscribers',{method:'POST',headers:{Authorization:'Bearer '+env.MAILERLITE_API_TOKEN,'Content-Type':'application/json',Accept:'application/json','X-Version':'2026-09-09'},body:JSON.stringify(payload)})}catch{return json({message:'Email delivery is temporarily unavailable. Please try again.'},502)}
  if(!response.ok){
    const detail=await response.json().catch(()=>({}));
    if(response.status===422&&detail?.errors?.email)return json({message:'Please check your email address.'},400);
    return json({message:'We could not send your result. Please try again.'},502);
  }
  const data=await response.json().catch(()=>({}));
  if(data?.data?.status&&data.data.status!=='active')return json({message:'This email address cannot be subscribed. Please use another address.'},409);
  return json({ok:true});
}

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

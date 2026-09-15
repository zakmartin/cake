// Minimal Google Ads REST client (no dependencies). Port of
// ../pojistitonline.cz/server/utils/googleAdsAuth.ts – same OAuth refresh-token
// grant, same env variable names. Credentials are read from an .env file that
// stays outside this repo; default is the pojistitonline.cz project next door.
//
//   ADS_ENV_FILE=/path/to/.env node scripts/ads-conversions.mjs
//
// Required keys: GOOGLE_ADS_DEVELOPER_TOKEN, GOOGLE_ADS_CLIENT_ID,
// GOOGLE_ADS_CLIENT_SECRET, GOOGLE_ADS_REFRESH_TOKEN, GOOGLE_ADS_CUSTOMER_ID,
// optional GOOGLE_ADS_LOGIN_CUSTOMER_ID (MCC) and GOOGLE_ADS_API_VERSION.
import {readFile} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {setTimeout as sleep} from 'node:timers/promises';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');

export async function loadEnv(){
  const file=process.env.ADS_ENV_FILE||resolve(root,'..','pojistitonline.cz','.env');
  let text;
  try{text=await readFile(file,'utf8');}
  catch{throw new Error(`Cannot read env file ${file}. Set ADS_ENV_FILE to a file with GOOGLE_ADS_* keys.`);}
  const env={};
  for(const raw of text.split('\n')){
    const line=raw.trim();
    if(!line||line.startsWith('#'))continue;
    const eq=line.indexOf('=');
    if(eq<0)continue;
    const key=line.slice(0,eq).trim();
    let value=line.slice(eq+1).trim();
    if(/^(['"]).*\1$/.test(value))value=value.slice(1,-1);
    else value=value.replace(/\s+#.*$/,'').trim();
    if(key.startsWith('GOOGLE_ADS_'))env[key]=value;
  }
  for(const key of Object.keys(env))if(!process.env[key])process.env[key]=env[key];
  return file;
}

export const normalizeCustomerId=raw=>(raw||'').replace(/\D/g,'');
const requireEnv=key=>{
  const value=process.env[key];
  if(!value)throw new Error(`${key} is not set. Run npx tsx scripts/ads-auth.mts in pojistitonline.cz or set ADS_ENV_FILE.`);
  return value;
};
const version=()=>process.env.GOOGLE_ADS_API_VERSION||'v22';
const base=()=>`https://googleads.googleapis.com/${version()}`;

let cached=null;
export async function getAccessToken(){
  if(cached&&cached.expiresAt>Date.now())return cached.token;
  const res=await fetch('https://oauth2.googleapis.com/token',{
    method:'POST',
    headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body:new URLSearchParams({
      client_id:requireEnv('GOOGLE_ADS_CLIENT_ID'),
      client_secret:requireEnv('GOOGLE_ADS_CLIENT_SECRET'),
      refresh_token:requireEnv('GOOGLE_ADS_REFRESH_TOKEN'),
      grant_type:'refresh_token'
    })
  });
  const body=await res.json().catch(()=>({}));
  if(!res.ok||!body.access_token){
    const hint=body.error==='invalid_grant'?' Refresh token expired or revoked; regenerate it with scripts/ads-auth.mts in pojistitonline.cz.':'';
    throw new Error(`OAuth token refresh failed (HTTP ${res.status}): ${body.error||''} ${body.error_description||''}.${hint}`);
  }
  cached={token:body.access_token,expiresAt:Date.now()+55*60*1000};
  return cached.token;
}

async function headers(){
  const h={Authorization:`Bearer ${await getAccessToken()}`,'developer-token':requireEnv('GOOGLE_ADS_DEVELOPER_TOKEN'),'Content-Type':'application/json'};
  const login=normalizeCustomerId(process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID);
  if(login)h['login-customer-id']=login;
  return h;
}

function describeError(status,text){
  let detail=text;
  try{
    const parsed=JSON.parse(text);
    const err=Array.isArray(parsed)?parsed[0]?.error:parsed?.error;
    detail=err?.message||text;
    const inner=err?.details?.[0]?.errors?.[0];
    if(inner?.message)detail+=` – ${inner.message}`;
    if(inner?.errorCode)detail+=` [${JSON.stringify(inner.errorCode)}]`;
  }catch{}
  return `Google Ads API ${status}: ${detail}`;
}

export function customerId(){return normalizeCustomerId(requireEnv('GOOGLE_ADS_CUSTOMER_ID'));}

export async function adsQuery(query){
  const url=`${base()}/customers/${customerId()}/googleAds:search`;
  const h=await headers();
  const rows=[];
  let pageToken;
  do{
    let res=null,text='';
    for(let attempt=0;attempt<4;attempt++){
      res=await fetch(url,{method:'POST',headers:h,body:JSON.stringify({query,...(pageToken?{pageToken}:{})})});
      text=await res.text();
      if(res.ok||(res.status!==429&&res.status<500))break;
      await sleep(2**attempt*1000);
    }
    if(!res||!res.ok)throw new Error(describeError(res?.status??0,text));
    const body=JSON.parse(text||'{}');
    rows.push(...(body.results||[]));
    pageToken=body.nextPageToken;
  }while(pageToken);
  return rows;
}

// service e.g. 'conversionActions' → customers/{id}/conversionActions:mutate
export async function adsMutate(service,operations,{validateOnly=false}={}){
  if(!operations.length)return {results:[]};
  const res=await fetch(`${base()}/customers/${customerId()}/${service}:mutate`,{
    method:'POST',headers:await headers(),body:JSON.stringify({operations,validateOnly})
  });
  const text=await res.text();
  if(!res.ok)throw new Error(describeError(res.status,text));
  return text?JSON.parse(text):{};
}

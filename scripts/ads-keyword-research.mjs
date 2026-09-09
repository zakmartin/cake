// Requires a Google Ads developer token with Basic access (Explorer access returns DEVELOPER_TOKEN_NOT_APPROVED
// for KeywordPlanIdeaService). Run: node scripts/ads-keyword-research.mjs

// Keyword Planner + account benchmark via Google Ads API, reusing pojistitonline.cz credentials.
import {readFileSync, writeFileSync} from 'node:fs';

// Credentials: point ADS_ENV_DIR at a directory with .env containing GOOGLE_ADS_* (defaults to the pojistitonline.cz checkout).
const ROOT=process.env.ADS_ENV_DIR||'/Users/Martin_1/WWW/pojistitonline.cz';
for(const f of ['.env','.env.local']){
  try{
    for(const line of readFileSync(`${ROOT}/${f}`,'utf8').split('\n')){
      const m=line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if(!m)continue;
      let v=m[2].trim();
      if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);
      process.env[m[1]]=v;
    }
  }catch{}
}
const V=process.env.GOOGLE_ADS_API_VERSION||'v22';
const BASE=`https://googleads.googleapis.com/${V}`;
const digits=s=>(s||'').replace(/\D/g,'');
const CID=digits(process.env.GOOGLE_ADS_CUSTOMER_ID);
const LOGIN=digits(process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID);

async function token(){
  const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:process.env.GOOGLE_ADS_CLIENT_ID,client_secret:process.env.GOOGLE_ADS_CLIENT_SECRET,refresh_token:process.env.GOOGLE_ADS_REFRESH_TOKEN,grant_type:'refresh_token'})});
  const b=await r.json();
  if(!b.access_token)throw new Error('token: '+JSON.stringify(b));
  return b.access_token;
}
const T=await token();
const headers={Authorization:`Bearer ${T}`,'developer-token':process.env.GOOGLE_ADS_DEVELOPER_TOKEN,'Content-Type':'application/json',...(LOGIN?{'login-customer-id':LOGIN}:{})};

async function post(path,body){
  for(let a=0;a<4;a++){
    const r=await fetch(`${BASE}${path}`,{method:'POST',headers,body:JSON.stringify(body)});
    const t=await r.text();
    if(r.ok)return JSON.parse(t||'{}');
    if(r.status!==429&&r.status<500)throw new Error(`${path} ${r.status}: ${t.slice(0,600)}`);
    await new Promise(res=>setTimeout(res,2**a*1000));
  }
  throw new Error('retries exhausted '+path);
}
async function gaql(query){
  const rows=[];let pageToken;
  do{const b=await post(`/customers/${CID}/googleAds:search`,{query,...(pageToken?{pageToken}:{})});rows.push(...(b.results||[]));pageToken=b.nextPageToken}while(pageToken);
  return rows;
}

// --- account benchmark ------------------------------------------------------
const cust=await gaql('SELECT customer.currency_code, customer.descriptive_name FROM customer');
const currency=cust[0]?.customer?.currencyCode;
const today=new Date();const d=n=>new Date(today-n*864e5).toISOString().slice(0,10);
const acct=await gaql(`SELECT metrics.cost_micros, metrics.clicks, metrics.impressions, metrics.conversions, metrics.all_conversions FROM customer WHERE segments.date BETWEEN '${d(90)}' AND '${d(1)}'`);
const sum=(k)=>acct.reduce((s,r)=>s+Number(r.metrics?.[k]||0),0);
const benchmark={currency,name:cust[0]?.customer?.descriptiveName,from:d(90),to:d(1),cost:sum('costMicros')/1e6,clicks:sum('clicks'),impressions:sum('impressions'),conversions:sum('conversions'),allConversions:sum('allConversions')};
benchmark.cpc=benchmark.clicks?benchmark.cost/benchmark.clicks:null;
benchmark.ctr=benchmark.impressions?benchmark.clicks/benchmark.impressions:null;
benchmark.clickToConv=benchmark.clicks?benchmark.conversions/benchmark.clicks:null;
console.error('benchmark',benchmark);

// --- FX ---------------------------------------------------------------------
let fx={};
try{fx=(await (await fetch(`https://api.frankfurter.app/latest?from=${currency}&to=USD,EUR,GBP`)).json()).rates||{}}catch{}
if(!fx.USD){fx={USD:1/23,EUR:1/24.5,GBP:1/29}}// fallback approx
console.error('fx',currency,fx);

// --- keyword ideas ----------------------------------------------------------
const seeds=[
  'cake pricing calculator','how to price a cake','cake pricing guide','how much to charge for a cake',
  'cake cost calculator','cake pricing spreadsheet','cake business pricing','home bakery pricing',
  'how to price cakes for profit','cupcake pricing calculator','wedding cake pricing','bakery pricing calculator',
  'cake quote template','cake order form template','cake business spreadsheet','baking cost calculator'
];
const markets=[
  {code:'US',geo:'2840'},{code:'GB',geo:'2826'},{code:'CA',geo:'2124'},{code:'AU',geo:'2036'}
];
const ideas={};
for(const m of markets){
  const body={language:'languageConstants/1000',geoTargetConstants:[`geoTargetConstants/${m.geo}`],keywordPlanNetwork:'GOOGLE_SEARCH',includeAdultKeywords:false,keywordSeed:{keywords:seeds.slice(0,20)},pageSize:400};
  const r=await post(`/customers/${CID}:generateKeywordIdeas`,body);
  ideas[m.code]=(r.results||[]).map(x=>({
    text:x.text,
    volume:Number(x.keywordIdeaMetrics?.avgMonthlySearches||0),
    competition:x.keywordIdeaMetrics?.competition||null,
    competitionIndex:Number(x.keywordIdeaMetrics?.competitionIndex||0),
    lowBidUsd:x.keywordIdeaMetrics?.lowTopOfPageBidMicros?Number(x.keywordIdeaMetrics.lowTopOfPageBidMicros)/1e6*fx.USD:null,
    highBidUsd:x.keywordIdeaMetrics?.highTopOfPageBidMicros?Number(x.keywordIdeaMetrics.highTopOfPageBidMicros)/1e6*fx.USD:null,
    monthly:(x.keywordIdeaMetrics?.monthlySearchVolumes||[]).map(v=>({y:v.year,m:v.month,n:Number(v.monthlySearches||0)}))
  })).sort((a,b)=>b.volume-a.volume);
  console.error(m.code,'ideas',ideas[m.code].length);
  await new Promise(r=>setTimeout(r,800));
}

// --- exact historical metrics for seeds -------------------------------------
const exact={};
for(const m of markets){
  const r=await post(`/customers/${CID}:generateKeywordHistoricalMetrics`,{keywords:seeds,language:'languageConstants/1000',geoTargetConstants:[`geoTargetConstants/${m.geo}`],keywordPlanNetwork:'GOOGLE_SEARCH',includeAdultKeywords:false});
  exact[m.code]=(r.results||[]).map(x=>({
    text:x.text,closeVariants:x.closeVariants||[],
    volume:Number(x.keywordMetrics?.avgMonthlySearches||0),
    competition:x.keywordMetrics?.competition||null,
    competitionIndex:Number(x.keywordMetrics?.competitionIndex||0),
    lowBidUsd:x.keywordMetrics?.lowTopOfPageBidMicros?Number(x.keywordMetrics.lowTopOfPageBidMicros)/1e6*fx.USD:null,
    highBidUsd:x.keywordMetrics?.highTopOfPageBidMicros?Number(x.keywordMetrics.highTopOfPageBidMicros)/1e6*fx.USD:null,
    monthly:(x.keywordMetrics?.monthlySearchVolumes||[]).map(v=>({y:v.year,m:v.month,n:Number(v.monthlySearches||0)}))
  })).sort((a,b)=>b.volume-a.volume);
  await new Promise(r=>setTimeout(r,800));
}

const out={generatedAt:new Date().toISOString(),benchmark,fx,accountCurrency:currency,seeds,markets,ideas,exact};
writeFileSync(new URL('../docs/ads-keyword-data.json',import.meta.url),JSON.stringify(out,null,1));
console.log('saved docs/ads-keyword-data.json');

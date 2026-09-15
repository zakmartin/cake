// Creates the Google Ads conversion actions used by site/tracking.mjs and
// thank-you.html, reads their labels back and writes them into site/config.js.
// Idempotent: existing actions (matched by name) are reused, never duplicated.
//
//   node scripts/ads-conversions.mjs            # dry run: list + validateOnly
//   node scripts/ads-conversions.mjs --apply    # create missing actions, write config.js
import {readFile, writeFile} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {adsMutate, adsQuery, customerId, loadEnv} from './google-ads.mjs';

const APPLY=process.argv.includes('--apply');
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const configPath=resolve(root,'site','config.js');
const log=(s='')=>console.log(s);

const ACTIONS=[
  {
    key:'purchase',
    name:'Cake Quote Kit – Purchase',
    body:{
      type:'WEBPAGE',category:'PURCHASE',status:'ENABLED',
      countingType:'MANY_PER_CLICK',primaryForGoal:true,
      clickThroughLookbackWindowDays:30,viewThroughLookbackWindowDays:1,
      valueSettings:{defaultValue:6.9,defaultCurrencyCode:'USD',alwaysUseDefaultValue:false}
    }
  },
  {
    key:'lead',
    name:'Cake Quote Kit – Lead (result email)',
    body:{
      type:'WEBPAGE',category:'SUBMIT_LEAD_FORM',status:'ENABLED',
      countingType:'ONE_PER_CLICK',primaryForGoal:false,
      clickThroughLookbackWindowDays:30,viewThroughLookbackWindowDays:1
    }
  },
  {
    key:'checkout_click',
    name:'Cake Quote Kit – Checkout click',
    body:{
      type:'WEBPAGE',category:'BEGIN_CHECKOUT',status:'ENABLED',
      countingType:'ONE_PER_CLICK',primaryForGoal:false,
      clickThroughLookbackWindowDays:30,viewThroughLookbackWindowDays:1
    }
  }
];

const envFile=await loadEnv();
log(`Env: ${envFile}`);
log(`Customer: ${customerId()}  Mode: ${APPLY?'APPLY':'DRY RUN (validateOnly)'}`);

async function fetchActions(){
  const rows=await adsQuery(`
    SELECT conversion_action.id, conversion_action.resource_name, conversion_action.name, conversion_action.type,
           conversion_action.status, conversion_action.category, conversion_action.counting_type,
           conversion_action.primary_for_goal, conversion_action.tag_snippets,
           conversion_action.value_settings.default_value, conversion_action.value_settings.default_currency_code
    FROM conversion_action WHERE conversion_action.status != 'REMOVED'`);
  return rows.map(r=>r.conversionAction);
}

function labelOf(action){
  for(const s of action.tagSnippets||[]){
    if(s.type!=='WEBPAGE'||s.pageFormat!=='HTML')continue;
    const m=/send_to['"]?\s*:\s*['"]AW-(\d+)\/([\w-]+)/.exec(s.eventSnippet||'');
    if(m)return {adsId:'AW-'+m[1],label:m[2]};
  }
  return null;
}

let existing=await fetchActions();
log(`\nConversion actions in account: ${existing.length}`);
for(const a of existing)log(`  ${a.primaryForGoal?'PRIMARY  ':'secondary'}  ${a.type.padEnd(14)} ${a.category.padEnd(18)} ${a.name}`);

const ops=[];
const pending=[];
for(const def of ACTIONS){
  const found=existing.find(a=>a.name===def.name);
  if(found){log(`\n✓ exists: ${def.name} (id ${found.id})`);continue;}
  log(`\n+ create: ${def.name}  [${def.body.category}, ${def.body.countingType}, ${def.body.primaryForGoal?'primary':'secondary'}]`);
  ops.push({create:{name:def.name,...def.body}});
  pending.push(def);
}

if(ops.length){
  await adsMutate('conversionActions',ops,{validateOnly:true});
  log(`\n✅ validateOnly OK (${ops.length} operation${ops.length>1?'s':''})`);
  if(APPLY){
    const res=await adsMutate('conversionActions',ops);
    for(const [i,r] of (res.results||[]).entries())log(`✅ created ${pending[i].name} → ${r.resourceName}`);
    existing=await fetchActions();
  }
}else log('\nNothing to create.');

log('\nLabels:');
const labels={};
let adsId=null;
for(const def of ACTIONS){
  const a=existing.find(x=>x.name===def.name);
  const tag=a?labelOf(a):null;
  if(tag){labels[def.key]=tag.label;adsId=adsId||tag.adsId;}
  log(`  ${def.key.padEnd(15)} ${tag?`${tag.adsId}/${tag.label}`:(a?'(no HTML snippet returned)':'(not created yet)')}`);
}

if(!APPLY){
  log('\nDry run only. Re-run with --apply to create the actions and write site/config.js.');
  process.exit(0);
}

let config=await readFile(configPath,'utf8');
let changed=0;
for(const [key,label] of Object.entries(labels)){
  const re=new RegExp(`(\\b${key}:\\s*)'[^']*'`);
  if(!re.test(config)){log(`⚠ config.js has no "${key}:" entry inside conversionLabels`);continue;}
  const next=config.replace(re,`$1'${label}'`);
  if(next!==config){config=next;changed++;}
}
if(adsId){
  const re=/(googleAdsId:\s*)'[^']*'/;
  const next=config.replace(re,`$1'${adsId}'`);
  if(next!==config){config=next;changed++;log(`⚠ googleAdsId updated to ${adsId} – also update the gtag snippets in index.html and thank-you.html`);}
}
if(changed){await writeFile(configPath,config);log(`\n✅ site/config.js updated (${changed} value${changed>1?'s':''}). Run npm run build.`);}
else log('\nsite/config.js already up to date.');

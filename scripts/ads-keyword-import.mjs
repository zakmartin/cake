// Import manual Keyword Planner exports (ads.google.com → Keyword Planner → Download → .csv).
// Usage: node scripts/ads-keyword-import.mjs docs/kw/US.csv docs/kw/GB.csv ...
// Market code is taken from the file name (US, GB, CA, AU, ...). Handles UTF-16/UTF-8, tab or comma,
// English or Czech UI headers. Bids are converted from the account currency to USD.
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {basename} from 'node:path';

const files=process.argv.slice(2);
if(!files.length){console.error('Give me the exported CSV files, e.g. docs/kw/US.csv');process.exit(1)}

function decode(buf){
  if(buf[0]===0xFF&&buf[1]===0xFE)return buf.subarray(2).toString('utf16le');
  if(buf[0]===0xFE&&buf[1]===0xFF){const b=Buffer.from(buf.subarray(2));for(let i=0;i<b.length-1;i+=2){const t=b[i];b[i]=b[i+1];b[i+1]=t}return b.toString('utf16le')}
  // No BOM: Google's export is UTF-16LE, which shows up as every other byte being NUL.
  let nul=0;for(let i=1;i<Math.min(buf.length,400);i+=2)if(buf[i]===0)nul++;
  if(nul>Math.min(buf.length,400)/4)return buf.toString('utf16le');
  const s=buf.toString('utf8');
  return s.charCodeAt(0)===0xFEFF?s.slice(1):s;
}
function splitLine(line,sep){
  const out=[];let cur='',q=false;
  for(let i=0;i<line.length;i++){const c=line[i];
    if(c==='"'){if(q&&line[i+1]==='"'){cur+='"';i++}else q=!q}
    else if(c===sep&&!q){out.push(cur);cur=''}
    else cur+=c}
  out.push(cur);return out;
}
const num=v=>{if(v==null)return null;const s=String(v).replace(/\s| /g,'').replace(/[^\d,.\-]/g,'').replace(/,(?=\d{3}(\D|$))/g,'').replace(',','.');const n=parseFloat(s);return Number.isFinite(n)?n:null};
const find=(h,...needles)=>h.findIndex(c=>needles.some(n=>c.toLowerCase().includes(n)));

async function fx(){
  try{const r=await (await fetch('https://api.frankfurter.app/latest?from=CZK&to=USD,EUR,GBP')).json();return {CZK:r.rates}}catch{return {CZK:{USD:1/21,EUR:1/24.5,GBP:1/28}}}
}
const rates=await fx();
const toUsd=(v,cur)=>v==null?null:cur==='USD'?v:cur==='CZK'?v*rates.CZK.USD:cur==='EUR'?v*rates.CZK.USD/rates.CZK.EUR:cur==='GBP'?v*rates.CZK.USD/rates.CZK.GBP:v;

const out={generatedAt:new Date().toISOString(),source:'Keyword Planner manual export',fx:rates,markets:{}};
for(const f of files){
  const text=decode(readFileSync(f));
  const lines=text.split(/\r?\n/).filter(l=>l.trim());
  const sep=(lines.find(l=>l.includes('\t'))?'\t':',');
  const hi=lines.findIndex(l=>/keyword|klíčov/i.test(l)&&/search|vyhled/i.test(l));
  if(hi<0){console.error(f,': header row not found');continue}
  const h=splitLine(lines[hi],sep).map(s=>s.trim());
  const iKw=find(h,'keyword','klíčov'), iCur=find(h,'currency','měna'), iVol=find(h,'avg. monthly','prům','monthly searches'),
        iComp=find(h,'competition (indexed','konkurence (index'), iCompL=h.findIndex((c,i)=>i!==iComp&&/^competition$|^konkurence$/i.test(c)),
        iLow=find(h,'bid (low','low range','nízk'), iHigh=find(h,'bid (high','high range','vysok');
  const monthCols=h.map((c,i)=>({c,i})).filter(x=>/searches:|vyhledávání:/i.test(x.c));
  const market=basename(f).replace(/\.[^.]+$/,'').toUpperCase();
  const rows=[];
  for(const line of lines.slice(hi+1)){
    const cells=splitLine(line,sep);
    const kw=(cells[iKw]||'').trim();if(!kw)continue;
    const cur=(cells[iCur]||'CZK').trim().toUpperCase();
    rows.push({
      text:kw,
      volume:num(cells[iVol])??0,
      competition:iCompL>=0?cells[iCompL]:null,
      competitionIndex:iComp>=0?num(cells[iComp]):null,
      lowBidUsd:iLow>=0?toUsd(num(cells[iLow]),cur):null,
      highBidUsd:iHigh>=0?toUsd(num(cells[iHigh]),cur):null,
      monthly:monthCols.map(m=>({label:m.c.split(':')[1]?.trim(),n:num(cells[m.i])??0}))
    });
  }
  rows.sort((a,b)=>b.volume-a.volume);
  const tot=rows.reduce((s,r)=>s+r.volume,0);
  out.markets[market]={file:basename(f),count:rows.length,totalVolume:tot,rows};
  console.log(`${market}: ${rows.length} keywords, ${tot.toLocaleString('en-US')} searches/month, top: ${rows.slice(0,3).map(r=>`${r.text} (${r.volume}, $${r.lowBidUsd?.toFixed(2)}–${r.highBidUsd?.toFixed(2)})`).join('; ')}`);
}
mkdirSync('docs',{recursive:true});
writeFileSync('docs/ads-keyword-data.json',JSON.stringify(out,null,1));
console.log('saved docs/ads-keyword-data.json');

import {calculate} from './calculator.mjs';

const ids=['ingredients','hours','rate','extras','price','feePercent','feeFixed','margin'];
const $=id=>document.getElementById(id);
const form=$('price-form');
const resultEmailForm=$('result-email-form');
let latest=null;

function money(n){
  return new Intl.NumberFormat('en-US',{style:'currency',currency:$('currency').value}).format(n);
}

function readCalculation(){
  const valid=ids.every(id=>$(id).value.trim()!==''&&$(id).validity.valid);
  if(!valid)throw new RangeError('Fill in every field with a valid number of zero or more.');
  const values=Object.fromEntries(ids.map(id=>[id,Number($(id).value)]));
  return {values,result:calculate(values)};
}

function paint(values,r){
  latest={...values,...r};
  const symbol=new Intl.NumberFormat('en-US',{style:'currency',currency:$('currency').value}).formatToParts(0).find(p=>p.type==='currency').value;
  document.querySelectorAll('[data-currency]').forEach(el=>el.textContent=symbol);
  $('target').textContent=money(r.target);
  $('floor').textContent=money(r.floor);
  $('surplus').textContent=money(r.surplus);
  $('surplus').style.color=r.surplus<0?'#a33b2a':'#173e35';
  $('margin-pill').textContent=values.margin+'% margin';
  const verdict=r.surplus < -0.001
    ? 'Your price does not cover all entered costs, including your chosen pay.'
    : values.price+0.001<r.target
      ? 'Your costs are covered, but your target margin is not.'
      : 'Your current price meets your chosen margin for the costs entered.';
  $('result-verdict').textContent=verdict;
  $('gate-verdict').textContent=verdict;
  const parts={ingredients:values.ingredients,labour:r.labour,extras:values.extras,fees:r.fees};
  const total=Object.values(parts).reduce((a,b)=>a+b,0);
  for(const [key,value] of Object.entries(parts)){
    $('cost-'+key).textContent=money(value);
    $('bar-'+key).style.width=(total?value/total*100:0)+'%';
  }
}

function resetGate(){
  latest=null;
  $('calc-error').hidden=true;
  $('lead-gate').hidden=true;
  $('result').hidden=true;
}

form.addEventListener('submit',e=>{
  e.preventDefault();
  try{
    const {values,result}=readCalculation();
    paint(values,result);
    $('calc-error').hidden=true;
    $('result').hidden=true;
    $('lead-gate').hidden=false;
    $('lead-gate').scrollIntoView({behavior:'smooth',block:'nearest'});
  }catch(error){
    latest=null;
    $('lead-gate').hidden=true;
    $('result').hidden=true;
    $('calc-error').hidden=false;
    $('calc-error').textContent=error.message;
  }
});

form.addEventListener('input',resetGate);
$('currency').addEventListener('change',()=>{
  resetGate();
  const symbol=new Intl.NumberFormat('en-US',{style:'currency',currency:$('currency').value}).formatToParts(0).find(p=>p.type==='currency').value;
  document.querySelectorAll('[data-currency]').forEach(el=>el.textContent=symbol);
});

resultEmailForm.addEventListener('submit',async e=>{
  e.preventDefault();
  if(!latest)return;
  const email=$('result-email').value.trim();
  const consent=$('result-consent').checked;
  const button=$('send-result');
  const message=$('gate-message');
  if(!email||!$('result-email').validity.valid||!consent){
    resultEmailForm.reportValidity();
    return;
  }
  button.disabled=true;
  button.firstChild.textContent='Sending… ';
  message.className='gate-message';
  message.textContent='Securely sending your result…';
  try{
    const response=await fetch('/api/subscribe-result',{
      method:'POST',
      headers:{'Content-Type':'application/json','Accept':'application/json'},
      body:JSON.stringify({
        email,
        consent,
        company:$('company').value,
        currency:$('currency').value,
        inputs:Object.fromEntries(ids.map(id=>[id,latest[id]]))
      })
    });
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data.message||'We could not send your result. Please try again.');
    message.className='gate-message success';
    message.textContent='Sent — check your inbox. Your full result is shown below too.';
    $('result').hidden=false;
    $('result').scrollIntoView({behavior:'smooth',block:'nearest'});
    button.firstChild.textContent='Result sent ';
  }catch(error){
    message.className='gate-message error-message';
    message.textContent=error.message;
    button.disabled=false;
    button.firstChild.textContent='Email my result ';
  }
});

$('download-result').addEventListener('click',()=>{
  if(!latest)return;
  const r=latest;
  const text=['CAKE QUOTE KIT — YOUR PRICE CHECK','',`Currency: ${$('currency').value}`,`Ingredients: ${money(r.ingredients)}`,`Time: ${r.hours} hours at ${money(r.rate)}/hour`,`Packaging and overheads: ${money(r.extras)}`,`Payment fees: ${r.feePercent}% + ${money(r.feeFixed)}`,`Target margin: ${r.margin}%`,'',`Current price: ${money(r.price)}`,`Surplus after entered costs, chosen pay and fees: ${money(r.surplus)}`,`Break-even price including chosen pay and fees: ${money(r.floor)}`,`Price for target margin: ${money(r.target)}`,'','Estimate based on your entries. Excludes taxes and costs not entered. Not a guarantee of demand or profit.','Cake Quote Kit'].join('\n');
  const url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'}));
  const a=document.createElement('a');
  a.href=url;
  a.download='my-cake-price-check.txt';
  a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
});

const config=window.CAKE_CONFIG||{};
function safeHttps(value){
  try{
    const url=new URL(value);
    return url.protocol==='https:'&&!url.username&&!url.password?url.href:null;
  }catch{return null;}
}

const checkout=safeHttps(config.checkoutUrl);
const privacy=safeHttps(config.privacyUrl);
const terms=safeHttps(config.termsUrl);
const ready=config.launchReady===true&&!!checkout&&!!privacy&&!!terms&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(config.supportEmail||'');

if(checkout){
  $('checkout-link').href=checkout;
  $('hero-checkout-link').href=checkout;
  $('product-price').textContent=config.priceLabel||'$6.90 USD';
  $('hero-product-price').textContent=config.priceLabel||'$6.90 USD';
  $('launch-status').textContent='Checkout opens here. Secure payment and instant file delivery are handled by Payhip.';
  $('preview-note').textContent='Private preview · Payhip checkout connected';
}

$('preview-note').textContent='Private preview · Payhip checkout + inline email delivery connected';

if(ready){
  $('preview-note').hidden=true;
  $('launch-status').hidden=true;
  const links=[['Privacy',privacy],['Terms',terms],['Support','mailto:'+config.supportEmail]];
  links.forEach(([label,url])=>{
    const link=document.createElement('a');
    link.textContent=label;
    link.href=url;
    $('legal-links').append(link);
  });
}

document.addEventListener('click',e=>{
  const el=e.target.closest('[data-action],.payhip-buy-button,#signup-link,#send-result,#download-result');
  if(el)window.dispatchEvent(new CustomEvent('cake:action',{detail:{action:el.dataset.action||el.id}}));
});

resetGate();

// Google Ads / gtag.js event layer. Sends only action names and the public product price.
// Never pass email addresses or calculator inputs here.
const config=window.CAKE_CONFIG||{};
const ADS_ID=config.googleAdsId||'AW-1040350636';
const labels=config.conversionLabels||{};
const item={item_id:config.productId||'N5CET',item_name:config.productName||'Cake Quote Kit',price:config.priceValue||6.9};

function gtagReady(){return typeof window.gtag==='function';}

export function track(name,params={}){
  if(!gtagReady())return false;
  window.gtag('event',name,params);
  return true;
}

// Fires a Google Ads conversion when a label is configured for `key`.
export function conversion(key,params={}){
  const label=labels[key];
  if(!label||!gtagReady())return false;
  window.gtag('event','conversion',{send_to:ADS_ID+'/'+label,...params});
  return true;
}

const price={currency:config.priceCurrency||'USD',value:config.priceValue||6.9};

// Maps `cake:action` events (dispatched by app.mjs) to gtag events and conversions.
const handlers={
  checkout_header:()=>checkoutClick('header'),
  checkout_hero:()=>checkoutClick('hero'),
  checkout_offer:()=>checkoutClick('offer'),
  'checkout-link':()=>checkoutClick('offer'),
  'hero-checkout-link':()=>checkoutClick('hero'),
  calculate:()=>track('calculate_price'),
  lead_sent:()=>{
    track('generate_lead',{method:'calculator_result_email',currency:price.currency,value:0});
    conversion('lead',{currency:price.currency,value:0});
  },
  checklist_open:()=>track('view_checklist'),
  'download-result':()=>track('download_result')
};

function checkoutClick(placement){
  track('begin_checkout',{...price,placement,items:[item]});
  conversion('checkout_click',price);
}

window.addEventListener('cake:action',e=>{
  const handler=handlers[e.detail&&e.detail.action];
  if(handler)handler();
});

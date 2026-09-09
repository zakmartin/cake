// Shared /api/subscribe-result handler. Web-standard Request/Response only, so it runs
// unchanged inside the OpenAI hosting worker (see scripts/build.mjs) and Vercel Functions
// (see api/subscribe-result.js). Never log or persist email addresses or calculator inputs.
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
function clientIp(request){
  const direct=request.headers.get('CF-Connecting-IP')||request.headers.get('X-Real-IP');
  if(direct)return direct.trim();
  const forwarded=request.headers.get('X-Forwarded-For');
  return forwarded?forwarded.split(',')[0].trim():'';
}
function expectedOrigin(request){
  const host=request.headers.get('X-Forwarded-Host')||request.headers.get('Host');
  if(!host)return new URL(request.url).origin;
  const proto=request.headers.get('X-Forwarded-Proto')||new URL(request.url).protocol.replace(':','');
  return proto+'://'+host.split(',')[0].trim();
}

export async function subscribe(request,env){
  if(request.method!=='POST')return json({message:'Method not allowed.'},405);
  const origin=request.headers.get('Origin');
  if(origin&&origin!==expectedOrigin(request))return json({message:'Request not allowed.'},403);
  if(!(request.headers.get('Content-Type')||'').toLowerCase().includes('application/json'))return json({message:'Send JSON.'},415);
  const length=Number(request.headers.get('Content-Length')||0);
  if(length>12000)return json({message:'Request is too large.'},413);
  let body;
  try{body=JSON.parse(await request.text())}catch{return json({message:'Invalid request.'},400)}
  if(body.company)return json({ok:true});
  const email=String(body.email||'').trim().toLowerCase();
  if(body.consent!==true||email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email))return json({message:'Enter a valid email and confirm your subscription.'},400);
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
  const ip=clientIp(request);
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

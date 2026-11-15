import {fail} from './model.js';

// J$5,000 converted using the BOJ selling rate of J$159.2957 per US$1 on 13 Nov 2026.
export const launchPlan={id:'10ccc2eaa64d13037fa144e9',name:'ICSS Plaza Monthly',amount:3139,currency:'USD'};
const productId='PROD-ICSS-PLAZA-RENTAL';
const eventTypes=[
 'BILLING.SUBSCRIPTION.ACTIVATED','BILLING.SUBSCRIPTION.SUSPENDED','BILLING.SUBSCRIPTION.CANCELLED',
 'BILLING.SUBSCRIPTION.EXPIRED','BILLING.SUBSCRIPTION.PAYMENT.FAILED',
 'PAYMENT.SALE.COMPLETED','PAYMENT.SALE.REFUNDED','PAYMENT.SALE.REVERSED'
];
const reference=x=>typeof x==='string'&&/^[A-Z0-9-]{4,60}$/.test(x);
const planReference=x=>typeof x==='string'&&/^P-[A-Z0-9]{8,58}$/.test(x);
const price=(amount)=>(amount/100).toFixed(2);
export function matchesMonthlyPlan(actual,plan){
 const cycle=actual?.billing_cycles?.[0],fixed=cycle?.pricing_scheme?.fixed_price;
 const value=String(fixed?.value??'');
 return actual?.status==='ACTIVE'&&actual.billing_cycles?.length===1&&cycle.tenure_type==='REGULAR'&&cycle.total_cycles===0&&
  cycle.frequency?.interval_unit==='MONTH'&&cycle.frequency?.interval_count===1&&
  fixed?.currency_code===plan.currency&&/^\d+(\.\d{1,2})?$/.test(value)&&Math.round(Number(value)*100)===plan.amount&&
  Number(actual.payment_preferences?.setup_fee?.value||0)===0&&Number(actual.taxes?.percentage||0)===0;
}

export function paypalLaunch({request,origin,configuredWebhook}) {
 const url=origin+'/api/billing/hooks/paypal';
 let cached;
 const goodHook=hook=>hook?.url===url&&reference(hook.id)&&
  (hook.event_types?.some(event=>event.name==='*')||eventTypes.every(type=>hook.event_types?.some(event=>event.name===type)));
 function cache(hook){cached={id:hook.id,expires:Date.now()+300000};return cached.id;}
 async function webhook(headers,{create=false}={}){
  if(configuredWebhook&&!create)return configuredWebhook;
  if(!create&&cached?.expires>Date.now())return cached.id;
  const path='/v1/notifications/webhooks';
  const existing=configuredWebhook?[await request(path+'/'+encodeURIComponent(configuredWebhook),{headers,missing:true})]:
   (await request(path,{headers})).webhooks||[];
  const found=existing.find(goodHook);
  if(found)return cache(found);
  if(configuredWebhook||existing.some(hook=>hook?.url===url))fail('The PayPal webhook must use '+url+' and include all eight rental events listed in the platform operations guide.',409);
  if(!create)fail('PayPal rental notifications are not configured. Contact ICSS Plaza.',503);
  const created=await request(path,{method:'POST',headers,body:JSON.stringify({url,event_types:eventTypes.map(name=>({name}))})});
  const hook=goodHook(created)||!reference(created?.id)?created:await request(path+'/'+created.id,{headers});
  if(!goodHook(hook))fail('PayPal did not confirm the rental webhook. Verify it before offering payments.',502);
  return cache(hook);
 }
 async function verifyPlan(reference,headers) {
  if(!planReference(reference))return false;
  const actual=await request('/v1/billing/plans/'+reference,{headers,missing:true});
  return actual?.product_id===productId&&matchesMonthlyPlan(actual,launchPlan);
 }
 async function setup(headers,local){
  await webhook(headers,{create:true});
  if(local){
   if(!await verifyPlan(local.paypal_plan,headers))fail('The linked PayPal plan no longer matches the USD monthly price. Check it in PayPal before accepting payments.',409);
   return local.paypal_plan;
  }
  const productPath='/v1/catalogs/products';
  const product=await request(productPath+'/'+productId,{headers,missing:true})||
   await request(productPath,{method:'POST',headers:{...headers,'PayPal-Request-Id':'plaza-monthly-product-v1'},
    body:JSON.stringify({id:productId,name:'ICSS Plaza Storefront Rental',description:'Monthly access to an ICSS Plaza online storefront.',type:'SERVICE'})});
  if(product.id!==productId)fail('PayPal did not confirm the ICSS Plaza rental product.',502);
  const plansPath='/v1/billing/plans';
  // Retry safely if PayPal created the plan but the local write did not finish.
  for(let page=1;page<=5;page++){
   const data=await request(plansPath+'?product_id='+productId+'&page_size=20&total_required=true&page='+page,{headers});
   for(const plan of data.plans||[]){
    if(plan.name===launchPlan.name&&await verifyPlan(plan.id,headers))return plan.id;
   }
   if(!data.links?.some(link=>link.rel==='next')&&!(data.total_pages>page))break;
   if(page===5)fail('Too many PayPal plans to check safely. Use the manual plan link in Subscriptions.',409);
  }
  const data=await request(plansPath,{method:'POST',headers:{...headers,'PayPal-Request-Id':'plaza-monthly-usd-3139-v1'},
   body:JSON.stringify({product_id:productId,name:launchPlan.name,description:'Recurring monthly ICSS Plaza storefront rental.',status:'ACTIVE',
    billing_cycles:[{frequency:{interval_unit:'MONTH',interval_count:1},tenure_type:'REGULAR',sequence:1,total_cycles:0,
     pricing_scheme:{fixed_price:{value:price(launchPlan.amount),currency_code:launchPlan.currency}}}],
    payment_preferences:{auto_bill_outstanding:false,setup_fee_failure_action:'CANCEL',payment_failure_threshold:1}})});
  if(!await verifyPlan(data.id,headers))fail('PayPal did not confirm the active US$31.39 monthly plan.',502);
  return data.id;
 }
 return {webhook,setup};
}

import {fail} from './model.js';

// J$5,000 converted using the BOJ selling rate of J$159.2957 per US$1 on 13 Nov 2026.
export const launchPlan={id:'10ccc2eaa64d13037fa144e9',name:'ICSS Plaza Monthly',amount:3139,currency:'USD',paypalPlan:'P-59K86224KG120672MNL5AQNA'};
const eventTypes=[
 'BILLING.SUBSCRIPTION.ACTIVATED','BILLING.SUBSCRIPTION.SUSPENDED','BILLING.SUBSCRIPTION.CANCELLED',
 'BILLING.SUBSCRIPTION.EXPIRED','BILLING.SUBSCRIPTION.PAYMENT.FAILED',
 'PAYMENT.SALE.COMPLETED','PAYMENT.SALE.REFUNDED','PAYMENT.SALE.REVERSED'
];
const reference=x=>typeof x==='string'&&/^[A-Z0-9-]{4,60}$/.test(x);
export function matchesMonthlyPlan(actual,plan){
 const cycle=actual?.billing_cycles?.[0],fixed=cycle?.pricing_scheme?.fixed_price;
 const value=String(fixed?.value??'');
 return actual?.status==='ACTIVE'&&actual.billing_cycles?.length===1&&cycle?.tenure_type==='REGULAR'&&cycle.total_cycles===0&&
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
 async function setup(headers){
  const ref=launchPlan.paypalPlan;
  const actual=await request('/v1/billing/plans/'+ref,{headers,missing:true});
  if(!actual||actual.id!==ref)fail('This plan was not found in the connected PayPal Live account. Check that you saved credentials for the same PayPal app that owns the plan.',409);
  if(actual.billing_cycles?.some(cycle=>cycle?.tenure_type==='TRIAL'))
   fail('This PayPal plan includes a trial cycle. Use an active US$31.39 monthly plan without a separate PayPal trial; Plaza provides the 14 days.',409);
  if(!matchesMonthlyPlan(actual,launchPlan))
   fail('The PayPal plan must be active at US$31.39 every month, with no setup fee or added PayPal tax.',409);
  await webhook(headers,{create:true});
  return ref;
 }
 return {webhook,setup};
}

import {fygaroJWT,verifyFygaro} from './payments.js';
import {fail,id,integer,safeURL,text} from './model.js';
import {launchPlan,matchesMonthlyPlan,paypalLaunch} from './paypal-launch.js';
import {paypalSettings} from './paypal-settings.js';

const paypalId=x=>typeof x==='string'&&/^[A-Z0-9-]{4,60}$/.test(x);
const paidStates=['active','renewal_due','past_due','cancelled','suspended','expired','refunded'];
const minor=(amount,currency,expected)=>currency===expected&&/^\d+(\.\d{1,2})?$/.test(String(amount))?Math.round(Number(amount)*100):-1;
const monthAfter = start => {
 const d=new Date(start),day=d.getUTCDate();
 d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+1);
 const end=new Date(d);end.setUTCMonth(end.getUTCMonth()+1);end.setUTCDate(0);
 d.setUTCDate(Math.min(day,end.getUTCDate()));return d.getTime();
};

export function createPlatformBilling({db,key,env=process.env,fetcher=fetch,origin,audit,notify}) {
 const {one,all,run,tx}=db;
 const fy={buttonURL:env.PLAZA_FYGARO_LINK,keyId:env.PLAZA_FYGARO_KEY_ID,secret:env.PLAZA_FYGARO_SECRET};
 const fallback={client:env.PLAZA_PAYPAL_CLIENT_ID?.trim(),secret:env.PLAZA_PAYPAL_SECRET?.trim(),
  webhook:env.PLAZA_PAYPAL_WEBHOOK_ID?.trim(),live:env.PLAZA_PAYPAL_MODE==='live'};
 const secure=!!origin?.startsWith('https://');
 const fygaroReady=!!(fy.buttonURL&&fy.keyId&&fy.secret&&secure);
 const config=paypalSettings({db,key});
 const launchRow=()=>one('SELECT * FROM plaza_plans WHERE id=?',launchPlan.id);
 let lastAccount,settingUp=false;
 function account(pp){
  const api=pp.live?'https://api-m.paypal.com':'https://api-m.sandbox.paypal.com';
  async function request(path,{missing=false,...options}={}) {
   let r;
   try{r=await fetcher(api+path,{...options,redirect:'error',signal:AbortSignal.timeout(15000)});}
   catch{fail('Could not connect to PayPal. Try again shortly.',502);}
   if(missing&&r.status===404)return null;
   if(path==='/v1/oauth2/token'&&[400,401,403].includes(r.status))fail('PayPal rejected the app credentials. Check that the Client ID and secret are both from the same Live app.',502);
   if(!r.ok)fail('PayPal could not complete the request. Try again or contact Plaza support.',502);
   return r.status===204?{}:r.json();
  }
  async function authorize() {
   const r=await request('/v1/oauth2/token',{method:'POST',headers:{Authorization:'Basic '+Buffer.from(pp.client+':'+pp.secret).toString('base64'),'Content-Type':'application/x-www-form-urlencoded'},body:'grant_type=client_credentials'});
   if(!r.access_token)fail('PayPal credentials could not be verified.',502);
   return {Authorization:'Bearer '+r.access_token,'Content-Type':'application/json'};
  }
  return {...pp,credentials:!!(pp.client&&pp.secret&&secure),request,authorize,launch:paypalLaunch({request,origin,configuredWebhook:pp.webhook})};
 }
 async function currentAccount() {
  const saved=await config.read();
  const pp=saved?{...saved,live:true,webhook:fallback.live&&saved.client===fallback.client?fallback.webhook:undefined}:fallback;
  if(!lastAccount||['client','secret','webhook','live','updated'].some(k=>pp[k]!==lastAccount[k]))lastAccount=account(pp);
  return lastAccount;
 }
 async function readiness(row=undefined,pp=undefined) {
  pp??=await currentAccount();
  return {fygaro:fygaroReady,paypal:pp.credentials&&Boolean(pp.webhook||
   pp.live&&(row===undefined?await launchRow():row)?.paypal_plan)};
 }
 const credential=(raw,label)=>{
  if(typeof raw!=='string'||!/^[A-Za-z0-9_-]{6,256}$/.test(raw.trim())||raw.length>300)fail('Enter a valid PayPal '+label+'.');
  return raw.trim();
 };
 async function checkReplacement(current,client){
  if(current.live&&current.client===client)return;
  if(await one("SELECT id FROM plaza_plans WHERE paypal_plan<>'' LIMIT 1")||
     await one("SELECT id FROM plaza_rentals WHERE provider='paypal' AND provider_id IS NOT NULL LIMIT 1"))
   fail('PayPal billing is already linked. Use the same Live app to replace its secret so existing subscriptions stay connected.',409);
 }
 const select='SELECT r.*,p.name AS plan_name,t.slug FROM plaza_rentals r JOIN plaza_plans p ON p.id=r.plan_id JOIN tenants t ON t.id=r.tenant_id';
 const stateFor=r=>r.paid_until&&r.paid_until<=Date.now()&&['active','renewal_due'].includes(r.status)?(r.provider==='fygaro'?'renewal_due':'past_due'):r.status;
 const show=r=>r?{...r,status:stateFor(r)}:null;
 const chosen=tid=>one(select+" WHERE r.tenant_id=? ORDER BY CASE WHEN r.paid_until>0 OR r.status IN ('active','past_due','cancelled','suspended','expired','renewal_due','refunded') THEN 0 ELSE 1 END,r.paid_until DESC,r.created DESC,r.id DESC LIMIT 1",tid);
 async function addEvent(r,kind,event,mutation) {
  return tx(async()=>{
   const current=await one('SELECT * FROM plaza_rentals WHERE id=?',r.id);
   if(await one('SELECT id FROM plaza_billing_events WHERE id=?',event))return false;
   await mutation(current);
   await run('INSERT INTO plaza_billing_events VALUES(?,?,?,?)',event,r.id,kind,Date.now());
   await audit(r.tenant_id,'billing','rental.'+kind+'.'+r.provider);
   return true;
  },'tenant:'+r.tenant_id);
 }
 async function receipt(r,kind) {
  const account=await one('SELECT u.email,t.settings FROM tenants t JOIN users u ON u.id=t.owner WHERE t.id=?',r.tenant_id);
  if(account)await notify('rental_billing',kind+'/'+r.id+'/'+r.paid_until,account.email,{store:JSON.parse(account.settings).name,status:kind,reference:r.id});
 }
 async function grant(r,end) {
  const until=Math.max(end,r.paid_until),next=r.provider==='paypal'&&['cancelled','suspended','expired'].includes(r.status)?r.status:'active';
  await run('UPDATE plaza_rentals SET status=?,paid_until=?,updated=? WHERE id=?',next,until,Date.now(),r.id);
  await run("UPDATE tenants SET status='active' WHERE id=? AND status='trial'",r.tenant_id);
  await receipt({...r,paid_until:until},'payment confirmed');
 }
 return {
  async overview(){
   const pp=await currentAccount();
   return {billing:await readiness(undefined,pp),paypalMode:pp.live?'live':'sandbox'};
  },
  async savePayPalSettings(b,actor){
   if(!secure)fail('Connect the Plaza site over HTTPS before saving PayPal credentials.',503);
   const current=await currentAccount();
   const given=typeof b.clientId==='string'?b.clientId.trim():'';
   const client=credential(given||(current.live?current.client:''),'Client ID');
   const secret=credential(b.secret,'client secret');
   await checkReplacement(current,client);
   await account({client,secret,live:true}).authorize();
   await tx(async()=>{
    const latest=await currentAccount();
    if(latest.secret!==current.secret||latest.client!==current.client||latest.updated!==current.updated)
     fail('PayPal settings changed. Reload the portal and try again.',409);
    await checkReplacement(latest,client);
    await config.write({client,secret,updated:Date.now()});
    await audit(null,actor,'rental.paypal.credentials.saved');
   },'billing-plans');
   return {ok:true};
  },
  async setupPayPal(actor){
   const pp=await currentAccount();
   if(!pp.live||!pp.credentials)fail('Save the Live PayPal app credentials in Developer → Subscriptions before completing setup.',503);
   if(settingUp)fail('PayPal setup is already running. Try again shortly.',409);
   settingUp=true;
   try {
    const local=await launchRow(),linked=await pp.launch.setup(await pp.authorize(),local);
    if(!local)await tx(async()=>{
     if((await currentAccount()).client!==pp.client)fail('PayPal settings changed. Run setup again.',409);
     if(await launchRow())return;
     await run('INSERT INTO plaza_plans VALUES(?,?,?,?,?,?,?)',launchPlan.id,launchPlan.name,launchPlan.amount,launchPlan.currency,linked,1,Date.now());
     await audit(null,actor,'rental.paypal.launch.'+launchPlan.id);
    },'billing-plans');
    const result=await launchRow();
    return {id:result.id,enabled:!!result.enabled};
   }finally{settingUp=false;}
  },
  async available(t) {
   if(!t||['suspended','cancelled'].includes(t.status))return false;
   if(/^plaza-test-/.test(t.slug))return false;
   const row=await chosen(t.id);
   if(row&&(row.paid_until||paidStates.includes(row.status))) return row.paid_until>Date.now()&&!['suspended','refunded'].includes(row.status);
   return t.status==='active'||t.status==='trial'&&t.trial_end>Date.now();
  },
  async list(tid) {
   const plans=await all(tid?'SELECT * FROM plaza_plans WHERE enabled=1 ORDER BY created DESC':'SELECT * FROM plaza_plans ORDER BY created DESC LIMIT 100');
   const rentals=(await all(select+(tid?' WHERE r.tenant_id=?':'')+' ORDER BY r.created DESC,r.id DESC LIMIT 100',...(tid?[tid]:[]))).map(show);
   const events=tid?[]:await all('SELECT e.kind,e.created,r.provider,r.tenant_id FROM plaza_billing_events e JOIN plaza_rentals r ON r.id=e.rental_id ORDER BY e.created DESC LIMIT 60');
   const managed=plans.find(p=>p.id===launchPlan.id)??(tid?await launchRow():null);
   const pp=await currentAccount(),live=pp.live;
   const providers=await readiness(managed,pp);
   const offered=plans.map(p=>p.id===launchPlan.id?{...p,paypalOnly:true}:p).filter(p=>!tid||!p.paypalOnly||providers.paypal&&live);
   return {plans:offered,rentals,events,providers,paypalMode:live?'live':'sandbox',
    ...(!tid?{paypalSetup:{credentialsReady:pp.credentials&&live,hasClientId:!!(live&&pp.client),portalSaved:!!pp.updated,enabled:!!managed?.enabled,linked:!!managed}}:{})};
  },
  async plan(b,actor) {
   const name=text(b.name,80,2),amount=integer(b.amount,100000000,1),currency=b.currency;
   if(!['JMD','USD'].includes(currency))fail('Choose JMD or USD.');
   const plan=text(b.paypalPlan||'',60);
   if(plan&&(currency!=='USD'||!/^P-[A-Z0-9]{8,}$/.test(plan)))fail('PayPal monthly plans require a USD plan ID.');
   const pid=id();
   await tx(async()=>{await run('INSERT INTO plaza_plans VALUES(?,?,?,?,?,?,?)',pid,name,amount,currency,plan,1,Date.now());await audit(null,actor,'rental.plan.created.'+pid);},'billing-plans');
   return {id:pid};
  },
  async setPlan(pid,b,actor) {
   if(typeof b.enabled!=='boolean')fail('Choose whether this plan accepts new subscriptions.');
   await tx(async()=>{
    if(!await one('SELECT id FROM plaza_plans WHERE id=?',pid))fail('Plan not found.',404);
    await run('UPDATE plaza_plans SET enabled=? WHERE id=?',Number(b.enabled),pid);
    await audit(null,actor,'rental.plan.'+(b.enabled?'enabled.':'disabled.')+pid);
   },'billing-plans');
  },
  async checkout(t,b) {
   const provider=b.provider;
   const pp=provider==='paypal'?await currentAccount():null;
   if(!['fygaro','paypal'].includes(provider)||provider==='fygaro'&&!fygaroReady||
      provider==='paypal'&&(!pp.live||!(await readiness(undefined,pp)).paypal))fail('This payment method is not configured.',503);
   if(['suspended','cancelled'].includes(t.status)||/^plaza-test-/.test(t.slug))fail('Billing is unavailable for this store.',403);
   const plan=await one('SELECT * FROM plaza_plans WHERE id=? AND enabled=1',text(b.plan,24,24));
   if(!plan)fail('Plan unavailable.',404);
   if(plan.id===launchPlan.id&&provider!=='paypal')fail('This USD monthly plan is available through PayPal only.');
   if(provider==='paypal'&&!plan.paypal_plan)fail('This plan does not offer PayPal.');
   let headers;
   if(provider==='paypal'){
    headers=await pp.authorize();
    await pp.launch.webhook(headers);
    const actual=await pp.request('/v1/billing/plans/'+plan.paypal_plan,{headers});
    if(!matchesMonthlyPlan(actual,plan))fail('PayPal plan price or schedule does not match Plaza.',409);
   }
   const r=await tx(async()=>{
    const current=await chosen(t.id);
    const pending=await one("SELECT * FROM plaza_rentals WHERE tenant_id=? AND status='pending' AND (created>? OR provider='paypal' AND provider_id IS NOT NULL) ORDER BY created DESC LIMIT 1",t.id,Date.now()-3600000);
    const agreement=await one("SELECT id FROM plaza_rentals WHERE tenant_id=? AND provider='paypal' AND provider_id IS NOT NULL AND status NOT IN ('cancelled','expired','pending') LIMIT 1",t.id);
    if(agreement)fail('Cancel the existing PayPal subscription before starting another.',409);
    if(current?.paid_until>Date.now()&&(provider==='paypal'||current.provider!==provider))fail('Wait until the current paid period ends before changing billing providers.',409);
    if(pending?.provider===provider&&pending.plan_id===plan.id)return pending;
    if(pending)fail('A checkout is already open for this store. Finish it or wait for it to expire.',409);
    const rid=id(),now=Date.now();
    await run('INSERT INTO plaza_rentals VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',rid,t.id,plan.id,provider,plan.amount,plan.currency,plan.paypal_plan,null,'pending',0,now,now);
    return one('SELECT * FROM plaza_rentals WHERE id=?',rid);
   },'tenant:'+t.id);
   if(provider==='fygaro'){
    let u;try{u=new URL(safeURL(fy.buttonURL,['fygaro.com']));}catch{fail('The platform Fygaro link is invalid.',503);}
    u.searchParams.set('jwt',fygaroJWT({id:'plaza-'+r.id,total:r.amount,currency:r.currency},fy));return {url:u.toString()};
   }
   const data=await pp.request(r.provider_id?'/v1/billing/subscriptions/'+r.provider_id:'/v1/billing/subscriptions',r.provider_id?{headers}:{method:'POST',headers:{...headers,'PayPal-Request-Id':'plaza-'+r.id},
    body:JSON.stringify({plan_id:r.provider_plan,custom_id:r.id,application_context:{brand_name:'ICSS Plaza',user_action:'SUBSCRIBE_NOW',shipping_preference:'NO_SHIPPING',return_url:origin+'/admin?tab=billing',cancel_url:origin+'/admin?tab=billing'}})});
   if(!paypalId(data.id))fail('PayPal returned an invalid subscription reference.',502);
   await run('UPDATE plaza_rentals SET provider_id=?,updated=? WHERE id=?',data.id,Date.now(),r.id);
   const link=data.links?.find(x=>x.rel==='approve');
   if(!link)fail('PayPal approval is no longer available. Check the rental dashboard.',409);
   return {url:safeURL(link.href,['paypal.com'])};
  },
  async cancel(t,rid,actor) {
   const r=await one("SELECT * FROM plaza_rentals WHERE id=? AND tenant_id=? AND provider='paypal'",rid,t.id);
   if(!r?.provider_id)fail('PayPal subscription not found.',404);
   if(r.status==='cancelled'||r.status==='expired')return;
   const pp=await currentAccount();
   if(!pp.credentials||!pp.live)fail('Live PayPal subscription management is not configured.',503);
   const headers=await pp.authorize();
   const path='/v1/billing/subscriptions/'+r.provider_id;
   const remote=await pp.request(path,{headers});
   if(remote.id!==r.provider_id||remote.plan_id!==r.provider_plan||remote.custom_id!==r.id)fail('PayPal subscription does not match this rental.',409);
   if(!['CANCELLED','EXPIRED'].includes(remote.status))await pp.request(path+'/cancel',{method:'POST',headers,body:JSON.stringify({reason:'Cancelled in ICSS Plaza'})});
   await addEvent(r,'cancelled','cancel/'+r.id,async current=>{
    await run("UPDATE plaza_rentals SET status='cancelled',updated=? WHERE id=?",Date.now(),r.id);await receipt(current,'automatic renewal cancelled');
    await audit(t.id,actor,'rental.cancel.requested');
   });
  },
  async fygaroHook(b,raw,headers) {
   if(!fygaroReady||!verifyFygaro(raw,headers,fy))fail('Invalid Fygaro signature.',401);
   const match=String(b.customReference||'').match(/^plaza-([a-f0-9]{24})$/);
   if(!match)fail('Unknown rental reference.',404);
   const r=await one("SELECT * FROM plaza_rentals WHERE id=? AND provider='fygaro'",match[1]);
   const transaction=text(b.transactionId||'',180,1);
   if(!r||minor(b.amount,b.currency,r.currency)!==r.amount)fail('Rental amount or currency mismatch.',409);
   await addEvent(r,'payment','fygaro/'+transaction,async current=>{
    if(current.paid_until)fail('This payment link was already used. Contact Plaza about a duplicate charge.',409);
    const prior=await one("SELECT MAX(paid_until) AS n FROM plaza_rentals WHERE tenant_id=? AND provider='fygaro'",r.tenant_id);
    await grant(current,monthAfter(Math.max(Date.now(),prior.n||0)));
   });
  },
  async paypalHook(b,h) {
   const pp=await currentAccount();
   if(!(await readiness(undefined,pp)).paypal)fail('PayPal webhooks are not configured.',503);
   const signature={auth_algo:h['paypal-auth-algo'],cert_url:h['paypal-cert-url'],transmission_id:h['paypal-transmission-id'],
    transmission_sig:h['paypal-transmission-sig'],transmission_time:h['paypal-transmission-time']};
   if(Object.values(signature).some(v=>typeof v!=='string'||!v))fail('Missing PayPal signature.',401);
   const headers=await pp.authorize();
   const webhook=await pp.launch.webhook(headers);
   const v=await pp.request('/v1/notifications/verify-webhook-signature',{method:'POST',headers,body:JSON.stringify({...signature,webhook_id:webhook,webhook_event:b})});
   if(v.verification_status!=='SUCCESS')fail('Invalid PayPal signature.',401);
   const type=b.event_type,resource=b.resource||{},sale=type==='PAYMENT.SALE.COMPLETED';
   const statuses={'BILLING.SUBSCRIPTION.CANCELLED':'cancelled','BILLING.SUBSCRIPTION.SUSPENDED':'suspended','BILLING.SUBSCRIPTION.EXPIRED':'expired','BILLING.SUBSCRIPTION.PAYMENT.FAILED':'past_due'};
   const reversal=['PAYMENT.SALE.REFUNDED','PAYMENT.SALE.REVERSED'].includes(type);
   if(!sale&&!reversal&&!statuses[type]&&type!=='BILLING.SUBSCRIPTION.ACTIVATED')return;
   const pid=sale||reversal?resource.billing_agreement_id:resource.id;
   if(typeof b.id!=='string'||!b.id||b.id.length>150)return;
   let r=paypalId(pid)?await one("SELECT * FROM plaza_rentals WHERE provider='paypal' AND provider_id=?",pid):null;
   if(!r&&reversal){const original=resource.sale_id||resource.parent_sale_id||(type==='PAYMENT.SALE.REVERSED'?resource.id:null);if(paypalId(original))r=await one("SELECT r.* FROM plaza_billing_events e JOIN plaza_rentals r ON r.id=e.rental_id WHERE e.id=? AND r.provider='paypal'",'paypal-sale/'+original);}
   if(!r){if(type==='BILLING.SUBSCRIPTION.ACTIVATED'&&typeof resource.custom_id==='string'&&await one("SELECT id FROM plaza_rentals WHERE id=? AND provider='paypal'",resource.custom_id))fail('Subscription is still being linked. Retry shortly.',503);return;}
   if(sale||type==='BILLING.SUBSCRIPTION.ACTIVATED'){
    const remote=await pp.request('/v1/billing/subscriptions/'+pid,{headers});
    if(remote.id!==pid||remote.plan_id!==r.provider_plan||remote.custom_id!==r.id)fail('PayPal subscription does not match this rental.',409);
    if(!sale){await addEvent(r,'approved','paypal/'+b.id,async current=>{if(current.status==='pending')await run("UPDATE plaza_rentals SET status='approved',updated=? WHERE id=?",Date.now(),r.id);});return;}
    if(!pp.live)return; // Sandbox never grants a paid live rental.
    if(minor(resource.amount?.total,resource.amount?.currency,r.currency)!==r.amount)fail('PayPal rental amount does not match.',409);
    if(!paypalId(resource.id))fail('Invalid PayPal payment reference.',409);
    const next=Date.parse(remote.billing_info?.next_billing_time||'');
    const paidAt=Date.parse(resource.create_time||'');
    const until=Number.isFinite(next)&&next>Date.now()?next:Number.isFinite(paidAt)?monthAfter(paidAt):0;
    if(!until||until<=Date.now())fail('PayPal did not confirm a current paid period.',409);
    await addEvent(r,'payment','paypal-sale/'+resource.id,current=>grant(current,until));return;
   }
   const status=statuses[type]||'past_due';
   await addEvent(r,reversal?'refund_or_reversal':status,'paypal/'+b.id,async current=>{
    if(!pp.live)return;
    if(!reversal&&!['cancelled','expired'].includes(current.status))await run('UPDATE plaza_rentals SET status=?,updated=? WHERE id=?',status,Date.now(),r.id);
    await receipt(current,reversal?'refund or reversal recorded':status.replace('_',' '));
   });
  }
 };
}

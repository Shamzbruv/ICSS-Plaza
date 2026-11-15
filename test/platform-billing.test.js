import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash,createHmac} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../src/server.js';
import {ownerEmail} from '../src/operator-access.js';
import {paypalSettingsKey} from '../src/paypal-settings.js';
import {launchPlan} from '../src/paypal-launch.js';
import {decrypt} from '../src/model.js';

const origin='https://plaza.example';
const invite='ab'.repeat(32),testAccess={verifier:createHash('sha256').update(invite).digest('hex'),expiresAt:Date.now()+60000};
const billingEnv={PLAZA_FYGARO_LINK:'https://www.fygaro.com/en/pb/test/',PLAZA_FYGARO_KEY_ID:'test-key',PLAZA_FYGARO_SECRET:'test-signing-only',
 PLAZA_PAYPAL_MODE:'live',PLAZA_PAYPAL_CLIENT_ID:'test-client',PLAZA_PAYPAL_SECRET:'test-secret',PLAZA_PAYPAL_WEBHOOK_ID:'test-hook'};
const planRef='P-1234567890';
let remote,verified=true;
const mock=async(url,opts={})=>{
 const path=new URL(url).pathname;
 const result=x=>new Response(JSON.stringify(x));
 if(path==='/v1/oauth2/token')return result({access_token:'fixture'});
 if(path.endsWith('/verify-webhook-signature'))return result({verification_status:verified?'SUCCESS':'FAILURE'});
 if(path==='/v1/billing/plans/'+planRef)return result({status:'ACTIVE',billing_cycles:[{tenure_type:'REGULAR',total_cycles:0,frequency:{interval_unit:'MONTH',interval_count:1},pricing_scheme:{fixed_price:{value:'12.00',currency_code:'USD'}}}]});
 if(path==='/v1/billing/subscriptions'){
  remote={...JSON.parse(opts.body),id:'I-TEST12345',status:'ACTIVE',billing_info:{next_billing_time:new Date(Date.now()+30*86400000).toISOString()}};
  assert.equal(remote.plan_id,planRef);
  return result({...remote,links:[{rel:'approve',href:'https://www.paypal.com/approve'}]});
 }
 if(path.endsWith('/cancel')){remote.status='CANCELLED';return new Response(null,{status:204});}
 if(path.endsWith('/'+remote?.id))return result(remote);
 throw Error('Unexpected PayPal operation: '+path);
};
test('developer, consultations, isolated QA and rental gateways enforce their boundaries',async t=>{
 const dir=mkdtempSync(join(tmpdir(),'plaza-ops-'));
 const {server,database}=await createApp({dataDir:dir,databaseURL:process.env.PLAZA_TEST_DATABASE_URL||'',baseURL:origin,encryptionKey:'12'.repeat(32),operatorEmail:'operator@example.com',operatorPassword:'strong-operator-password',production:false,billingEnv,billingFetcher:mock,testAccess});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 t.after(async()=>{await new Promise(r=>server.close(r));rmSync(dir,{recursive:true,force:true});});
 const base='http://127.0.0.1:'+server.address().port;
 async function req(path,method='GET',data,auth={},headers={}){
  const r=await fetch(base+path,{method,headers:{Origin:origin,'Content-Type':'application/json',...(auth.cookie?{Cookie:auth.cookie,'X-CSRF-Token':auth.csrf||''}:{}),...headers},...(data?{body:JSON.stringify(data)}:{})});
  return {status:r.status,body:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};
 }
 async function login(email,password){const r=await req('/api/login','POST',{email,password});assert.equal(r.status,200);const auth={cookie:r.cookie};const x=await req('/api/session','GET',null,auth);return {...auth,...x.body};}
 const op=await login('operator@example.com','strong-operator-password');
 const seed=async slug=>{const email=slug+'@example.com',pw='billing-test-password';assert.equal((await req('/api/signup','POST',{name:slug,email,password:pw,slug,acceptTerms:true,template:"beauty"})).status,201);return login(email,pw);};
 const fy=await seed('fygaro-rental-shop'),pp=await seed('paypal-rental-shop');
 assert.equal((await req('/api/operator/overview')).status,401);
 assert.equal((await req('/api/operator/overview','GET',null,fy)).status,403);
 assert.equal((await req('/api/operator/test-account','POST',{},fy)).status,403);
 const qa=await req('/api/operator/test-account','POST',{},op);assert.equal(qa.status,201);
 assert.match(qa.body.email,/example\.invalid$/);
 const test=await login(qa.body.email,qa.body.password);
 assert.equal(test.operator,false);
 assert.equal((await req('/api/admin/'+test.tenants[0].id+'/billing/checkout','POST',{provider:'fygaro'},test)).status,403);
 await database.run('UPDATE tenants SET trial_end=? WHERE id=?',Date.now()-1,test.tenants[0].id);
 assert.equal((await req('/api/session','GET',null,test)).body.user,null);
 const invalid=await req('/api/test-access','POST',{invite:'cd'.repeat(32),password:'test-invite-password'});assert.equal(invalid.status,404);
 const claim=await req('/api/test-access','POST',{invite,password:'test-invite-password'});assert.equal(claim.status,201);
 assert.equal((await req('/api/session','GET',null,{cookie:claim.cookie})).body.operator,false);
 assert.equal((await req('/api/test-access','POST',{invite,password:'test-invite-password'})).status,409);
 const c=await req('/api/consultations','POST',{name:'Prospect',email:'prospect@example.com',business:'Fixture business',topic:'setup',consent:true,message:'Help getting my store online.'});
 assert.equal(c.status,201);
 assert.equal((await req('/api/operator/consultations','GET',null,fy)).status,403);
 const raw=await database.one('SELECT payload FROM plaza_consultations WHERE id=?',c.body.reference);assert.doesNotMatch(raw.payload,/prospect/);
 const item=(await req('/api/operator/consultations','GET',null,op)).body.requests.find(x=>x.id===c.body.reference);
 assert.equal(item.email,'prospect@example.com');
 assert.equal((await req('/api/operator/consultations/'+item.id,'PATCH',{status:'scheduled',updated:item.updated,notes:'Private note'},op)).status,200);
 assert.equal((await req('/api/operator/consultations/'+item.id,'PATCH',{status:'closed',updated:item.updated},op)).status,409);
 const plan=await req('/api/operator/billing','POST',{name:'Monthly USD',amount:1200,currency:'USD',paypalPlan:planRef},op);assert.equal(plan.status,201);
 const fyPath='/api/admin/'+fy.tenants[0].id+'/billing',ppPath='/api/admin/'+pp.tenants[0].id+'/billing';
 const f=await req(fyPath+'/checkout','POST',{plan:plan.body.id,provider:'fygaro'},fy);assert.equal(f.status,200);
 const jwt=new URL(f.body.url).searchParams.get('jwt'), claims=JSON.parse(Buffer.from(jwt.split('.')[1],'base64url'));
 assert.equal(claims.amount,'12.00');
 const event={customReference:claims.custom_reference,transactionId:'fixture-fygaro-payment',amount:'12.00',currency:'USD'};
 const stamp=String(Math.floor(Date.now()/1000));
 const signed=b=>({'Fygaro-Key-Id':'test-key','Fygaro-Signature':'t='+stamp+',v1='+createHmac('sha256',billingEnv.PLAZA_FYGARO_SECRET).update(stamp+'.'+JSON.stringify(b)).digest('hex')});
 const p='/api/billing/hooks/fygaro';
 assert.equal((await req(p,'POST',event)).status,401);
 const wrong={...event,amount:'1.00'};assert.equal((await req(p,'POST',wrong,{},signed(wrong))).status,409);
 assert.equal((await req(p,'POST',event,{},signed(event))).status,200);
 assert.equal((await req(p,'POST',event,{},signed(event))).status,200);
 const ledger=(await req(fyPath,'GET',null,fy)).body.rentals;assert.equal(ledger[0].status,'active');assert.ok(ledger[0].paid_until>Date.now());
 const start=await req(ppPath+'/checkout','POST',{plan:plan.body.id,provider:'paypal'},pp);assert.equal(start.status,200,JSON.stringify(start.body));
 const approval={id:'EVENT-1',event_type:'BILLING.SUBSCRIPTION.ACTIVATED',resource:{id:remote.id}};
 const sale={id:'EVENT-2',event_type:'PAYMENT.SALE.COMPLETED',resource:{id:'SALE-123456',billing_agreement_id:remote.id,amount:{total:'12.00',currency:'USD'}}};
 const h=Object.fromEntries(['auth-algo','cert-url','transmission-id','transmission-sig','transmission-time'].map(k=>['PayPal-'+k,'fixture']));
 const hook='/api/billing/hooks/paypal';
 verified=false;assert.equal((await req(hook,'POST',approval,{},h)).status,401);
 verified=true;assert.equal((await req(hook,'POST',approval,{},h)).status,200);
 const pending=(await req(ppPath,'GET',null,pp)).body.rentals[0];assert.equal(pending.paid_until,0);
 assert.equal((await req(hook,'POST',sale,{},h)).status,200);assert.equal((await req(hook,'POST',sale,{},h)).status,200);
 const active=(await req(ppPath,'GET',null,pp)).body.rentals[0];assert.equal(active.status,'active');
 assert.equal((await req(ppPath+'/'+active.id+'/cancel','POST',{},pp)).status,200);
 const cancelled=(await req(ppPath,'GET',null,pp)).body.rentals[0];assert.equal(cancelled.status,'cancelled');assert.equal(cancelled.paid_until,active.paid_until);
 const refund={id:'REFUND-EVENT',event_type:'PAYMENT.SALE.REFUNDED',resource:{id:'REFUND-123456',sale_id:'SALE-123456'}};
 assert.equal((await req(hook,'POST',refund,{},h)).status,200);
 const events=(await req('/api/operator/billing','GET',null,op)).body.events;
 assert.equal(events.filter(e=>e.kind==='payment').length,2);
 assert.equal(events.filter(e=>e.kind==='refund_or_reversal').length,1);
});

test('the supplied Live PayPal plan links once and preserves a card-free Plaza trial',async t=>{
 const dir=mkdtempSync(join(tmpdir(),'plaza-paypal-launch-'));
 const env={...billingEnv,PLAZA_PAYPAL_SECRET:undefined,PLAZA_PAYPAL_WEBHOOK_ID:undefined};
 const clientId=env.PLAZA_PAYPAL_CLIENT_ID,firstSecret='portal-test-secret',newSecret='portal-rotated-secret',key='12'.repeat(32);
 const paths={oauth:'/v1/oauth2/token',hooks:'/v1/notifications/webhooks',plans:'/v1/billing/plans'};
 const tx={hooks:0,subscribers:0};
 const planReference='P-59K86224KG120672MNL5AQNA';
 const cycle={frequency:{interval_unit:'MONTH',interval_count:1},tenure_type:'REGULAR',sequence:1,total_cycles:0,pricing_scheme:{fixed_price:{value:'31.39',currency_code:'USD'}}};
 let hook,remote,plan={id:planReference,status:'ACTIVE',billing_cycles:[{tenure_type:'TRIAL'},cycle]};

 let acceptedSecret=firstSecret;
 const billingFetcher=async(url,opts)=>{
  const {pathname,hostname}=new URL(url);
  assert.equal(hostname,'api-m.paypal.com');
  const method=opts.method||'GET',body=opts.body?.startsWith('{')?JSON.parse(opts.body):null;
  if(pathname===paths.oauth){
   return opts.headers.Authorization==='Basic '+Buffer.from(clientId+':'+acceptedSecret).toString('base64')?
    Response.json({access_token:'fixture'}):new Response(null,{status:401});
  }
  assert.equal(opts.headers.Authorization,'Bearer fixture');
  if(pathname===paths.hooks&&method==='GET')return Response.json({webhooks:hook?[hook]:[]});
  if(pathname===paths.hooks&&method==='POST'){
   assert.equal(body.url,origin+'/api/billing/hooks/paypal');
   assert.ok(body.event_types.some(event=>event.name==='PAYMENT.SALE.COMPLETED'));
   assert.equal(new Set(body.event_types.map(x=>x.name)).size,8);
   tx.hooks++;hook={id:'HOOK-3139',...body};return Response.json(hook,{status:201});
  }
  if(pathname===paths.plans+'/'+planReference&&method==='GET')return Response.json(plan);
  if(pathname==='/v1/billing/subscriptions'){
   assert.equal(body.plan_id,planReference);
   tx.subscribers++;remote={...body,id:'I-LAUNCH-'+tx.subscribers,billing_info:{next_billing_time:new Date(Date.now()+30*86400000).toISOString()}};
   return Response.json({...remote,links:[{rel:'approve',href:'https://www.paypal.com/approve'}]});
  }
  if(pathname==='/v1/billing/subscriptions/'+remote?.id)return Response.json(remote);
  if(pathname==='/v1/notifications/verify-webhook-signature'){
   assert.equal(body.webhook_id,hook.id);
   return Response.json({verification_status:'SUCCESS'});
  }
  throw Error('Unexpected PayPal operation: '+pathname);
 };
 const operatorEmail='paypal-launch-operator@example.com',password='secure-launch-test-password';
 const developerAuthConfig={url:'https://auth.example',anon:'fixture',userId:'2d9774a7-a8ef-46bb-b239-0856c33cc415'};
 const developerAuthFetcher=async(url,{body})=>{
  if(new URL(url).pathname==='/logout')return new Response(null,{status:204});
  const login=JSON.parse(body);
  if(login.password!==password)return new Response(null,{status:401});
  return Response.json({user:{id:developerAuthConfig.userId,email:ownerEmail},access_token:'fixture'});
 };
 const {server,database}=await createApp({dataDir:dir,databaseURL:process.env.PLAZA_TEST_DATABASE_URL||'',baseURL:origin,encryptionKey:key,operatorEmail,operatorPassword:password,production:false,billingEnv:env,billingFetcher,developerAuthConfig,developerAuthFetcher});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 t.after(async()=>{await new Promise(r=>server.close(r));rmSync(dir,{recursive:true,force:true});});
 const port=server.address().port;
 const req=(path,{body,auth,headers,method}={})=>fetch('http://127.0.0.1:'+port+path,{method:method||(body?'POST':'GET'),headers:{Origin:origin,'Content-Type':'application/json',...(auth?{Cookie:auth.cookie,'X-CSRF-Token':auth.csrf}:{}),...headers},body:body?JSON.stringify(body):undefined});
 async function signedIn(response){
  assert.ok(response.ok);
  const cookie=response.headers.get('set-cookie').split(';')[0];
  return {cookie,...await (await req('/api/session',{auth:{cookie}})).json()};
 }
 const merchant=await signedIn(await req('/api/signup',{body:{email:'paypal-launch-shop@example.com',password,name:'PayPal launch test shop',slug:'paypal-launch-shop',acceptTerms:true,template:'beauty'}}));
 const op=await signedIn(await req('/api/login',{body:{email:operatorEmail,password}}));
 const owner=await signedIn(await req('/api/login',{body:{email:ownerEmail,password}}));
 const setup='/api/operator/billing/paypal-setup',settings='/api/operator/billing/paypal-settings';
 const credentials={clientId,secret:firstSecret,currentPassword:password};
 const readSaved=()=>database.one('SELECT value FROM metadata WHERE key=?',paypalSettingsKey);
 const getSettings=async auth=>(await (await req('/api/operator/billing',{auth})).json());
 assert.equal((await req(settings,{body:credentials})).status,401);
 assert.equal((await req(settings,{body:credentials,auth:merchant})).status,403);
 assert.equal((await req(settings,{body:credentials,auth:op})).status,403);
 assert.equal((await req(settings,{body:credentials,auth:owner,headers:{'X-CSRF-Token':'invalid'}})).status,403);
 assert.equal((await req(setup,{body:{},auth:owner})).status,503);
 const before=await getSettings(owner);
 assert.equal(before.canManagePayPal,true);
 assert.equal((await getSettings(op)).canManagePayPal,false);
 assert.equal(before.providers.paypal,false);assert.equal(before.paypalSetup.linked,false);
 assert.equal((await req(settings,{body:{...credentials,currentPassword:'wrong-existing-password'},auth:owner})).status,401);
 const denied=await req(settings,{body:{...credentials,secret:'rejected-client-secret'},auth:owner});
 assert.equal(denied.status,502);assert.match((await denied.json()).error,/rejected the app credentials/);
 assert.equal(await readSaved(),undefined);
 const saved=await req(settings,{body:credentials,auth:owner});assert.deepEqual(await saved.json(),{ok:true});
 assert.match(saved.headers.get('cache-control'),/no-store/);
 const stored=(await readSaved()).value;
 assert.ok(!stored.includes(firstSecret));
 assert.equal(decrypt(stored,key).secret,firstSecret);
 const status=await getSettings(owner);
 assert.equal(status.paypalSetup.credentialsReady,true);
 assert.equal(status.paypalSetup.linked,false);
 assert.doesNotMatch(JSON.stringify(status),new RegExp(clientId+'|'+firstSecret));
 assert.deepEqual(tx,{hooks:0,subscribers:0});
 const badPlan=await req(setup,{body:{},auth:owner});
 assert.equal(badPlan.status,409);
 assert.match((await badPlan.json()).error,/includes a trial cycle/);
 assert.equal(tx.hooks,0);
 plan={...plan,billing_cycles:[cycle]};
 const first=await req(setup,{body:{},auth:op});assert.equal(first.status,200);
 const {id,enabled}=await first.json();assert.ok(enabled);
 const repeat=await req(setup,{body:{},auth:op});assert.deepEqual(await repeat.json(),{id,enabled:true});
 assert.deepEqual(tx,{hooks:1,subscribers:0});
 const vendorPath='/api/admin/'+merchant.tenants[0].id+'/billing';
 const data=await (await req(vendorPath,{auth:merchant})).json();
 const offer=data.plans.find(x=>x.id===id);
 assert.deepEqual([offer.amount,offer.currency,offer.paypalOnly,offer.paypal_plan],[3139,'USD',true,planReference]);
 assert.equal((await req(vendorPath+'/checkout',{body:{plan:id,provider:'fygaro'},auth:merchant})).status,400);
 assert.equal((await req(vendorPath+'/checkout',{body:{plan:id,provider:'paypal'},auth:merchant})).status,200);
 const tenant=merchant.tenants[0];
 assert.equal(Date.parse(remote.start_time),Math.ceil(tenant.trial_end/1000)*1000);
 const headers=Object.fromEntries(['auth-algo','cert-url','transmission-id','transmission-sig','transmission-time'].map(k=>['PayPal-'+k,'fixture']));
 const cancelled={id:'EV-CANCEL-TRIAL',event_type:'BILLING.SUBSCRIPTION.CANCELLED',resource:{id:remote.id}};
 assert.equal((await req('/api/billing/hooks/paypal',{body:cancelled,headers})).status,200);
 const detail=await (await req('/api/operator/stores/'+tenant.id,{auth:op})).json();
 assert.equal(detail.accessible,true);
 await database.run('UPDATE tenants SET trial_end=? WHERE id=?',Date.now()-1000,tenant.id);
 assert.equal((await req(vendorPath+'/checkout',{body:{plan:id,provider:'paypal'},auth:merchant})).status,200);
 assert.equal(remote.start_time,undefined);
 assert.equal((await req(settings,{body:{...credentials,clientId:'other-live-app'},auth:owner})).status,409);
 acceptedSecret=newSecret;
 assert.equal((await req(settings,{body:{clientId:'',secret:newSecret,currentPassword:password},auth:owner})).status,200);
 assert.equal(decrypt((await readSaved()).value,key).secret,newSecret);
 await database.run('UPDATE plaza_plans SET paypal_plan=?,enabled=0 WHERE id=?','P-OLDER-FIXTURE',launchPlan.id);
 const relink=await req(setup,{body:{},auth:owner});
 assert.deepEqual(await relink.json(),{id,enabled:false});
 assert.equal((await getSettings(owner)).paypalSetup.planId,planReference);
 const body={id:'EV-LAUNCH',event_type:'PAYMENT.SALE.COMPLETED',resource:{id:'SALE-LAUNCH',billing_agreement_id:remote.id,amount:{total:'31.39',currency:'USD'}}};
 assert.equal((await req('/api/billing/hooks/paypal',{body,headers})).status,200);
 const after=await (await req(vendorPath,{auth:merchant})).json();
 assert.equal(after.rentals[0].status,'active');
 assert.equal(after.rentals[0].amount,3139);
});

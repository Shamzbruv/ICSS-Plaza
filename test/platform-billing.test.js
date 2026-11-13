import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash,createHmac} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../src/server.js';

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
 const seed=async slug=>{const email=slug+'@example.com',pw='billing-test-password';assert.equal((await req('/api/signup','POST',{name:slug,email,password:pw,slug,acceptTerms:true})).status,201);return login(email,pw);};
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

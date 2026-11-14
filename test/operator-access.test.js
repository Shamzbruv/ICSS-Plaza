import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../src/server.js';

test('developer provisioning reserves the email and vendor support grants are bounded and audited',async t=>{
 const dir=mkdtempSync(join(tmpdir(),'plaza-support-')),origin='https://plaza.example';
 const invite='ef'.repeat(32),email='new-dev@example.com',password='test-only-developer-password';
 const ownerProvisioning={email,verifier:createHash('sha256').update(invite).digest('hex'),expiresAt:Date.now()+60000};
 const {server,database}=await createApp({dataDir:dir,databaseURL:process.env.PLAZA_TEST_DATABASE_URL||'',baseURL:origin,encryptionKey:'12'.repeat(32),production:false,ownerProvisioning});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 t.after(async()=>{await new Promise(r=>server.close(r));rmSync(dir,{recursive:true,force:true});});
 const base='http://127.0.0.1:'+server.address().port;
 async function req(path,method='GET',data,auth={},support){
  const r=await fetch(base+path,{method,headers:{Origin:origin,'Content-Type':'application/json',...(auth.cookie?{Cookie:auth.cookie,'X-CSRF-Token':auth.csrf}:{}),...(support?{'X-Plaza-Support':support}:{})},...(data?{body:JSON.stringify(data)}:{})});
  return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};
 }
 const signup=(email,slug)=>req('/api/signup','POST',{email,password,name:slug,slug,acceptTerms:true,template:"beauty"});
 async function login(email){const r=await req('/api/login','POST',{email,password});assert.equal(r.status,200);const a={cookie:r.cookie};return {...a,...(await req('/api/session','GET',null,a)).data};}
 assert.equal((await signup(email,'spoof-dev')).status,409);
 assert.equal((await req('/api/developer/provision','POST',{invite:'aa'.repeat(32),password})).status,404);
 assert.equal((await req('/api/developer/provision','POST',{invite,password})).status,201);
 assert.equal((await req('/api/developer/provision','POST',{invite,password})).status,409);
 const op=await login(email),otherSession=await login(email);assert.equal(op.operator,true);
 const vendor='support-target@example.com',secondVendor='other-support-target@example.com';
 assert.equal((await signup(vendor,'support-target')).status,201);assert.equal((await signup(secondVendor,'other-support-target')).status,201);
 const a=await login(vendor),other=await login(secondVendor),tid=a.tenants[0].id,otherTid=other.tenants[0].id;
 const route='/api/operator/vendors/'+tid+'/access',admin='/api/admin/'+tid;
 assert.equal((await req(route,'POST',{reason:'Update vendor branding.'},a)).status,403);
 assert.equal((await req(admin,'GET',null,op)).status,404);
 const r=await req(route,'POST',{reason:'Update vendor branding.'},op);
 assert.equal(r.status,201,JSON.stringify(r.data));const grant=r.data.id;
 assert.equal((await req(admin,'GET',null,otherSession,grant)).status,403);
 assert.equal((await req('/api/admin/'+otherTid,'GET',null,op,grant)).status,403);
 assert.equal((await req(admin+'/settings','PUT',{name:'Updated vendor'},op,grant)).status,200);
 assert.equal((await req(admin+'/settings','PUT',{contactEmail:'wrong@example.com'},op,grant)).status,403);
 assert.equal((await req(admin+'/settings','PUT',{published:true,vendorAcknowledgement:true},op,grant)).status,403);
 assert.equal((await req(admin+'/export','GET',null,op,grant)).status,403);
 assert.equal((await req(admin+'/gateways/bank','PUT',{instructions:'Wrong account'},op,grant)).status,403);
 const log=(await req('/api/operator','GET',null,op)).data.audit;
 assert.ok(log.some(x=>x.reason==='Update vendor branding.'));
 assert.ok(log.some(x=>x.actor===op.user.id&&x.action==='vendor-support.put.settings.'+grant));
 assert.equal((await req(route,'DELETE',{},op,grant)).status,200);
 assert.equal((await req(admin,'GET',null,op,grant)).status,403);
 assert.equal((await req(admin,'GET',null,a)).data.tenant.settings.name,'Updated vendor');

 const directory='/api/operator/vendors',qaLogin=directory+'/test-login';
 assert.equal((await req(directory,'POST',{})).status,401);
 assert.equal((await req(directory,'POST',{},a)).status,403);
 const openDirectory=()=>req(directory,'POST',{},op);
 const [first,second]=await Promise.all([openDirectory(),openDirectory()]);
 assert.equal(first.status,200);assert.equal(second.status,200);
 const qa=first.data.tenants[0];
 assert.equal(qa.settings.name,'Plaza Test Vendor');assert.equal(qa.primaryTest,true);
 assert.deepEqual(second.data.tenants.filter(x=>x.primaryTest).map(x=>x.id),[qa.id]);
 assert.ok(first.data.tenants.some(x=>x.id===tid&&!x.test));
 const reason='Check the sample catalogue.';
 const qaGrant=await req(directory+'/'+qa.id+'/access','POST',{reason},op);
 assert.equal(qaGrant.status,201);
 const qaAdmin='/api/admin/'+qa.id,sample=(await req(qaAdmin,'GET',null,op,qaGrant.data.id)).data;
 assert.ok(sample.products.some(p=>p.sku==='QA-TOTE'));
 const trialTools={value:{orders:2,percent:15,enabled:true}};
 assert.equal((await req(qaAdmin+'/features/loyalty','PUT',trialTools,op,qaGrant.data.id)).status,200);
 assert.equal((await req(qaAdmin+'/features/loyalty','PUT',trialTools,otherSession,qaGrant.data.id)).status,403);
 assert.equal((await req(admin+'/features/loyalty','PUT',trialTools,op,grant)).status,403);
 const tote=sample.products.find(p=>p.sku==='QA-TOTE'),stockPath=qaAdmin+'/products/'+tote.id+'/stock',changeStock={quantities:[{id:'base',previous:tote.stock,stock:9}]};
 assert.equal((await req(stockPath,'PATCH',changeStock,a)).status,404);
 const adjusted=await req(stockPath,'PATCH',changeStock,op,qaGrant.data.id);
 assert.equal(adjusted.status,200);assert.equal(adjusted.data.stock,9);assert.equal(adjusted.data.name,tote.name);
 assert.equal((await req(stockPath,'PATCH',changeStock,op,qaGrant.data.id)).status,409);
 assert.deepEqual(sample.orders,[]);
 const variants=await req(qaAdmin+'/products','POST',{name:'Training shoes',price:700,stock:0,variants:[{id:'small',name:'Small',price:700,stock:4},{id:'large',name:'Large',price:700,stock:2}]},op,qaGrant.data.id);
 assert.equal(variants.status,201);
 const optionUpdate=await req(qaAdmin+'/products/'+variants.data.id+'/stock','PATCH',{quantities:[{id:'large',previous:2,stock:10},{id:'small',previous:4,stock:0}]},op,qaGrant.data.id);
 assert.equal(optionUpdate.status,200);assert.deepEqual(optionUpdate.data.variants.map(v=>v.stock),[0,10]);
 assert.equal((await req(qaLogin,'POST',{},a)).status,403);
 const credentials=(await req(qaLogin,'POST',{},op)).data;
 assert.equal(credentials.email,qa.email);
 const signedIn=await req('/api/login','POST',{email:credentials.email,password:credentials.password});
 assert.equal(signedIn.status,200);const qaAuth={cookie:signedIn.cookie};Object.assign(qaAuth,(await req('/api/session','GET',null,qaAuth)).data);
 assert.equal(qaAuth.operator,false);
 assert.equal(qaAuth.tenants[0].id,qa.id);
 assert.equal((await req(qaAdmin+'/settings','PUT',{published:true,vendorAcknowledgement:true},qaAuth)).status,403);
 const newLogin=await req(qaLogin,'POST',{},op);
 assert.equal(newLogin.status,200);assert.notEqual(newLogin.data.password,credentials.password);
 assert.equal((await req('/api/login','POST',{email:credentials.email,password:credentials.password})).status,401);
 assert.equal((await req('/api/session','GET',null,qaAuth)).data.user,null);

 const old=await fetch(base+'/developer/demo',{redirect:'manual'});assert.equal(old.status,303);assert.equal(old.headers.get('location'),'/developer');
 await database.run('UPDATE plaza_developers SET enabled=0 WHERE user_id=?',op.user.id);
 assert.equal((await req('/api/operator/overview','GET',null,op)).status,403);
});

test('the pinned developer uses durable Auth and signs in after a fresh local database',async()=>{
 const origin='https://plaza.example',email='shamzbiz1@gmail.com',password='a-dev-test-password';
 const userId='c55ca9ba-77f8-4011-b5a1-1dd42db5ce05';
 const config={url:'https://auth.example/auth/v1',anon:'test-public-key',userId};
 let accepted=password;
 let wrongId=false;
 const fetcher=async(url,opts)=>{
  assert.equal(opts.headers.apikey,config.anon);
  if(url.endsWith('/logout?scope=local'))return new Response(null,{status:204});
  if(url.endsWith('/user')){
   assert.match(opts.headers.Authorization,/^Bearer /);
   accepted=JSON.parse(opts.body).password;return new Response('{}');
  }
  const b=JSON.parse(opts.body);
  assert.equal(b.email,email);
  return b.password===accepted?new Response(JSON.stringify({access_token:'token',user:{email,id:wrongId?'wrong-identity':userId}})):new Response('{}',{status:400});
 };
 for(let attempt=0;attempt<2;attempt++){
  const dir=mkdtempSync(join(tmpdir(),'plaza-durable-dev-'));
  const {server}=await createApp({dataDir:dir,databaseURL:'',baseURL:origin,developerAuthConfig:config,developerAuthFetcher:fetcher});
  try{
   await new Promise(r=>server.listen(0,'127.0.0.1',r));
   const base='http://127.0.0.1:'+server.address().port;
   const make=(path,data={},extra={})=>fetch(base+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...extra},body:JSON.stringify(data)});
   if(attempt===0){
    wrongId=true;assert.equal((await make('/api/login',{email,password})).status,403);wrongId=false;
   }
   const r=await make('/api/login',{email,password:accepted});
   assert.equal(r.status,200);
   const cookie=r.headers.get('set-cookie').split(';')[0],sess=await (await fetch(base+'/api/session',{headers:{Cookie:cookie}})).json();
   assert.equal(sess.operator,true);
   if(attempt===0)assert.equal((await make('/api/password',{currentPassword:password,password:'a-changed-test-password'},{Cookie:cookie,'X-CSRF-Token':sess.csrf})).status,200);
   assert.equal((await make('/api/developer/provision',{invite:'ff'.repeat(32),password})).status,404);
  }finally{await new Promise(r=>server.close(r));rmSync(dir,{recursive:true,force:true});}
 }
});

import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../src/server.js';
import {createHmac} from 'node:crypto';
const dir=mkdtempSync(join(tmpdir(),'icss-plaza-'));
const origin='http://localhost:3000';
const {server,db}=createApp({dataDir:dir,baseURL:origin,encryptionKey:'12'.repeat(32),operatorEmail:'operator@example.com',operatorPassword:'strong-operator-password',production:false,fetcher:async()=>{throw Error('No external network in platform tests.');}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base='http://127.0.0.1:'+server.address().port;
after(async()=>{await new Promise(r=>server.close(r));rmSync(dir,{recursive:true,force:true});});
async function req(path,method='GET',body,auth={}){const r=await fetch(base+path,{method,headers:{Origin:origin,'Content-Type':'application/json',...(auth.cookie?{Cookie:auth.cookie}:{}),...(auth.csrf?{'X-CSRF-Token':auth.csrf}:{})},...(body?{body:JSON.stringify(body)}:{})});let data;try{data=await r.json();}catch{data={};}return {status:r.status,data,cookie:r.headers.get('set-cookie')?.split(';')[0],headers:r.headers};}
async function signup(slug){const r=await req('/api/signup','POST',{email:slug+'@example.com',password:'a-secure-password-123',name:slug,slug,acceptTerms:true});assert.equal(r.status,201,JSON.stringify(r.data));const a={cookie:r.cookie};const s=await req('/api/session','GET',null,a);a.csrf=s.data.csrf;a.tenant=s.data.tenants[0];return a;}
let alice,bob,product,oid,token;
test('account creation gives an isolated draft trial with secure session',async()=>{
 alice=await signup('alice-store');bob=await signup('bob-store');assert.notEqual(alice.tenant.id,bob.tenant.id);assert.equal(alice.tenant.settings.published,false);assert.equal(alice.tenant.status,'trial');assert.ok(alice.cookie.startsWith('plaza_session='));
 const r=await req('/api/login','POST',{email:'alice-store@example.com',password:'wrong-password'});assert.equal(r.status,401);
});
test('tenant B cannot read or edit tenant A resources; CSRF is required',async()=>{
 assert.equal((await req('/api/admin/'+alice.tenant.id,'GET',null,bob)).status,404);
 assert.equal((await req('/api/admin/'+alice.tenant.id+'/settings','PUT',{name:'Stolen'},bob)).status,404);
 assert.equal((await req('/api/admin/'+alice.tenant.id+'/settings','PUT',{name:'Missing CSRF'},{cookie:alice.cookie})).status,403);
 assert.equal((await req('/api/stores/alice-store')).status,404);
});
test('create product and enforce publishing requirements',async()=>{
 let r=await req('/api/admin/'+alice.tenant.id+'/products','POST',{name:'A handmade item',price:100000,stock:3,category:'Home',image:'/assets/tote.svg',variants:[]},alice);assert.equal(r.status,201);product=r.data;
 assert.equal((await req('/api/admin/'+alice.tenant.id+'/products/'+product.id,'DELETE',null,bob)).status,404);
 r=await req('/api/admin/'+alice.tenant.id+'/settings','PUT',{published:true},alice);assert.equal(r.status,400);
 assert.equal((await req('/api/admin/'+alice.tenant.id+'/gateways/bank','PUT',{instructions:'Transfer to our business account. Confirm the order reference.',environment:'live'},alice)).status,200);
 r=await req('/api/admin/'+alice.tenant.id+'/settings','PUT',{address:'Example business address, Kingston, Jamaica',defaultPayment:'bank',published:true,shippingFee:50000,taxBps:1500},alice);assert.equal(r.status,200,JSON.stringify(r.data));
 r=await req('/api/stores/alice-store');assert.equal(r.status,200);assert.equal(r.data.products.length,1);assert.equal(r.data.gateways[0].id,'bank');assert.ok(!JSON.stringify(r.data).includes('Transfer to our business account'));
});
const checkout=()=>({customer:{name:'Example Customer',email:'buyer@example.com',phone:'8760000000',address:'Kingston'},lines:[{productId:product.id,quantity:2}],gateway:'bank',delivery:'shipping',acceptTerms:true,idempotency:'idempotency-key-123456',orderToken:'buyer-secret-access-token-123456789'});
test('checkout calculates authoritative totals and reserves inventory exactly once',async()=>{
 const b=checkout();const r=await req('/api/stores/alice-store/orders','POST',b);assert.equal(r.status,201,JSON.stringify(r.data));assert.equal(r.data.order.total,280000);assert.equal(r.data.order.paid,false);assert.ok(!('paymentConfig' in r.data.order));oid=r.data.order.id;token=r.data.token;
 const repeat=await req('/api/stores/alice-store/orders','POST',b);assert.equal(repeat.status,200);assert.equal(repeat.data.order.id,oid);assert.ok(!('paymentConfig' in repeat.data.order));
 const admin=await req('/api/admin/'+alice.tenant.id,'GET',null,alice);assert.equal(admin.data.products[0].stock,1);assert.ok(!JSON.stringify(admin.data.orders).includes('paymentConfig'));
 assert.equal((await req('/api/stores/alice-store/orders','POST',{...b,lines:[{productId:product.id,quantity:1}]})).status,409);
 const tooMuch=await req('/api/stores/alice-store/orders','POST',{...b,idempotency:'another-idempotency-key-1234'});assert.equal(tooMuch.status,409);
});
test('private orders need their access token and other tenants cannot change them',async()=>{
 assert.equal((await req('/api/orders/'+oid)).status,404);assert.equal((await req('/api/orders/'+oid+'?token=incorrect')).status,404);assert.equal((await req('/api/orders/'+oid+'?token='+token)).status,200);
 assert.equal((await req('/api/admin/'+bob.tenant.id+'/orders/'+oid,'PATCH',{markPaid:true,reference:'spoof'},bob)).status,404);
 assert.equal((await req('/api/admin/'+alice.tenant.id+'/orders/'+oid,'PATCH',{state:'fulfilled'},alice)).status,400);
});
test('cancelling an unpaid order restores inventory once; paid fulfilment is protected',async()=>{
 assert.equal((await req('/api/admin/'+alice.tenant.id+'/orders/'+oid,'PATCH',{state:'cancelled'},alice)).status,200);
 assert.equal((await req('/api/admin/'+alice.tenant.id+'/orders/'+oid,'PATCH',{state:'cancelled'},alice)).status,200);
 let r=await req('/api/admin/'+alice.tenant.id,'GET',null,alice);assert.equal(r.data.products[0].stock,3);
 assert.equal((await req('/api/admin/'+alice.tenant.id+'/orders/'+oid,'PATCH',{state:'new'},alice)).status,400);
 r=await req('/api/stores/alice-store/orders','POST',{...checkout(),idempotency:'manual-confirm-order-1234567'});assert.equal(r.status,201);const id=r.data.order.id;
 assert.equal((await req('/api/admin/'+alice.tenant.id+'/orders/'+id,'PATCH',{markPaid:true,reference:'BANK-REF-12345',state:'fulfilled'},alice)).status,200);
 const row=db.prepare('SELECT * FROM orders WHERE id=?').get(id);assert.equal(row.paid,1);assert.equal(row.state,'fulfilled');
});
test('image ownership and MIME checks prevent unsafe and cross-tenant uploads',async()=>{
 const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jfgoAAAAASUVORK5CYII=';
 let r=await req('/api/admin/'+alice.tenant.id+'/images','POST',{name:'pixel.png',data:png},alice);assert.equal(r.status,201);const img=r.data;
 assert.equal((await req('/api/admin/'+bob.tenant.id+'/settings','PUT',{logo:img.url},bob)).status,400);
 assert.equal((await req('/api/admin/'+alice.tenant.id+'/images','POST',{name:'x.svg',data:'data:image/svg+xml;base64,PHN2Zz4='},alice)).status,400);
 assert.equal((await req('/api/admin/'+alice.tenant.id+'/images','POST',{name:'fake.png',data:'data:image/png;base64,SGVsbG8='},alice)).status,400);
 assert.equal((await req('/api/admin/'+alice.tenant.id+'/settings','PUT',{accent:'red; background:url(https://evil.test)'},alice)).status,400);
 assert.equal((await req('/api/admin/'+alice.tenant.id+'/settings','PUT',{heroImage:'https://tracking.example.com/photo.png'},alice)).status,400);
});
test('gateway credentials are encrypted and admin responses redact them',async()=>{
 let r=await req('/api/admin/'+alice.tenant.id+'/gateways/fygaro','PUT',{buttonURL:'https://www.fygaro.com/en/pb/example/',keyId:'test-key',secret:'test-secret-do-not-expose',environment:'live'},alice);assert.equal(r.status,200);
 const raw=db.prepare('SELECT config FROM gateways WHERE tenant_id=? AND provider=?').get(alice.tenant.id,'fygaro');assert.ok(!raw.config.includes('test-secret'));
 r=await req('/api/admin/'+alice.tenant.id,'GET',null,alice);assert.ok(!JSON.stringify(r.data).includes('test-secret'));
});
test('Fygaro hooks reject forgery, validate amount/currency and deduplicate payment',async()=>{
 const c={...checkout(),lines:[{productId:product.id,quantity:1}],gateway:'fygaro',idempotency:'fygaro-order-123456789'};
 let r=await req('/api/stores/alice-store/orders','POST',c);assert.equal(r.status,201);const order=r.data.order;
 const hook={customReference:order.id,transactionId:'fygaro-transaction-123',currency:'JMD',amount:(order.total/100).toFixed(2)};
 const send=async(payload,signed=true)=>{const raw=JSON.stringify(payload),t=String(Math.floor(Date.now()/1000)),sig=createHmac('sha256','test-secret-do-not-expose').update(t+'.'+raw).digest('hex');return fetch(base+'/api/payments/'+alice.tenant.id+'/fygaro/hook',{method:'POST',headers:{'Content-Type':'application/json','Fygaro-Key-ID':'test-key','Fygaro-Signature':'t='+t+',v1='+(signed?sig:'0'.repeat(64))},body:raw});};
 assert.equal((await send(hook,false)).status,401);assert.equal((await send({...hook,amount:'0.01'})).status,409);assert.equal((await send({...hook,currency:'USD'})).status,409);assert.equal((await send(hook)).status,200);assert.equal((await send(hook)).status,200);
 assert.equal(db.prepare('SELECT paid FROM orders WHERE id=?').get(order.id).paid,1);
 const update=await req('/api/admin/'+alice.tenant.id+'/orders/'+order.id,'PATCH',{markPaid:true,reference:'manual-fake'},alice);assert.equal(update.status,400);
});
test('trial expiry and operator suspension close public checkout, only operator can change rentals',async()=>{
 db.prepare('UPDATE tenants SET trial_end=? WHERE id=?').run(Date.now()-1,alice.tenant.id);
 assert.equal((await req('/api/stores/alice-store')).status,404);
 assert.equal((await req('/api/operator/'+alice.tenant.id,'PATCH',{status:'active'},alice)).status,403);
 const login=await req('/api/login','POST',{email:'operator@example.com',password:'strong-operator-password'});const op={cookie:login.cookie};op.csrf=(await req('/api/session','GET',null,op)).data.csrf;
 assert.equal((await req('/api/operator/'+alice.tenant.id,'PATCH',{status:'active'},op)).status,200);assert.equal((await req('/api/stores/alice-store')).status,200);
 assert.equal((await req('/api/admin/'+alice.tenant.id+'/requests','POST',{kind:'cancellation',note:'Test cancellation'},alice)).status,200);assert.equal((await req('/api/stores/alice-store')).status,404);
 const exportData=await req('/api/admin/'+alice.tenant.id+'/export','GET',null,alice);assert.equal(exportData.status,200);assert.ok(exportData.data.orders.length);assert.ok(!JSON.stringify(exportData.data).includes('paymentConfig'));
});
test('static pages serve security headers and sensitive source files are inaccessible',async()=>{
 const r=await fetch(base+'/');assert.equal(r.status,200);assert.match(r.headers.get('content-security-policy'),/frame-ancestors 'none'/);assert.equal((await req('/src/server.js')).status,404);assert.equal((await req('/data/plaza.sqlite')).status,404);
});
test('brand metadata, manifest icons and shared artwork are served with browser-compatible types',async()=>{
 const html=await (await fetch(base+'/')).text();assert.match(html,/http:\/\/localhost:3000\/assets\/brand\/social-preview.png/);assert.ok(!html.includes('__PLAZA_ORIGIN__'));
 for(const route of ['/','/login','/demo']){const page=await(await fetch(base+route)).text();assert.match(page,/href="\/favicon.svg"/);assert.match(page,/href="\/site.webmanifest"/);}
 const manifestResponse=await fetch(base+'/site.webmanifest');assert.match(manifestResponse.headers.get('content-type'),/application\/manifest\+json/);const manifest=await manifestResponse.json();assert.equal(manifest.short_name,'ICSS Plaza');
 for(const icon of [...manifest.icons,{src:'/assets/brand/apple-touch-icon.png',sizes:'180x180'},{src:'/assets/brand/social-preview.png',sizes:'1200x630'}]){const r=await fetch(base+icon.src);assert.equal(r.status,200);assert.equal(r.headers.get('content-type'),'image/png');const data=Buffer.from(await r.arrayBuffer());assert.equal(data.subarray(1,4).toString(),'PNG');assert.equal(data.readUInt32BE(16)+'x'+data.readUInt32BE(20),icon.sizes);}
 const icon=await fetch(base+'/favicon.ico');assert.equal(icon.headers.get('content-type'),'image/x-icon');const bytes=Buffer.from(await icon.arrayBuffer());assert.equal(bytes.readUInt16LE(2),1);assert.equal(bytes.readUInt16LE(4),3);
 const head=await fetch(base+'/assets/brand/logo-horizontal.png',{method:'HEAD'});assert.equal(head.status,200);assert.equal(head.headers.get('content-type'),'image/png');assert.equal((await head.arrayBuffer()).byteLength,0);
});

import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../src/server.js';
import {createHmac} from 'node:crypto';
const dir=mkdtempSync(join(tmpdir(),'icss-plaza-'));
const origin='http://localhost:3000';
const {server,database}=await createApp({databaseURL:process.env.PLAZA_TEST_DATABASE_URL||'',dataDir:dir,baseURL:origin,encryptionKey:'12'.repeat(32),operatorEmail:'operator@example.com',operatorPassword:'strong-operator-password',production:false,fetcher:async()=>{throw Error('No external network in platform tests.');}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base='http://127.0.0.1:'+server.address().port;
after(async()=>{await new Promise(r=>server.close(r));rmSync(dir,{recursive:true,force:true});});
async function req(path,method='GET',body,auth={}){const r=await fetch(base+path,{method,headers:{Origin:origin,'Content-Type':'application/json',...(auth.cookie?{Cookie:auth.cookie}:{}),...(auth.csrf?{'X-CSRF-Token':auth.csrf}:{})},...(body?{body:JSON.stringify(body)}:{})});let data;try{data=await r.json();}catch{data={};}return {status:r.status,data,cookie:r.headers.get('set-cookie')?.split(';')[0],headers:r.headers};}
async function signup(slug,template='beauty'){const r=await req('/api/signup','POST',{email:slug+'@example.com',password:'a-secure-password-123',name:slug,slug,template,acceptTerms:true});assert.equal(r.status,201,JSON.stringify(r.data));const a={cookie:r.cookie};const s=await req('/api/session','GET',null,a);a.csrf=s.data.csrf;a.tenant=s.data.tenants[0];return a;}
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
 r=await req('/api/admin/'+alice.tenant.id+'/settings','PUT',{address:'Example business address, Kingston, Jamaica',defaultPayment:'bank',published:true,vendorAcknowledgement:true,shippingFee:50000,taxBps:1500},alice);assert.equal(r.status,200,JSON.stringify(r.data));
 r=await req('/api/stores/alice-store');assert.equal(r.status,200);assert.equal(r.data.products.length,1);assert.equal(r.data.gateways[0].id,'bank');assert.ok(!JSON.stringify(r.data).includes('Transfer to our business account'));
});
const checkout=()=>({customer:{name:'Example Customer',email:'buyer@example.com',phone:'8760000000',address:'Kingston'},lines:[{productId:product.id,quantity:2}],gateway:'bank',delivery:'shipping',acceptTerms:true,idempotency:'idempotency-key-123456',orderToken:'buyer-secret-access-token-123456789'});
test('checkout calculates authoritative totals and reserves inventory exactly once',async()=>{
 const b=checkout();const r=await req('/api/stores/alice-store/orders','POST',b);assert.equal(r.status,201,JSON.stringify(r.data));assert.equal(r.data.order.total,280000);assert.equal(r.data.order.paid,false);assert.equal(r.data.order.seller.name,'alice-store');assert.ok(r.data.order.policySnapshot.returns);assert.ok(!('paymentConfig' in r.data.order));oid=r.data.order.id;token=r.data.token;
 const repeat=await req('/api/stores/alice-store/orders','POST',b);assert.equal(repeat.status,200);assert.equal(repeat.data.order.id,oid);assert.ok(!('paymentConfig' in repeat.data.order));
 const admin=await req('/api/admin/'+alice.tenant.id,'GET',null,alice);assert.equal(admin.data.products[0].stock,1);assert.ok(!JSON.stringify(admin.data.orders).includes('paymentConfig'));
 assert.equal((await req('/api/stores/alice-store/orders','POST',{...b,lines:[{productId:product.id,quantity:1}]})).status,409);
 const tooMuch=await req('/api/stores/alice-store/orders','POST',{...b,idempotency:'another-idempotency-key-1234'});assert.equal(tooMuch.status,409);
});
test('concurrent checkout retries reserve stock once',async()=>{
 const b={...checkout(),lines:[{productId:product.id,quantity:1}],idempotency:'concurrent-checkout-retry'};
 const results=await Promise.all([req('/api/stores/alice-store/orders','POST',b),req('/api/stores/alice-store/orders','POST',b)]);
 assert.deepEqual(results.map(r=>r.status).sort(),[200,201]);
 assert.equal(results[0].data.order.id,results[1].data.order.id);
 const orderId=results[0].data.order.id;
 const cancel=await Promise.all([req('/api/admin/'+alice.tenant.id+'/orders/'+orderId,'PATCH',{state:'cancelled'},alice),req('/api/admin/'+alice.tenant.id+'/orders/'+orderId,'PATCH',{state:'cancelled'},alice)]);
 assert.deepEqual(cancel.map(r=>r.status),[200,200]);
 const admin=await req('/api/admin/'+alice.tenant.id,'GET',null,alice);
 assert.equal(admin.data.products[0].stock,1);
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
 const row=await database.one('SELECT * FROM orders WHERE id=?',id);assert.equal(row.paid,1);assert.equal(row.state,'fulfilled');
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
 const raw=await database.one('SELECT config FROM gateways WHERE tenant_id=? AND provider=?',alice.tenant.id,'fygaro');assert.ok(!raw.config.includes('test-secret'));
 r=await req('/api/admin/'+alice.tenant.id,'GET',null,alice);assert.ok(!JSON.stringify(r.data).includes('test-secret'));
});
test('Fygaro hooks reject forgery, validate amount/currency and deduplicate payment',async()=>{
 const c={...checkout(),lines:[{productId:product.id,quantity:1}],gateway:'fygaro',idempotency:'fygaro-order-123456789'};
 let r=await req('/api/stores/alice-store/orders','POST',c);assert.equal(r.status,201);const order=r.data.order;
 const hook={customReference:order.id,transactionId:'fygaro-transaction-123',currency:'JMD',amount:(order.total/100).toFixed(2)};
 const send=async(payload,signed=true)=>{const raw=JSON.stringify(payload),t=String(Math.floor(Date.now()/1000)),sig=createHmac('sha256','test-secret-do-not-expose').update(t+'.'+raw).digest('hex');return fetch(base+'/api/payments/'+alice.tenant.id+'/fygaro/hook',{method:'POST',headers:{'Content-Type':'application/json','Fygaro-Key-ID':'test-key','Fygaro-Signature':'t='+t+',v1='+(signed?sig:'0'.repeat(64))},body:raw});};
 assert.equal((await send(hook,false)).status,401);assert.equal((await send({...hook,amount:'0.01'})).status,409);assert.equal((await send({...hook,currency:'USD'})).status,409);assert.equal((await send(hook)).status,200);assert.equal((await send(hook)).status,200);
 assert.equal((await database.one('SELECT paid FROM orders WHERE id=?',order.id)).paid,1);
 const update=await req('/api/admin/'+alice.tenant.id+'/orders/'+order.id,'PATCH',{markPaid:true,reference:'manual-fake'},alice);assert.equal(update.status,400);
});
test('vendor reports are private, support evidence and enforce the investigation outcome',async()=>{
 const description='The seller did not deliver the items or respond to the request.';
 const evidence={name:'private-evidence.png',data:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jfgoAAAAASUVORK5CYII='};
 const customerEmail='private-customer@example.com';
 const login=await req('/api/login','POST',{email:'operator@example.com',password:'strong-operator-password'});
 const op={cookie:login.cookie};op.csrf=(await req('/api/session','GET',null,op)).data.csrf;
 const sale=await database.one('SELECT short_id FROM orders WHERE id=?',oid);
 const body={slug:alice.tenant.slug,reason:'fraud',email:customerEmail,orderReference:sale.short_id,description,acknowledge:true,evidence:[evidence]};
 assert.equal((await req('/api/reports','POST',{...body,evidence:[{name:'fake.png',data:'data:image/png;base64,aGk='}]})).status,400);
 const submitted=await req('/api/reports','POST',body);
 assert.equal(submitted.status,201,JSON.stringify(submitted.data));
 const {id,accessKey}=submitted.data;
 const pub='/api/reports/'+id,ops='/api/operator/reports/'+id,ven='/api/vendor/reports/'+id;
 assert.equal((await req(pub+'/lookup','POST',{accessKey:'a'.repeat(64)})).status,404);
 assert.equal((await req(ops,'GET',null,alice)).status,403);
 assert.equal((await req(ven,'GET',null,alice)).status,404);
 const row=await database.one('SELECT * FROM vendor_reports WHERE id=?',id);
 assert.notEqual(row.access_hash,accessKey);
 assert.ok(!row.payload.includes(customerEmail));
 const initial=(await req(ops,'GET',null,op)).data;
 assert.equal(initial.matchedOrder,true);
 assert.equal(initial.priority,'high');
 assert.equal(initial.email,customerEmail);
 const file=ops+'/evidence/'+initial.evidence[0].id;
 assert.equal((await req(file,'GET',null,bob)).status,403);
 const saved=await fetch(base+file,{headers:{Cookie:op.cookie}});
 assert.equal(saved.status,200);assert.match(saved.headers.get('content-disposition'),/^attachment/);
 assert.deepEqual(Buffer.from(await saved.arrayBuffer()),Buffer.from(evidence.data.split(',')[1],'base64'));
 const started=await req(ops,'PATCH',{version:initial.version,status:'awaiting_vendor',vendorMessage:'Please provide delivery confirmation.',note:'Internal review only.',restriction:'checkout'},op);
 assert.equal(started.status,200,JSON.stringify(started.data));
 assert.equal((await req(ops,'PATCH',{version:initial.version,status:'reviewing'},op)).status,409);
 assert.equal((await req(ven,'GET',null,bob)).status,404);
 const vendor=(await req(ven,'GET',null,alice)).data;
 const vendorText=JSON.stringify(vendor);
 for(const secret of [customerEmail,description,'Internal review only.',evidence.name,accessKey])assert.ok(!vendorText.includes(secret));
 assert.match(vendorText,/delivery confirmation/);
 const customer=(await req(pub+'/lookup','POST',{accessKey})).data;
 assert.ok(!JSON.stringify(customer).includes('Internal review only.'));
 assert.ok(!JSON.stringify(customer).includes('delivery confirmation'));
 assert.equal((await req('/api/stores/alice-store')).data.checkoutBlocked,true);
 assert.equal((await req('/api/stores/alice-store/orders','POST',{...checkout(),idempotency:'blocked-checkout-123'})).status,409);
 const responded=await req(ven,'POST',{message:'We will provide a new delivery date.'},alice);
 assert.equal(responded.data.status,'reviewing');
 const current=(await req(ops,'GET',null,op)).data;
 const suspended=await req(ops,'PATCH',{version:current.version,status:'resolved',outcome:'policy_action',customerMessage:'We restricted this storefront while the vendor addresses the issue.',note:'Suspended after evidence review.',restriction:'suspend'},op);
 assert.equal(suspended.status,200,JSON.stringify(suspended.data));
 assert.equal((await req('/api/stores/alice-store')).status,404);
 assert.equal((await req(pub+'/reply','POST',{accessKey,message:'Please review the new information.'})).status,409);
 const appeal=await req(pub+'/reply','POST',{accessKey,message:'Please review the new information.',review:true});
 assert.equal(appeal.data.status,'reviewing');
 const appealed=(await req(ops,'GET',null,op)).data;
 assert.equal((await req(ops,'PATCH',{version:appealed.version,status:'closed',outcome:'seller_remedy',customerMessage:'The vendor documented the remedy.',note:'Reinstated after remedy.',restriction:'lift'},op)).status,200);
 assert.equal((await req('/api/stores/alice-store')).data.checkoutBlocked,false);
 assert.equal((await req(pub+'/lookup','POST',{accessKey})).data.outcome,'seller_remedy');
});

test('trial expiry and operator suspension close public checkout, only operator can change rentals',async()=>{
 await database.run('UPDATE tenants SET trial_end=? WHERE id=?',Date.now()-1,alice.tenant.id);
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

test('template signup, immutable starter selection and draft publication protect live storefront design',async()=>{
 const signupData={email:'missing-template@example.com',password:'test-password-only',name:'No template',slug:'missing-template',acceptTerms:true};
 assert.equal((await req('/api/signup','POST',signupData)).status,400);
 assert.equal((await req('/api/signup','POST',{...signupData,template:'bad-template'})).status,400);
 const merchant=await signup('studio-wholesale','wholesale'),tenant=merchant.tenant,path='/api/admin/'+tenant.id,live='/api/stores/'+tenant.slug;
 assert.equal(tenant.settings.template,'wholesale');
 assert.ok(tenant.settings.categories.includes('Pantry'));
 assert.equal((await req(path+'/settings','PUT',{template:'fashion'},merchant)).status,409);
 assert.equal((await req(path+'/sample-products','POST',{},merchant)).status,201);
 const samples=(await req(path,'GET',null,merchant)).data.products;
 assert.ok(samples.length>=2&&samples.every(x=>!x.active));
 assert.equal((await req(path+'/sample-products','POST',{},merchant)).status,409);
 assert.equal((await req(path+'/design','PUT',{mode:'save',design:{heroTitle:'Cannot write this'}},bob)).status,404);
 const image=(await req(path+'/images','POST',{name:'design.png',data:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aKPwAAAAASUVORK5CYII='},merchant)).data;
 const video=(await req(path+'/images','POST',{name:'product.mp4',data:'data:video/mp4;base64,'+Buffer.from('0000ftypisom0000extra').toString('base64')},merchant)).data;
 assert.ok(image.url&&video.url);
 assert.equal((await req(path+'/design','PUT',{mode:'save',design:{logo:video.url}},merchant)).status,400);
 assert.equal((await req(path+'/design','PUT',{mode:'save',design:{sections:[{id:'offer',type:'promo',title:'Unsafe',link:'javascript:alert(1)'}]}},merchant)).status,400);
 assert.equal((await req(path+'/products','POST',{name:'Wrong file',price:100,stock:1,video:image.url},merchant)).status,400);
 assert.equal((await req(path+'/products','POST',{name:'Case of canned juice',price:5000,stock:10,video:video.url,gallery:[image.url]},merchant)).status,201);
 assert.equal((await req(path+'/gateways/bank','PUT',{instructions:'Use the reference at checkout when paying by transfer.',environment:'live'},merchant)).status,200);
 const design={heroTitle:'Wholesale prices for all',sections:[{id:'gallery',type:'gallery',title:'See inside',images:[image.url]},{id:'catalog',type:'catalog'}]};
 assert.equal((await req(path+'/design','PUT',{mode:'save',design},merchant)).status,200);
 assert.equal((await req(live)).status,404);
 assert.equal((await req(path+'/settings','PUT',{address:'Kingston, Jamaica',defaultPayment:'bank',published:true,vendorAcknowledgement:true},merchant)).status,200);
 let customer=(await req(live)).data;
 assert.equal(customer.settings.heroTitle,design.heroTitle);
 assert.equal(customer.settings.sections[0].images[0],image.url);
 assert.equal(customer.products.length,1);assert.equal(customer.products[0].video,video.url);
 const clip=await fetch(base+video.url,{headers:{Range:'bytes=4-7'}});
 assert.equal(clip.status,206);assert.equal(await clip.text(),'ftyp');
 const privatePhoto=(await req(path+'/images','POST',{name:'private.png',data:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aKPwAAAAASUVORK5CYII='},merchant)).data;
 assert.equal((await req(path+'/design','PUT',{mode:'save',design:{heroTitle:'Private revamp',heroImage:privatePhoto.url}},merchant)).status,200);
 assert.equal((await req(privatePhoto.url)).status,404);
 assert.equal((await req(privatePhoto.url,'GET',null,merchant)).status,200);
 customer=(await req(live)).data;
 assert.equal(customer.settings.heroTitle,design.heroTitle);assert.ok(!Object.hasOwn(customer.settings,'designDraft'));
 assert.equal((await req(path+'/design','PUT',{mode:'apply',design:{}},merchant)).status,200);
 assert.equal((await req(live)).data.settings.heroTitle,'Private revamp');
 assert.equal((await req(privatePhoto.url)).status,200);
});

test('vendor growth tools apply at checkout and keep drafts, private data, and unapproved reviews out of the storefront',async()=>{
 const a=await signup('growth-shop','beauty'),tid=a.tenant.id,admin='/api/admin/'+tid,shop='/api/stores/growth-shop',tools=admin+'/features/';
 const buy=(path,body)=>req(path,'POST',body);
 const configure=(name,value,actor=a)=>req(tools+name,'PUT',{value},actor);
 assert.equal((await configure('loyalty',{orders:2,percent:10,enabled:true},bob)).status,404);
 assert.equal((await configure('loyalty',{orders:2,percent:10,enabled:true})).status,200);
 assert.equal((await configure('discounts',[{code:'SAVE10',kind:'percent',amount:10,min:1000,active:true}])).status,200);
 assert.equal((await configure('quiz',{enabled:true,question:'What would you like?',rules:[{label:'Skincare',category:'Skin care'}]})).status,200);
 assert.equal((await configure('journal',[{id:'draft',title:'Private draft',body:'Hidden article',published:false},{id:'live',title:'Our story',body:'Public article',published:true}])).status,200);
 assert.equal((await configure('emails',{order_buyer:{subject:'Your Growth Shop receipt',message:'Thanks for helping us grow.'}})).status,200);
 const preview=await req(tools+'email-preview','POST',{kind:'order_buyer',value:{subject:'Preview subject',message:'<script>test</script>'}},a);
 assert.equal(preview.data.subject,'Preview subject');assert.doesNotMatch(preview.data.html,/<script>/);assert.match(preview.data.html,/ICSS Plaza/);
 const created=await req(admin+'/products','POST',{name:'Skin lotion',category:'Skin care',stock:8,price:10000},a);
 assert.equal(created.status,201);
 assert.equal((await req(admin+'/gateways/bank','PUT',{instructions:'Pay the exact amount with the order reference.',environment:'live'},a)).status,200);
 assert.equal((await req(admin+'/settings','PUT',{address:'Kingston, Jamaica',defaultPayment:'bank',published:true,vendorAcknowledgement:true,taxBps:1500},a)).status,200);
 const catalogue=(await req(shop)).data;
 assert.equal(catalogue.features.discounts,true);assert.equal(catalogue.features.quiz.rules[0].category,'Skin care');
 assert.deepEqual(catalogue.features.journal.map(x=>x.id),['live']);
 for(const secret of ['SAVE10','Private draft','Thanks for helping us grow.'])assert.ok(!JSON.stringify(catalogue).includes(secret));
 const order={customer:{name:'Verified buyer',email:'repeat@example.com',address:'Kingston',phone:'8765550000'},gateway:'bank',lines:[{productId:created.data.id,quantity:1}],delivery:'pickup',acceptTerms:true};
 const place=(suffix,extra={})=>buy(shop+'/orders',{...order,idempotency:'purchase-key-long-'+suffix,orderToken:'private-order-link-key-at-least-32-'+suffix,...extra});
 const qualify=async suffix=>{
  const r=await place(suffix);
  assert.equal(r.status,201,JSON.stringify(r.data));const o=r.data.order;
  assert.equal((await req(admin+'/orders/'+o.id,'PATCH',{markPaid:true,reference:'BANK-'+suffix,state:'fulfilled'},a)).status,200);
  return {id:o.id,token:r.data.token};
 };
 const quote=await buy(shop+'/quote',{...order,discountCode:'save10'});
 assert.equal(quote.data.discount,1000);assert.equal(quote.data.tax,1350);assert.equal(quote.data.total,10350);
 assert.equal((await place('changed',{discountCode:'SAVE10',expectedTotal:1})).status,409);
 assert.equal((await req(admin)).status,401);
 assert.equal((await req(admin,'GET',null,a)).data.products[0].stock,8);
 const first=await qualify('first'),second=await qualify('second');
 const loyaltyReward={loyaltyReward:true,loyaltyProof:first};
 assert.equal((await buy(shop+'/quote',{...order,...loyaltyReward,customer:{...order.customer,email:'other@example.com'}})).status,400);
 assert.equal((await place('combine',{...loyaltyReward,discountCode:'SAVE10'})).status,400);
 const redeemed=await place('reward',loyaltyReward);assert.equal(redeemed.status,201);assert.equal(redeemed.data.order.discount,1000);
 assert.equal((await place('retry-reward',loyaltyReward)).status,400);
 const reviewPath='/api/orders/'+second.id+'/review',candidate={token:second.token,name:'Repeat shopper',rating:5,comment:'Very helpful service.'};
 assert.equal((await buy(reviewPath,{...candidate,token:'wrong-order-token-long-enough-000000'})).status,404);
 assert.equal((await buy(reviewPath,candidate)).status,201);
 assert.equal((await buy(reviewPath,candidate)).status,409);
 assert.deepEqual((await req(shop)).data.reviews,[]);
 assert.equal((await configure('reviews/'+second.id,'published',bob)).status,404);
 assert.equal((await req(tools+'reviews/'+second.id,'PUT',{status:'published'},a)).status,200);
 assert.deepEqual((await req(shop)).data.reviews,[{name:candidate.name,rating:5,comment:candidate.comment}]);
});

test('public pages are searchable in the initial HTML with unique metadata and stable URLs',async()=>{
 const pages=[['/','Your business'],['/sell-online-jamaica','How to sell products online in Jamaica'],['/online-store-templates','Choose an ecommerce template'],['/ecommerce-payments-jamaica','How to take payments'],['/online-store-pricing','What does it cost'],['/consultation','Let’s talk about your online store']];
 const titles=new Set();
 for(const [path,heading] of pages){
  const response=await fetch(base+path+'?utm_source=verification');
  assert.equal(response.status,200,path);
  assert.equal(response.headers.get('x-robots-tag'),null,path);
  const html=await response.text();
  assert.ok(html.includes('<link rel="canonical" href="'+origin+path+'">'),path);
  assert.ok(html.includes('<h1>'+heading),path);
  assert.match(html,/name="description" content="[^"]+"/);
  assert.match(html,/property="og:locale" content="en_JM"/);
  assert.match(html,/href="\/consultation"/);
  titles.add(html.match(/<title>([^<]+)<\/title>/)[1]);
  const json=JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/)[1]);
  assert.ok(json['@graph'].some(x=>x['@type']===(path==='/'?'Organization':'BreadcrumbList')));
 }
 assert.equal(titles.size,pages.length);
 const gallery=await (await fetch(base+'/online-store-templates')).text();
 assert.match(gallery,/href="\/templates\/wholesale"/);
 assert.match(gallery,/href="\/templates\/fashion"/);
 assert.match(gallery,/href="\/templates\/yard"/);
 const redirect=await fetch(base+'/sell-online-jamaica/?source=keep',{redirect:'manual'});
 assert.equal(redirect.status,308);
 assert.equal(redirect.headers.get('location'),'/sell-online-jamaica?source=keep');
});

test('crawl files expose published stores and products, with private or missing routes excluded',async()=>{
 const store='/s/studio-wholesale';
 const {data}=await req('/api/stores/studio-wholesale');
 const productPath=store+'/product/'+data.products[0].id;
 const robots=await fetch(base+'/robots.txt');
 assert.match(robots.headers.get('content-type'),/text\/plain/);
 assert.ok((await robots.text()).includes('Sitemap: '+origin+'/sitemap.xml'));
 const sitemap=await fetch(base+'/sitemap.xml');
 assert.match(sitemap.headers.get('content-type'),/application\/xml/);
 const xml=await sitemap.text();
 for(const path of ['/','/sell-online-jamaica','/consultation',store+'/shop',productPath])assert.ok(xml.includes('<loc>'+origin+path+'</loc>'),path);
 assert.doesNotMatch(xml,/alice-store|bob-store|plaza-test-|\/templates\/wholesale|\/bag|\/developer/);
 for(const p of ['/templates/wholesale/shop','/templates/wholesale/product/sample-0','/developer','/signup',store+'/bag',store+'/shop?q=juice']){
  const response=await fetch(base+p);
  assert.equal(response.status,200,p);
  assert.match(response.headers.get('x-robots-tag'),/noindex/,p);
 }
 for(const p of ['/s/example/store','/s/example/about','/s/bob-store',store+'/product/nonexistent',store+'/page/99']){
  const response=await fetch(base+p);
  assert.equal(response.status,404,p);
  assert.match(response.headers.get('content-type'),/text\/html/);
  assert.match(response.headers.get('x-robots-tag'),/noindex/);
 }
 assert.equal((await req('/api/stores/example/shop')).status,404);
 const response=await fetch(base+productPath);
 assert.equal(response.status,200);
 const html=await response.text();
 assert.match(html,/<h1>Case of canned juice<\/h1>/);
 const graph=JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/)[1])['@graph'];
 const offer=graph.find(x=>x['@type']==='Product').offers;
 assert.equal(offer.url,origin+productPath);assert.equal(offer.priceCurrency,'JMD');assert.equal(offer.price,'50.00');
});

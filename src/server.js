import http from 'node:http';
import { createPostgresPool, openPostgres, openSqlite, revenueSQL } from './database.js';
import { assertPostgresCutover, postgresKey } from './postgres-cutover.js';
import { createVendorTrust } from './vendor-trust.js';
import { createMailer } from './mailer.js';
import { createPlatformBilling } from './platform-billing.js';
import { createPlatformOps } from './platform-ops.js';
import { developerAuth } from './developer-auth.js';
import { operatorAccess, ownerEmail, permitsSupport } from './operator-access.js';
import { launchTestAccess } from './test-access.js';
import { policyVersion } from '../public/trust-data.js';
import { mkdirSync, readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { id, hash, fail, text, integer, passwordHash, passwordMatches, encrypt, decrypt, defaults, settings, product, totals } from './model.js';
import { gateways, validateGateway, initiate, capturePayPal, verifyFygaro, wiHash, same } from './payments.js';
import { resolveBaseURL, resolveRequestOrigin, resolveEncryptionKey } from './runtime-config.js';
const here=dirname(fileURLToPath(import.meta.url));
const email=x=>{x=text(x,200,3).toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x))fail('Enter a valid email address.');return x;};
export async function createApp(options={}) {
 const production=options.production ?? process.env.NODE_ENV==='production';
 const baseURL=resolveBaseURL({baseURL:options.baseURL,production});
 const dataDir=resolve(options.dataDir || process.env.DATA_DIR || './data');
 const databaseURL=options.databaseURL ?? process.env.DATABASE_URL;
 if(process.env.REQUIRE_POSTGRES==='1'&&!options.postgresPool&&!databaseURL) throw new Error('REQUIRE_POSTGRES is set but DATABASE_URL is missing.');
 const database=options.postgresPool||databaseURL
  ?openPostgres(options.postgresPool||createPostgresPool(databaseURL,production))
  :(mkdirSync(dataDir,{recursive:true}),openSqlite(dataDir));
 const {one,all,run,tx}=database;
 let key;
 const operatorEmail=(options.operatorEmail || process.env.OPERATOR_EMAIL || '').toLowerCase();
 const opPassword=options.operatorPassword || process.env.OPERATOR_PASSWORD;
 try {
  if(database.kind==='postgres'){
   await assertPostgresCutover(database,dataDir);
   key=await postgresKey(database,options.encryptionKey ?? process.env.ENCRYPTION_KEY);
  }else key=resolveEncryptionKey({encryptionKey:options.encryptionKey,dataDir,db:database.raw});
  if(operatorEmail&&operatorEmail!==ownerEmail&&opPassword&&!await one('SELECT id FROM users WHERE email=?',operatorEmail)){
   await run('INSERT INTO users VALUES(?,?,?,?) ON CONFLICT(email) DO NOTHING',id(),email(operatorEmail),passwordHash(opPassword),Date.now());
  }
 }catch(error){await database.close();throw error;}
 const mailer=createMailer({db:database,key,origin:baseURL,env:options.mailEnv,fetcher:options.mailFetcher});
 const notify=mailer.enqueue;
 const orderMail=(o,t)=>({id:o.id,slug:o.slug||t.slug,reference:o.short_id,store:o.seller?.name||t.settings.name,amount:new Intl.NumberFormat('en-JM',{style:'currency',currency:o.currency}).format(o.total/100)});
 const audit=async (tenant,actor,action)=>(await run('INSERT INTO audit VALUES(?,?,?,?,?)',id(),tenant,actor,action,Date.now()));
 const durableDeveloper=developerAuth(options.developerAuthConfig,options.developerAuthFetcher);
 const access=operatorAccess({db:database,key,legacyEmail:operatorEmail,audit,provision:options.ownerProvisioning});
 const billing=createPlatformBilling({db:database,env:options.billingEnv,fetcher:options.billingFetcher,origin:baseURL,audit,notify});
 const ops=createPlatformOps({db:database,key,notify,operatorEmail:operatorEmail||ownerEmail,limit,email,audit,testAccess:options.testAccess??launchTestAccess});
 const available=billing.available;
 const unpack=t=>t?{...t,settings:JSON.parse(t.settings)}:null;
 const getTenant=async slug=>unpack((await one('SELECT * FROM tenants WHERE slug=?',slug)));
 const getTenantId=async tid=>unpack((await one('SELECT * FROM tenants WHERE id=?',tid)));
 const storefrontRestriction=async tid=>(await one('SELECT mode FROM vendor_restrictions WHERE tenant_id=?',tid))?.mode;
 const publicGateway=g=>({id:g.provider,name:g.provider==='custom'?(decrypt(g.config,key).label||'Other approved provider'):gateways.find(x=>x.id===g.provider)?.name,mode:gateways.find(x=>x.id===g.provider)?.mode});
 async function activeGateways(t){return (await all('SELECT * FROM gateways WHERE tenant_id=? AND enabled=1',t.id)).filter(g=>gateways.find(x=>x.id===g.provider)?.currencies.includes(t.settings.currency));}
 function owner(req,t){if(!req.user || !t || t.owner!==req.user.id)fail('Store not found or access denied.',404);return t;}
 function requireUser(req){if(!req.user)fail('Please sign in.',401);}
 function requireOperator(req){requireUser(req);if(!req.operator)fail('Operator access required.',403);}
 async function getConfig(tid,provider){const row=(await one('SELECT * FROM gateways WHERE tenant_id=? AND provider=?',tid,provider));if(!row)fail('Payment method is unavailable.');return {...row,value:decrypt(row.config,key)};}
 const readOrder=row=>row?{...JSON.parse(row.data),id:row.id,tenant_id:row.tenant_id,short_id:row.short_id,state:row.state,paid:!!row.paid,created:row.created,transaction_id:row.transaction_id}:null;
 async function orderAccess(oid,token){const row=(await one('SELECT * FROM orders WHERE id=?',oid));if(!row||!token||!same(row.token_hash,hash(token)))fail('Order not found.',404);return readOrder(row);}
 async function paid(tid,oid,transaction){return tx(async ()=>{const o=(await one('SELECT * FROM orders WHERE id=?',oid));if(!o)fail('Order not found.',404);if(o.paid)return;if(o.state==='cancelled')fail('Order cancelled: payment needs operator review.',409);await run('UPDATE orders SET paid=1,transaction_id=? WHERE id=?',transaction,oid);await audit(o.tenant_id,'gateway','payment.verified');const order=readOrder(o),tenant=await getTenantId(tid);await notify('payment',oid,order.customer.email,orderMail(order,tenant),{replyTo:order.seller?.email||tenant.settings.contactEmail});},'tenant:'+tid);}
 async function release(o){const data=JSON.parse(o.data);for(const l of data.lines){const p=(await one('SELECT * FROM products WHERE id=? AND tenant_id=?',l.productId,o.tenant_id));if(!p)continue;const d=JSON.parse(p.data);if(l.variantId){const v=d.variants.find(x=>x.id===l.variantId);if(v)v.stock+=l.quantity;}else d.stock+=l.quantity;await run('UPDATE products SET data=? WHERE id=?',JSON.stringify(d),p.id);}}
 const paymentLocks=new Set();
 const rate=new Map();function limit(req,bucket,max){const ip=process.env.TRUST_PROXY==='1'?String(req.headers['x-forwarded-for']||req.socket.remoteAddress).split(',')[0]:req.socket.remoteAddress;const k=bucket+':'+ip;const now=Date.now();let r=rate.get(k);if(!r||r.until<now)r={count:0,until:now+900000};if(++r.count>max)fail('Too many requests. Try again in 15 minutes.',429);rate.set(k,r);}
 const trust=createVendorTrust({db:database,key,limit,email,requireOperator,requireUser,audit,notify,operatorEmail:operatorEmail||ownerEmail});
 let lastPurge=0;
 const timer=setInterval(async ()=>{for(const [k,v]of rate)if(v.until<Date.now())rate.delete(k);try{await run('DELETE FROM sessions WHERE expires<?',Date.now());await run('DELETE FROM resets WHERE expires<?',Date.now());if(Date.now()-lastPurge>=86400000){await trust.purge();await mailer.purge();await ops.purge();lastPurge=Date.now();}}catch(error){console.error('Scheduled cleanup failed:',error.code||error.name);}},60000);timer.unref();
 const mailTimer=setInterval(()=>void mailer.drain().catch(error=>console.error('Email queue failed:',error.code||error.name)),4000);mailTimer.unref();
 function respond(res,data,status=200){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
 function redirect(res,url){res.writeHead(303,{Location:url,'Cache-Control':'no-store'});res.end();}
 async function session(req,res,user){const token=randomBytes(32).toString('hex'),csrf=randomBytes(24).toString('hex');await run('INSERT INTO sessions VALUES(?,?,?,?)',hash(token),user.id,csrf,Date.now()+7*86400000);res.setHeader('Set-Cookie',`plaza_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800${production?'; Secure':''}`);req.user=user;req.csrf=csrf;}
 async function body(req){let size=0,chunks=[];for await(const chunk of req){size+=chunk.length;if(size>4*1024*1024)fail('Request too large.',413);chunks.push(chunk);}const raw=Buffer.concat(chunks);req.raw=raw;try{return raw.length?JSON.parse(raw.toString()):{};}catch{fail('Invalid JSON.');}}
 const server=http.createServer(async(req,res)=>{
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Frame-Options','DENY');
 res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');
 res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'");
 if(production)res.setHeader('Strict-Transport-Security','max-age=31536000');
 try {
 const u=new URL(req.url,baseURL || 'http://localhost'),path=u.pathname,method=req.method;
 const token=String(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('plaza_session='))?.slice(14);
 const s=token?(await one("SELECT s.*,u.email FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires>? AND NOT EXISTS (SELECT 1 FROM tenants t WHERE t.owner=u.id AND t.slug LIKE 'plaza-test-%' AND (t.trial_end<=? OR t.status<>'trial'))",hash(token),Date.now(),Date.now())):null;
 if(s){req.user={id:s.user_id,email:s.email};req.csrf=s.csrf;req.sessionHash=hash(token);req.operator=await access.isOperator(req.user);}
 const webhook=/^\/api\/payments\/[a-f0-9]+\/fygaro\/hook$/.test(path)||path==='/api/webhooks/resend'||/^\/api\/billing\/hooks\/(fygaro|paypal)$/.test(path);
 if(!['GET','HEAD'].includes(method)){
 if(!webhook){const origin=resolveRequestOrigin({baseURL,host:req.headers.host,production});if(!origin||req.headers.origin!==origin)fail('Request origin rejected.',403);if(s&&req.headers['x-csrf-token']!==s.csrf)fail('Refresh the page and try again.',403);if(!String(req.headers['content-type']||'').startsWith('application/json'))fail('JSON required.',415);}
 req.body=await body(req);
 }
 const b=req.body||{};
 if(options.ownerProvisioning&&path==='/api/developer/provision'&&method==='POST'){limit(req,'developer-provision',8);return respond(res,await access.provision(b),201);}
 const vendorAccess=path.match(/^\/api\/operator\/vendors\/([a-f0-9]{24})\/access$/);
 if(vendorAccess&&['POST','DELETE'].includes(method)){
  requireOperator(req);
  const t=await getTenantId(vendorAccess[1]);if(!t)fail('Vendor not found.',404);
  if(method==='POST'){limit(req,'vendor-support-start',25);return respond(res,await access.begin(req,t,b.reason),201);}
  await access.end(req,t.id);return respond(res,{ok:true});
 }

 if(path==='/api/test-access'&&method==='POST'){if(req.user)fail('Open the invitation in a private window first.',409);const u=await ops.claimTest(req,b);await session(req,res,u);return respond(res,{email:u.email,expiresAt:u.expiresAt},201);}
 if(path==='/api/consultations'&&method==='POST')return respond(res,await ops.consult(req,b),201);
 if(path==='/api/billing/hooks/fygaro'&&method==='POST'){await billing.fygaroHook(b,req.raw,req.headers);return respond(res,{received:true});}
 if(path==='/api/billing/hooks/paypal'&&method==='POST'){await billing.paypalHook(b,req.headers);return respond(res,{received:true});}
 if(path==='/api/operator/overview'&&method==='GET'){requireOperator(req);return respond(res,{...(await ops.overview()),...(await mailer.stats()),database:database.kind,billing:billing.ready,paypalMode:billing.paypalMode});}
 const tenantDetail=path.match(/^\/api\/operator\/stores\/([a-f0-9]{24})$/);
 if(tenantDetail&&method==='GET'){requireOperator(req);const t=await getTenantId(tenantDetail[1]);if(!t)fail('Store not found.',404);const result={name:t.settings.name,slug:t.slug,status:t.status,published:t.settings.published,accessible:await available(t),restriction:await storefrontRestriction(t.id)||null};for(const table of ['orders','products','images','vendor_reports'])result[table]=(await one('SELECT COUNT(*) AS n FROM '+table+' WHERE tenant_id=?',t.id)).n;return respond(res,result);}
 const rentalCancel=path.match(/^\/api\/operator\/billing\/rentals\/([a-f0-9]{24})\/cancel$/);
 if(rentalCancel&&method==='POST'){requireOperator(req);limit(req,'operator-cancel-rental',15);const row=await one('SELECT tenant_id FROM plaza_rentals WHERE id=?',rentalCancel[1]);if(!row)fail('Rental not found.',404);await billing.cancel({id:row.tenant_id},rentalCancel[1],req.user.id);return respond(res,{ok:true});}
 if(path==='/api/operator/consultations'&&method==='GET'){requireOperator(req);return respond(res,{requests:await ops.consultations()});}
 const consultationRoute=path.match(/^\/api\/operator\/consultations\/([a-f0-9]{24})$/);
 if(consultationRoute&&method==='PATCH'){requireOperator(req);if(b.message&&!mailer.configured)fail('Connect Resend to send an email from this console.',503);await ops.consultation(consultationRoute[1],b,req.user.id);return respond(res,{ok:true});}
 if(path==='/api/operator/test-account'&&method==='POST'){requireOperator(req);limit(req,'operator-test-account',8);return respond(res,await ops.createTest(req.user.id),201);}
 if(path==='/api/operator/billing'){requireOperator(req);if(method==='GET')return respond(res,await billing.list());if(method==='POST')return respond(res,await billing.plan(b,req.user.id),201);}
 const planRoute=path.match(/^\/api\/operator\/billing\/plans\/([a-f0-9]{24})$/);
 if(planRoute&&method==='PATCH'){requireOperator(req);await billing.setPlan(planRoute[1],b,req.user.id);return respond(res,{ok:true});}

 if(path==='/api/webhooks/resend'&&method==='POST'){await mailer.receive(req.raw,req.headers,b);return respond(res,{received:true});}
 const mailReply=path.match(/^\/api\/operator\/mail\/([a-f0-9-]{36})\/reply$/i);
 if(mailReply&&method==='POST'){requireOperator(req);limit(req,'mail-reply',30);const message=text(b.message,5000,10);const requestId=text(b.requestId,32,32);if(!/^[a-f0-9]{32}$/.test(requestId))fail('Invalid request reference.');await mailer.replyToInbound(mailReply[1],message,requestId);return respond(res,{queued:true},202);}
 if(path==='/api/operator/mail'&&method==='GET'){requireOperator(req);return respond(res,{...(await mailer.stats()),messages:await mailer.inbox()});}
 if(/^\/api\/(reports|vendor\/reports|operator\/reports)(?:\/|$)/.test(path))return await trust.handle({req,res,u,path,method,b,respond});
 if(path==='/api/health')return respond(res,{ok:!!(await one('SELECT 1 AS ok'))});
 if(path==='/api/catalog'&&method==='GET')return respond(res,{gateways,operator:'iCreate Solutions & Services',trialDays:14});
 if(path==='/api/session'&&method==='GET'){const tenants=req.user?(await all('SELECT * FROM tenants WHERE owner=?',req.user.id)).map(unpack):[];return respond(res,{user:req.user||null,csrf:req.csrf||'',tenants,operator:!!req.operator});}
 if(path==='/api/signup'&&method==='POST'){
 limit(req,'signup',10);const em=email(b.email),pw=passwordHash(b.password),slug=text(b.slug,48,3).toLowerCase();if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)||['admin','demo','api','www','plaza','support','developer','consultation'].includes(slug)||slug.startsWith('plaza-test-'))fail('Choose a store address using letters, numbers and hyphens.');
 if(access.reserved(em))fail('This email is reserved. Contact Plaza support.',409);
 if(b.acceptTerms!==true)fail('Accept the platform terms and independent vendor agreement to continue.');
 const uid=id(),tid=id(),storeName=text(b.name,180,1);(await tx(async ()=>{if((await one('SELECT id FROM users WHERE email=?',em)))fail('This email is already registered. Sign in instead.',409);if((await one('SELECT id FROM tenants WHERE slug=?',slug)))fail('That store address is taken.',409);await run('INSERT INTO users VALUES(?,?,?,?)',uid,em,pw,Date.now());(await run('INSERT INTO tenants VALUES(?,?,?,?,?,?,?)',tid,slug,uid,'trial',Date.now()+14*86400000,JSON.stringify({...defaults(),name:storeName,contactEmail:em}),Date.now()));await notify('welcome',uid,em,{store:storeName});},'signup'));
 (await session(req,res,{id:uid,email:em}));await audit(tid,uid,'signup.vendor-agreement.'+policyVersion);return respond(res,{ok:true},201);
 }
 if(path==='/api/login'&&method==='POST'){
 if(String(b.email||'').trim().toLowerCase()===ownerEmail){
  limit(req,'developer-login',12);
  await durableDeveloper.verify(ownerEmail,text(b.password,128,1));
  const user=await tx(async()=>{
   let u=await one('SELECT id,email FROM users WHERE email=?',ownerEmail);
   if(!u){
    const uid=durableDeveloper.id.replaceAll('-','');
    await run('INSERT INTO users VALUES(?,?,?,?)',uid,ownerEmail,passwordHash(randomBytes(32).toString('hex')),Date.now());
    u={id:uid,email:ownerEmail};
   }
   await run('INSERT INTO plaza_developers VALUES(?,?,?) ON CONFLICT(user_id) DO NOTHING',u.id,1,Date.now());
   if(!await one('SELECT user_id FROM plaza_developers WHERE user_id=? AND enabled=1',u.id))fail('Developer access is disabled.',403);
   return u;
  },'signup');
  await session(req,res,user);return respond(res,{ok:true});
 }
 limit(req,'login',30);const em=email(b.email),pw=text(b.password,128,1);const user=(await one('SELECT * FROM users WHERE email=?',em));if(!passwordMatches(pw,user?.password||'0000000000000000:'+ '0'.repeat(128)))fail('Email or password is incorrect.',401);const testStore=await one("SELECT trial_end,status FROM tenants WHERE owner=? AND slug LIKE 'plaza-test-%'",user.id);if(testStore&&(testStore.trial_end<=Date.now()||testStore.status!=='trial'))fail('This test account has expired.',403);await session(req,res,user);return respond(res,{ok:true});
 }
 if(path==='/api/logout'&&method==='POST'){if(token)(await run('DELETE FROM sessions WHERE token=?',hash(token)));res.setHeader('Set-Cookie','plaza_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');return respond(res,{ok:true});}
 if(path==='/api/password'&&method==='POST'){requireUser(req);
 if(req.user.email===ownerEmail){
  limit(req,'developer-password',8);
  const current=text(b.currentPassword,128,1),password=text(b.password,128,12);
  await durableDeveloper.changePassword(ownerEmail,current,password);
  await run('DELETE FROM sessions WHERE user_id=?',req.user.id);await session(req,res,req.user);
  await notify('password_changed',hash(req.csrf),req.user.email);return respond(res,{ok:true});
 }
const user=(await one('SELECT * FROM users WHERE id=?',req.user.id));if(!passwordMatches(text(b.currentPassword,128,1),user.password))fail('Current password is incorrect.',403);await run('UPDATE users SET password=? WHERE id=?',passwordHash(b.password),user.id);(await run('DELETE FROM sessions WHERE user_id=?',user.id));await session(req,res,user);await notify('password_changed',hash(req.csrf),user.email);return respond(res,{ok:true});}
 if(path==='/api/reset'&&method==='POST'){limit(req,'reset',20);const resetHash=hash(text(b.token,100,1));await tx(async ()=>{const r=await one('SELECT * FROM resets WHERE token=? AND expires>?',resetHash,Date.now());if(!r)fail('Reset token is invalid or expired.');await run('UPDATE users SET password=? WHERE id=?',passwordHash(b.password),r.user_id);(await run('DELETE FROM sessions WHERE user_id=?',r.user_id));await run('DELETE FROM resets WHERE user_id=?',r.user_id);const user=await one('SELECT email FROM users WHERE id=?',r.user_id);await notify('password_changed',resetHash,user?.email);},'password-reset');return respond(res,{ok:true});}
 let m;
 if((m=path.match(/^\/api\/stores\/([a-z0-9-]+)$/))&&method==='GET'){
 const t=(await getTenant(m[1]));if(!await available(t)||!t.settings.published)fail('This store is not currently available.',404);const restriction=await storefrontRestriction(t.id);if(restriction==='suspend')fail('This store is not currently available.',404);return respond(res,{id:t.id,slug:t.slug,settings:t.settings,checkoutBlocked:restriction==='checkout',products:(await all('SELECT * FROM products WHERE tenant_id=? ORDER BY created DESC',t.id)).map(p=>({id:p.id,...JSON.parse(p.data)})).filter(p=>p.active),gateways:(await activeGateways(t)).map(publicGateway)});
 }
 if((m=path.match(/^\/api\/stores\/([a-z0-9-]+)\/orders$/))&&method==='POST'){
 limit(req,'checkout',60);
 const initial=await getTenant(m[1]);if(!await available(initial)||!initial.settings.published)fail('This store is not currently accepting orders.',409);
 const idem=text(b.idempotency,100,16),orderToken=text(b.orderToken,100,32),fingerprint=hash(JSON.stringify(b));
 const result=await tx(async ()=>{
 const t=await getTenantId(initial.id);if(!await available(t)||!t.settings.published||await storefrontRestriction(t.id))fail('This store is not currently accepting orders.',409);
 const existing=await one('SELECT * FROM orders WHERE tenant_id=? AND idempotency=?',t.id,idem);
 if(existing){if(existing.request_hash!==fingerprint)fail('Checkout key already used with different details.',409);return {order:readOrder(existing),existing:true};}
 const contact={name:text(b.customer?.name,160,1),email:email(b.customer?.email),phone:text(b.customer?.phone,60,3),address:text(b.customer?.address||'',1000)};
 if(b.acceptTerms!==true)fail('Accept this seller’s terms and privacy notice.');
 const delivery=b.delivery==='pickup'?'pickup':'shipping';if((delivery==='pickup'&&!t.settings.pickup)||(delivery==='shipping'&&!t.settings.shippingEnabled))fail('Delivery option is unavailable.');if(delivery==='shipping'&&!contact.address)fail('Delivery address is required.');
 const gateway=text(b.gateway,40,1);if(!(await activeGateways(t)).some(g=>g.provider===gateway))fail('Choose an available payment method.');
 const config=(await getConfig(t.id,gateway)).value;
 const g=gateways.find(g=>g.id===gateway);if(g.mode==='automated'&&config.environment!=='live')fail('This payment method is in sandbox mode. Ask the seller to activate live credentials.',409);
 if(g.mode==='automated'&&!baseURL)fail('Online payment checkout is not ready. Contact the seller to activate their public store URL.',503);
 const oid=id(),short=id().slice(0,14);
 if(!Array.isArray(b.lines)||!b.lines.length||b.lines.length>100)fail('Your cart must contain 1–100 items.');
 const seen=new Set(); const lines=[];for(const line of b.lines){
 const pid=text(line.productId,40,1),variantId=text(line.variantId||'',60),lk=pid+':'+variantId;if(seen.has(lk))fail('Duplicate cart item.');seen.add(lk);
 const row=(await one('SELECT * FROM products WHERE id=? AND tenant_id=?',pid,t.id));if(!row)fail('A product is unavailable.');const p=JSON.parse(row.data);if(!p.active)fail('A product is unavailable.');const quantity=integer(line.quantity,99,1);
 let item=p;if(p.variants.length){item=p.variants.find(v=>v.id===variantId);if(!item)fail('Choose a valid product option.');}else if(variantId)fail('Invalid product option.');
 if(item.stock<quantity)fail(`${p.name} has insufficient stock.`,409);item.stock-=quantity;await run('UPDATE products SET data=? WHERE id=? AND tenant_id=?',JSON.stringify(p),pid,t.id);
 lines.push({productId:pid,variantId,name:p.name+(item!==p?' — '+item.name:''),price:item.price,quantity,type:p.type});
 }
 const total=totals(lines,t.settings,delivery);const data={...total,currency:t.settings.currency,slug:t.slug,gateway,customer:contact,delivery,lines,provider_id:'',payment:null,paymentConfig:encrypt(config,key),termsAcceptedAt:Date.now(),seller:{name:t.settings.name,email:t.settings.contactEmail,phone:t.settings.phone,address:t.settings.address},policySnapshot:{terms:t.settings.terms,shipping:t.settings.shipping,returns:t.settings.returns,privacy:t.settings.privacy,platformVersion:policyVersion}};
 (await run('INSERT INTO orders VALUES(?,?,?,?,?,?,?,?,?,?,?)',oid,short,t.id,hash(orderToken),idem,fingerprint,JSON.stringify(data),'new',0,null,Date.now()));
 const order=readOrder(await one('SELECT * FROM orders WHERE id=?',oid));const mail=orderMail(order,t);
 await notify('order_buyer',oid,contact.email,{...mail,token:orderToken},{replyTo:t.settings.contactEmail});
 const seller=await one('SELECT email FROM users WHERE id=?',t.owner);await notify('order_vendor',oid,seller?.email,mail);
 return {order,config};
 }, 'tenant:'+initial.id);
 const {order,config}=result,oid=order.id;
 if(result.existing){delete order.paymentConfig;return respond(res,{order,token:orderToken});}
 // Order persistence precedes the provider call so retries never duplicate inventory reservations.
 paymentLocks.add(oid);try{order.payment=await initiate(order,config,baseURL,options.fetcher);order.provider_id=order.payment.providerId||'';await run('UPDATE orders SET data=? WHERE id=?',JSON.stringify({...order,paymentConfig:order.paymentConfig}),oid);}catch(e){order.paymentError='Payment could not be started. Contact the seller with your reference.';}finally{paymentLocks.delete(oid);}
 const safeOrder={...order};delete safeOrder.paymentConfig;return respond(res,{order:safeOrder,token:orderToken},201);
 }
 if((m=path.match(/^\/api\/orders\/([a-f0-9]+)\/payment$/))&&method==='POST'){
 limit(req,'payment-retry',30);const o=(await orderAccess(m[1],b.token));const t=(await getTenantId(o.tenant_id));
 if(!await available(t)||!t.settings.published||o.state==='cancelled'||o.paid||await storefrontRestriction(t.id))fail('This order cannot start a payment.',409);
 if(o.payment?.url){const safe={...o};delete safe.paymentConfig;return respond(res,{order:safe});}
 if(paymentLocks.has(o.id))fail('Payment is already starting. Try again shortly.',409);
 paymentLocks.add(o.id);
 try{const config=decrypt(o.paymentConfig,key);o.payment=await initiate(o,config,baseURL,options.fetcher);o.provider_id=o.payment.providerId||'';await run('UPDATE orders SET data=? WHERE id=?',JSON.stringify(o),o.id);const safe={...o};delete safe.paymentConfig;return respond(res,{order:safe});}finally{paymentLocks.delete(o.id);}
 }
 if((m=path.match(/^\/api\/orders\/([a-f0-9]+)\/lookup$/))&&method==='POST'){limit(req,'order-lookup',60);const o=await orderAccess(m[1],b.token);delete o.paymentConfig;return respond(res,{order:o});}
 if((m=path.match(/^\/api\/orders\/([a-f0-9]+)$/))&&method==='GET'){const o=(await orderAccess(m[1],u.searchParams.get('token')));delete o.paymentConfig;return respond(res,{order:o});}
 if((m=path.match(/^\/api\/payments\/([a-f0-9]+)\/(fygaro|paypal|wipay)\/(hook|return)$/))){
 const [,tid,provider,kind]=m;
 if(provider==='fygaro'&&kind==='hook'&&method==='POST'){
 const row=(await one('SELECT * FROM orders WHERE id=? AND tenant_id=?',String(b.customReference||''),tid));if(!row)fail('Unknown order.',404);const o=readOrder(row);if(o.gateway!==provider)fail('Gateway mismatch.');const c=decrypt(o.paymentConfig,key);
 if(!verifyFygaro(req.raw,req.headers,c))fail('Invalid webhook signature.',401);
 if(b.currency!==o.currency||Math.round(Number(b.amount)*100)!==o.total||typeof b.transactionId!=='string'||!b.transactionId)fail('Payment amount, currency or transaction mismatch.',409);
 (await paid(tid,o.id,'fygaro:'+b.transactionId));return respond(res,{received:true});
 }
 if(kind==='return'&&method==='GET'){
 const row=(await one('SELECT * FROM orders WHERE id=? AND tenant_id=?',u.searchParams.get('order')||'',tid));if(!row)fail('Order not found.',404);const o=readOrder(row);if(o.gateway!==provider)fail('Gateway mismatch.');const c=decrypt(o.paymentConfig,key);
 if(provider==='paypal'&&!o.paid)(await paid(tid,o.id,'paypal:'+await capturePayPal(o,c,u.searchParams.get('token'),options.fetcher)));
 if(provider==='wipay'&&!o.paid){const tr=u.searchParams.get('transaction_id')||'';if(u.searchParams.get('status')!=='success'||u.searchParams.get('order_id')!==o.short_id||!tr||tr!==o.provider_id||u.searchParams.get('currency')!==o.currency||!same(wiHash(tr,o.total,c.secret),u.searchParams.get('hash')))fail('Payment is awaiting verification.',409);await paid(tid,o.id,'wipay:'+tr);}
 return redirect(res,(baseURL||'')+'/s/'+o.slug+'?payment=returned');
 }
 fail('Unknown payment action.',404);
 }
 if((m=path.match(/^\/api\/admin\/([a-f0-9]+)(?:\/(.*))?$/))){
 requireUser(req);const idForStore=m[1],action=m[2]||'',target=await getTenantId(idForStore);
 let support=null;
 if(req.headers['x-plaza-support']){
  support=await access.active(req,idForStore);
  if(!support||!target)fail('Vendor support session ended or is unavailable.',403);
  if(!permitsSupport(action,method))fail('This action is outside storefront support access.',403);
 }
 const t=support?target:owner(req,target);
 if(action==='support-state'&&method==='GET'&&support)return respond(res,support);
 if(action==='billing'&&method==='GET')return respond(res,await billing.list(t.id));
 if(action==='billing/checkout'&&method==='POST'){limit(req,'rental-checkout',20);return respond(res,await billing.checkout(t,b));}
 const cancelBilling=action.match(/^billing\/([a-f0-9]{24})\/cancel$/);
 if(cancelBilling&&method==='POST'){limit(req,'rental-cancel',10);await billing.cancel(t,cancelBilling[1],req.user.id);return respond(res,{ok:true});}
 if(!action&&method==='GET'&&support)return respond(res,{
 tenant:t,products:(await all('SELECT id,data FROM products WHERE tenant_id=? ORDER BY created DESC',t.id)).map(r=>({id:r.id,...JSON.parse(r.data)})),
 images:await all('SELECT id,name,mime FROM images WHERE tenant_id=? ORDER BY created DESC',t.id),
 gateways:(await all('SELECT provider,enabled FROM gateways WHERE tenant_id=?',t.id)).map(g=>({provider:g.provider,enabled:!!g.enabled})),
 metrics:{orderCount:0,confirmedRevenue:0},orders:[],requests:[],support
 });
 if(!action&&method==='GET')return respond(res,{tenant:t,metrics:{orderCount:(await one('SELECT COUNT(*) AS n FROM orders WHERE tenant_id=?',t.id)).n,confirmedRevenue:(await one(revenueSQL(database),t.id)).n},products:(await all('SELECT * FROM products WHERE tenant_id=? ORDER BY created DESC',t.id)).map(p=>({id:p.id,...JSON.parse(p.data)})),orders:(await all('SELECT * FROM orders WHERE tenant_id=? ORDER BY created DESC LIMIT 500',t.id)).map(r=>{const o=readOrder(r);delete o.paymentConfig;return o;}),gateways:(await all('SELECT * FROM gateways WHERE tenant_id=?',t.id)).map(g=>({provider:g.provider,enabled:!!g.enabled,environment:decrypt(g.config,key).environment,configured:true})),images:(await all('SELECT id,name,mime FROM images WHERE tenant_id=? ORDER BY created DESC',t.id)),requests:(await all('SELECT * FROM requests WHERE tenant_id=? ORDER BY created DESC',t.id))});
 if(method==='PUT'&&action==='settings'||method==='POST'&&['products','images','requests'].includes(action)||['PUT','DELETE'].includes(method)&&/^products\/[a-f0-9]+$/.test(action)||method==='DELETE'&&/^images\/[a-f0-9]+$/.test(action)||method==='PUT'&&/^gateways\/[a-z]+$/.test(action)){
 const result=await tx(async ()=>{
 const current=await getTenantId(idForStore),t=support?current:owner(req,current);let a;
 if(support){
  if(!await access.active(req,t.id))fail('Vendor support session ended.',403);
  if(action==='settings'&&['published','currency','defaultPayment','contactEmail'].some(k=>Object.hasOwn(b,k)&&b[k]!==t.settings[k]))fail('Only the vendor can change publishing, currency, default payment, or the contact email.',403);
  await audit(t.id,req.user.id,'vendor-support.'+method.toLowerCase()+'.'+action.replaceAll('/','.')+'.'+support.id);
 }
 if(action==='settings'&&method==='PUT'){
 const next=settings(b,t.settings);if(next.published&&!t.settings.published&&b.vendorAcknowledgement!==true)fail('Confirm the independent vendor agreement before publishing.');for(const k of ['heroImage','logo'])if(next[k].startsWith('/api/images/')&&!(await one('SELECT id FROM images WHERE id=? AND tenant_id=?',next[k].split('/').pop(),t.id)))fail('Image does not belong to this store.');
 if(next.currency!==t.settings.currency&&(await one('SELECT id FROM orders WHERE tenant_id=? LIMIT 1',t.id)))fail('Currency cannot change after the first order. Contact support.');
 const methods=(await activeGateways({...t,settings:next}));if(next.defaultPayment&&!methods.some(g=>g.provider===next.defaultPayment))fail('Default payment must be enabled and support this currency.');
 if(next.published){if(!support&&!await available(t))fail('Your store rental is inactive.',403);if(!next.contactEmail||!next.address||!next.shipping||!next.returns||!next.privacy||!next.terms)fail('Add seller contact details, business address, delivery, return, privacy and terms policies before publishing.');if(!next.defaultPayment)fail('Set up and select a default payment method before publishing.');if(!(await all('SELECT data FROM products WHERE tenant_id=?',t.id)).some(p=>JSON.parse(p.data).active))fail('Add an active product before publishing.');}
 (await run('UPDATE tenants SET settings=? WHERE id=?',JSON.stringify(next),t.id));await audit(t.id,req.user.id,'settings.updated');if(next.published&&!t.settings.published)await audit(t.id,req.user.id,'publish.vendor-agreement.'+policyVersion);return {payload:{settings:next}};
 }
 if(action==='products'&&method==='POST'){
 if((await one('SELECT COUNT(*) AS n FROM products WHERE tenant_id=?',t.id)).n>=1000)fail('Product limit reached. Contact support.');const p=product(b);await checkProductImages(p,t.id);const pid=id();await run('INSERT INTO products VALUES(?,?,?,?)',pid,t.id,JSON.stringify(p),Date.now());return {payload:{id:pid,...p},status:201};
 }
 if((a=action.match(/^products\/([a-f0-9]+)$/))){const row=(await one('SELECT * FROM products WHERE id=? AND tenant_id=?',a[1],t.id));if(!row)fail('Product not found.',404);if(method==='PUT'){const p=product(b);await checkProductImages(p,t.id);(await run('UPDATE products SET data=? WHERE id=? AND tenant_id=?',JSON.stringify(p),a[1],t.id));return {payload:{id:a[1],...p}};}if(method==='DELETE'){await run('DELETE FROM products WHERE id=? AND tenant_id=?',a[1],t.id);return {payload:{ok:true}};}}
 if(action==='images'&&method==='POST'){
 const name=text(b.name,200,1),raw=text(b.data,4200000,1);const match=raw.match(/^data:image\/(png|jpeg|webp);base64,([a-zA-Z0-9+/=]+)$/);if(!match)fail('Upload PNG, JPEG or WebP images only.');const bytes=Buffer.from(match[2],'base64');if(bytes.length>2*1024*1024)fail('Maximum image size is 2 MB.');
 const mime='image/'+match[1];const valid=mime==='image/png'?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):mime==='image/jpeg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP';if(!valid)fail('Image content does not match its format.');
 const quota=(await one('SELECT COALESCE(SUM(length(bytes)),0) AS size,COUNT(*) AS n FROM images WHERE tenant_id=?',t.id));if(quota.size+bytes.length>100*1024*1024||quota.n>=200)fail('Media limit reached. Contact support.');const iid=id();await run('INSERT INTO images VALUES(?,?,?,?,?,?)',iid,t.id,mime,name,bytes,Date.now());return {payload:{id:iid,url:'/api/images/'+iid,name},status:201};
 }
 if((a=action.match(/^images\/([a-f0-9]+)$/))&&method==='DELETE'){
 const img=(await one('SELECT id FROM images WHERE id=? AND tenant_id=?',a[1],t.id));if(!img)fail('Image not found.',404);const url='/api/images/'+img.id;if(JSON.stringify(t.settings).includes(url)||(await all('SELECT data FROM products WHERE tenant_id=?',t.id)).some(x=>x.data.includes(url)))fail('Replace this image wherever it is used before deleting.');await run('DELETE FROM images WHERE id=? AND tenant_id=?',img.id,t.id);return {payload:{ok:true}};
 }
 if((a=action.match(/^gateways\/([a-z]+)$/))&&method==='PUT'){
 const g=gateways.find(x=>x.id===a[1]);if(!g)fail('Unknown gateway.');const old=(await one('SELECT * FROM gateways WHERE tenant_id=? AND provider=?',t.id,g.id));if(b.enabled===false){if(t.settings.published&&t.settings.defaultPayment===g.id)fail('Choose another default payment before disabling this one.');await run('UPDATE gateways SET enabled=0 WHERE tenant_id=? AND provider=?',t.id,g.id);return {payload:{ok:true}};}
 const config=validateGateway(g.id,b,old?decrypt(old.config,key):{});if(!g.currencies.includes(t.settings.currency))fail('This provider does not support the store currency.');
 (await run('INSERT INTO gateways VALUES(?,?,?,?) ON CONFLICT(tenant_id,provider) DO UPDATE SET enabled=excluded.enabled,config=excluded.config',t.id,g.id,1,encrypt(config,key)));await audit(t.id,req.user.id,'gateway.configured.'+g.id);return {payload:{ok:true}};
 }
 if(action==='requests'&&method==='POST'){if(b.kind==='cancellation'&&await one("SELECT id FROM plaza_rentals WHERE tenant_id=? AND provider='paypal' AND provider_id IS NOT NULL AND status NOT IN ('cancelled','expired') LIMIT 1",t.id))fail('Cancel PayPal automatic renewal in Rental billing before closing the store.',409);if(!['cancellation','deletion','billing','support'].includes(b.kind))fail('Invalid request.');const requestId=id();await run('INSERT INTO requests VALUES(?,?,?,?,?)',requestId,t.id,b.kind,text(b.note||'',3000),Date.now());if(b.kind==='cancellation'){await run('UPDATE tenants SET status=? WHERE id=?','cancelled',t.id);(await run('UPDATE tenants SET settings=? WHERE id=?',JSON.stringify({...t.settings,published:false}),t.id));}await audit(t.id,req.user.id,'request.'+b.kind);const mail={store:t.settings.name,type:b.kind};await notify('service_request',requestId,req.user.email,mail);await notify('service_operator',requestId,operatorEmail,mail);return {payload:{ok:true}};}
 fail('Admin action not found.',404);
 },'tenant:'+t.id);
 return respond(res,result.payload,result.status);
 }
 let a;
 if((a=action.match(/^orders\/([a-f0-9]+)$/))&&method==='PATCH'){
 await tx(async ()=>{
 const row=await one('SELECT * FROM orders WHERE id=? AND tenant_id=?',a[1],t.id);if(!row)fail('Order not found.',404);const o=readOrder(row);
 if(b.markPaid===true&&gateways.find(g=>g.id===o.gateway)?.mode!=='manual')fail('Automated payments must be verified by the provider.');
 if(b.markPaid===true&&!o.paid){if(o.state==='cancelled')fail('Cancelled order cannot be paid.');const reference=text(b.reference,200,3);await run('UPDATE orders SET paid=1,transaction_id=? WHERE id=? AND tenant_id=?','manual:'+reference,o.id,t.id);(await audit(t.id,req.user.id,'payment.manual-confirmation'));await notify('payment',o.id,o.customer.email,orderMail(o,t),{replyTo:o.seller?.email||t.settings.contactEmail});}
 if(b.state){if(!['new','processing','fulfilled','cancelled'].includes(b.state))fail('Invalid order status.');if(o.state==='cancelled'&&b.state!=='cancelled')fail('Cancelled orders cannot be reopened.');const isPaid=o.paid||b.markPaid===true;if(b.state==='fulfilled'&&!isPaid)fail('Confirm payment before fulfilment.');if(b.state==='cancelled'&&isPaid)fail('Refund with your payment provider first. Contact support to reconcile the refund.');if(b.state==='cancelled'&&o.state!=='cancelled')(await release(row));await run('UPDATE orders SET state=? WHERE id=? AND tenant_id=?',b.state,o.id,t.id);if(b.state!==o.state)await notify('order_status',id(),o.customer.email,{...orderMail(o,t),state:b.state},{replyTo:o.seller?.email||t.settings.contactEmail});}
 },'tenant:'+t.id);return respond(res,{ok:true});
 }
 if(action==='export'&&method==='GET'){
 const images=(await all('SELECT * FROM images WHERE tenant_id=?',t.id)).map(x=>({id:x.id,name:x.name,mime:x.mime,data:Buffer.from(x.bytes).toString('base64')}));
 const orders=(await all('SELECT * FROM orders WHERE tenant_id=?',t.id)).map(x=>{const o=readOrder(x);delete o.paymentConfig;return o;});res.setHeader('Content-Disposition',`attachment; filename="${t.slug}-export.json"`);return respond(res,{exportedAt:new Date().toISOString(),tenant:t,products:(await all('SELECT * FROM products WHERE tenant_id=?',t.id)).map(x=>({id:x.id,...JSON.parse(x.data)})),orders,images});
 }
 fail('Admin action not found.',404);
 }
 if(path==='/api/operator'&&method==='GET'){requireOperator(req);return respond(res,{tenants:(await all('SELECT t.*,u.email FROM tenants t JOIN users u ON u.id=t.owner ORDER BY t.created DESC')).map(unpack),requests:(await all('SELECT r.*,t.slug FROM requests r JOIN tenants t ON t.id=r.tenant_id ORDER BY r.created DESC')),audit:await access.auditWithReason(await all('SELECT * FROM audit ORDER BY created DESC LIMIT 200'))});}
 if((m=path.match(/^\/api\/operator\/([a-f0-9]+)$/))&&method==='PATCH'){
 requireOperator(req);await tx(async ()=>{const t=await getTenantId(m[1]);if(!t)fail('Store not found.',404);if(!['active','trial','suspended','cancelled'].includes(b.status))fail('Invalid rental status.');const trialEnd=b.status==='trial'?Date.now()+integer(b.trialDays||14,90,1)*86400000:t.trial_end;await run('UPDATE tenants SET status=?,trial_end=? WHERE id=?',b.status,trialEnd,t.id);await audit(t.id,req.user.id,'operator.status.'+b.status);if(t.status!==b.status){const owner=await one('SELECT email FROM users WHERE id=?',t.owner);await notify('rental',id(),owner?.email,{store:t.settings.name,status:b.status});}},'tenant:'+m[1]);return respond(res,{ok:true});
 }
 if((m=path.match(/^\/api\/operator\/([a-f0-9]+)\/reset$/))&&method==='POST'){
 requireOperator(req);const t=(await getTenantId(m[1]));if(!t)fail('Store not found.',404);const token=randomBytes(32).toString('hex'),expires=Date.now()+3600000;const queued=await tx(async()=>{await run('DELETE FROM resets WHERE user_id=?',t.owner);await run('INSERT INTO resets VALUES(?,?,?)',hash(token),t.owner,expires);await audit(t.id,req.user.id,'operator.password-reset-issued');const owner=await one('SELECT email FROM users WHERE id=?',t.owner);return notify('reset',hash(token),owner?.email,{token},{expires});},'password-reset');return respond(res,{queued,...(queued?{}:{token}),expiresInMinutes:60});
 }
 if((m=path.match(/^\/api\/images\/([a-f0-9]+)$/))&&method==='GET'){
 const row=(await one('SELECT * FROM images WHERE id=?',m[1]));const t=row?(await getTenantId(row.tenant_id)):null;if(!row||(!((await available(t)&&t.settings.published&&(await storefrontRestriction(t.id))!=='suspend')||req.user?.id===t.owner||await access.permitsImage(req,t.id))))fail('Image not found.',404);res.writeHead(200,{'Content-Type':row.mime,'Cache-Control':'private, no-store'});return res.end(Buffer.from(row.bytes));
 }
 if(path==='/developer/demo'||path==='/developer/demo/')return redirect(res,'/developer');
 if(path.startsWith('/api/'))fail('Endpoint not found.',404);
 if(method!=='GET'&&method!=='HEAD')fail('Method not allowed.',405);
 const publicDir=resolve(here,'../public');const page=path==='/'||/^\/(demo|admin|login|signup|operator|developer(?:\/vendors\/[a-f0-9]{24})?|test-access|consultation|reset|report|legal(?:\/[a-z-]+)?|s\/[a-z0-9-]+)\/?$/.test(path)?'/index.html':path;
 const file=resolve(publicDir,'.'+page);if(!file.startsWith(publicDir+'/')||!existsSync(file))fail('Page not found.',404);
 const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.ico':'image/x-icon','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.json':'application/json; charset=utf-8','.webmanifest':'application/manifest+json; charset=utf-8','.txt':'text/plain; charset=utf-8'};
 res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream','Cache-Control':page==='/index.html'?'no-cache':'public, max-age=3600'});if(method==='HEAD')return res.end();
 if(page==='/index.html'){const origin=(baseURL||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));return res.end(readFileSync(file,'utf8').replaceAll('__PLAZA_ORIGIN__',origin));}
 return res.end(readFileSync(file));
 }catch(e){if(!res.headersSent){if(!e.status)console.error('Request failed:',e.code||e.name);respond(res,{error:e.status?e.message:'Something went wrong. Please try again.'},e.status||500);}else res.end();}
 });
 async function checkProductImages(p,tid){if(p.image.startsWith('/api/images/')&&!(await one('SELECT id FROM images WHERE id=? AND tenant_id=?',p.image.split('/').pop(),tid)))fail('Image does not belong to this store.');}
 server.on('close',()=>{clearInterval(timer);clearInterval(mailTimer);void database.close().catch(error=>console.error('Database close failed:',error.code||error.name));});return {server,db:database.raw,database};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){const {server}=await createApp();server.listen(Number(process.env.PORT||3000),'0.0.0.0',()=>console.log('ICSS Plaza listening on port '+(process.env.PORT||3000)));}

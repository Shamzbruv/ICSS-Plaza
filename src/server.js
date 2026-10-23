import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { id, hash, fail, text, integer, passwordHash, passwordMatches, encrypt, decrypt, defaults, settings, product, totals } from './model.js';
import { gateways, validateGateway, initiate, capturePayPal, verifyFygaro, wiHash, same } from './payments.js';
import { resolveBaseURL, resolveEncryptionKey } from './runtime-config.js';
const here=dirname(fileURLToPath(import.meta.url));
const email=x=>{x=text(x,200,3).toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x))fail('Enter a valid email address.');return x;};
export function createApp(options={}) {
 const production=options.production ?? process.env.NODE_ENV==='production';
 const baseURL=resolveBaseURL({baseURL:options.baseURL,production});
 const dataDir=resolve(options.dataDir || process.env.DATA_DIR || './data'); mkdirSync(dataDir,{recursive:true});
 const db=new DatabaseSync(resolve(dataDir,'plaza.sqlite')); db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
 db.exec(`CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT NOT NULL UNIQUE,password TEXT NOT NULL,created INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS tenants(id TEXT PRIMARY KEY,slug TEXT UNIQUE NOT NULL,owner TEXT NOT NULL REFERENCES users(id),status TEXT NOT NULL DEFAULT 'trial',trial_end INTEGER NOT NULL,settings TEXT NOT NULL,created INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id),csrf TEXT NOT NULL,expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS products(id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL REFERENCES tenants(id),data TEXT NOT NULL,created INTEGER NOT NULL);
 CREATE INDEX IF NOT EXISTS products_tenant ON products(tenant_id);
 CREATE TABLE IF NOT EXISTS gateways(tenant_id TEXT NOT NULL REFERENCES tenants(id),provider TEXT NOT NULL,enabled INTEGER NOT NULL,config TEXT NOT NULL,PRIMARY KEY(tenant_id,provider));
 CREATE TABLE IF NOT EXISTS orders(id TEXT PRIMARY KEY,short_id TEXT NOT NULL UNIQUE,tenant_id TEXT NOT NULL REFERENCES tenants(id),token_hash TEXT NOT NULL,idempotency TEXT NOT NULL,request_hash TEXT NOT NULL,data TEXT NOT NULL,state TEXT NOT NULL,paid INTEGER NOT NULL DEFAULT 0,transaction_id TEXT,created INTEGER NOT NULL,UNIQUE(tenant_id,idempotency));
 CREATE UNIQUE INDEX IF NOT EXISTS payment_transaction ON orders(tenant_id,transaction_id) WHERE transaction_id IS NOT NULL;
 CREATE INDEX IF NOT EXISTS orders_tenant ON orders(tenant_id);
 CREATE TABLE IF NOT EXISTS images(id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL REFERENCES tenants(id),mime TEXT NOT NULL,name TEXT NOT NULL,bytes BLOB NOT NULL,created INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS audit(id TEXT PRIMARY KEY,tenant_id TEXT,actor TEXT NOT NULL,action TEXT NOT NULL,created INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS requests(id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL REFERENCES tenants(id),kind TEXT NOT NULL,note TEXT NOT NULL,created INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS resets(token TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),expires INTEGER NOT NULL);`);
 let key;
 try { key=resolveEncryptionKey({encryptionKey:options.encryptionKey,dataDir,db}); }
 catch(error) { db.close(); throw error; }
 const operatorEmail=(options.operatorEmail || process.env.OPERATOR_EMAIL || '').toLowerCase();
 const opPassword=options.operatorPassword || process.env.OPERATOR_PASSWORD;
 if(operatorEmail && opPassword && !db.prepare('SELECT id FROM users WHERE email=?').get(operatorEmail)) db.prepare('INSERT INTO users VALUES(?,?,?,?)').run(id(),email(operatorEmail),passwordHash(opPassword),Date.now());
 const one=(sql,...args)=>db.prepare(sql).get(...args), all=(sql,...args)=>db.prepare(sql).all(...args), run=(sql,...args)=>db.prepare(sql).run(...args);
 const audit=(tenant,actor,action)=>run('INSERT INTO audit VALUES(?,?,?,?,?)',id(),tenant,actor,action,Date.now());
 function tx(fn){db.exec('BEGIN IMMEDIATE');try{const x=fn();db.exec('COMMIT');return x;}catch(e){db.exec('ROLLBACK');throw e;}}
 function available(t){return t && (t.status==='active' || (t.status==='trial' && t.trial_end>Date.now()));}
 const unpack=t=>t?{...t,settings:JSON.parse(t.settings)}:null;
 const getTenant=slug=>unpack(one('SELECT * FROM tenants WHERE slug=?',slug));
 const getTenantId=tid=>unpack(one('SELECT * FROM tenants WHERE id=?',tid));
 const publicGateway=g=>({id:g.provider,name:g.provider==='custom'?(decrypt(g.config,key).label||'Other approved provider'):gateways.find(x=>x.id===g.provider)?.name,mode:gateways.find(x=>x.id===g.provider)?.mode});
 function activeGateways(t){return all('SELECT * FROM gateways WHERE tenant_id=? AND enabled=1',t.id).filter(g=>gateways.find(x=>x.id===g.provider)?.currencies.includes(t.settings.currency));}
 function owner(req,t){if(!req.user || !t || t.owner!==req.user.id)fail('Store not found or access denied.',404);return t;}
 function requireUser(req){if(!req.user)fail('Please sign in.',401);}
 function requireOperator(req){requireUser(req);if(req.user.email!==operatorEmail || !operatorEmail)fail('Operator access required.',403);}
 function getConfig(tid,provider){const row=one('SELECT * FROM gateways WHERE tenant_id=? AND provider=?',tid,provider);if(!row)fail('Payment method is unavailable.');return {...row,value:decrypt(row.config,key)};}
 const readOrder=row=>row?{...JSON.parse(row.data),id:row.id,tenant_id:row.tenant_id,short_id:row.short_id,state:row.state,paid:!!row.paid,created:row.created,transaction_id:row.transaction_id}:null;
 function orderAccess(oid,token){const row=one('SELECT * FROM orders WHERE id=?',oid);if(!row||!token||!same(row.token_hash,hash(token)))fail('Order not found.',404);return readOrder(row);}
 function paid(oid,transaction){return tx(()=>{const o=one('SELECT * FROM orders WHERE id=?',oid);if(!o)fail('Order not found.',404);if(o.paid)return;if(o.state==='cancelled')fail('Order cancelled: payment needs operator review.',409);run('UPDATE orders SET paid=1,transaction_id=? WHERE id=?',transaction,oid);audit(o.tenant_id,'gateway','payment.verified');});}
 function release(o){const data=JSON.parse(o.data);for(const l of data.lines){const p=one('SELECT * FROM products WHERE id=? AND tenant_id=?',l.productId,o.tenant_id);if(!p)continue;const d=JSON.parse(p.data);if(l.variantId){const v=d.variants.find(x=>x.id===l.variantId);if(v)v.stock+=l.quantity;}else d.stock+=l.quantity;run('UPDATE products SET data=? WHERE id=?',JSON.stringify(d),p.id);}}
 const paymentLocks=new Set();
 const rate=new Map();function limit(req,bucket,max){const ip=process.env.TRUST_PROXY==='1'?String(req.headers['x-forwarded-for']||req.socket.remoteAddress).split(',')[0]:req.socket.remoteAddress;const k=bucket+':'+ip;const now=Date.now();let r=rate.get(k);if(!r||r.until<now)r={count:0,until:now+900000};if(++r.count>max)fail('Too many requests. Try again in 15 minutes.',429);rate.set(k,r);}
 const timer=setInterval(()=>{for(const [k,v]of rate)if(v.until<Date.now())rate.delete(k);run('DELETE FROM sessions WHERE expires<?',Date.now());run('DELETE FROM resets WHERE expires<?',Date.now());},60000);timer.unref();
 function respond(res,data,status=200){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
 function redirect(res,url){res.writeHead(303,{Location:url,'Cache-Control':'no-store'});res.end();}
 function session(req,res,user){const token=randomBytes(32).toString('hex'),csrf=randomBytes(24).toString('hex');run('INSERT INTO sessions VALUES(?,?,?,?)',hash(token),user.id,csrf,Date.now()+7*86400000);res.setHeader('Set-Cookie',`plaza_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800${production?'; Secure':''}`);req.user=user;req.csrf=csrf;}
 async function body(req){let size=0,chunks=[];for await(const chunk of req){size+=chunk.length;if(size>4*1024*1024)fail('Request too large.',413);chunks.push(chunk);}const raw=Buffer.concat(chunks);req.raw=raw;try{return raw.length?JSON.parse(raw.toString()):{};}catch{fail('Invalid JSON.');}}
 const server=http.createServer(async(req,res)=>{
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Frame-Options','DENY');
 res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');
 res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'");
 if(production)res.setHeader('Strict-Transport-Security','max-age=31536000');
 try {
 const u=new URL(req.url,baseURL),path=u.pathname,method=req.method;
 const token=String(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('plaza_session='))?.slice(14);
 const s=token?one('SELECT s.*,u.email FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires>?',hash(token),Date.now()):null;
 if(s){req.user={id:s.user_id,email:s.email};req.csrf=s.csrf;}
 const webhook=/^\/api\/payments\/[a-f0-9]+\/fygaro\/hook$/.test(path);
 if(!['GET','HEAD'].includes(method)){
 if(!webhook){if(req.headers.origin!==new URL(baseURL).origin)fail('Request origin rejected.',403);if(s&&req.headers['x-csrf-token']!==s.csrf)fail('Refresh the page and try again.',403);if(!String(req.headers['content-type']||'').startsWith('application/json'))fail('JSON required.',415);}
 req.body=await body(req);
 }
 const b=req.body||{};
 if(path==='/api/health')return respond(res,{ok:!!one('SELECT 1 AS ok')});
 if(path==='/api/catalog')return respond(res,{gateways,operator:'iCreate Solutions & Services',trialDays:14});
 if(path==='/api/session'&&method==='GET'){const tenants=req.user?all('SELECT * FROM tenants WHERE owner=?',req.user.id).map(unpack):[];return respond(res,{user:req.user||null,csrf:req.csrf||'',tenants,operator:!!operatorEmail&&req.user?.email===operatorEmail});}
 if(path==='/api/signup'&&method==='POST'){
 limit(req,'signup',10);const em=email(b.email),pw=passwordHash(b.password),slug=text(b.slug,48,3).toLowerCase();if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)||['admin','demo','api','www','plaza','support'].includes(slug))fail('Choose a store address using letters, numbers and hyphens.');
 if(b.acceptTerms!==true)fail('Accept the platform terms to continue.');
 const uid=id(),tid=id();tx(()=>{if(one('SELECT id FROM users WHERE email=?',em))fail('This email is already registered. Sign in instead.',409);if(one('SELECT id FROM tenants WHERE slug=?',slug))fail('That store address is taken.',409);run('INSERT INTO users VALUES(?,?,?,?)',uid,em,pw,Date.now());run('INSERT INTO tenants VALUES(?,?,?,?,?,?,?)',tid,slug,uid,'trial',Date.now()+14*86400000,JSON.stringify({...defaults(),name:text(b.name,180,1),contactEmail:em}),Date.now());});
 session(req,res,{id:uid,email:em});audit(tid,uid,'signup.terms-v1');return respond(res,{ok:true},201);
 }
 if(path==='/api/login'&&method==='POST'){
 limit(req,'login',30);const em=email(b.email),pw=text(b.password,128,1);const user=one('SELECT * FROM users WHERE email=?',em);if(!passwordMatches(pw,user?.password||'0000000000000000:'+ '0'.repeat(128)))fail('Email or password is incorrect.',401);session(req,res,user);return respond(res,{ok:true});
 }
 if(path==='/api/logout'&&method==='POST'){if(token)run('DELETE FROM sessions WHERE token=?',hash(token));res.setHeader('Set-Cookie','plaza_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');return respond(res,{ok:true});}
 if(path==='/api/password'&&method==='POST'){requireUser(req);const user=one('SELECT * FROM users WHERE id=?',req.user.id);if(!passwordMatches(text(b.currentPassword,128,1),user.password))fail('Current password is incorrect.',403);run('UPDATE users SET password=? WHERE id=?',passwordHash(b.password),user.id);run('DELETE FROM sessions WHERE user_id=?',user.id);session(req,res,user);return respond(res,{ok:true});}
 if(path==='/api/reset'&&method==='POST'){limit(req,'reset',20);const r=one('SELECT * FROM resets WHERE token=? AND expires>?',hash(text(b.token,100,1)),Date.now());if(!r)fail('Reset token is invalid or expired.');tx(()=>{run('UPDATE users SET password=? WHERE id=?',passwordHash(b.password),r.user_id);run('DELETE FROM sessions WHERE user_id=?',r.user_id);run('DELETE FROM resets WHERE user_id=?',r.user_id);});return respond(res,{ok:true});}
 let m;
 if((m=path.match(/^\/api\/stores\/([a-z0-9-]+)$/))&&method==='GET'){
 const t=getTenant(m[1]);if(!available(t)||!t.settings.published)fail('This store is not currently available.',404);return respond(res,{id:t.id,slug:t.slug,settings:t.settings,products:all('SELECT * FROM products WHERE tenant_id=? ORDER BY created DESC',t.id).map(p=>({id:p.id,...JSON.parse(p.data)})).filter(p=>p.active),gateways:activeGateways(t).map(publicGateway)});
 }
 if((m=path.match(/^\/api\/stores\/([a-z0-9-]+)\/orders$/))&&method==='POST'){
 limit(req,'checkout',60);const t=getTenant(m[1]);if(!available(t)||!t.settings.published)fail('This store is not currently accepting orders.',409);
 const idem=text(b.idempotency,100,16),orderToken=text(b.orderToken,100,32),fingerprint=hash(JSON.stringify(b));
 const existing=one('SELECT * FROM orders WHERE tenant_id=? AND idempotency=?',t.id,idem);if(existing){if(existing.request_hash!==fingerprint)fail('Checkout key already used with different details.',409);const safe=readOrder(existing);delete safe.paymentConfig;return respond(res,{order:safe,token:orderToken});}
 const contact={name:text(b.customer?.name,160,1),email:email(b.customer?.email),phone:text(b.customer?.phone,60,3),address:text(b.customer?.address||'',1000)};
 if(b.acceptTerms!==true)fail('Accept this seller’s terms and privacy notice.');
 const delivery=b.delivery==='pickup'?'pickup':'shipping';if((delivery==='pickup'&&!t.settings.pickup)||(delivery==='shipping'&&!t.settings.shippingEnabled))fail('Delivery option is unavailable.');if(delivery==='shipping'&&!contact.address)fail('Delivery address is required.');
 const gateway=text(b.gateway,40,1);if(!activeGateways(t).some(g=>g.provider===gateway))fail('Choose an available payment method.');
 const config=getConfig(t.id,gateway).value;
 const g=gateways.find(g=>g.id===gateway);if(g.mode==='automated'&&config.environment!=='live')fail('This payment method is in sandbox mode. Ask the seller to activate live credentials.',409);
 const oid=id(),short=id().slice(0,14);
 const order=tx(()=>{
 if(!Array.isArray(b.lines)||!b.lines.length||b.lines.length>100)fail('Your cart must contain 1–100 items.');
 const seen=new Set(); const lines=b.lines.map(line=>{
 const pid=text(line.productId,40,1),variantId=text(line.variantId||'',60),lk=pid+':'+variantId;if(seen.has(lk))fail('Duplicate cart item.');seen.add(lk);
 const row=one('SELECT * FROM products WHERE id=? AND tenant_id=?',pid,t.id);if(!row)fail('A product is unavailable.');const p=JSON.parse(row.data);if(!p.active)fail('A product is unavailable.');const quantity=integer(line.quantity,99,1);
 let item=p;if(p.variants.length){item=p.variants.find(v=>v.id===variantId);if(!item)fail('Choose a valid product option.');}else if(variantId)fail('Invalid product option.');
 if(item.stock<quantity)fail(`${p.name} has insufficient stock.`,409);item.stock-=quantity;run('UPDATE products SET data=? WHERE id=? AND tenant_id=?',JSON.stringify(p),pid,t.id);
 return {productId:pid,variantId,name:p.name+(item!==p?' — '+item.name:''),price:item.price,quantity,type:p.type};
 });
 const total=totals(lines,t.settings,delivery);const data={...total,currency:t.settings.currency,slug:t.slug,gateway,customer:contact,delivery,lines,provider_id:'',payment:null,paymentConfig:encrypt(config,key),termsAcceptedAt:Date.now()};
 run('INSERT INTO orders VALUES(?,?,?,?,?,?,?,?,?,?,?)',oid,short,t.id,hash(orderToken),idem,fingerprint,JSON.stringify(data),'new',0,null,Date.now());
 return readOrder(one('SELECT * FROM orders WHERE id=?',oid));
 });
 // Order persistence precedes the provider call so retries never duplicate inventory reservations.
 paymentLocks.add(oid);try{order.payment=await initiate(order,config,baseURL,options.fetcher);order.provider_id=order.payment.providerId||'';run('UPDATE orders SET data=? WHERE id=?',JSON.stringify({...order,paymentConfig:order.paymentConfig}),oid);}catch(e){order.paymentError='Payment could not be started. Contact the seller with your reference.';}finally{paymentLocks.delete(oid);}
 const safeOrder={...order};delete safeOrder.paymentConfig;return respond(res,{order:safeOrder,token:orderToken},201);
 }
 if((m=path.match(/^\/api\/orders\/([a-f0-9]+)\/payment$/))&&method==='POST'){
 limit(req,'payment-retry',30);const o=orderAccess(m[1],b.token);const t=getTenantId(o.tenant_id);
 if(!available(t)||!t.settings.published||o.state==='cancelled'||o.paid)fail('This order cannot start a payment.',409);
 if(o.payment?.url){const safe={...o};delete safe.paymentConfig;return respond(res,{order:safe});}
 if(paymentLocks.has(o.id))fail('Payment is already starting. Try again shortly.',409);
 paymentLocks.add(o.id);
 try{const config=decrypt(o.paymentConfig,key);o.payment=await initiate(o,config,baseURL,options.fetcher);o.provider_id=o.payment.providerId||'';run('UPDATE orders SET data=? WHERE id=?',JSON.stringify(o),o.id);const safe={...o};delete safe.paymentConfig;return respond(res,{order:safe});}finally{paymentLocks.delete(o.id);}
 }
 if((m=path.match(/^\/api\/orders\/([a-f0-9]+)$/))&&method==='GET'){const o=orderAccess(m[1],u.searchParams.get('token'));delete o.paymentConfig;return respond(res,{order:o});}
 if((m=path.match(/^\/api\/payments\/([a-f0-9]+)\/(fygaro|paypal|wipay)\/(hook|return)$/))){
 const [,tid,provider,kind]=m;
 if(provider==='fygaro'&&kind==='hook'&&method==='POST'){
 const row=one('SELECT * FROM orders WHERE id=? AND tenant_id=?',String(b.customReference||''),tid);if(!row)fail('Unknown order.',404);const o=readOrder(row);if(o.gateway!==provider)fail('Gateway mismatch.');const c=decrypt(o.paymentConfig,key);
 if(!verifyFygaro(req.raw,req.headers,c))fail('Invalid webhook signature.',401);
 if(b.currency!==o.currency||Math.round(Number(b.amount)*100)!==o.total||typeof b.transactionId!=='string'||!b.transactionId)fail('Payment amount, currency or transaction mismatch.',409);
 paid(o.id,'fygaro:'+b.transactionId);return respond(res,{received:true});
 }
 if(kind==='return'&&method==='GET'){
 const row=one('SELECT * FROM orders WHERE id=? AND tenant_id=?',u.searchParams.get('order')||'',tid);if(!row)fail('Order not found.',404);const o=readOrder(row);if(o.gateway!==provider)fail('Gateway mismatch.');const c=decrypt(o.paymentConfig,key);
 if(provider==='paypal'&&!o.paid)paid(o.id,'paypal:'+await capturePayPal(o,c,u.searchParams.get('token'),options.fetcher));
 if(provider==='wipay'&&!o.paid){const tr=u.searchParams.get('transaction_id')||'';if(u.searchParams.get('status')!=='success'||u.searchParams.get('order_id')!==o.short_id||!tr||tr!==o.provider_id||u.searchParams.get('currency')!==o.currency||!same(wiHash(tr,o.total,c.secret),u.searchParams.get('hash')))fail('Payment is awaiting verification.',409);paid(o.id,'wipay:'+tr);}
 return redirect(res,baseURL+'/s/'+o.slug+'?payment=returned');
 }
 fail('Unknown payment action.',404);
 }
 if((m=path.match(/^\/api\/admin\/([a-f0-9]+)(?:\/(.*))?$/))){
 requireUser(req);const t=owner(req,getTenantId(m[1])),action=m[2]||'';
 if(!action&&method==='GET')return respond(res,{tenant:t,metrics:{orderCount:one('SELECT COUNT(*) AS n FROM orders WHERE tenant_id=?',t.id).n,confirmedRevenue:one("SELECT COALESCE(SUM(json_extract(data,'$.total')),0) AS n FROM orders WHERE tenant_id=? AND paid=1",t.id).n},products:all('SELECT * FROM products WHERE tenant_id=? ORDER BY created DESC',t.id).map(p=>({id:p.id,...JSON.parse(p.data)})),orders:all('SELECT * FROM orders WHERE tenant_id=? ORDER BY created DESC LIMIT 500',t.id).map(r=>{const o=readOrder(r);delete o.paymentConfig;return o;}),gateways:all('SELECT * FROM gateways WHERE tenant_id=?',t.id).map(g=>({provider:g.provider,enabled:!!g.enabled,environment:decrypt(g.config,key).environment,configured:true})),images:all('SELECT id,name,mime FROM images WHERE tenant_id=? ORDER BY created DESC',t.id),requests:all('SELECT * FROM requests WHERE tenant_id=? ORDER BY created DESC',t.id)});
 if(action==='settings'&&method==='PUT'){
 const next=settings(b,t.settings);for(const k of ['heroImage','logo'])if(next[k].startsWith('/api/images/')&&!one('SELECT id FROM images WHERE id=? AND tenant_id=?',next[k].split('/').pop(),t.id))fail('Image does not belong to this store.');
 if(next.currency!==t.settings.currency&&one('SELECT id FROM orders WHERE tenant_id=? LIMIT 1',t.id))fail('Currency cannot change after the first order. Contact support.');
 const methods=activeGateways({...t,settings:next});if(next.defaultPayment&&!methods.some(g=>g.provider===next.defaultPayment))fail('Default payment must be enabled and support this currency.');
 if(next.published){if(!available(t))fail('Your store rental is inactive.',403);if(!next.contactEmail||!next.address||!next.shipping||!next.returns||!next.privacy||!next.terms)fail('Add seller contact details, business address, delivery, return, privacy and terms policies before publishing.');if(!next.defaultPayment)fail('Set up and select a default payment method before publishing.');if(!all('SELECT data FROM products WHERE tenant_id=?',t.id).some(p=>JSON.parse(p.data).active))fail('Add an active product before publishing.');}
 run('UPDATE tenants SET settings=? WHERE id=?',JSON.stringify(next),t.id);audit(t.id,req.user.id,'settings.updated');return respond(res,{settings:next});
 }
 if(action==='products'&&method==='POST'){
 if(one('SELECT COUNT(*) AS n FROM products WHERE tenant_id=?',t.id).n>=1000)fail('Product limit reached. Contact support.');const p=product(b);checkProductImages(p,t.id);const pid=id();run('INSERT INTO products VALUES(?,?,?,?)',pid,t.id,JSON.stringify(p),Date.now());return respond(res,{id:pid,...p},201);
 }
 let a;
 if((a=action.match(/^products\/([a-f0-9]+)$/))){const row=one('SELECT * FROM products WHERE id=? AND tenant_id=?',a[1],t.id);if(!row)fail('Product not found.',404);if(method==='PUT'){const p=product(b);checkProductImages(p,t.id);run('UPDATE products SET data=? WHERE id=? AND tenant_id=?',JSON.stringify(p),a[1],t.id);return respond(res,{id:a[1],...p});}if(method==='DELETE'){run('DELETE FROM products WHERE id=? AND tenant_id=?',a[1],t.id);return respond(res,{ok:true});}}
 if(action==='images'&&method==='POST'){
 const name=text(b.name,200,1),raw=text(b.data,4200000,1);const match=raw.match(/^data:image\/(png|jpeg|webp);base64,([a-zA-Z0-9+/=]+)$/);if(!match)fail('Upload PNG, JPEG or WebP images only.');const bytes=Buffer.from(match[2],'base64');if(bytes.length>2*1024*1024)fail('Maximum image size is 2 MB.');
 const mime='image/'+match[1];const valid=mime==='image/png'?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):mime==='image/jpeg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP';if(!valid)fail('Image content does not match its format.');
 const quota=one('SELECT COALESCE(SUM(length(bytes)),0) AS size,COUNT(*) AS n FROM images WHERE tenant_id=?',t.id);if(quota.size+bytes.length>100*1024*1024||quota.n>=200)fail('Media limit reached. Contact support.');const iid=id();run('INSERT INTO images VALUES(?,?,?,?,?,?)',iid,t.id,mime,name,bytes,Date.now());return respond(res,{id:iid,url:'/api/images/'+iid,name},201);
 }
 if((a=action.match(/^images\/([a-f0-9]+)$/))&&method==='DELETE'){
 const img=one('SELECT id FROM images WHERE id=? AND tenant_id=?',a[1],t.id);if(!img)fail('Image not found.',404);const url='/api/images/'+img.id;if(JSON.stringify(t.settings).includes(url)||all('SELECT data FROM products WHERE tenant_id=?',t.id).some(x=>x.data.includes(url)))fail('Replace this image wherever it is used before deleting.');run('DELETE FROM images WHERE id=? AND tenant_id=?',img.id,t.id);return respond(res,{ok:true});
 }
 if((a=action.match(/^gateways\/([a-z]+)$/))&&method==='PUT'){
 const g=gateways.find(x=>x.id===a[1]);if(!g)fail('Unknown gateway.');const old=one('SELECT * FROM gateways WHERE tenant_id=? AND provider=?',t.id,g.id);if(b.enabled===false){if(t.settings.published&&t.settings.defaultPayment===g.id)fail('Choose another default payment before disabling this one.');run('UPDATE gateways SET enabled=0 WHERE tenant_id=? AND provider=?',t.id,g.id);return respond(res,{ok:true});}
 const config=validateGateway(g.id,b,old?decrypt(old.config,key):{});if(!g.currencies.includes(t.settings.currency))fail('This provider does not support the store currency.');
 run('INSERT INTO gateways VALUES(?,?,?,?) ON CONFLICT(tenant_id,provider) DO UPDATE SET enabled=excluded.enabled,config=excluded.config',t.id,g.id,1,encrypt(config,key));audit(t.id,req.user.id,'gateway.configured.'+g.id);return respond(res,{ok:true});
 }
 if((a=action.match(/^orders\/([a-f0-9]+)$/))&&method==='PATCH'){
 const row=one('SELECT * FROM orders WHERE id=? AND tenant_id=?',a[1],t.id);if(!row)fail('Order not found.',404);const o=readOrder(row);
 tx(()=>{
 if(b.markPaid===true){if(gateways.find(g=>g.id===o.gateway)?.mode!=='manual')fail('Automated payments must be verified by the provider.');if(o.state==='cancelled')fail('Cancelled order cannot be paid.');const reference=text(b.reference,200,3);run('UPDATE orders SET paid=1,transaction_id=? WHERE id=? AND tenant_id=?','manual:'+reference,o.id,t.id);audit(t.id,req.user.id,'payment.manual-confirmation');}
 if(b.state){if(!['new','processing','fulfilled','cancelled'].includes(b.state))fail('Invalid order status.');if(o.state==='cancelled'&&b.state!=='cancelled')fail('Cancelled orders cannot be reopened.');const isPaid=o.paid||b.markPaid===true;if(b.state==='fulfilled'&&!isPaid)fail('Confirm payment before fulfilment.');if(b.state==='cancelled'&&isPaid)fail('Refund with your payment provider first. Contact support to reconcile the refund.');if(b.state==='cancelled'&&o.state!=='cancelled')release(row);run('UPDATE orders SET state=? WHERE id=? AND tenant_id=?',b.state,o.id,t.id);}
 });return respond(res,{ok:true});
 }
 if(action==='requests'&&method==='POST'){if(!['cancellation','deletion','billing','support'].includes(b.kind))fail('Invalid request.');run('INSERT INTO requests VALUES(?,?,?,?,?)',id(),t.id,b.kind,text(b.note||'',3000),Date.now());if(b.kind==='cancellation'){run('UPDATE tenants SET status=? WHERE id=?','cancelled',t.id);run('UPDATE tenants SET settings=? WHERE id=?',JSON.stringify({...t.settings,published:false}),t.id);}audit(t.id,req.user.id,'request.'+b.kind);return respond(res,{ok:true});}
 if(action==='export'&&method==='GET'){
 const images=all('SELECT * FROM images WHERE tenant_id=?',t.id).map(x=>({id:x.id,name:x.name,mime:x.mime,data:Buffer.from(x.bytes).toString('base64')}));
 const orders=all('SELECT * FROM orders WHERE tenant_id=?',t.id).map(x=>{const o=readOrder(x);delete o.paymentConfig;return o;});res.setHeader('Content-Disposition',`attachment; filename="${t.slug}-export.json"`);return respond(res,{exportedAt:new Date().toISOString(),tenant:t,products:all('SELECT * FROM products WHERE tenant_id=?',t.id).map(x=>({id:x.id,...JSON.parse(x.data)})),orders,images});
 }
 fail('Admin action not found.',404);
 }
 if(path==='/api/operator'&&method==='GET'){requireOperator(req);return respond(res,{tenants:all('SELECT t.*,u.email FROM tenants t JOIN users u ON u.id=t.owner ORDER BY t.created DESC').map(unpack),requests:all('SELECT r.*,t.slug FROM requests r JOIN tenants t ON t.id=r.tenant_id ORDER BY r.created DESC'),audit:all('SELECT * FROM audit ORDER BY created DESC LIMIT 200')});}
 if((m=path.match(/^\/api\/operator\/([a-f0-9]+)$/))&&method==='PATCH'){
 requireOperator(req);const t=getTenantId(m[1]);if(!t)fail('Store not found.',404);if(!['active','trial','suspended','cancelled'].includes(b.status))fail('Invalid rental status.');const trialEnd=b.status==='trial'?Date.now()+integer(b.trialDays||14,90,1)*86400000:t.trial_end;run('UPDATE tenants SET status=?,trial_end=? WHERE id=?',b.status,trialEnd,t.id);audit(t.id,req.user.id,'operator.status.'+b.status);return respond(res,{ok:true});
 }
 if((m=path.match(/^\/api\/operator\/([a-f0-9]+)\/reset$/))&&method==='POST'){
 requireOperator(req);const t=getTenantId(m[1]);if(!t)fail('Store not found.',404);const token=randomBytes(32).toString('hex');run('INSERT INTO resets VALUES(?,?,?)',hash(token),t.owner,Date.now()+3600000);audit(t.id,req.user.id,'operator.password-reset-issued');return respond(res,{token,expiresInMinutes:60});
 }
 if((m=path.match(/^\/api\/images\/([a-f0-9]+)$/))&&method==='GET'){
 const row=one('SELECT * FROM images WHERE id=?',m[1]);const t=row?getTenantId(row.tenant_id):null;if(!row||(!((available(t)&&t.settings.published)||req.user?.id===t.owner)))fail('Image not found.',404);res.writeHead(200,{'Content-Type':row.mime,'Cache-Control':'private, max-age=300'});return res.end(Buffer.from(row.bytes));
 }
 if(path.startsWith('/api/'))fail('Endpoint not found.',404);
 if(method!=='GET'&&method!=='HEAD')fail('Method not allowed.',405);
 const publicDir=resolve(here,'../public');const page=path==='/'||/^\/(demo|admin|login|signup|operator|reset|legal(?:\/[a-z-]+)?|s\/[a-z0-9-]+)\/?$/.test(path)?'/index.html':path;
 const file=resolve(publicDir,'.'+page);if(!file.startsWith(publicDir+'/')||!existsSync(file))fail('Page not found.',404);
 const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.ico':'image/x-icon'};
 res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream','Cache-Control':page==='/index.html'?'no-cache':'public, max-age=3600'});return res.end(method==='HEAD'?'':readFileSync(file));
 }catch(e){if(!res.headersSent){if(!e.status)console.error('Request failed:',e.code||e.name);respond(res,{error:e.status?e.message:'Something went wrong. Please try again.'},e.status||500);}else res.end();}
 });
 function checkProductImages(p,tid){if(p.image.startsWith('/api/images/')&&!one('SELECT id FROM images WHERE id=? AND tenant_id=?',p.image.split('/').pop(),tid))fail('Image does not belong to this store.');}
 server.on('close',()=>{clearInterval(timer);db.close();});return {server,db};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){const {server}=createApp();server.listen(Number(process.env.PORT||3000),'0.0.0.0',()=>console.log('ICSS Plaza listening on port '+(process.env.PORT||3000)));}

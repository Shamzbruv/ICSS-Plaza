import {randomBytes,timingSafeEqual} from 'node:crypto';
import {decrypt,defaults,encrypt,fail,hash,id,passwordHash,product,text} from './model.js';

const stages=['new','contacted','scheduled','completed','closed'];
const topics=['setup','payments','migration','pricing','other'];
const day=86400000;
export const testVendorSlug='plaza-test-workspace';
export function createPlatformOps({db,key,notify,operatorEmail,limit,email,audit,testAccess}) {
 const {one,all,run,tx}=db;
 const protectedData=x=>encrypt(x,key);
 async function ensureTestVendor(actor){
  const existing=await one('SELECT t.id,t.owner,u.email FROM tenants t JOIN users u ON u.id=t.owner WHERE t.slug=?',testVendorSlug);
  if(existing)return existing;
  const uid=id(),tid=id(),now=Date.now(),expiry=now+14*day,testVendorEmail='plaza-test-'+uid+'@example.invalid';
  await run('INSERT INTO users VALUES(?,?,?,?)',uid,testVendorEmail,passwordHash(randomBytes(32).toString('hex')),now);
  await run('INSERT INTO tenants VALUES(?,?,?,?,?,?,?)',tid,testVendorSlug,uid,'trial',expiry,JSON.stringify({...defaults(),name:'Plaza Test Vendor',contactEmail:testVendorEmail}),now);
  for(const p of [
   {name:'Sample canvas tote',sku:'QA-TOTE',price:250000,stock:12,image:'/assets/tote.svg'},
   {name:'Sample stoneware mug',sku:'QA-MUG',price:180000,stock:8,image:'/assets/mug.svg'}
  ])await run('INSERT INTO products VALUES(?,?,?,?)',id(),tid,JSON.stringify(product({...p,description:'Sample product for testing the storefront editor.'})),now);
  await audit(tid,actor,'developer.test-vendor.created');
  return {id:tid,owner:uid,email:testVendorEmail};
 }
 return {
  async vendors(actor){
   if(!await one('SELECT id FROM tenants WHERE slug=?',testVendorSlug))await tx(()=>ensureTestVendor(actor),'signup');
   return (await all('SELECT t.id,t.slug,t.settings,t.status,t.trial_end,u.email FROM tenants t JOIN users u ON u.id=t.owner ORDER BY CASE WHEN t.slug=? THEN 0 ELSE 1 END,t.created DESC',testVendorSlug))
    .map(t=>({...t,settings:{name:JSON.parse(t.settings).name},test:t.slug.startsWith('plaza-test-'),primaryTest:t.slug===testVendorSlug}));
  },
  async renewTestVendorLogin(actor){
   return tx(async()=>{
    const t=await ensureTestVendor(actor);
    const password=randomBytes(21).toString('base64url'),expiresAt=Date.now()+14*day;
    await run('UPDATE users SET password=? WHERE id=?',passwordHash(password),t.owner);
    await run("UPDATE tenants SET status='trial',trial_end=? WHERE id=?",expiresAt,t.id);
    await run('DELETE FROM sessions WHERE user_id=?',t.owner);
    await run('DELETE FROM resets WHERE user_id=?',t.owner);
    await audit(t.id,actor,'developer.test-vendor.login-reset');
    return {email:t.email,password,expiresAt};
   },'signup');
  },
  async consult(req,b) {
   limit(req,'consultation-request',5);
   if(b.website||b.consent!==true)fail('Please confirm the contact and privacy notice.');
   const phone=text(b.phone||'',35);
   if(phone&&!/^[+0-9 ().-]{7,35}$/.test(phone))fail('Enter a valid phone number.');
   if(!topics.includes(b.topic))fail('Choose a consultation topic.');
   const payload={name:text(b.name,100,2),email:email(b.email),business:text(b.business,100,2),phone,topic:b.topic,availability:text(b.availability||'',250),message:text(b.message,2500,10),notes:''};
   const cid=id(),now=Date.now();
   await tx(async()=>{
    await run('INSERT INTO plaza_consultations VALUES(?,?,?,?,?)',cid,protectedData(payload),'new',now,now);
    await notify('consultation_received',cid,payload.email,{reference:cid});
    await notify('consultation_operator',cid,operatorEmail,{reference:cid});
   },'consultations');
   return {reference:cid,status:'new'};
  },
  async consultations() {
   return (await all("SELECT * FROM plaza_consultations ORDER BY CASE WHEN status IN ('completed','closed') THEN 1 ELSE 0 END,created DESC LIMIT 150")).map(({payload,...r})=>({...r,...decrypt(payload,key)}));
  },
  async consultation(cid,b,actor) {
   if(!stages.includes(b.status))fail('Choose a valid status.');
   await tx(async()=>{
    const r=await one('SELECT * FROM plaza_consultations WHERE id=?',cid);
    if(!r)fail('Consultation not found.',404);
    if(b.updated!==r.updated)fail('This request changed. Reload before saving.',409);
    const p=decrypt(r.payload,key);
    p.notes=text(b.notes||'',2500);
    const message=text(b.message||'',1500);
    const now=Math.max(Date.now(),r.updated+1);
    await run('UPDATE plaza_consultations SET status=?,payload=?,updated=? WHERE id=?',b.status,protectedData(p),now,r.id);
    await audit(null,actor,'consultation.'+b.status+'.'+cid);
    if(message)await notify('consultation_update',cid+'/'+now,p.email,{reference:cid,message});
   },'consultations');
  },
  async overview() {
   const [stores,orders,reports,consultations,rentals,revenue]=await Promise.all([
    all("SELECT status,COUNT(*) AS n FROM tenants WHERE slug NOT LIKE 'plaza-test-%' GROUP BY status"),
    all('SELECT state,COUNT(*) AS n FROM orders GROUP BY state'),
    one("SELECT COUNT(*) AS n FROM vendor_reports WHERE status NOT IN ('resolved','closed')"),
    one("SELECT COUNT(*) AS n FROM plaza_consultations WHERE status IN ('new','contacted','scheduled')"),
    one("SELECT COUNT(DISTINCT tenant_id) AS n FROM plaza_rentals WHERE paid_until>? AND status<>'suspended'",Date.now()),
    all("SELECT r.currency,SUM(r.amount) AS n FROM plaza_billing_events e JOIN plaza_rentals r ON r.id=e.rental_id WHERE e.kind='payment' AND e.created>? GROUP BY r.currency",Date.now()-30*day)
   ]);
   return {stores,orders,reports:reports.n,consultations:consultations.n,paidRentals:rentals.n,revenue};
  },
  async claimTest(req,b){
   limit(req,'claim-test-account',10);
   const token=b.invite;
   if(!testAccess||Date.now()>testAccess.expiresAt||typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token)||
      !timingSafeEqual(Buffer.from(hash(token),'hex'),Buffer.from(testAccess.verifier,'hex')))fail('This test invitation is invalid or expired.',404);
   const slug='plaza-test-'+testAccess.verifier.slice(0,12);
   const email=slug+'@example.invalid',uid=id(),tid=id(),now=Date.now(),password=passwordHash(b.password);
   await tx(async()=>{
    if(await one('SELECT id FROM tenants WHERE slug=?',slug))fail('This invitation has already been used. Sign in with the test account you created.',409);
    await run('INSERT INTO users VALUES(?,?,?,?)',uid,email,password,now);
    await run('INSERT INTO tenants VALUES(?,?,?,?,?,?,?)',tid,slug,uid,'trial',now+14*day,JSON.stringify({...defaults(),name:'Plaza QA workspace',contactEmail:email}),now);
    await audit(tid,uid,'developer.test-account.claimed');
   },'signup');
   return {id:uid,email,slug,expiresAt:now+14*day};
  },
  async createTest(actor) {
   const code=randomBytes(5).toString('hex'),uid=id(),tid=id(),password=randomBytes(21).toString('base64url');
   const slug='plaza-test-'+code,login=slug+'@example.invalid',now=Date.now();
   await tx(async()=>{
    await run('INSERT INTO users VALUES(?,?,?,?)',uid,login,passwordHash(password),now);
    await run('INSERT INTO tenants VALUES(?,?,?,?,?,?,?)',tid,slug,uid,'trial',now+14*day,JSON.stringify({...defaults(),name:'Plaza QA workspace',contactEmail:login}),now);
    await audit(tid,actor,'developer.test-account.created');
   },'signup');
   return {email:login,password,slug,expiresAt:now+14*day};
  },
  async purge() {
   await run("DELETE FROM plaza_consultations WHERE status IN ('completed','closed') AND updated<?",Date.now()-365*day);
  }
 };
}

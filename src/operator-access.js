import {decrypt,encrypt,fail,id,passwordHash,passwordMatches,text} from './model.js';
import {createHash,timingSafeEqual} from 'node:crypto';

export const ownerEmail='shamzbiz1@gmail.com';
const supportWindow=30*60*1000;

export const operatorSchema=`
CREATE TABLE IF NOT EXISTS plaza_developers (
 user_id TEXT PRIMARY KEY REFERENCES users(id), enabled INTEGER NOT NULL DEFAULT 1, created BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS plaza_vendor_access (
 id TEXT PRIMARY KEY, operator_id TEXT NOT NULL REFERENCES users(id), tenant_id TEXT NOT NULL REFERENCES tenants(id),
 session_hash TEXT NOT NULL, purpose TEXT NOT NULL, created BIGINT NOT NULL, expires BIGINT NOT NULL, ended BIGINT
);
CREATE INDEX IF NOT EXISTS plaza_vendor_access_actor ON plaza_vendor_access(operator_id,tenant_id,created);
`;

export function operatorAccess({db,key,legacyEmail,audit,provision=null}){
 const {one,run,tx}=db;
 return {
  reserved(email){return email===legacyEmail||email===ownerEmail||email===provision?.email;},
  async isOperator(user){return !!user&&(user.email===legacyEmail&&!!legacyEmail||!!await one('SELECT user_id FROM plaza_developers WHERE user_id=? AND enabled=1',user.id));},
  async provision(input){
   const token=input.invite;
   if(!provision||Date.now()>provision.expiresAt||typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token)||
      !timingSafeEqual(createHash('sha256').update(token).digest(),Buffer.from(provision.verifier,'hex')))fail('Provisioning unavailable.',404);
   const password=passwordHash(input.password);
   return tx(async()=>{
    const existing=await one('SELECT id,password FROM users WHERE email=?',provision.email);
    if(existing&&await one('SELECT user_id FROM plaza_developers WHERE user_id=?',existing.id))fail('Developer account already exists.',409);
    if(existing&&!passwordMatches(input.password,existing.password))fail('This email already has a Plaza account. Verify its existing password before granting developer access.',409);
    const uid=existing?.id||id();
    if(!existing)await run('INSERT INTO users VALUES(?,?,?,?)',uid,provision.email,password,Date.now());
    else{
     await run('DELETE FROM sessions WHERE user_id=?',uid);
     await run('DELETE FROM resets WHERE user_id=?',uid);
    }
    await run('INSERT INTO plaza_developers VALUES(?,?,?)',uid,1,Date.now());
    await audit(null,uid,'developer.account.provisioned');
    return {email:provision.email};
   },'signup');
  },
  async begin(req,t,reason){
   const purpose=text(reason||'',300,10),now=Date.now(),aid=id();
   await tx(async()=>{
    await run('UPDATE plaza_vendor_access SET ended=? WHERE session_hash=? AND tenant_id=? AND ended IS NULL',now,req.sessionHash,t.id);
    await run('INSERT INTO plaza_vendor_access VALUES(?,?,?,?,?,?,?,?)',aid,req.user.id,t.id,req.sessionHash,encrypt(purpose,key),now,now+supportWindow,null);
    await audit(t.id,req.user.id,'vendor-support.opened.'+aid);
   },'tenant:'+t.id);
   return {id:aid,reason:purpose,expires:now+supportWindow};
  },
  async active(req,tenant){
   if(!req.operator||!req.sessionHash)return null;
   const aid=req.headers['x-plaza-support'];
   if(typeof aid!=='string'||!/^[a-f0-9]{24}$/.test(aid))return null;
   const row=await one('SELECT id,purpose,expires FROM plaza_vendor_access WHERE id=? AND operator_id=? AND tenant_id=? AND session_hash=? AND ended IS NULL AND expires>?',aid,req.user.id,tenant,req.sessionHash,Date.now());
   return row?{id:row.id,reason:decrypt(row.purpose,key),expires:row.expires}:null;
  },
  async permitsImage(req,tenant){
   return !!req.operator&&!!req.sessionHash&&!!await one('SELECT id FROM plaza_vendor_access WHERE operator_id=? AND tenant_id=? AND session_hash=? AND ended IS NULL AND expires>?',req.user.id,tenant,req.sessionHash,Date.now());
  },
  async end(req,t){
   await tx(async()=>{
    const row=await this.active(req,t);
    if(row){await run('UPDATE plaza_vendor_access SET ended=? WHERE id=?',Date.now(),row.id);await audit(t,req.user.id,'vendor-support.closed.'+row.id);}
   },'tenant:'+t);
  },
  async auditWithReason(events) {
   return Promise.all(events.map(async event=>{
    const aid=event.action.match(/^vendor-support\.opened\.([a-f0-9]{24})$/)?.[1];
    if(!aid)return event;
    const row=await one('SELECT purpose FROM plaza_vendor_access WHERE id=?',aid);
    return row?{...event,reason:decrypt(row.purpose,key)}:event;
   }));
  }
 };
}

export function permitsSupport(action,method,testWorkspace=false) {
 if(testWorkspace&&(
   method==='PUT'&&/^features\/(discounts|loyalty|quiz|journal|emails|reviews\/[a-f0-9]{24})$/.test(action)||
   method==='GET'&&action==='features/reviews'||
   method==='POST'&&action==='features/email-preview'
 ))return true;
 return method==='GET'&&(!action||action==='support-state')||
   method==='PUT'&&['settings','design'].includes(action)||
   method==='POST'&&['products','images','sample-products'].includes(action)||
   ['PUT','DELETE'].includes(method)&&/^products\/[a-f0-9]+$/.test(action)||
   method==='PATCH'&&/^products\/[a-f0-9]+\/stock$/.test(action)||
   method==='DELETE'&&/^images\/[a-f0-9]+$/.test(action);
}

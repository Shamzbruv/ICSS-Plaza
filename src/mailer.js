import {createHmac,timingSafeEqual} from 'node:crypto';
import {decrypt,encrypt,fail,hash} from './model.js';
import {emailMessage} from './email-design.js';

const API='https://api.resend.com';
const day=86400000;
const address=s=>typeof s==='string'&&s.length<=254&&/^[^\s<>,@]+@[^\s<>,@]+\.[^\s<>,@]+$/.test(s);
const sender=s=>typeof s==='string'&&(address(s)||/^[-\w &.]+ <[^<>]+>$/.test(s)&&address(s.slice(s.indexOf('<')+1,-1)));

export function verifyResend(raw,headers,secret,now=Date.now()) {
 const id=headers['svix-id'], stamp=headers['svix-timestamp'], sig=headers['svix-signature'];
 if(!/^whsec_[A-Za-z0-9+/=_-]{16,}$/.test(secret||'')||typeof id!=='string'||!id||!/^\d{1,12}$/.test(stamp||'')||
    typeof sig!=='string'||Math.abs(now-Number(stamp)*1000)>300000) return false;
 const expected=createHmac('sha256',Buffer.from(secret.slice(6),'base64')).update(id+'.'+stamp+'.').update(raw).digest();
 return sig.split(' ').some(v=>{
  if(!v.startsWith('v1,')) return false;
  const actual=Buffer.from(v.slice(3),'base64');
  return actual.length===expected.length&&timingSafeEqual(actual,expected);
 });
}

export function createMailer({db,key,origin,env=process.env,fetcher=fetch}) {
 const apiKey=String(env.RESEND_API_KEY||'').trim(),from=String(env.RESEND_FROM||'').trim();
 const inboundKey=String(env.RESEND_INBOUND_API_KEY||'').trim();
 const replyTo=String(env.RESEND_REPLY_TO||'').trim();
 const inbox=String(env.RESEND_INBOX_ADDRESS||'').trim().toLowerCase();
 const hookSecret=String(env.RESEND_WEBHOOK_SECRET||'').trim();
 const configured=!!apiKey&&sender(from)&&/^https:\/\//.test(origin||'');
 const inboundConfigured=!!inboundKey&&!!hookSecret&&address(inbox);
 let busy=false;
 const {one,all,run}=db;
 const seal=value=>encrypt(value,key), unseal=value=>decrypt(value,key);
 const auth=key=>({Authorization:'Bearer '+key});
 return {
  configured,inboundConfigured,
  async enqueue(kind,event,to,data={},options={}) {
   if(!configured||!address(to)) return false;
   const id=hash('plaza/'+kind+'/'+event+'/'+to.toLowerCase());
   const now=Date.now();
   const message=emailMessage(kind,data,origin);
   const payload={...message,from,to:[to],...(address(options.replyTo||replyTo)?{reply_to:options.replyTo||replyTo}:{})};
   await run("INSERT INTO email_outbox(id,payload,status,next_attempt,created,expires) VALUES(?,?,'queued',?,?,?) ON CONFLICT(id) DO NOTHING",
    id,seal(payload),now,now,Math.min(options.expires??Infinity,now+20*3600000));
   return true;
  },
  async drain() {
   if(!configured||busy) return;
   busy=true;
   try{
    await run("UPDATE email_outbox SET status='expired',payload='' WHERE status='queued' AND expires<=?",Date.now());
    const rows=await all("SELECT * FROM email_outbox WHERE status='queued' AND next_attempt<=? ORDER BY created,id LIMIT 8",Date.now());
    for(const row of rows){
     if(row.expires<=Date.now()) continue;
     let status=0,providerId;
     try{
      const response=await fetcher(API+'/emails',{method:'POST',headers:{...auth(apiKey),'Content-Type':'application/json','Idempotency-Key':'icss-plaza/'+row.id},body:JSON.stringify(unseal(row.payload)),signal:AbortSignal.timeout(8000)});
      status=response.status;
      if(response.ok) providerId=(await response.json()).id;
     }catch{}
     if(providerId){
      await run("UPDATE email_outbox SET status='sent',payload='',provider_id=?,attempts=attempts+1 WHERE id=?",providerId,row.id);
      continue;
     }
     const permanent=status>=400&&status<500&&![408,409,429].includes(status);
     const delay=Math.min(60000*2**row.attempts,3600000);
     const failed=permanent||row.attempts>=7||Date.now()+delay>=row.expires;
     await run("UPDATE email_outbox SET attempts=attempts+1,next_attempt=?,status=?,last_error=?,payload=CASE WHEN ?=1 THEN '' ELSE payload END WHERE id=?",
      Date.now()+delay,failed?'failed':'queued',status?'http_'+status:'transport',Number(failed),row.id);
    }
   }finally{busy=false;}
  },
  async purge() {
   const cutoff=Date.now()-30*day;
   await run("DELETE FROM email_outbox WHERE created<?",cutoff);
   await run("DELETE FROM email_inbound WHERE created<?",cutoff);
  },
  async receive(raw,headers,event) {
   if(!inboundConfigured) fail('Inbound email is not configured.',503);
   if(!verifyResend(raw,headers,hookSecret)) fail('Invalid webhook signature.',401);
   if(event.type!=='email.received') return;
   const id=event.data?.email_id;
   if(typeof id!=='string'||!/^[a-f0-9-]{36}$/i.test(id)) fail('Invalid email identifier.');
   if(await one('SELECT id FROM email_inbound WHERE id=?',id)) return;
   if(!Array.isArray(event.data.to)||!event.data.to.some(to=>String(to).trim().toLowerCase()===inbox)) return;
   const response=await fetcher(API+'/emails/receiving/'+id,{headers:auth(inboundKey),signal:AbortSignal.timeout(8000)});
   if(!response.ok) fail('Email retrieval is temporarily unavailable.',503);
   const message=await response.json();
   const clip=(value,max)=>String(value||'').slice(0,max);
   const payload=seal({from:clip(message.from||event.data.from,300),subject:clip(message.subject||event.data.subject,300),
    text:clip(message.text,12000),attachments:Array.isArray(message.attachments)?message.attachments.length:0});
   await run('INSERT INTO email_inbound VALUES(?,?,?) ON CONFLICT(id) DO NOTHING',id,payload,Date.now());
  },
  async replyToInbound(messageId,message,event) {
   if(!configured) fail('Outgoing email is not configured.',503);
   const row=await one('SELECT payload FROM email_inbound WHERE id=?',messageId);
   if(!row)fail('Support email not found.',404);
   const previous=unseal(row.payload);
   const to=(previous.from.match(/<([^<>]+)>\s*$/)?.[1]||previous.from).trim();
   if(!address(to)||to.toLowerCase()===inbox)fail('No reply address is available for this message.');
   return this.enqueue('support_reply',messageId+'/'+event,to,{message,reference:messageId.slice(0,8)});
  },
  async inbox() {
   const rows=await all('SELECT * FROM email_inbound ORDER BY created DESC LIMIT 50');
   return rows.map(row=>({id:row.id,created:row.created,...unseal(row.payload)}));
  },
  async stats() {
   const rows=await all('SELECT status,COUNT(*) AS n FROM email_outbox GROUP BY status');
   return {configured,inboundConfigured,counts:Object.fromEntries(rows.map(r=>[r.status,r.n]))};
  }
 };
}

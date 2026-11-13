import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../src/server.js';
import {createMailer,verifyResend} from '../src/mailer.js';
import {openSqlite,openPostgres,createPostgresPool} from '../src/database.js';
import {authTemplates} from '../src/email-design.js';

const key='ab'.repeat(32), origin='https://plaza.example.com';
const env={RESEND_API_KEY:'sending-test',RESEND_FROM:'ICSS Plaza <plaza@example.com>',RESEND_REPLY_TO:'support@example.com',RESEND_INBOX_ADDRESS:'support@example.com',RESEND_INBOUND_API_KEY:'receiving-test',RESEND_WEBHOOK_SECRET:'whsec_'+Buffer.from('fixture-webhook-signature-secret').toString('base64')};
const ok=data=>new Response(JSON.stringify(data),{status:200});

test('Branded welcome is queued with signup and sent only once through Resend',async t=>{
 const dir=mkdtempSync(join(tmpdir(),'plaza-welcome-'));
 const requests=[];
 const fetcher=async(url,opts)=>{requests.push({url,opts});return ok({id:'sent-welcome'});};
 const {server,database}=await createApp({dataDir:dir,baseURL:origin,encryptionKey:key,mailEnv:env,mailFetcher:fetcher});
 t.after(async()=>{await new Promise(resolve=>server.close(resolve));rmSync(dir,{recursive:true,force:true});});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const result=await fetch('http://127.0.0.1:'+server.address().port+'/api/signup',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({email:'vendor@example.com',password:'test-password-only',name:'<Fake Store>',slug:'mail-shop',acceptTerms:true})});
 assert.equal(result.status,201,await result.text());
 const raw=(await database.all('SELECT payload FROM email_outbox'))[0];
 assert.ok(raw?.payload);
 assert.doesNotMatch(raw.payload,/vendor@example.com/);
 const mail=createMailer({db:database,key,origin,env,fetcher});
 await mail.drain();await mail.drain();
 assert.equal(requests.length,1);
 const {url,opts}=requests[0],data=JSON.parse(opts.body);
 assert.equal(url,'https://api.resend.com/emails');
 assert.match(opts.headers['Idempotency-Key'],/^icss-plaza\/[a-f0-9]{64}$/);
 assert.deepEqual(data.to,['vendor@example.com']);
 assert.match(data.html,/logo-horizontal\.png/);
 assert.match(data.html,/iCreate Solutions &amp; Services/);
 assert.match(data.html,/&lt;Fake Store&gt;/);
 assert.match(data.text,/Open your dashboard/);
 assert.equal((await mail.stats()).counts.sent,1);
 assert.equal((await database.one('SELECT payload FROM email_outbox')).payload,'');
});

test('Resend queue retries safely; only verified inbound mail for Plaza is stored',async t=>{
 const url=process.env.PLAZA_TEST_DATABASE_URL;
 const dir=mkdtempSync(join(tmpdir(),'plaza-mail-'));
 const db=url?openPostgres(createPostgresPool(url,false)):openSqlite(dir);
 t.after(async()=>{await db.close();rmSync(dir,{recursive:true,force:true});});
 const requests=[];
 let first=true;
 const fetcher=async(url,opts)=>{
  requests.push({url,opts});
  if(url.endsWith('/emails')&&first){first=false;return new Response('{}',{status:429});}
  if(url.includes('/receiving/'))return ok({from:'Customer <customer@example.com>',subject:'Private request',text:'Private support body',attachments:[{}]});
  return ok({id:'sent'});
 };
 const mail=createMailer({db,key,origin,env,fetcher});
 assert.equal(await mail.enqueue('case_customer','case-event','buyer@example.com',{reference:'test-case',status:'received',token:'never-included'}),true);
 await mail.enqueue('case_customer','case-event','buyer@example.com',{reference:'test-case',status:'received'});
 await mail.drain();
 assert.equal((await mail.stats()).counts.queued,1);
 await db.run('UPDATE email_outbox SET next_attempt=?',0);
 await mail.drain();assert.equal(requests.length,2);
 assert.equal(requests[0].opts.headers['Idempotency-Key'],requests[1].opts.headers['Idempotency-Key']);
 assert.doesNotMatch(requests[0].opts.body,/never-included/);
 const event={type:'email.received',data:{email_id:'43222222-1111-4444-8888-098765432123',to:['support@example.com']}};
 const sign=e=>{
  const raw=Buffer.from(JSON.stringify(e)), stamp=String(Math.floor(Date.now()/1000)), id='msg_test';
  const sig=createHmac('sha256',Buffer.from(env.RESEND_WEBHOOK_SECRET.slice(6),'base64')).update(id+'.'+stamp+'.').update(raw).digest('base64');
  return {raw,headers:{'svix-id':id,'svix-timestamp':stamp,'svix-signature':'v1,'+sig}};
 };
 const {raw,headers}=sign(event);
 assert.equal(verifyResend(raw,headers,env.RESEND_WEBHOOK_SECRET,Date.now()+600000),false);
 await assert.rejects(mail.receive(raw,{...headers,'svix-signature':'v1,invalid'},event),/Invalid webhook/);
 const elsewhere={...event,data:{...event.data,to:['wrong@example.com']}};
 const other=sign(elsewhere);await mail.receive(other.raw,other.headers,elsewhere);assert.equal(requests.length,2);
 await mail.receive(raw,headers,event);await mail.receive(raw,headers,event);
 assert.equal(requests.length,3);assert.equal((await mail.inbox())[0].text,'Private support body');
 assert.doesNotMatch((await db.one('SELECT payload FROM email_inbound')).payload,/Private support body/);
 await mail.replyToInbound(event.data.email_id,'We are reviewing your request.', 'test-reply');await mail.drain();
 const reply=JSON.parse(requests.at(-1).opts.body);
 assert.deepEqual(reply.to,['customer@example.com']);
 assert.match(reply.html,/logo-horizontal\.png/);
 assert.match(reply.text,/We are reviewing your request/);
});

test('Supabase Auth templates preserve native action placeholders',()=>{
 const templates=authTemplates();
 assert.equal(Object.keys(templates).length,13);
 for(const t of Object.values(templates))assert.match(t.html,/logo-horizontal\.png/);
 assert.match(templates.recovery.html,/href="\{\{ \.ConfirmationURL \}\}"/);
 assert.match(templates.reauthentication.html,/\{\{ \.Token \}\}/);
});

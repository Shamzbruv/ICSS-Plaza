import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, statSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { spawn } from 'node:child_process';
import { resolveBaseURL, resolveRequestOrigin, resolveEncryptionKey } from '../src/runtime-config.js';
import { encrypt } from '../src/model.js';

function fixture(t) {
  const dataDir = mkdtempSync(join(tmpdir(), 'plaza-config-'));
  const db = new DatabaseSync(join(dataDir, 'test.sqlite'));
  db.exec('CREATE TABLE gateways(config TEXT); CREATE TABLE orders(data TEXT);');
  t.after(() => { db.close(); rmSync(dataDir, {recursive:true, force:true}); });
  return {dataDir, db, env:{}};
}

test('production derives an HTTPS origin from the provided public domain', () => {
  assert.equal(resolveBaseURL({production:true, env:{RAILWAY_PUBLIC_DOMAIN:'icss-plaza.up.railway.app'}}), 'https://icss-plaza.up.railway.app');
  assert.equal(resolveBaseURL({production:true, env:{BASE_URL:'https://shop.example/', RAILWAY_PUBLIC_DOMAIN:'fallback.up.railway.app'}}), 'https://shop.example');
  assert.equal(resolveBaseURL({production:false, env:{}}), 'http://localhost:3000');
});

test('production rejects insecure or malformed configured origins and permits an unconfigured origin', () => {
  for (const baseURL of ['http://shop.example','https://','https://user:pass@shop.example','https://shop.example/path','https://shop.example/?x=1','https://shop.example/#x']) {
    assert.throws(() => resolveBaseURL({baseURL, production:true, env:{}}));
  }
  assert.equal(resolveBaseURL({production:true, env:{}}), null);
});

test('first startup generates a private key once and restart reuses it to decrypt credentials', t => {
  const f = fixture(t);
  const key = resolveEncryptionKey(f);
  assert.match(key, /^[a-f0-9]{64}$/);
  const file = join(f.dataDir, '.encryption-key');
  assert.equal(statSync(file).mode & 0o777, 0o600);
  assert.equal(readFileSync(file,'utf8').trim(), key);
  f.db.prepare('INSERT INTO gateways VALUES(?)').run(encrypt({secret:'test-merchant-secret'},key));
  assert.equal(resolveEncryptionKey(f), key);
  assert.equal(readdirSync(f.dataDir).some(x=>x.endsWith('.tmp')), false);
});

test('explicit valid keys are retained; invalid keys never trigger silent replacement', t => {
  const f=fixture(t), key='ab'.repeat(32);
  assert.equal(resolveEncryptionKey({...f,encryptionKey:key}),key);
  assert.throws(()=>resolveEncryptionKey({...f,encryptionKey:'short'}), /64 hexadecimal/);
  writeFileSync(join(f.dataDir,'.encryption-key'),'corrupt-key');
  assert.throws(()=>resolveEncryptionKey(f), /saved encryption key is invalid/);
  assert.equal(readFileSync(join(f.dataDir,'.encryption-key'),'utf8'),'corrupt-key');
});

test('existing encrypted records require the original key, including historical order snapshots', t => {
  const f=fixture(t), key='cd'.repeat(32), encrypted=encrypt({secret:'order-credential'},key);
  f.db.prepare('INSERT INTO orders VALUES(?)').run(JSON.stringify({paymentConfig:encrypted}));
  assert.throws(()=>resolveEncryptionKey(f), /key is missing/);
  assert.throws(()=>resolveEncryptionKey({...f,encryptionKey:'ef'.repeat(32)}), /does not match/);
  assert.equal(resolveEncryptionKey({...f,encryptionKey:key}),key);
  assert.equal(f.db.prepare('SELECT data FROM orders').get().data,JSON.stringify({paymentConfig:encrypted}));
});

for (const hasDomain of [true, false]) test(`production boots with no BASE_URL/key and ${hasDomain ? 'a provided domain' : 'no public domain at all'}`, async t => {
  const dataDir=mkdtempSync(join(tmpdir(),'plaza-production-'));
  const env={...process.env,NODE_ENV:'production',RAILWAY_PUBLIC_DOMAIN:'plaza-test.up.railway.app',DATA_DIR:dataDir,PORT:'0'};
  if (!hasDomain) delete env.RAILWAY_PUBLIC_DOMAIN;
  delete env.BASE_URL; delete env.ENCRYPTION_KEY; delete env.OPERATOR_EMAIL; delete env.OPERATOR_PASSWORD;
  // Port zero is passed to createApp's real HTTP server so tests do not reserve a fixed port.
  const script="import {createApp} from './src/server.js'; const {server}=createApp(); server.listen(0,'127.0.0.1',()=>console.log('READY '+server.address().port));";
  const child=spawn(process.execPath,['--input-type=module','-e',script],{cwd:new URL('..',import.meta.url),env,stdio:['ignore','pipe','pipe']});
  t.after(async()=>{child.kill();await new Promise(r=>child.exitCode!==null||child.signalCode!==null?r():child.once('exit',r));rmSync(dataDir,{recursive:true,force:true});});
  const port=await new Promise((resolve,reject)=>{
    let output='',errors='';const timer=setTimeout(()=>reject(Error('Production startup timed out')),10000);
    child.stderr.on('data',b=>errors+=b.toString());
    child.stdout.on('data',b=>{output+=b.toString();const m=output.match(/READY (\d+)/);if(m){clearTimeout(timer);resolve(Number(m[1]));}});
    child.once('exit',()=>{clearTimeout(timer);reject(Error('Production exited: '+errors));});
  });
  const health=await fetch(`http://127.0.0.1:${port}/api/health`);
  assert.equal(health.status,200); assert.deepEqual(await health.json(),{ok:true});
  const browserOrigin=hasDomain?'https://plaza-test.up.railway.app':`https://127.0.0.1:${port}`;
  const landing=await fetch(`http://127.0.0.1:${port}/`);assert.equal(landing.status,200);
  const signup=await fetch(`http://127.0.0.1:${port}/api/signup`,{method:'POST',headers:{Origin:browserOrigin,'Content-Type':'application/json'},body:JSON.stringify({email:'smoke@example.com',password:'secure-smoke-password',name:'Smoke store',slug:'smoke-store',acceptTerms:true})});
  assert.equal(signup.status,201);assert.match(signup.headers.get('set-cookie'),/; Secure/);
  const hostile=await fetch(`http://127.0.0.1:${port}/api/login`,{method:'POST',headers:{Origin:'https://attacker.example','X-Forwarded-Host':'attacker.example','Content-Type':'application/json'},body:'{}'});assert.equal(hostile.status,403);
  assert.match(readFileSync(join(dataDir,'.encryption-key'),'utf8').trim(),/^[a-f0-9]{64}$/);
});


test('unconfigured browser origin is tied to Host and does not become a global origin', () => {
  assert.equal(resolveRequestOrigin({baseURL:null,host:'plaza.example',production:true}),'https://plaza.example');
  assert.equal(resolveRequestOrigin({baseURL:null,host:'second.example',production:true}),'https://second.example');
  assert.equal(resolveRequestOrigin({baseURL:'https://configured.example',host:'attacker.example',production:true}),'https://configured.example');
  for(const host of ['',null,'a.example,b.example','user@a.example','a.example/path','a.example?x=1','a.example#x','a.example\\x','a.example b']) assert.equal(resolveRequestOrigin({baseURL:null,host,production:true}),null);
});

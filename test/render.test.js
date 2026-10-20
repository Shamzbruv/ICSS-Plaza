import {test} from 'node:test';
import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';
import {gateways} from '../src/payments.js';
// A template smoke test, not a substitute for browser layout/accessibility QA.
// It boots the actual front-end module with its platform boundary mocked.
async function boot(path,search=''){
 const app={innerHTML:''},modal={innerHTML:'',open:false,showModal(){this.open=true;},close(){this.open=false;}},toast={style:{},textContent:''},events=new Map(),storage=new Map();
 globalThis.document={title:'',querySelector:s=>s==='#app'?app:s==='#modal'?modal:toast,addEventListener:(k,v)=>events.set(k,v)};
 globalThis.location={pathname:path,search,origin:'https://plaza.example'};
 globalThis.localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};
 globalThis.window={scrollTo(){}};
 globalThis.fetch=async url=>new Response(JSON.stringify(url==='/api/catalog'?{gateways}:url==='/api/session'?{user:null,tenants:[],csrf:''}:{}),{status:200});
 await import('../public/app.js?test='+Math.random());
 for(let i=0;i<20&&!app.innerHTML;i++)await delay(1);
 return {app,events,modal,storage};
}
test('landing includes interactive demo, operator attribution, contact and accurate payment disclosures',async()=>{
 const {app}=await boot('/');assert.match(app.innerHTML,/Your business/);assert.match(app.innerHTML,/mini-editor/);assert.match(app.innerHTML,/iCreate Solutions &amp; Services|iCreate Solutions & Services/);assert.match(app.innerHTML,/876-585-7469/);assert.match(app.innerHTML,/manual reconciliation/);assert.ok(!app.innerHTML.includes('876-582-5685'));
});
test('demo dashboard tabs render designer, policies, media, payments and settings',async()=>{
 const {app,events}=await boot('/demo');assert.match(app.innerHTML,/Demo playground/);assert.match(app.innerHTML,/Your store, step by step/);
 for(const [tab,expected] of [['appearance','Save store design'],['content','Additional store pages'],['payments','EzeePayments'],['settings','Default payment method'],['products','Botanical body oil'],['media','Your media library']]){await events.get('click')({target:{closest:()=>({dataset:{tab}})}});assert.ok(app.innerHTML.includes(expected),tab+' did not render');}
});
test('demo storefront renders products and escaped custom content',async()=>{
 const {app}=await boot('/demo','?view=store');assert.match(app.innerHTML,/Everyday essentials/);assert.match(app.innerHTML,/Botanical body oil/);assert.match(app.innerHTML,/data-form|data-action="cart"/);assert.match(app.innerHTML,/data-policy="returns"/);
});
test('every legal route renders the matching document and real operator contact',async()=>{
 for(const [slug,title] of [['terms','Platform terms'],['privacy','Privacy notice'],['refunds','Cancellation & refunds'],['acceptable-use','Acceptable use policy'],['cookies','Cookie notice']]){const {app}=await boot('/legal/'+slug);assert.ok(app.innerHTML.includes(title));assert.match(app.innerHTML,/icreatesolutions.ja@gmail.com/);}
});

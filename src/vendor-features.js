import {fail,integer,text} from './model.js';

export const emailKinds=['order_buyer','payment','order_status'];
const keys=['discounts','loyalty','quiz','journal','emails'];
const token=(x,max=40)=>{x=text(x,max,1);if(!/^[a-z0-9-]+$/i.test(x))fail('Use only letters, numbers and hyphens.');return x;};
const rows=(list,limit,map,key='id')=>{
 if(!Array.isArray(list)||list.length>limit)fail('Too many entries.');
 const cleaned=list.map(x=>{if(!x||typeof x!=='object'||Array.isArray(x))fail('Invalid entry.');return map(x);});
 if(new Set(cleaned.map(x=>x[key])).size!==cleaned.length)fail('Entries must have unique names or codes.');
 return cleaned;
};
export function featureValue(key,b){
 if(!keys.includes(key))fail('Unknown store tool.',404);
 if(key==='discounts')return rows(b,25,x=>{
  if(!['percent','fixed'].includes(x.kind))fail('Choose a discount type.');
  const code=token(x.code,30).toUpperCase(),min=integer(x.min||0),amount=integer(x.amount,x.kind==='percent'?90:10000000,1);
  const expires=x.expires?text(x.expires,10,10):'';
  if(expires&&(!/^\d{4}-\d{2}-\d{2}$/.test(expires)||!Number.isFinite(Date.parse(expires))||new Date(expires).toISOString().slice(0,10)!==expires))fail('Use a valid expiry date.');
  return {code,kind:x.kind,min,amount,active:x.active===true,expires,currency:x.kind==='fixed'?text(x.currency,3,3):''};
 },'code');
 if(key==='journal')return rows(b,20,x=>({id:token(x.id),title:text(x.title,120,1),intro:text(x.intro||'',240),body:text(x.body,6000,1),published:x.published===true}));
 if(!b||typeof b!=='object'||Array.isArray(b))fail('Invalid feature settings.');
 if(key==='loyalty')return {enabled:b.enabled===true,orders:integer(b.orders,30,2),percent:integer(b.percent,40,1)};
 if(key==='quiz')return {enabled:b.enabled===true,question:text(b.question||'',160,b.enabled?1:0),rules:rows(b.rules||[],12,x=>({label:text(x.label,80,1),category:text(x.category,60,1)}),'label')};
 return Object.fromEntries(emailKinds.map(k=>{
  const subject=text(b[k]?.subject||'',100);
  if(/[\u0000-\u001f\u007f]/.test(subject))fail('Enter a single line for the email subject.');
  return [k,{subject,message:text(b[k]?.message||'',1000)}];
 }));
}
export function liveFeatures(settings){
 const f=settings.features||{};
 return {discounts:(f.discounts||[]).some(x=>x.active),loyalty:f.loyalty?.enabled?f.loyalty:null,quiz:f.quiz?.enabled?{...f.quiz,rules:f.quiz.rules.filter(r=>settings.categories.includes(r.category))}:null,journal:(f.journal||[]).filter(a=>a.published)};
}
export function discountFor(store,raw,subtotal,now=Date.now()){
 const code=typeof raw==='string'?raw.trim().toUpperCase():'';
 const d=store.features?.discounts?.find(x=>x.code===code&&x.active);
 if(!d||d.expires&&Date.parse(d.expires+'T23:59:59-05:00')<now||d.kind==='fixed'&&d.currency!==store.currency)fail('This discount code is not available.');
 if(subtotal<d.min)fail('Your order does not meet the minimum for this discount.');
 return d.kind==='percent'?Math.floor(subtotal*d.amount/100):d.amount;
}
export function reviewValue(input){return {rating:integer(input.rating,5,1),comment:text(input.comment,1400,5),name:text(input.name||'Verified customer',60,2),status:'pending',submitted:Date.now()};}
export const featureMail=(t,kind)=>t.settings.features?.emails?.[kind];

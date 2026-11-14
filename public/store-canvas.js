import {renderStorefront,productShowcase,formatMoney,esc} from './storefront.js?v=studio-1';

const root=document.querySelector('#canvas-root'),dialog=document.querySelector('#canvas-dialog');
const parentWindow=window.parent,origin=location.origin;
let state=null,category='All',search='',sort='featured',policy='',customPage=null;
const send=(type,target)=>parentWindow.postMessage({plazaCanvas:true,type,target},origin);
function paint(){
 if(!state)return;
 root.innerHTML=renderStorefront(state.store,{editor:state.edit,trust:state.trust,policy,customPage,search,category,sort,basePath:'#hero'});
 if(state.edit){
  root.querySelectorAll('[data-edit]').forEach(x=>x.classList.toggle('canvas-selected',x.dataset.edit===state.selected));
 }
}
window.addEventListener('message',e=>{
 if(e.origin!==origin||e.source!==parentWindow||!e.data?.plazaStudio)return;
 const {type}=e.data;
 if(type==='render'){
  if(state?.edit!==e.data.edit){policy='';customPage=null;category='All';search='';sort='featured';if(dialog.open)dialog.close();}
  if(!dialog.open||e.data.edit) {state=e.data;paint();} else state=e.data;
 }
 if(type==='jump'){
  const node=[...root.querySelectorAll('[data-edit]')].find(x=>x.dataset.edit===e.data.target);
  node?.scrollIntoView({block:'center',behavior:'instant'});
 }
});
function showDialog(title,body){
 dialog.innerHTML=`<div class="dialog-head"><h2>${esc(title)}</h2><button class="close" type="button" data-canvas-close aria-label="Close">×</button></div>${body}`;
 if(!dialog.open)dialog.showModal();
}
document.addEventListener('click',e=>{
 if(!state||!(e.target instanceof Element))return;
 if(e.target.closest('[data-canvas-close]')){dialog.close();return;}
 if(state.edit){
  const target=e.target.closest('[data-edit]');
  if(target&&!e.target.closest('video')){e.preventDefault();send('select',target.dataset.edit);}
  return;
 }
 const control=e.target.closest('a,[data-category],[data-action],[data-policy]');
 if(!control)return;
 if(control.matches('a')){
  const href=control.getAttribute('href');
  if(!href?.startsWith('#'))e.preventDefault();
  return;
 }
 const {category:next,policy:nextPolicy,action,id,index}=control.dataset;
 if(next){category=next;paint();if(control.dataset.jump)document.getElementById(control.dataset.jump)?.scrollIntoView();return;}
 if(nextPolicy){policy=nextPolicy;customPage=null;paint();window.scrollTo(0,0);return;}
 if(action==='store-home'||action==='custom-page'){
  policy='';customPage=action==='custom-page'?state.store.settings.customPages?.[Number(index)]:null;paint();window.scrollTo(0,0);return;
 }
 if(action==='product-detail'){
  const p=state.store.products.find(x=>x.id===id);
  if(p)showDialog(p.name,`<div class="split">${productShowcase(p)}<div><p class="preline">${esc(p.description)}</p><p>${formatMoney(p.variants?.length?Math.min(...p.variants.map(v=>v.price)):p.price,state.store.settings.currency)}</p>${p.variants?.length?`<p>Options: ${p.variants.map(v=>esc(v.name)).join(' · ')}</p>`:''}<p class="small">Preview only. No checkout is available here.</p></div></div>`);
 }
 if(action==='product-photo'){const current=dialog.querySelector('.product-showcase > img');if(current)current.src=control.dataset.image;}
 if(action==='cart')showDialog('Shopping bag','<p>This is a storefront preview. Checkout is turned off here.</p>');
});
document.addEventListener('keydown',e=>{
 if(e.key==='Escape'&&dialog.open){dialog.close();return;}
 if(state?.edit&&['Enter',' '].includes(e.key)&&e.target.matches('[data-edit]')){e.preventDefault();send('select',e.target.dataset.edit);}
});
root.addEventListener('input',e=>{
 if(state?.edit||!e.target.matches('[data-search]'))return;
 const pos=e.target.selectionStart;search=e.target.value;paint();const field=root.querySelector('[data-search]');field?.focus();field?.setSelectionRange(pos,pos);
});
root.addEventListener('change',e=>{if(!state?.edit&&e.target.matches('[data-sort]')){sort=e.target.value;paint();}});
send('ready');

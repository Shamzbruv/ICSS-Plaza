import {renderStorefront,sectionPage} from './storefront.js?v=plaza-careers-1';
import {readRetailRoute} from './retail-route.js?v=retail-1';

const root=document.querySelector('#canvas-root');
const parentWindow=window.parent,origin=location.origin,base='/demo?view=store';
let state=null,route={page:'home'};
const send=(type,target)=>parentWindow.postMessage({plazaCanvas:true,type,target},origin);
function paint(){
 if(!state)return;
 root.innerHTML=renderStorefront(state.store,{editor:state.edit,trust:state.trust,route,basePath:base,preview:true});
 if(state.edit)root.querySelectorAll('[data-edit]').forEach(x=>x.classList.toggle('canvas-selected',x.dataset.edit===state.selected));
}
const jump=target=>[...root.querySelectorAll('[data-edit]')].find(x=>x.dataset.edit===target)?.scrollIntoView({block:'center',behavior:'instant'});
function navigate(next,notify=true){route=next;paint();window.scrollTo(0,0);if(notify)send('page',next);}
window.addEventListener('message',e=>{
 if(e.origin!==origin||e.source!==parentWindow||!e.data?.plazaStudio)return;
 const {type,target}=e.data;
 if(type==='render'){
  if(!state||state.edit!==e.data.edit){route=e.data.route||{page:'home'};}
  state=e.data;paint();
 }
 if(type==='page')navigate(target,false);
 if(type==='jump'&&state){
  const section=state.store.settings.sections?.find(x=>x.id===target);
  if(section&&sectionPage(section)!==route.page)navigate({page:sectionPage(section)});
  jump(target);
 }
});
document.addEventListener('click',e=>{
 if(!state||!(e.target instanceof Element))return;
 const control=e.target.closest('a,[data-action]');
 if(control?.matches('a')){
  const url=new URL(control.href,location.href);
  if(url.pathname==='/demo'&&url.searchParams.get('view')==='store'&&url.origin===origin){
   e.preventDefault();const next=readRetailRoute(url.searchParams.get('page')||'',url.search);
   if(!state.edit||control.closest('.retail-nav,.retail-crumb')||control.classList.contains('retail-department')){navigate(next);return;}
  }else if(!control.getAttribute('href')?.startsWith('#'))e.preventDefault();
 }
 if(control?.dataset.action==='product-photo'){
  const img=control.closest('.product-showcase')?.querySelector(':scope > img');if(img)img.src=control.dataset.image;return;
 }
 if(state.edit){
  const target=e.target.closest('[data-edit]');
  if(target&&!e.target.closest('video')){e.preventDefault();send('select',target.dataset.edit);}
  return;
 }

});
document.addEventListener('keydown',e=>{
 if(state?.edit&&['Enter',' '].includes(e.key)&&e.target.matches('[data-edit]')){e.preventDefault();send('select',e.target.dataset.edit);}
});
root.addEventListener('submit',e=>{
 e.preventDefault();
 if(e.target.matches('[data-form=retail-search]'))navigate({page:'shop',search:e.target.elements.q.value.trim()});
});
root.addEventListener('change',e=>{if(e.target.matches('[data-sort]'))navigate({...route,sort:e.target.value,offset:0});});
send('ready');

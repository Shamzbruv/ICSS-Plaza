import {templates,getTemplate,sectionTypes,exampleStore} from './store-templates.js?v=studio-1';
import {designGroups,designKeys} from './store-design-fields.js?v=studio-1';
import {esc,getSections} from './storefront.js?v=growth-1';

const coreTypes=['hero','catalog','about'];
const canvasURL='/store-canvas.html?v=growth-1';
const assetNames=['collection','serum','tote','mug','candle',...templates.map(t=>'template-'+t.id)];
const attr=x=>esc(x);
const own=Object.hasOwn;
const copy=x=>structuredClone(x);
const newID=()=>crypto.randomUUID().replaceAll('-','').slice(0,18);
const btn=(label,cmd,value='',css='outline sm')=>`<button type="button" class="btn ${css}" data-studio="${cmd}" data-value="${attr(value)}">${esc(label)}</button>`;

export function templateChooser(){
 return `<section class="signup-templates"><div class="eyebrow">01 · Choose your starting point</div><h2>Find the right look for your shop.</h2><p>Choose a starter template when you sign up. Your template choice is permanent; you can still change the layout, colours, sections, content and products afterwards.</p><fieldset><legend class="studio-sr">Choose a storefront template</legend><div class="template-grid">${templates.map(t=>`<article class="template-card"><label><input type="radio" name="template" value="${t.id}" required><img src="${t.art}" width="960" height="600" alt=""><span><strong>${esc(t.label)}</strong><small>${esc(t.description)}</small></span></label><a href="/templates/${t.id}" target="_blank" rel="noopener">Preview full storefront ↗</a></article>`).join('')}</div></fieldset></section>`;
}
export function templatePage(id){
 const t=getTemplate(id);
 if(!t)return null;
 return {store:exampleStore(t),toolbar:`<div class="example-toolbar"><a href="/signup">← All templates</a><strong>${esc(t.label)} · Template preview</strong><a class="btn sm" href="/signup?template=${t.id}">Start with this template →</a></div>`};
}
export function studioMediaOptions(images,kind,selected,label,name){
 const options=kind==='video'?[]:assetNames.map(k=>['/assets/'+k+'.svg',k.startsWith('template-')?'Artwork · '+getTemplate(k.slice(9))?.label:'Sample '+k]);
 for(const m of images){
  if((m.mime?.startsWith('video/')||false)===(kind==='video'))options.push([m.url||'/api/images/'+m.id,m.name]);
 }
 return `<select name="${attr(name)}" aria-label="${attr(label)}"><option value="">None</option>${options.map(([url,text])=>`<option value="${attr(url)}" ${url===selected?'selected':''}>${esc(text)}</option>`).join('')}</select>`;
}
function field([key,label,type,options],value,images){
 let input;
 if(['text','categories'].includes(type))input=`<textarea name="${key}" rows="${type==='text'?4:3}" maxlength="6000">${esc(type==='categories'?(value||[]).join('\n'):value)}</textarea>`;
 else if(type==='options')input=`<select name="${key}">${options.map(([v,n])=>`<option value="${v}" ${v===value?'selected':''}>${esc(n)}</option>`).join('')}</select>`;
 else if(type==='image'||type==='video')return `<div class="studio-media-field"><label class="field">${esc(label)}${studioMediaOptions(images,type,value,label,key)}</label><label class="studio-upload">Upload ${type}<input type="file" data-studio-upload="${key}" accept="${type==='video'?'video/mp4,video/webm':'image/png,image/jpeg,image/webp'}"></label></div>`;
 else input=`<input name="${key}" ${type==='color'?'type="color"':'maxlength="500"'} value="${attr(value)}">`;
 return `<label class="field">${esc(label)}${input}</label>`;
}
const extraFields=(section,images)=>{
 const fields=[['title','Heading'],['text','Text','text']];
 if(['image','video'].includes(section.type))fields.push(['image',section.type==='video'?'Video cover':'Photo','image'],['alt','Photo description for screen readers']);
 if(section.type==='video')fields.push(['video','Video','video']);
 if(section.type==='gallery')fields.push(['alt','Photo descriptions']);
 fields.push(['button','Button label'],['link','Button link (HTTPS or #collection)'],['align','Text alignment','options',[['left','Left'],['center','Centre'],['right','Right']]],['tone','Background','options',[['plain','Page'],['soft','Soft'],['accent','Accent']]]);
 let content=fields.map(f=>field(f,section[f[0]]??(f[0]==='align'?'left':f[0]==='tone'?'plain':''),images)).join('');
 if(section.type==='gallery')content+=`<details open><summary>Gallery photos</summary>${Array.from({length:8},(_,i)=>field(['photo-'+i,'Photo '+(i+1),'image'],section.images?.[i]||'',images)).join('')}</details>`;
 if(['benefits','faq'].includes(section.type))content+=pairs(section.items||[],'entries',section.type==='faq'?'Question':'Benefit',section.type==='faq'?'Answer':'Description',8);
 return content;
};
function pairs(list,name,title,text,limit){
 return `<div class="studio-pairs">${list.map((v,i)=>`<fieldset><legend>${esc(title)} ${i+1}</legend>${field([name+'-title-'+i,title],v.title)}${field([name+'-text-'+i,text,'text'],v.text??v.content)}${btn('Remove','remove-pair',name+':'+i)}</fieldset>`).join('')}${list.length<limit?btn('Add '+title.toLowerCase(),'add-pair',name):''}</div>`;
}
function startDraft(settings){
 const merged={...settings,...settings.designDraft};
 const value={grid:'standard',headerStyle:'split',bagLabel:'Bag',...Object.fromEntries(designKeys.filter(k=>own(merged,k)).map(k=>[k,copy(merged[k])]))};
 value.sections=copy(getSections(merged));
 return value;
}
export function createStoreStudio({app,getState,getSupport,isDemo,logo,api,toast,upload,editProduct,openDashboard,confirmPublish,importProducts}){
 let selected='hero',viewport='desktop',preview=false,value=null,baseline='',undo=[],redo=[],timer=null,savePending=false,statusText='',owner='';
 const current=()=>getState();
 const dirty=()=>!!value&&JSON.stringify(value)!==baseline;
 const inStudio=()=>!!app.querySelector('#store-studio');
 function load(){
  const tenant=current()?.id||'demo';
  if(value&&owner===tenant)return;
  owner=tenant;reset();
  selected=value.sections.find(x=>!x.hidden)?.id||'brand';
 }
 function reset(){
  value=startDraft(current().settings);baseline=JSON.stringify(value);undo=[];redo=[];statusText='';
 }
 function locate(){return value.sections.find(s=>s.id===selected);}
 function viewData(){
  const {designDraft,...published}=current().settings;
  const f=published.features||{},settings={...published,...value};
  return { ...current(),settings,features:{quiz:f.quiz?.enabled?{...f.quiz,rules:f.quiz.rules.filter(r=>settings.categories.includes(r.category))}:null,journal:(f.journal||[]).filter(a=>a.published)} };
 }
 function send(type='render',target){
  app.querySelector('#studio-canvas')?.contentWindow?.postMessage({plazaStudio:true,type,target,store:viewData(),edit:!preview,trust:!isDemo(),selected},location.origin);
 }
 function drawInspector(focus=false){
  const panel=app.querySelector('#studio-inspector');
  if(!panel)return;
  const t=getTemplate(current().settings.template);
  const s=locate(),g=designGroups[s?.type||selected],products=current().products;
  const sectionTitle=x=>x.title||sectionTypes[x.type];
  const row=(id,label,icon)=>`<button type="button" class="studio-layer${selected===id?' selected':''}" data-studio="pick" data-value="${attr(id)}" aria-pressed="${selected===id}"><span aria-hidden="true">${icon}</span>${esc(label)}</button>`;
  const list=selected==='all-products'? `<div class="studio-products"><p class="small">Product changes save separately from design drafts. On a live store, changes to visible products take effect when you save them.</p>${btn('+ Add product','edit-product','','sm')}${t&&!products.length?`<p>Try this template’s sample products. They stay hidden until you make them visible.</p>${btn('Add sample products','sample-products')}`:''}${products.map(p=>`<button type="button" class="studio-layer" data-studio="edit-product" data-value="${attr(p.id)}"><span aria-hidden="true">▧</span><span>${esc(p.name)}<small>${p.active?'Visible':'Hidden'}</small></span></button>`).join('')}</div>`:'';
  const pages=value.customPages||[];
  let controls='';
  if(g)controls=g.fields.map(f=>f[2]==='pages'?pairs(pages,'pages','Page','Page content',10):field(f,value[f[0]],current().images)).join('');
  if(s&&!g)controls=extraFields(s,current().images);
  if(g===designGroups.catalog)controls+=btn('Manage products','pick','all-products');
  if(s?.type==='categories')controls+=btn('Edit category list','pick','catalog');
  const index=s?value.sections.indexOf(s):-1;
  const manage=s?`<div class="studio-section-actions"><button type="button" class="btn outline sm" data-studio="move" data-value="-1" ${index<1?'disabled':''}>↑ Up</button><button type="button" class="btn outline sm" data-studio="move" data-value="1" ${index===value.sections.length-1?'disabled':''}>↓ Down</button>${btn(s.hidden?'Show':'Hide','hide')}${coreTypes.includes(s.type)?'':btn('Remove','remove')}</div>`:'';
  const oldScroll=panel.scrollTop;
  panel.innerHTML=`<div class="studio-inspector-inner"><div class="studio-label">Store design</div><p class="studio-template-name">${esc(t?.label||'Classic storefront')} <span>Template locked</span></p>
   <div class="studio-global">${row('brand','Brand & navigation','◈')}${row('theme','Colours & layout','◉')}${row('all-products','Products','▧')}</div>
   <details class="studio-layers" open><summary>Page sections</summary>${value.sections.map(x=>row(x.id,sectionTitle(x)+(x.hidden?' (hidden)':''),'▤')).join('')}${['hero','catalog','about'].filter(k=>!value.sections.some(x=>x.type===k)).map(k=>btn('+ Restore '+sectionTypes[k],'add-section',k)).join('')}${row('footer','Footer & policies','≡')}<label class="field studio-add-label">Add a section<select data-studio-add><option value="">Choose a section</option>${Object.entries(sectionTypes).filter(([k])=>!coreTypes.includes(k)).map(([k,n])=>`<option value="${k}">${esc(n)}</option>`).join('')}</select></label></details>
   <section class="studio-fields"><h2 tabindex="-1">${esc(g?.label||sectionTitle(s||{})||'Products')}</h2>${manage}<div id="studio-inputs">${controls}${list}</div></section></div>`;
  panel.scrollTop=oldScroll;
  if(focus)panel.querySelector('.studio-fields h2')?.focus();
 }
 function drawStatus(){
  const box=app.querySelector('#studio-status');
  if(box)box.textContent=statusText||(dirty()?'Unsaved changes':current().settings.designDraft?'Draft saved':current().settings.published?'Published storefront':'Unpublished storefront');
  const discard=app.querySelector('[data-studio="discard"]');
  if(discard)discard.hidden=!dirty()&&!current().settings.designDraft;
  const redoButton=app.querySelector('[data-studio="redo"]'),undoButton=app.querySelector('[data-studio="undo"]');
  if(redoButton)redoButton.disabled=!redo.length;
  if(undoButton)undoButton.disabled=!undo.length;
 }
 function change(fn,{redraw=false,coalesce=false}={}){
  const previous=JSON.stringify(value);fn();
  if(previous===JSON.stringify(value))return;
  if(!coalesce||!timer){undo.push(previous);if(undo.length>60)undo.shift();}
  clearTimeout(timer);timer=coalesce?setTimeout(()=>{timer=null;},360):null;
  redo=[];statusText='';if(redraw)drawInspector();
  send();drawStatus();
 }
 function fieldChanged(control){
  if(!control.closest('#studio-inputs')||!control.name)return;
  const key=control.name,raw=control.value,sect=locate();
  change(()=>{
   const pair=key.match(/^(pages|entries)-(title|text)-(\d+)$/);
   if(pair){
    const list=pair[1]==='pages'?value.customPages:sect.items;
    list[Number(pair[3])][pair[1]==='pages'&&pair[2]==='text'?'content':pair[2]]=raw;
   }else if(/^photo-\d$/.test(key)){
    sect.images||=[];sect.images[Number(key.slice(6))]=raw;
   }else if(designKeys.includes(key))value[key]=key==='categories'?raw.split('\n').map(x=>x.trim()).filter(Boolean):raw;
   else if(sect&&!coreTypes.includes(sect.type))sect[key]=raw;
  },{coalesce:['text','textarea'].includes(control.type)});
 }
 function addSection(type){
  if(value.sections.length>=24){toast('You can add up to 24 sections.');return;}
  const id=coreTypes.includes(type)?type:newID();
  change(()=>{
   const after=value.sections.findIndex(x=>x.id===selected),item={id,type};
   if(!coreTypes.includes(type)){item.title=sectionTypes[type];item.text='';if(type==='faq')item.items=[{title:'Your first question?',text:'Add an answer for customers.'}];if(type==='benefits')item.items=[{title:'Your first benefit',text:'Tell customers what makes shopping here different.'}];}
   value.sections.splice(after===-1?value.sections.length:after+1,0,item);selected=id;
  },{redraw:true});send('jump',selected);
 }
 function select(target,fromCanvas=false){
  if(target.startsWith('product:')){editProduct(target.slice(8));return;}
  selected=target;drawInspector(fromCanvas);send();
  if(!fromCanvas&&locate())send('jump',selected);
 }
 async function persist(mode){
  if(savePending)return;
  savePending=true;statusText=mode==='discard'?'Discarding…':'Saving…';drawStatus();
  const before=JSON.stringify(value);
  try{
   const design=JSON.parse(before),previous=JSON.parse(baseline);
   for(const k of Object.keys(design))if(JSON.stringify(design[k])===JSON.stringify(previous[k]))delete design[k];
   if(design.sections)design.sections=design.sections.map(s=>({...s,images:(s.images||[]).filter(Boolean),items:(s.items||[]).filter(x=>x.title.trim()||x.text.trim())}));
   if(design.customPages)design.customPages=design.customPages.filter(x=>x.title.trim()||x.content.trim());
   if(isDemo()){
    const s=current().settings;
    if(mode==='discard')delete s.designDraft;
    else if(mode==='apply'){Object.assign(s,s.designDraft,design);delete s.designDraft;}
    else s.designDraft={...s.designDraft,...design};
    openDashboard('save-demo');
   }else{
    const result=await api('/api/admin/'+current().id+'/design','PUT',{mode,design});
    current().settings=result.settings;
   }
   if(before===JSON.stringify(value)||mode==='discard'){reset();drawInspector();}else baseline=JSON.stringify(startDraft(current().settings));
   statusText=mode==='discard'?'Draft discarded':mode==='apply'?'Changes are live':'Draft saved';
   send();toast(statusText);
  }catch(error){statusText=error.message;toast(error.message);throw error;}
  finally{savePending=false;drawStatus();}
 }
 function draw(){
  load();
  const s=current().settings,support=getSupport(),canApply=!support&&s.published;
  app.innerHTML=`<main id="store-studio" class="store-studio${preview?' studio-preview-only':''}" data-viewport="${viewport}">
   <header class="studio-toolbar"><div class="studio-toolbar-home">${logo()}<span><strong>${esc(s.name)}</strong><small>${preview?'Storefront preview':'Store designer'}</small></span></div>
    <div class="studio-view-tools" role="group" aria-label="Preview size">${['Desktop','Tablet','Phone'].map(n=>btn(n,'viewport',n.toLowerCase(),viewport===n.toLowerCase()?'sm':'outline sm').replace('data-studio=',`aria-pressed="${viewport===n.toLowerCase()}" data-studio=`)).join('')}</div>
    <div class="studio-toolbar-actions">${btn('Dashboard','exit')}${btn(preview?'Back to editing':'Full preview','preview')}${preview?'':btn('Undo','undo')+btn('Redo','redo')+btn('Save draft','save','','sm')+(canApply?btn(isDemo()?'Apply demo changes':'Publish changes','apply','','sm'):!support&&!isDemo()?btn('Publish store','publish','','sm'):'')}</div>
   </header>
   <div class="studio-notice"><span>${preview?'Customer view · Checkout disabled in preview.':'Select a section on the storefront to edit it. Save a draft to keep changes private.'}${support?' · Vendor support mode':''}</span><span id="studio-status" role="status"></span>${!support&&!preview?btn('Discard draft','discard'):''}${support?'<button type="button" class="btn outline sm" data-action="vendor-support-end">End support session</button>':''}</div>
   <div class="studio-workbench"><aside id="studio-inspector" aria-label="Store design controls"></aside><div class="studio-stage"><iframe id="studio-canvas" title="Live storefront preview" src="${canvasURL}"></iframe></div></div>
   </main>`;
  drawInspector();drawStatus();
 }
 const preserve=(e)=>{if(inStudio()&&dirty()&&e.target?.closest?.('a')?.getAttribute('href')==='/'&&!window.confirm('Leave the designer with unsaved changes?'))e.preventDefault();};
 window.addEventListener('beforeunload',e=>{if(inStudio()&&dirty()){e.preventDefault();e.returnValue='';}});
 window.addEventListener('message',e=>{
  const frame=app.querySelector('#studio-canvas');
  if(!frame||e.origin!==location.origin||e.source!==frame.contentWindow||!e.data?.plazaCanvas)return;
  if(e.data.type==='ready')send();
  if(e.data.type==='select'&&typeof e.data.target==='string')select(e.data.target,true);
 });
 app.addEventListener('click',preserve);
 app.addEventListener('input',e=>{if(inStudio()&&e.target.matches('#studio-inputs textarea,#studio-inputs input:not([type=file])'))fieldChanged(e.target);});
 app.addEventListener('change',async e=>{
  if(!inStudio())return;
  const target=e.target;
  if(target.matches('[data-studio-add]')&&target.value){addSection(target.value);return;}
  if(target.matches('select'))fieldChanged(target);
  if(target.matches('[data-studio-upload]')&&target.files[0]){
   const where=selected,key=target.dataset.studioUpload;
   try{
    target.disabled=true;const url=await upload(target.files[0]);
    if(!inStudio()||where!==selected){toast('Media uploaded. Select it from the library.');return;}
    const el=app.querySelector('#studio-inputs select[name="'+key+'"]');
    if(el)fieldChanged({name:key,value:url,type:'select',closest:()=>true});
    drawInspector();toast('Media added.');
   }catch(error){toast(error.message);}finally{target.disabled=false;}
  }
 });
 app.addEventListener('click',async e=>{
  if(!inStudio())return;
  const button=e.target.closest('[data-studio]');
  if(!button)return;
  const command=button.dataset.studio,v=button.dataset.value;
  try{
   if(command==='pick')select(v);
   if(command==='edit-product')editProduct(v);
   if(command==='sample-products'){button.disabled=true;await importProducts();drawInspector();send();}
   if(command==='add-section')addSection(v);
   if(command==='viewport'){viewport=v;const shell=app.querySelector('#store-studio');shell.dataset.viewport=v;for(const b of shell.querySelectorAll('[data-studio=viewport]')){b.classList.toggle('outline',b.dataset.value!==viewport);b.setAttribute('aria-pressed',String(b.dataset.value===viewport));}}
   if(command==='preview'){preview=!preview;draw();}
   if(command==='exit'&&(!dirty()||window.confirm('Leave the designer with unsaved changes?'))){reset();preview=false;openDashboard();}
   if(command==='undo'||command==='redo'){
    const from=command==='undo'?undo:redo,to=command==='undo'?redo:undo;
    if(from.length){to.push(JSON.stringify(value));value=JSON.parse(from.pop());statusText='';if(!designGroups[selected]&&!locate()&&selected!=='all-products')selected='brand';drawInspector();send();drawStatus();}
   }
   if(['move','hide','remove'].includes(command)){
    const section=locate(),i=value.sections.indexOf(section);
    if(section)change(()=>{
     if(command==='move'){value.sections.splice(i,1);value.sections.splice(i+Number(v),0,section);}
     if(command==='hide')section.hidden=!section.hidden;
     if(command==='remove'){value.sections.splice(i,1);selected='brand';}
    },{redraw:true});
   }
   if(command==='add-pair'||command==='remove-pair'){
    const [key,i]=v.split(':');
    change(()=>{
     if(key==='entries'&&!locate())return;
     const list=key==='pages'?(value.customPages||=[]):(locate().items||=[]);
     if(command==='add-pair')list.push(key==='pages'?{title:'',content:''}:{title:'',text:''});
     else list.splice(Number(i),1);
    },{redraw:true});
   }
   if(command==='save')await persist('save');
   if(command==='discard'&&window.confirm('Discard changes to this design draft?'))await persist('discard');
   if(command==='apply'&&(isDemo()||window.confirm('Publish these design changes to your live storefront?')))await persist('apply');
   if(command==='publish'){if(dirty())await persist('save');confirmPublish();}
  }catch(error){if(!statusText||statusText!==error.message)toast(error.message);}
 finally{if(command==='sample-products')button.disabled=false;}
 });
 return {open(onlyPreview=false){preview=onlyPreview;draw();},inStudio,mayExit(){if(!inStudio()||!dirty())return true;if(!window.confirm('Leave the designer with unsaved changes?'))return false;reset();return true;},refresh(){if(inStudio()){drawInspector();send();drawStatus();}},published(){reset();if(inStudio())draw();}};
}

const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const emailLabels={order_buyer:'Order receipt',payment:'Payment confirmed',order_status:'Order status update'};
const title={discounts:'Discount codes',loyalty:'Loyalty rewards',quiz:'Shopper quiz',reviews:'Customer reviews',journal:'Store journal',emails:'Customer email templates'};
const desc={
 discounts:'Set a percentage or fixed amount, minimum spend and optional expiry. Customers enter a code at checkout.',
 loyalty:'Reward repeat customers after a set number of fulfilled, paid orders. At checkout, customers verify using a previous order link and the same email address.',
 quiz:'Ask shoppers a question. Each answer takes them to a category you already sell.',
 reviews:'Only customers with a fulfilled, paid order and its private link can submit a review. Approve reviews to show them on your storefront.',
 journal:'Write buying guides, product stories or store news. Drafts are private until published.',
 emails:'Customise the subject and add a message to each customer email. Plaza keeps the required order details and links.'
};
const btn=(label,action,id='',solid=false)=>`<button type="button" class="btn ${solid?'sm':'outline sm'}" data-action="${action}" data-id="${esc(id)}">${esc(label)}</button>`;
const field=(label,name,value='',type='text',extra='')=>`<label class="field">${esc(label)}<input name="${name}" type="${type}" value="${esc(value)}" ${extra}></label>`;
const area=(label,name,value='',max=1000)=>`<label class="field">${esc(label)}<textarea name="${name}" maxlength="${max}">${esc(value)}</textarea></label>`;
const check=(label,name,checked)=>`<label class="field check"><input type="checkbox" name="${name}" ${checked?'checked':''}>${label}</label>`;
const menu=(label,name,selected,opts)=>`<label class="field">${label}<select name="${name}">${opts.map(([k,v])=>`<option value="${esc(k)}" ${selected===k?'selected':''}>${esc(v)}</option>`).join('')}</select></label>`;
const form=(key,inner,id='')=>`<form data-form="shop-feature" data-key="${key}" data-id="${esc(id)}">${inner}<div class="form-error" role="alert"></div><button type="submit" class="btn">Save ${key==='emails'?'email template':key==='loyalty'?'loyalty rules':key==='quiz'?'quiz':key==='journal'?'article':'discount'}</button></form>`;
const card=(lead,body,bottom='')=>`<article class="panel growth-card"><div>${lead}</div><div>${body}</div>${bottom?`<div class="row">${bottom}</div>`:''}</article>`;
export function featurePanel(key,settings,reviews,money){
 const data=settings.features?.[key],cur=settings.currency;
 let body='',action='';
 if(key==='discounts'){
  action=btn('+ Create discount','shop-feature','',true);
  body=(data||[]).map(x=>card(`<h3>${esc(x.code)}</h3><span class="tag">${x.active?'Enabled':'Paused'}</span>`,
   `<p>${x.kind==='percent'?x.amount+'% off':esc(x.currency||cur)+' '+money(x.amount,x.currency||cur)+' off'} · ${x.min?'Minimum '+money(x.min,cur):'No minimum'} · ${x.expires?'Through '+esc(x.expires):'No expiry'}</p>`,btn('Edit','shop-feature',x.code))).join('');
 }
 if(key==='loyalty'){
  body=card(`<h3>${data?.enabled?'Program enabled':'Program off'}</h3>`,`<p>${data?.enabled?`${data.percent}% off after every ${data.orders} fulfilled paid orders. Discounts cannot be combined.`:'Choose how often a returning customer earns a discount.'}</p>`,btn('Edit loyalty rules','shop-feature'));
 }
 if(key==='quiz'){
  body=card(`<h3>${esc(data?.question||'Product finder')}</h3><span class="tag">${data?.enabled?'Enabled':'Off'}</span>`,`<p>${data?.rules?.length?data.rules.map(x=>esc(x.label)+' → '+esc(x.category)).join('<br>'):'Add answer choices and link them to product categories.'}</p>`,btn('Edit quiz rules','shop-feature'));
 }
 if(key==='reviews'){
  body=reviews===null?'<p>Loading reviews…</p>':reviews.map(r=>card(`<h3>${esc(r.name)} · ${r.rating}/5</h3><span class="tag">${esc(r.status)}</span>`,`<p class="preline">${esc(r.comment)}</p><p class="small">Order ${esc(r.reference)}</p>`,
   r.status==='published'?btn('Hide review','review-hidden',r.id):btn('Publish review','review-published',r.id)+(r.status==='pending'?btn('Hide review','review-hidden',r.id):''))).join('');
 }
 if(key==='journal'){
  action=btn('+ Write article','shop-feature','',true);
  body=(data||[]).map(x=>card(`<h3>${esc(x.title)}</h3><span class="tag">${x.published?'Published':'Draft'}</span>`,`<p>${esc(x.intro||x.body.slice(0,150))}</p>`,btn('Edit article','shop-feature',x.id))).join('');
 }
 if(key==='emails')body=Object.entries(emailLabels).map(([k,v])=>card(`<h3>${v}</h3>`,`<p>${esc(data?.[k]?.subject||'Using Plaza’s default subject')}</p>`,btn('Edit or preview','shop-feature',k))).join('');
 return `<section class="panel vendor-panel"><div class="section-head"><div><h2>${title[key]}</h2><p>${desc[key]}</p></div>${action}</div></section><div id="shop-feature-list" class="growth-grid">${body||`<section class="panel vendor-panel"><p>${key==='reviews'?'No reviews yet.':key==='journal'?'No articles yet.':'No discount codes yet.'}</p></section>`}</div>`;
}
export function featureDialog(key,id,settings){
 const value=settings.features?.[key],cur=settings.currency;
 let inner='';
 if(key==='discounts'){
  const d=value?.find(x=>x.code===id)||{};
  inner=field('Discount code','code',d.code,'text','required maxlength="30"')+menu('Type','kind',d.kind,[['percent','Percentage'],['fixed','Fixed amount ('+cur+')']])+field('Amount (% or '+cur+')','amount',d.kind==='fixed'?d.amount/100:d.amount,'number','min="0.01" step="0.01" required')+field('Minimum order subtotal ('+cur+')','min',(d.min||0)/100,'number','min="0" step="0.01"')+field('Expiry date (Jamaica time)','expires',d.expires,'date')+check('Enable at checkout','active',d.active??true);
 }
 if(key==='loyalty')inner=check('Enable rewards','enabled',value?.enabled)+field('Fulfilled paid orders needed','orders',value?.orders||3,'number','min="2" max="30" required')+field('Reward discount (%)','percent',value?.percent||10,'number','min="1" max="40" required');
 if(key==='quiz'){
  const opts=[['','Choose category'],...settings.categories.map(x=>[x,x])];
  inner=check('Show quiz on storefront','enabled',value?.enabled)+field('Question','question',value?.question||'What are you shopping for?','text','maxlength="160"')+`<div id="quiz-rules">${Array.from({length:12},(_,i)=>`<div class="form-grid quiz-rule" ${i>=Math.max(3,(value?.rules?.length||0)+1)?'hidden':''}>${field('Answer '+(i+1),'label'+i,value?.rules[i]?.label,'text','maxlength="80"')}${menu('Category','category'+i,value?.rules[i]?.category,opts)}</div>`).join('')}</div>`+btn('+ Add answer','quiz-add');
 }
 if(key==='journal'){
  const a=value?.find(x=>x.id===id)||{};
  inner=field('Article title','title',a.title,'text','maxlength="120" required')+field('Short summary','intro',a.intro,'text','maxlength="240"')+area('Article','body',a.body,6000)+check('Publish on your storefront','published',a.published);
 }
 if(key==='emails'){
  const a=value?.[id]||{};
  inner=`<p>${esc(emailLabels[id])}</p>`+field('Custom subject (optional)','subject',a.subject,'text','maxlength="100"')+area('Extra customer message (optional)','message',a.message)+btn('Preview email','feature-email-preview',id)+'<div id="email-template-preview"></div>';
 }
 if(['discounts','journal'].includes(key)&&id)inner+=btn(key==='journal'?'Remove article':'Remove code','shop-feature-remove',id);
 return `<h2>${title[key]}</h2><p>${desc[key]}</p>${form(key,inner,id)}`;
}
export function featureRequest(key,id,data,existing={},uuid){
 if(key==='discounts'){const row={code:data.code.trim().toUpperCase(),kind:data.kind,amount:data.kind==='fixed'?Math.round(Number(data.amount)*100):Number(data.amount),min:Math.round(Number(data.min)*100),expires:data.expires,active:data.active};return [...(existing[key]||[]).filter(x=>x.code!==id),row];}
 if(key==='loyalty')return {enabled:data.enabled,orders:Number(data.orders),percent:Number(data.percent)};
 if(key==='quiz')return {enabled:data.enabled,question:data.question,rules:Array.from({length:12},(_,i)=>({label:data['label'+i].trim(),category:data['category'+i]})).filter(x=>x.label||x.category)};
 if(key==='journal'){const row={id:id||uuid(),title:data.title,intro:data.intro,body:data.body,published:data.published};return [...(existing[key]||[]).filter(x=>x.id!==id),row];}
 return {...existing.emails,[id]:{subject:data.subject,message:data.message}};
}
export function storefrontExtras(features,reviews){
 const {quiz,journal}=features||{};
 return `${quiz?.rules?.length?`<section class="store-section tone-soft store-feature"><h2>${esc(quiz.question)}</h2><div class="section-category-grid">${quiz.rules.map(r=>`<button type="button" data-category="${esc(r.category)}" data-jump="collection"><strong>${esc(r.label)}</strong><span aria-hidden="true">→</span></button>`).join('')}</div></section>`:''}
 ${journal?.length?`<section class="store-section store-feature"><h2>From our journal</h2><div class="growth-grid">${journal.map(a=>`<details><summary>${esc(a.title)}</summary>${a.intro?`<p>${esc(a.intro)}</p>`:''}<p class="preline">${esc(a.body)}</p></details>`).join('')}</div></section>`:''}
 ${reviews?.length?`<section class="store-section tone-soft store-feature"><h2>Customer reviews</h2><div class="growth-grid">${reviews.map(r=>`<article><strong>${esc(r.name)} · ${r.rating}/5</strong><p class="small">Verified purchase</p><p class="preline">${esc(r.comment)}</p></article>`).join('')}</div></section>`:''}`;
}

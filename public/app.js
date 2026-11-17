import {footer,nav,mini,landing,marketingPage} from './marketing.js?v=plaza-careers-1';
import {pathInStore,retailURL} from './retail-route.js?v=retail-1';
import {featurePanel,featureDialog,featureRequest} from './vendor-features.js?v=growth-1';
import {enquiryWorkspace,workspaceSidebar,workspaceTitle,workspaceTab,vendorDashboard,inventoryPanel,customersPanel} from './vendor-workspace.js?v=plaza-careers-1';
import {demoStore} from './demo-data.js';
import {renderStorefront} from './storefront.js?v=plaza-careers-1';
import {createStoreStudio,templatePage,studioMediaOptions} from './store-studio.js?v=plaza-careers-1';
import {signupExperience,updateSignupSelection,showSignupStep,suggestStoreSlug,launchpad} from './launch-experience.js?v=plaza-careers-1';
import {getTemplate,sellsOnline} from './store-templates.js?v=plaza-careers-1';
import {legalPages,policyVersion} from './legal.js?v=paypal-trial-1';
import {consultationPage,consultantDialog,developerShell,developerView,billingPanel,consoleTabs} from './platform-ui.js?v=plaza-careers-1';
import {publicReportPage,reportReceipt,reportCase,reportQueue,operatorCase} from './trust-ui.js';
const app=document.querySelector('#app'), modal=document.querySelector('#modal');
modal.addEventListener('close',()=>{modal.querySelector('[data-form="paypal-settings"]')?.reset();});
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=>crypto.randomUUID().replaceAll('-','');
let session={user:null,tenants:[],csrf:''},catalog={gateways:[]},state=null,tab='overview',demo=false,store=null,retailRoute={page:'home'};
const local={get(k,f){try{return JSON.parse(localStorage.getItem(k))??f;}catch{return f;}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch{toast('Your browser could not save these changes.');}},remove(k){localStorage.removeItem(k);}};
let reportAccess=null,reportFilter='open',reportPage=1,devTab='overview',devData=null,devLoad=0,support=null;
const developerTab=tab=>tab==='stores'?'vendors':consoleTabs.some(t=>t[0]===tab)?tab:null;
const studio=createStoreStudio({app,getState:()=>state,getSupport:()=>support,isDemo:()=>demo,logo:()=>logo(),api,toast,upload:uploadMedia,editProduct,
 openDashboard(mode){if(mode==='save-demo'){saveDemo();return;}goVendorTab('overview');},
 confirmPublish:publishDialog,async importProducts(){await adminMutation('sample-products','POST',{});toast('Hidden sample products added.');}
});
let example=false,shopReviews=null,orderQuote=null;
const growthTabs=['discounts','loyalty','quiz','reviews','journal','emails'];
const demoKey='icss-plaza-demo-v1';
const money=(cents,currency=state?.settings?.currency||store?.settings?.currency||'JMD')=>new Intl.NumberFormat('en-JM',{style:'currency',currency,maximumFractionDigits:2}).format(cents/100);
const logo=()=>'<a class="logo" href="/" aria-label="ICSS Plaza home"><img src="/assets/brand/logo-horizontal.png" alt="ICSS Plaza — by iCreate Solutions &amp; Services" width="900" height="220"></a>';
const illustration=(name,extra='')=>`<img class="empty-illustration ${extra}" src="/assets/brand/${name}.svg" alt="" width="640" height="400" loading="lazy">`;
const button=(label,action,cls='',attrs='')=>`<button class="btn ${cls}" data-action="${action}" ${attrs}>${label}</button>`;
const field=(label,name,value='',type='text',hint='')=>`<label class="field">${esc(label)}<input type="${type}" name="${name}" value="${esc(value)}" ${type==='number'?'min="0" step="0.01"':''}>${hint?`<span class="helper">${hint}</span>`:''}</label>`;
const area=(label,name,value='')=>`<label class="field">${esc(label)}<textarea name="${name}">${esc(value)}</textarea></label>`;
const check=(label,name,value)=>`<label class="field check"><input name="${name}" type="checkbox" ${value?'checked':''}>${esc(label)}</label>`;
const select=(label,name,value,items)=>`<label class="field">${esc(label)}<select name="${name}">${items.map(([k,v])=>`<option value="${esc(k)}" ${value===k?'selected':''}>${esc(v)}</option>`).join('')}</select></label>`;
function toast(msg){const t=document.querySelector('#toast');t.textContent=msg;t.style.display='block';clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.style.display='none',5000);}
async function api(path,method='GET',data){const r=await fetch(path,{method,headers:{'Content-Type':'application/json',...(session.csrf?{'X-CSRF-Token':session.csrf}:{}),...(support&&(path.startsWith('/api/admin/')||method==='DELETE'&&path.endsWith('/access'))?{'X-Plaza-Support':support.id}:{})},...(data?{body:JSON.stringify(data)}:{})});const result=await r.json();if(!r.ok)throw Error(result.error||'Request failed.');return result;}
function showModal(html){modal.innerHTML=`<div class="dialog-head"><span></span><button class="close" data-action="close" aria-label="Close dialog">×</button></div>`+html;modal.showModal();}
function errorPage(error){app.innerHTML=`<div class="error-page">${logo()}${illustration('not-found')}<h1 style="margin-top:24px">${esc(error.message)}</h1><a class="btn" href="/">Back to ICSS Plaza</a></div>`;}
function legal(){const key=location.pathname.split('/')[2]||'terms',p=legalPages[key];if(!p)return errorPage(Error('Policy not found.'));document.title=p.title+' | ICSS Plaza';const updated=p.updated||policyVersion;app.innerHTML=nav()+`<article class="legal"><div class="eyebrow">iCreate Solutions & Services · Jamaica</div><h1>${p.title}</h1><p>Updated <time datetime="${esc(updated)}">${esc(new Intl.DateTimeFormat('en-GB',{dateStyle:'long',timeZone:'UTC'}).format(new Date(updated)))}</time></p><nav class="legal-nav">${Object.entries(legalPages).map(([k,v])=>`<a class="tag" href="/legal/${k}">${v.title}</a>`).join('')}</nav>${p.sections.map(([h,b])=>`<h2>${esc(h)}</h2><p class="preline">${esc(b)}</p>`).join('')}${p.links?.length?`<nav class="legal-resources" aria-label="Related resources">${p.links.map(([label,url])=>`<a href="${esc(url)}">${esc(label)}</a>`).join('')}</nav>`:''}</article>`+footer();}
function authPage(kind){const signup=kind==='signup',reset=kind==='reset';if(signup)return signupPage();app.innerHTML=`<main class="auth">${logo()}<h1>${signup?'Make room for your business.':reset?'Choose a new password.':'Welcome back.'}</h1><p>${signup?'Create your store and explore a 14-day trial. No payment card needed.':reset?'Enter the one-time token provided by support.':'Sign in to manage your store.'}</p><form data-form="${kind}">${signup?field('Store name','name','')+field('Store address','slug','','text','Your store will live at /s/your-store. Use letters, numbers and hyphens.'):''}${!reset?field('Email address','email','','email'):field('Reset token','token',new URLSearchParams(location.hash?.slice(1)||'').get('token')||'')}${field('Password','password','','password',signup||reset?'Use at least 12 characters.':'')}${signup?`<label class="field check"><input name="acceptTerms" type="checkbox" required><span>I accept the <a href="/legal/terms" target="_blank">platform terms</a> and <a href="/legal/vendor-agreement" target="_blank" rel="noopener">independent vendor agreement</a>, and have read the <a href="/legal/privacy" target="_blank">privacy notice</a>.</span></label>`:''}<div class="form-error"></div><button class="btn" type="submit">${signup?'Create my store →':reset?'Reset password':'Sign in →'}</button></form><a class="small" href="${signup?'/login':'/signup'}">${signup?'Already have an account? Sign in':'New here? Create your store'}</a>${!signup?'<p class="small">Need help signing in? <a href="mailto:icreatesolutions.ja@gmail.com">Contact support</a> for a verified one-time reset token. <a href="/reset">Use reset token</a></p>':''}<a class="small" href="/demo">Explore the dashboard demo first ↗</a></main>`;}
function signupPage(){
 document.title='Create your online store | ICSS Plaza';
 const requested=new URLSearchParams(location.search).get('template');
 const selected=getTemplate(requested)?.id;
 app.innerHTML=signupExperience({logo:logo(),selected,details:`<section class="start-account panel" aria-label="Website and account details">
  <div class="eyebrow">ABOUT YOUR SITE</div><h3>Name and web address</h3>
  <label class="field">Website name<input name="name" required maxlength="180" autocomplete="organization" placeholder="e.g. Harbour Driving School"></label>
  <label class="field">Website address<span class="start-address"><span>icssplaza.com/s/</span><input name="slug" required minlength="3" maxlength="48" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" placeholder="your-store" aria-describedby="address-hint" autocapitalize="none" spellcheck="false"></span></label>
  <p class="start-field-note" id="address-hint">Use lowercase letters, numbers and hyphens. This will be the address you share with visitors.</p>
  <div class="eyebrow">YOUR SIGN-IN</div><h3>Create your account</h3>
  <label class="field">Email address<input name="email" type="email" autocomplete="email" maxlength="200" required></label>
  <label class="field">Password<input name="password" type="password" autocomplete="new-password" minlength="12" maxlength="128" aria-describedby="password-hint" required></label>
  <p class="start-field-note" id="password-hint">Use at least 12 characters.</p>
  <label class="field check"><input name="acceptTerms" type="checkbox" required><span>I accept the <a href="/legal/terms" target="_blank" rel="noopener">platform terms</a> and <a href="/legal/vendor-agreement" target="_blank" rel="noopener">vendor agreement</a>, and have read the <a href="/legal/privacy" target="_blank" rel="noopener">privacy notice</a>.</span></label>
  <div class="form-error" role="alert"></div>
 </section>`});
}
function loadDemo(){let d=local.get(demoKey,null);if(!d||!d.settings||!Array.isArray(d.products))d=demoStore();state=d;}
function saveDemo(){local.set(demoKey,state);}
const tenantId=()=>state.id;
async function refresh(){if(demo){saveDemo();return;}const r=await api('/api/admin/'+(support?.tenant||tenantId()));state={...r.tenant,...r};delete state.tenant;}
const workspaceMode=()=>({support:!!support,demo,testWorkspace:state?.slug==='plaza-test-workspace',enquiries:enquiryWorkspace(state)});
function goVendorTab(key){
 tab=workspaceTab(key,workspaceMode());
 history.replaceState(null,'',location.pathname+(tab==='overview'?'':'?tab='+encodeURIComponent(tab)));
 dashboard();
 app.querySelector('.work-head h1')?.focus({preventScroll:true});
 window.scrollTo(0,0);
}
function shell(content){
 const title=workspaceTitle(tab,workspaceMode()),published=state.settings.published;
 const selling=sellsOnline(state.settings),bread=(selling?'Store':'Website')+' dashboard'+(tab==='overview'?'':' / '+title);
 app.innerHTML=`${support?`<div class="banner support-banner vendor-context"><div><strong>Vendor support mode</strong><span> · ${esc(support.reason)} · Ends ${esc(new Date(support.expires).toLocaleTimeString('en-JM',{hour:'numeric',minute:'2-digit',timeZone:'America/Jamaica'}))}</span></div></div>`:''}${demo?`<div class="banner vendor-context"><span><strong>Demo playground</strong> · Sample changes stay in this browser.</span><div class="row">${button('Reset demo','reset-demo','outline sm')}<a class="btn sm" href="/signup">Start your store ↗</a></div></div>`:''}
 <div class="vendor-workspace ${support||demo?'has-context':''}">${workspaceSidebar({tab,state,support:!!support,demo,operator:session.operator})}
 <main class="main-work vendor-main"><header class="work-head vendor-heading"><div><div class="vendor-breadcrumb">${esc(bread)}</div><h1 tabindex="-1">${esc(title)}</h1><div class="vendor-store-meta"><span>${esc(state.settings.name)}</span><span class="tag ${published?'':'warn'}">${published?'Published':'Draft'}</span>${state.status==='trial'?'<span class="tag">Trial</span>':''}${!demo?`<small>/s/${esc(state.slug)}</small>`:''}</div></div>
 <div class="row vendor-head-actions">${button(selling?'Edit storefront':'Edit website','studio-open','sm')}${button(selling?'Preview storefront':'Preview website','preview','outline sm')}${!demo&&!support?button(published?'Unpublish':selling?'Publish store':'Publish website',published?'unpublish':'publish','outline sm'):''}</div></header>${content}</main></div>`;
}
function overview(){
 const setup=support?`<section class="panel vendor-panel"><h2>Storefront support</h2><p>Review the store with the vendor. Changes to products or inventory can affect their live shop.</p><div class="checklist"><button type="button" data-tab="appearance">Open Store Designer →</button><button type="button" data-tab="products">Review products →</button></div></section>`:launchpad(state,{demo,publicOrigin:location.origin});
 return vendorDashboard({state,money,support:!!support,demo,setup,previewButton:button(sellsOnline(state.settings)?'Preview storefront':'Preview website','preview','outline sm')});
}
function productsPanel(){return `<section class="panel vendor-panel"><div class="section-head" style="margin-bottom:15px"><div><h2>Your collection</h2><p class="small">Prices use ${esc(state.settings.currency)}. Add variants for size, colour or other choices.</p></div>${button('+ Add product','add-product','sm')}</div>${state.products.length?'<div class="vendor-list-tools"><label class="field">Find a product<input type="search" data-vendor-filter placeholder="Search name, SKU or category"></label></div>':''}<div class="table-scroll"><table class="vendor-table"><thead><tr><th>Product</th><th>Category</th><th>Price</th><th>Stock</th><th>Status</th><th></th></tr></thead><tbody>${state.products.map(p=>`<tr data-vendor-row data-filter="${esc([p.name,p.sku,p.category].join(' '))}"><td><div class="table-product"><img class="thumb" src="${esc(p.image||'/assets/collection.svg')}" alt=""><div><strong>${esc(p.name)}</strong><p class="small">${esc(p.sku)}</p></div></div></td><td>${esc(p.category)}</td><td>${money(p.price)}</td><td>${p.variants.length?p.variants.reduce((a,v)=>a+v.stock,0):p.stock}</td><td><span class="tag ${p.active?'':'warn'}">${p.active?'Active':'Hidden'}</span></td><td>${button('Edit','edit-product','outline sm',`data-id="${esc(p.id)}"`)}</td></tr>`).join('')}</tbody></table>${state.products.length?'':`<div class="empty">${illustration('empty-products')}<p>Your next best seller starts here. Add your first product.</p></div>`}<p class="vendor-filter-empty" hidden>No matches. Try a different search.</p></div></section>`;}
function customPageFields(p={title:'',content:''}){return `<div class="custom-page">${field('Page title','pageTitle',p.title)}${area('Page content','pageContent',p.content)}${button('Remove page','remove-page','outline sm','type="button"')}<hr style="border:0;border-top:1px solid var(--line);margin:20px 0"></div>`;}
function contentPanel(){
 const s=state.settings,selling=sellsOnline(s);
 return `<form data-form="content"><section class="panel vendor-panel"><h2>${selling?'Store information':'Website information'}</h2><p>Edit the business details customers use to contact you, plus your store’s story and additional pages.</p><div class="form-grid">${support?'':field('Public contact email','contactEmail',s.contactEmail,'email')}${field('Business phone','phone',s.phone)}<div class="full">${area('Business name and address','address',s.address)}${field('Instagram handle','instagram',s.instagram)}${field('About section heading','aboutTitle',s.aboutTitle)}${area('Your story','about',s.about)}</div></div></section>
 <section class="panel vendor-panel"><h2>${selling?'Additional store pages':'Additional pages'}</h2><p>${selling?'Add a size guide, care instructions or a service guide to your storefront footer.':'Add pages for your services, schedule or other details. The first two appear in the website navigation.'}</p><div id="custom-pages">${(s.customPages||[]).map(customPageFields).join('')}</div><div class="row">${button('+ Add page','add-page','outline sm','type="button"')}<button class="btn" type="submit">Save site content</button></div><div class="form-error" role="alert"></div></section></form>`;
}
function policiesPanel(){
 const s=state.settings,selling=sellsOnline(s);
 return `<form data-form="vendor-policies"><section class="panel vendor-panel"><h2>${selling?'Customer policies':'Website privacy'}</h2><p>${selling?'These are your store’s policies for customers. Review them before publishing. Plaza’s platform policies apply separately.':'Explain how you use the information people send when they contact you.'}</p>${selling?area('Delivery & shipping policy','shipping',s.shipping)+area('Returns, refunds & cancellations','returns',s.returns):''}${area('Privacy notice','privacy',s.privacy)}${selling?area('Sales terms','terms',s.terms):''}<div class="form-error" role="alert"></div><button class="btn" type="submit">Save policies</button></section></form>`;
}
function updateVendorFilter(panel){
 const search=(panel.querySelector('[data-vendor-filter]')?.value||'').trim().toLowerCase();
 const status=panel.querySelector('[data-vendor-status]')?.value||'';
 const rows=[...panel.querySelectorAll('[data-vendor-row]')];
 for(const row of rows)row.hidden=!row.dataset.filter.toLowerCase().includes(search)||!!status&&row.dataset.stock!==status;
 const empty=panel.querySelector('.vendor-filter-empty');if(empty)empty.hidden=rows.some(r=>!r.hidden);
}
function stockDialog(id){
 const p=state.products.find(x=>x.id===id);if(!p)return;
 const entries=p.variants.length?p.variants:[{id:'base',name:'Available stock',stock:p.stock}];
 showModal(`<h2>Adjust stock</h2><p>${esc(p.name)} · ${esc(p.sku||'No SKU')}</p><form data-form="vendor-stock" data-id="${esc(id)}">${entries.map(v=>`<label class="field">${esc(v.name)}<input type="number" min="0" max="1000000" step="1" value="${v.stock}" data-stock-id="${esc(v.id)}" data-previous="${v.stock}" required></label>`).join('')}<div class="form-error" role="alert"></div><button type="submit" class="btn">Save stock</button></form>`);
}
function paymentsPanel(){return `<div class="note">Connect your own approved merchant account. Credentials stay on the server and are never displayed back. Choose your default method in Store settings. Sandbox integrations cannot receive live store orders.</div><div class="payment-grid">${catalog.gateways.map(g=>{const c=state.gateways.find(x=>(x.provider||x.id)===g.id&&x.enabled);return `<article class="gateway-card"><div class="row"><h3>${esc(g.name)}</h3><span class="tag ${g.mode==='manual'?'warn':''}">${g.mode==='manual'?'Manual verification':'Automated adapter'}</span></div><p>${esc(g.note)}</p><span class="small">${g.currencies.join(' / ')} · ${c?'Configured · '+esc(c.environment):'Not configured'}</span><div class="row">${button(c?'Manage':'Set up','gateway','outline sm',`data-id="${g.id}"`)}${g.url?`<a href="${esc(g.url)}" target="_blank" rel="noopener">Provider details ↗</a>`:''}</div></article>`;}).join('')}</div>`;}
function mediaPanel(){return `<section class="panel"><h2>Your media library</h2><p>Upload product photos, logos, storefront artwork and short clips. PNG, JPEG and WebP up to 2 MB; MP4 and WebM up to 12 MB. Each store has room for 200 files and 100 MB.</p><label class="btn outline sm">+ Upload media<input class="hidden" type="file" data-upload accept="image/png,image/jpeg,image/webp,video/mp4,video/webm"></label></section><div class="media-grid">${state.images.map(i=>`<article class="media-card">${i.mime?.startsWith('video/')?`<video controls preload="metadata" src="${esc(i.url||'/api/images/'+i.id)}"></video>`:`<img src="${esc(i.url||'/api/images/'+i.id)}" alt="${esc(i.name)}">`}<p>${esc(i.name)}</p>${button('Delete','delete-image','outline sm',`data-id="${esc(i.id)}"`)}</article>`).join('')}</div>${state.images.length?'':`<div class="empty">${illustration('empty-media')}<p>Uploaded media will be available in the Store Designer and product editor.</p></div>`}`;}
function ordersPanel(){return `<section class="panel"><h2>Orders</h2><p>The latest 500 orders appear here; the store export includes full history. Payments must be verified before fulfilment. Manual payment methods require checking your provider or bank account.</p><div class="table-scroll"><table><thead><tr><th>Order</th><th>Customer</th><th>Total</th><th>Payment</th><th>Status</th><th></th></tr></thead><tbody>${state.orders.map(o=>`<tr><td>${esc(o.short_id||o.id.slice(0,10))}<p class="small">${new Date(o.created).toLocaleDateString()}</p></td><td>${esc(o.customer.name)}</td><td>${money(o.total,o.currency)}</td><td><span class="tag ${o.paid?'':'warn'}">${o.paid?'Paid':'Unverified'}</span></td><td>${esc(o.state)}</td><td>${button('View','order','outline sm',`data-id="${esc(o.id)}"`)}</td></tr>`).join('')}</tbody></table></div>${state.orders.length?'':`<div class="empty">${illustration('empty-orders')}<p>New orders will appear here.</p></div>`}</section>`;}
function settingsPanel(){const s=state.settings;return `<form data-form="settings"><section class="panel"><h2>Delivery, tax & checkout</h2><div class="form-grid">${select('Store currency','currency',s.currency,[['JMD','JMD — Jamaican dollar'],['USD','USD — US dollar']])}${select('Default payment method','defaultPayment',s.defaultPayment,[['','Choose a method'],...state.gateways.filter(g=>g.enabled).map(g=>[g.provider||g.id,catalog.gateways.find(x=>x.id===(g.provider||g.id))?.name||g.name])])}${field('Flat delivery charge','shippingFee',s.shippingFee/100,'number')}${field('Free delivery from (0 disables)','freeShippingOver',s.freeShippingOver/100,'number')}${field('Tax percentage','taxPercent',s.taxBps/100,'number','Set only the tax you are required to collect. Prices exclude this configured tax.')}${field('Tax label','taxLabel',s.taxLabel)}${check('Offer store pickup','pickup',s.pickup)}${check('Offer delivery','shippingEnabled',s.shippingEnabled)}<div class="full">${field('Categories, separated with commas','categories',s.categories.join(', '))}</div></div><div class="form-error"></div><button class="btn" type="submit">Save settings</button></section></form><section class="panel"><h2>Your account & data</h2><p>${demo?'Sample data is stored only in this browser.':'Export your catalogue, settings, images and orders. Keep this file secure: it contains customer information.'}</p><div class="row" style="flex-wrap:wrap">${button('Export store data','export','outline sm')}${!demo?button('Change password','password','outline sm')+button('Cancel store rental','cancel-store','outline sm')+button('Request account deletion','delete-account','outline sm'):button('Reset demo','reset-demo','outline sm')}</div>${state.requests?.length?`<div class="note">Recent requests: ${state.requests.map(r=>esc(r.kind)).join(', ')}</div>`:''}</section>`;}
function dashboard(){if(tab==='appearance'){studio.open();return;}const views={...Object.fromEntries(growthTabs.map(k=>[k,()=>featurePanel(k,state.settings,k==='reviews'&&demo?(state.orders.map(o=>o.review&&({...o.review,id:o.id,reference:o.short_id})).filter(Boolean)):shopReviews,money)])),overview,products:productsPanel,inventory:()=>inventoryPanel(state),customers:()=>customersPanel(state.orders,money),policies:policiesPanel,content:contentPanel,media:mediaPanel,payments:paymentsPanel,orders:ordersPanel,settings:settingsPanel,billing:()=>'<section id="vendor-billing" class="panel"><p>Loading rental billing…</p></section>','vendor-cases':()=>reportQueue({reports:[]},'all',1,false)};shell((views[tab]||overview)());if(tab==='reviews'&&!demo&&shopReviews===null)void refreshShopReviews().catch(e=>toast(e.message));if(tab==='vendor-cases'&&!demo)void refreshVendorCases().catch(e=>toast(e.message));if(tab==='billing'&&!demo)void refreshBilling().catch(e=>toast(e.message));}
async function refreshShopReviews(){
 if(demo){dashboard();return;}
 const f=await api('/api/admin/'+state.id+'/features/reviews');
 shopReviews=f.reviews;
 if(tab==='reviews')dashboard();
}
function openShopFeature(id=''){showModal(featureDialog(tab,id,state.settings));}
async function saveShopFeature(key,value){
 if(demo){state.settings.features={...state.settings.features,[key]:value};saveDemo();}
 else{const result=await api('/api/admin/'+state.id+'/features/'+key,'PUT',{value});state.settings.features=result.features;}
 modal.close();dashboard();toast('Saved.');
}
async function refreshVendorCases(){const data=await api('/api/vendor/reports');const el=document.querySelector('#vendor-case-queue');if(tab==='vendor-cases'&&el)el.outerHTML=reportQueue(data,'all',1,false);}
const reportLink=(slug,ref='')=>'/report?store='+encodeURIComponent(slug)+(ref?'&order='+encodeURIComponent(ref):'');
const cartKey=()=>`icss-cart-${demo?'demo':store.slug}`;
function cart(){return local.get(cartKey(),[]);}
function saveCart(lines){local.set(cartKey(),lines);}
function resolvedCart(){return cart().map(l=>{const p=store.products.find(p=>p.id===l.productId);if(!p?.active)return null;const v=l.variantId?p.variants.find(v=>v.id===l.variantId):p;if(!v)return null;return {...l,product:p,name:p.name+(v!==p?' — '+v.name:''),price:v.price,stock:v.stock};}).filter(Boolean);}
const storeBase=()=>example?'/templates/'+store.slug:demo?'/demo?view=store':'/s/'+store.slug;
function navigateRetail(page,options={}){
 history.pushState(null,'',retailURL(storeBase(),page,options));
 retailRoute={page,...options};renderStore();
 window.scrollTo(0,0);app.querySelector('.retail-main')?.focus();
}
function renderStore(){
 const banner=example?templatePage(store.slug).toolbar:demo?`<div class="banner"><span>Demo storefront · No real payments. Use sample information only.</span><a class="btn sm" href="/demo">← Edit this demo</a></div>`:'';
 const f=store.settings.features,shown=demo&&f?{...store,features:{quiz:f.quiz?.enabled?f.quiz:null,journal:(f.journal||[]).filter(x=>x.published)},reviews:store.orders.map(o=>o.review).filter(r=>r?.status==='published')}:store;
 app.innerHTML=banner+renderStorefront(shown,{trust:!demo&&!example,route:retailRoute,preview:example,bag:example?0:resolvedCart().reduce((n,i)=>n+i.quantity,0),cartLines:!example&&retailRoute.page==='bag'?resolvedCart():[],basePath:storeBase()});
 const item=retailRoute.page==='product'&&store.products.find(p=>p.id===retailRoute.id);
 document.title=(item?item.name+' | ':retailRoute.page==='shop'?'Shop | ':'')+store.settings.name+' | ICSS Plaza';
}
function previewStore(){if(!demo)history.replaceState(null,'',location.pathname+'?tab=appearance&view=preview');studio.open(true);}
function rewardProof(input){
 if(!input)return null;
 try{
  const u=new URL(input),p=new URLSearchParams(u.hash.slice(1));
  if(u.origin!==location.origin||u.pathname!=='/s/'+store.slug||!p.get('order')||!p.get('key'))throw Error();
  return {id:p.get('order'),token:p.get('key')};
 }catch{throw Error('Paste a private order link from this storefront.');}
}
function rewardRequest(data){
 if(!store.features?.discounts&&!store.features?.loyalty)return {};
 const proof=rewardProof(data.loyaltyLink);
 return {discountCode:data.discountCode?.trim()||'',loyaltyReward:!!proof,...(proof?{loyaltyProof:proof}:{})};
}
async function applyOrderQuote(form){
 const data=formData(form),request={lines:resolvedCart().map(({productId,variantId,quantity})=>({productId,variantId,quantity})),delivery:data.delivery,customer:{email:data.email},...rewardRequest(data)};
 const quote=await api('/api/stores/'+store.slug+'/quote','POST',request);
 orderQuote={total:quote.total,key:JSON.stringify(request)};
 for(const [key,text] of Object.entries({'shipping-total':money(quote.shipping,store.settings.currency),'checkout-total':money(quote.total,store.settings.currency),'checkout-tax':money(quote.tax,store.settings.currency),'checkout-discount':quote.discount?'−'+money(quote.discount,store.settings.currency):money(0,store.settings.currency)})){const el=form.querySelector('#'+key);if(el)el.textContent=text;}
 return request;
}
function checkoutDialog(){orderQuote=null;if(!demo&&store.checkoutBlocked){toast('This store is not accepting new orders right now.');return;}const s=store.settings,lines=resolvedCart();if(!lines.length){navigateRetail('bag');return;}const subtotal=lines.reduce((a,l)=>a+l.price*l.quantity,0);const tax=Math.round(subtotal*s.taxBps/10000);const shipping=s.freeShippingOver&&subtotal>=s.freeShippingOver?0:s.shippingFee;
 const gs=demo?state.gateways.filter(g=>g.enabled).map(g=>({...g,id:g.provider||g.id,name:catalog.gateways.find(x=>x.id===(g.provider||g.id))?.name||g.name})):store.gateways;
 showModal(`<h2>${demo?'Try a sample checkout':'Checkout'}</h2>${demo?'<div class="note">Use fictional details. No payment will be taken and no real order will be sent.</div>':''}<form data-form="checkout">${field('Full name','name',demo?'Demo Customer':'')}${field('Email','email',demo?'sample@example.com':'','email')}${field('Phone','phone',demo?'0000000000':'')}${select('Delivery method','delivery',s.shippingEnabled?'shipping':'pickup',[[...(s.shippingEnabled?['shipping','Delivery']:[])],[...(s.pickup?['pickup','Pickup']:[])]].filter(x=>x.length))}${area('Delivery address (required for delivery)','address',demo?'Demo address, Jamaica':'')}${select('Payment method','gateway',s.defaultPayment,gs.map(g=>[g.id,g.name+(g.mode==='manual'?' — manual verification':'')]))}
 ${!demo&&(store.features?.discounts||store.features?.loyalty)?`<details><summary>Discount or loyalty reward</summary>${store.features.discounts?field('Discount code','discountCode'):''}${store.features.loyalty?field('Link to a previous fulfilled order','loyaltyLink','','url','Get ${store.features.loyalty.percent}% off after ${store.features.loyalty.orders} fulfilled paid orders. Use the same email as your previous order.'):''}${button('Apply and update total','order-quote','outline sm','type="button"')}</details><div class="order-total"><span>Discount</span><strong id="checkout-discount">${money(0,s.currency)}</strong></div>`:''}<div class="order-total"><span>Subtotal</span><strong>${money(subtotal,s.currency)}</strong></div><div class="order-total"><span>${esc(s.taxLabel)} (${s.taxBps/100}%)</span><strong id="checkout-tax">${money(tax,s.currency)}</strong></div><div class="order-total"><span>Delivery</span><strong id="shipping-total">${money(s.shippingEnabled?shipping:0,s.currency)}</strong></div><div class="order-total"><strong>Total</strong><strong id="checkout-total" data-subtotal="${subtotal+tax}" data-shipping="${shipping}">${money(subtotal+tax+(s.shippingEnabled?shipping:0),s.currency)}</strong></div><p>Seller: ${esc(s.name)}. ${demo?'Sample transaction.':'You are buying from this independent vendor. Contact them about delivery, returns or refunds. Plaza’s rental refund policy does not apply.'}</p><label class="field check"><input type="checkbox" name="acceptTerms" required><span>I accept this seller’s <button class="back-link" type="button" data-action="checkout-policy" data-id="terms">sales terms</button>, <button class="back-link" type="button" data-action="checkout-policy" data-id="shipping">delivery</button> and <button class="back-link" type="button" data-action="checkout-policy" data-id="returns">returns policy</button> and have read the <button class="back-link" type="button" data-action="checkout-policy" data-id="privacy">privacy notice</button>.</span></label><div class="form-error"></div><button class="btn" type="submit">${demo?'Place sample order':'Place order & continue'} →</button></form>`);
}
function variantRow(v={id:uid(),name:'',price:0,stock:0}){return `<div class="variant-row" data-variant-id="${esc(v.id)}"><input aria-label="Variant name" data-v-name placeholder="Size / colour" value="${esc(v.name)}"><input aria-label="Variant price" data-v-price type="number" step="0.01" min="0" value="${v.price/100}"><input aria-label="Variant stock" data-v-stock type="number" min="0" value="${v.stock}"><button type="button" data-action="remove-variant" aria-label="Remove variant">×</button></div>`;}
function productMedia(name,value,label,type='image'){return `<div class="studio-media-field"><label class="field">${esc(label)}${studioMediaOptions(state.images,type,value,label,name)}</label><label class="studio-upload">Upload ${type}<input type="file" data-product-upload="${name}" accept="${type==='video'?'video/mp4,video/webm':'image/png,image/jpeg,image/webp'}"></label></div>`;}
function editProduct(pid){const p=state.products.find(x=>x.id===pid)||{id:'',name:'',description:'',category:state.settings.categories[0]||'General',price:0,stock:0,sku:'',image:'',active:true,featured:false,type:'physical',variants:[]};showModal(`<h2>${p.id?'Edit product':'Add a product'}</h2><form data-form="product" data-id="${esc(p.id)}"><div class="form-grid">${field('Product name','name',p.name)}${field('SKU','sku',p.sku)}<div class="full">${area('Description','description',p.description)}</div>${field('Category','category',p.category)}${select('Product type','type',p.type,[['physical','Physical product'],['service','Service (manual fulfilment)']])}${field('Base price ('+state.settings.currency+')','price',p.price/100,'number')}${field('Stock / available quantity','stock',p.stock,'number')}<div class="full">${productMedia('image',p.image,'Main photo')}${productMedia('video',p.video,'Product video','video')}<details class="product-gallery-editor"><summary>Additional gallery photos</summary>${Array.from({length:8},(_,i)=>productMedia('gallery-'+i,p.gallery?.[i],'Photo '+(i+1))).join('')}</details>${check('Visible in store','active',p.active)}${check('Featured product','featured',p.featured)}<label class="field">Options / variants<span class="helper">Optional. Each option has its own price and stock. Base price and stock apply only when there are no variants.</span></label><div class="variants">${p.variants.map(variantRow).join('')}</div>${button('+ Add option','add-variant','outline sm','type="button"')}<div style="height:20px"></div></div></div><div class="form-error"></div><div class="row"><button class="btn" type="submit">Save product</button>${p.id?button('Delete product','delete-product','outline sm',`type="button" data-id="${esc(p.id)}"`):''}</div></form>`);}
function gatewayDialog(provider){const g=catalog.gateways.find(g=>g.id===provider),configured=state.gateways.find(c=>(c.provider||c.id)===provider&&c.enabled);const labels={buttonURL:'Fygaro payment button HTTPS URL',keyId:'Fygaro API key ID',secret:provider==='wipay'?'WiPay verification API key':'API secret',clientId:'PayPal client ID',accountNumber:'WiPay account number',paymentURL:'Approved merchant hosted payment URL (optional)',instructions:'Customer payment instructions',label:'Payment method display name'};showModal(`<h2>${esc(g.name)}</h2><p>${esc(g.note)}</p>${demo?'<div class="note">Demo mode: do not enter real payment credentials. Configuration is simulated.</div>':''}<form data-form="gateway" data-id="${g.id}">${g.mode==='automated'?select('Environment','environment',configured?.environment||'sandbox',[['sandbox','Sandbox / testing'],['live','Live (approved account required)']]):''}${g.fields.map(f=>f==='instructions'?area(labels[f],f,''):field(labels[f],f,'',f==='secret'?'password':'text',configured?'Leave blank to keep your current value.':'')).join('')}${provider==='fygaro'&&!demo?`<div class="note">Configure your payment button Hook URL as:<br><strong>${esc(location.origin+'/api/payments/'+state.id+'/fygaro/hook')}</strong><br>Use matching API key credentials for signing hooks. A return URL alone does not verify a payment.</div>`:''}<div class="form-error"></div><div class="row"><button class="btn" type="submit">${demo?'Simulate setup':'Save & enable'}</button>${configured?button('Disable','disable-gateway','outline sm',`type="button" data-id="${g.id}"`):''}</div></form>`);}
function orderDialog(oid){const o=state.orders.find(o=>o.id===oid);if(!o)return;const manual=catalog.gateways.find(g=>g.id===o.gateway)?.mode==='manual';showModal(`<h2>Order ${esc(o.short_id||o.id.slice(0,10))}</h2><div class="status-line"><span class="tag ${o.paid?'':'warn'}">${o.paid?'Paid':'Payment unverified'}</span><span class="tag">${esc(o.state)}</span><span class="small">${esc(o.gateway)}</span></div><p><strong>${esc(o.customer.name)}</strong><br>${esc(o.customer.email)}<br>${esc(o.customer.phone)}<br>${esc(o.customer.address)}</p><p>Delivery: ${esc(o.delivery||'shipping')}</p>${o.lines.map(l=>`<div class="order-total"><span>${esc(l.name)} × ${l.quantity}</span><strong>${money(l.price*l.quantity,o.currency)}</strong></div>`).join('')}<div class="order-total"><strong>Total</strong><strong>${money(o.total,o.currency)}</strong></div>${o.transaction_id?`<p>Payment reference: ${esc(o.transaction_id)}</p>`:''}<form data-form="order" data-id="${esc(o.id)}">${select('Order status','state',o.state,['new','processing','fulfilled','cancelled'].map(k=>[k,k]))}${!o.paid&&manual?check('I verified this payment in my provider / bank account','markPaid',false)+field('Verified transaction reference','reference'):''}<div class="form-error"></div><button class="btn" type="submit">Update order</button></form><p style="margin-top:20px">Refunds must be issued in your provider account and reconciled with support. Cancellation releases reserved stock only for unpaid orders.</p>`);}
async function refreshBilling(){
 const data=await api('/api/admin/'+state.id+'/billing');
 const el=document.querySelector('#vendor-billing');if(tab==='billing'&&el)el.outerHTML=billingPanel(data,{trialEnd:state.status==='trial'?state.trial_end:0});
}
async function operatorPage(target=devTab,updateURL=false){
 if(!session.operator){
   app.innerHTML=nav()+`<main class="wrap trust-page"><div class="dev-hero"><div class="eyebrow">ICSS Plaza · Operator access</div><h1>Developer console</h1><p>${session.user?'This account is not authorised to manage the platform.':'Sign in with your Plaza operator account.'}</p><div class="row trust-actions">${session.user?button('Sign out','logout','outline'):`<a class="btn" href="/login?next=${target==='templates'?'templates':'developer'}">Operator sign-in →</a>`}</div></div></main>`+footer();return;
 }
 const load=++devLoad,data={...devData};
 let trustHTML='';
 try{
  if(target==='overview'||target==='system')data.overview=await api('/api/operator/overview');
  if(target==='vendors')data.vendors=(await api('/api/operator/vendors','POST',{})).tenants;
  if(['support','audit'].includes(target))data.operator=await api('/api/operator');
  if(target==='subscriptions')data.billing=await api('/api/operator/billing');
  if(target==='consultations'){const [consultations,overview]=await Promise.all([api('/api/operator/consultations'),api('/api/operator/overview')]);data.consultations=consultations;data.overview=overview;}
  if(target==='trust'){const cases=await api('/api/operator/reports?status='+reportFilter+'&page='+reportPage);trustHTML=reportQueue(cases,reportFilter,reportPage);}
  if(load!==devLoad)return;
  app.innerHTML=developerShell({tab:target,logo,content:developerView(target,data,{trustHTML})});
 }catch(error){
  if(load!==devLoad)return;
  const message=target==='vendors'?'Could not load Vendors. Try opening the tab again.':error.message;
  if(updateURL)throw Error(message);
  app.innerHTML=developerShell({tab:target,logo,content:`<section class="panel"><p role="alert">${esc(message)}</p>${button('Try again','developer-tab','outline sm',`data-id="${target}"`)}</section>`});
  return;
 }
 devTab=target;devData=data;
 if(updateURL)history.replaceState(null,'','/developer?tab='+target);
}
function showTestLogin(r){showModal(`<h2>Test vendor login</h2><p>Copy the temporary password now. Sign in from a private browser window to keep your developer session open.</p><label class="field">Email<input value="${esc(r.email)}" readonly></label><label class="field">Temporary password<input value="${esc(r.password)}" readonly></label><p>Expires ${esc(new Date(r.expiresAt).toLocaleDateString('en-JM'))}.</p><a class="btn" href="/login" target="_blank" rel="noopener">Open vendor sign-in →</a>`);}
async function saveSettings(payload){if(demo){state.settings={...state.settings,...payload};saveDemo();}else{const r=await api('/api/admin/'+state.id+'/settings','PUT',payload);state.settings=r.settings;}toast('Saved. Your store has been updated.');if(studio.inStudio())studio.published();else dashboard();}
async function adminMutation(action,method,data){if(!demo)await api('/api/admin/'+state.id+'/'+action,method,data);await refresh();}
function readFile(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('Could not read that file.'));reader.readAsDataURL(file);});}
async function uploadMedia(file){
 const video=['video/mp4','video/webm'].includes(file.type);
 if(!video&&!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>(video?12:2)*1024*1024)throw Error('Choose an image up to 2 MB or a video up to 12 MB.');
 if(video&&demo)throw Error('Video uploads are available in a vendor workspace.');
 const data=await readFile(file);
 if(demo){
  if(state.images.length>=10)throw Error('The demo is limited to 10 images.');
  const item={id:uid(),name:file.name,url:data,mime:file.type};const next={...state,images:[...state.images,item]};
  try{localStorage.setItem(demoKey,JSON.stringify(next));}catch{throw Error('Demo storage is full. Try a smaller image.');}
  state=next;return data;
 }
 const r=await api('/api/admin/'+state.id+'/images','POST',{name:file.name,data});
 state.images.unshift({...r,mime:file.type});return r.url;
}
function formData(form){const d=Object.fromEntries(new FormData(form));for(const box of form.querySelectorAll('input[type=checkbox]'))d[box.name]=box.checked;return d;}
function download(data,name){const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}
document.addEventListener('submit',async e=>{
 const form=e.target;if(!form.matches('[data-form]'))return;e.preventDefault();const kind=form.dataset.form,data=formData(form),submit=form.querySelector('[type=submit]');if(submit)submit.disabled=true;
 try{
 if(kind==='signup'){
  if(form.dataset.signupStep!=='details'){
   if(!getTemplate(data.template)){form.querySelector('.start-error').textContent='Choose a starting point above, or select Blank canvas.';form.querySelector('input[name=template]')?.focus();return;}
   showSignupStep(form,'details');return;
  }
  for(const field of form.querySelectorAll('[data-signup-pane="details"] input'))if(!field.reportValidity())return;
  await api('/api/signup','POST',data);location.href='/admin';return;
 }
 if(['login','reset'].includes(kind)){await api('/api/'+kind,'POST',data);if(kind==='reset'){toast('Password updated. Please sign in.');location.href='/login';}else location.href=kind==='login'&&new URLSearchParams(location.search).get('next')==='templates'?'/developer?tab=templates':kind==='login'&&new URLSearchParams(location.search).get('next')==='developer'?'/developer':'/admin';return;}
 if(kind==='content'){data.customPages=[...form.querySelectorAll('.custom-page')].map(p=>({title:p.querySelector('[name=pageTitle]').value,content:p.querySelector('[name=pageContent]').value}));delete data.pageTitle;delete data.pageContent;await saveSettings(data);return;}
 if(kind==='shop-feature'){
  await saveShopFeature(form.dataset.key,featureRequest(form.dataset.key,form.dataset.id,data,state.settings.features,uid));return;
 }
 if(kind==='submit-review'){
  const saved=local.get('icss-order-'+store.slug,null);
  const token=form.dataset.id===saved?.id?saved.token:null;
  if(!token)throw Error('Reopen the private link to your order.');
  await api('/api/orders/'+form.dataset.id+'/review','POST',{token,rating:Number(data.rating),name:data.name,comment:data.comment});
  modal.close();toast('Review submitted for approval.');return;
 }
 if(kind==='vendor-policies'){await saveSettings(data);return;}
 if(kind==='vendor-stock'){
  const quantities=[...form.querySelectorAll('[data-stock-id]')].map(x=>({id:x.dataset.stockId,previous:Number(x.dataset.previous),stock:x.valueAsNumber}));
  if(quantities.some(x=>!Number.isInteger(x.stock)||x.stock<0||x.stock>1000000))throw Error('Enter a whole number from 0 to 1,000,000.');
  if(demo){const p=state.products.find(x=>x.id===form.dataset.id);if(!p)throw Error('Product not found.');if(p.variants.length){for(const v of p.variants)v.stock=quantities.find(q=>q.id===v.id).stock;}else p.stock=quantities[0].stock;saveDemo();}
  else{try{await adminMutation('products/'+form.dataset.id+'/stock','PATCH',{quantities});}catch(error){await refresh();throw error;}}
  modal.close();dashboard();toast('Stock updated.');return;
 }
 if(kind==='settings'){for(const k of ['shippingFee','freeShippingOver'])data[k]=Math.round(Number(data[k])*100);data.taxBps=Math.round(Number(data.taxPercent)*100);delete data.taxPercent;data.categories=data.categories.split(',').map(x=>x.trim()).filter(Boolean);await saveSettings(data);return;}
 if(kind==='product'){
 if(example)return;
 data.gallery=Array.from({length:8},(_,i)=>data['gallery-'+i]).filter(Boolean);
 for(let i=0;i<8;i++)delete data['gallery-'+i];
 data.price=Math.round(Number(data.price)*100);data.stock=Number(data.stock);data.variants=[...form.querySelectorAll('[data-variant-id]')].map(r=>({id:r.dataset.variantId,name:r.querySelector('[data-v-name]').value,price:Math.round(Number(r.querySelector('[data-v-price]').value)*100),stock:Number(r.querySelector('[data-v-stock]').value)}));const pid=form.dataset.id;
 if(!data.name||!Number.isSafeInteger(data.price)||data.price<0||!Number.isSafeInteger(data.stock)||data.stock<0||data.variants.some(v=>!v.name||!Number.isSafeInteger(v.price)||v.price<0||!Number.isSafeInteger(v.stock)||v.stock<0))throw Error('Add a name, valid price and whole-number stock for every option.');
 if(demo){if(pid)state.products=state.products.map(p=>p.id===pid?{...data,id:pid}:p);else state.products.unshift({...data,id:uid()});saveDemo();}else{await adminMutation('products'+(pid?'/'+pid:''),pid?'PUT':'POST',data);}modal.close();toast('Product saved.');if(studio.inStudio())studio.refresh();else dashboard();return;
 }
 if(kind==='gateway'){
 const provider=form.dataset.id;if(demo){state.gateways=state.gateways.filter(g=>(g.provider||g.id)!==provider);state.gateways.push({provider,enabled:true,environment:data.environment||'live',configured:true});saveDemo();}else await adminMutation('gateways/'+provider,'PUT',{...data,enabled:true});modal.close();toast(demo?'Demo method configured. No real credentials were saved.':'Payment method saved.');dashboard();return;
 }
 if(kind==='order'){
 const oid=form.dataset.id;if(demo){const o=state.orders.find(o=>o.id===oid);if(data.state==='fulfilled'&&!o.paid&&!data.markPaid)throw Error('Confirm payment before fulfilment.');if(data.markPaid){if(!data.reference)throw Error('Add a sample transaction reference.');o.paid=true;o.transaction_id='demo:'+data.reference;}if(o.state==='cancelled'&&data.state!=='cancelled')throw Error('Cancelled orders cannot be reopened.');if(data.state==='cancelled'&&o.paid)throw Error('Paid orders need refund reconciliation first.');if(data.state==='cancelled'&&o.state!=='cancelled'){for(const l of o.lines){const p=state.products.find(p=>p.id===l.productId);const target=l.variantId?p?.variants.find(v=>v.id===l.variantId):p;if(target)target.stock+=l.quantity;}}o.state=data.state;saveDemo();}else await adminMutation('orders/'+oid,'PATCH',data);modal.close();toast('Order updated.');dashboard();return;
 }
 if(kind==='retail-search'){navigateRetail('shop',{search:String(data.q||'').trim()});return;}
 if(kind==='add-cart'){
 if(example)return;const p=store.products.find(p=>p.id===form.dataset.id),v=p?.variants.length?p.variants.find(v=>v.id===data.variantId):p,qty=Number(data.quantity);if(!p?.active||!v||!Number.isInteger(qty)||qty<1||qty>99)throw Error('Choose a valid quantity and option.');const c=cart(),l=c.find(l=>l.productId===p.id&&l.variantId===(data.variantId||''));if(qty+(l?.quantity||0)>v.stock)throw Error('There is not enough stock for that quantity.');if(l)l.quantity+=qty;else c.push({productId:p.id,variantId:data.variantId||'',quantity:qty});saveCart(c);renderStore();app.querySelector('.retail-bag')?.focus({preventScroll:true});toast('Added to your bag.');return;
 }
 if(kind==='checkout'){
 if(!data.acceptTerms)throw Error('Please accept the seller policies.');if(!data.name||!data.email||!data.phone||(data.delivery==='shipping'&&!data.address))throw Error('Complete your contact and delivery details.');
 const lines=resolvedCart();let result;
 if(demo){const subtotal=lines.reduce((a,l)=>a+l.price*l.quantity,0),s=store.settings;const shipping=data.delivery==='pickup'||(s.freeShippingOver&&subtotal>=s.freeShippingOver)?0:s.shippingFee,tax=Math.round(subtotal*s.taxBps/10000);for(const l of lines){const p=state.products.find(p=>p.id===l.productId),v=l.variantId?p.variants.find(v=>v.id===l.variantId):p;if(l.quantity>v.stock)throw Error('A sample product has insufficient stock.');}for(const l of lines){const p=state.products.find(p=>p.id===l.productId),v=l.variantId?p.variants.find(v=>v.id===l.variantId):p;v.stock-=l.quantity;}const o={id:uid(),short_id:'DEMO-'+uid().slice(0,6),total:subtotal+tax+shipping,subtotal,tax,shipping,currency:s.currency,customer:{name:data.name,email:data.email,phone:data.phone,address:data.address},lines:lines.map(({product,...l})=>l),gateway:data.gateway,delivery:data.delivery,state:'new',paid:false,created:Date.now()};state.orders.unshift(o);saveDemo();result={order:o};store=state;
 }else{
 const reward=rewardRequest(data),quoteData={lines:resolvedCart().map(({productId,variantId,quantity})=>({productId,variantId,quantity})),delivery:data.delivery,customer:{email:data.email},...reward};
 if((reward.discountCode||reward.loyaltyReward||orderQuote)&&orderQuote?.key!==JSON.stringify(quoteData)){await applyOrderQuote(form);throw Error('The total is updated. Review it and place your order.');}
 const request={customer:{name:data.name,email:data.email,phone:data.phone,address:data.address},lines:resolvedCart().map(({productId,variantId,quantity})=>({productId,variantId,quantity})),gateway:data.gateway,delivery:data.delivery,acceptTerms:true,...reward,...(orderQuote?{expectedTotal:orderQuote.total}:{})};
 const requestKey=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(request)))),b=>b.toString(16).padStart(2,'0')).join(''),old=local.get('icss-checkout-'+store.slug,null);const pending=old?.requestKey===requestKey?old:{requestKey,idempotency:uid(),orderToken:uid()+uid()};local.set('icss-checkout-'+store.slug,pending);
 try{result=await api('/api/stores/'+store.slug+'/orders','POST',{...request,idempotency:pending.idempotency,orderToken:pending.orderToken});}catch(error){if(error.message==='The order total changed. Review the updated total before placing your order.')await applyOrderQuote(form);throw error;}local.set('icss-order-'+store.slug,{id:result.order.id,token:result.token});local.remove('icss-checkout-'+store.slug);
 }
 saveCart([]);modal.close();renderStore();showOrderReceipt(result.order);return;
 }
 if(kind==='claim-test'){
   if(data.password!==data.confirm)throw Error('Passwords do not match.');
   const invite=new URLSearchParams(location.hash.slice(1)).get('invite');
   const r=await api('/api/test-access','POST',{invite,password:data.password});
   history.replaceState(null,'','/test-access');
   form.closest('main').innerHTML=`<h1>Your test account is ready.</h1><p>Save this test email and the password you just chose. The account lasts 14 days.</p><p><strong>${esc(r.email)}</strong></p><a class="btn" href="/admin">Open test workspace →</a>`;return;
 }
 if(kind==='vendor-support'){
   const r=await api('/api/operator/vendors/'+form.dataset.id+'/access','POST',{reason:data.reason});
   sessionStorage.setItem('plaza-vendor-access-'+form.dataset.id,r.id);
   location.href='/developer/vendors/'+form.dataset.id;return;
 }
 if(kind==='consultation'){
   const r=await api('/api/consultations','POST',data);const panel=form.closest('.panel');panel.innerHTML=`<span class="tag">Request received</span><h2>Thanks for reaching out.</h2><p>We’ll follow up using the contact details you provided. Your appointment is not confirmed yet.</p><p>Reference: <strong>${esc(r.reference)}</strong></p><a class="btn outline" href="/">Back to ICSS Plaza</a>`;return;
 }
 if(kind==='consultation-update'){await api('/api/operator/consultations/'+form.dataset.id,'PATCH',{...data,updated:Number(form.dataset.updated)});modal.close();await operatorPage();toast('Consultation saved.');return;}
 if(kind==='paypal-settings'){await api('/api/operator/billing/paypal-settings','POST',data);form.reset();modal.close();await operatorPage();toast('PayPal credentials verified and saved.');return;}
 if(kind==='paypal-setup'){const result=await api('/api/operator/billing/paypal-setup','POST',{});modal.close();await operatorPage();toast(result.enabled?'PayPal is ready for monthly subscriptions.':'PayPal verified. The monthly plan is retired.');return;}
 if(kind==='rental-plan'){const amount=Math.round(Number(data.amount)*100);await api('/api/operator/billing','POST',{...data,amount});modal.close();await operatorPage();toast('Rental plan created.');return;}
 if(kind==='cancel-rental'){const path=form.dataset.operator==='true'?'/api/operator/billing/rentals/'+form.dataset.id+'/cancel':'/api/admin/'+state.id+'/billing/'+form.dataset.id+'/cancel';await api(path,'POST',{});modal.close();if(form.dataset.operator==='true')await operatorPage();else await refreshBilling();toast('Automatic renewal cancelled.');return;}
 if(kind==='vendor-report'){
   const files=[...form.elements.evidence.files];if(files.length>2||files.some(f=>f.size>1024*1024))throw Error('Attach up to two images, 1 MB each.');
   let slug=String(data.slug||'').trim();if(slug.includes('/')){const parts=slug.match(/\/s\/([a-z0-9-]+)\/?(?:[?#].*)?$/i);if(!parts)throw Error('Enter a Plaza storefront URL or store address.');slug=parts[1];}
   const evidence=await Promise.all(files.map(async file=>({name:file.name,data:await readFile(file)})));
   const r=await api('/api/reports','POST',{...data,slug,evidence});form.reset();
   reportAccess={id:r.id,accessKey:r.accessKey};
   const result=document.querySelector('#report-result');result.innerHTML=reportReceipt(r);document.querySelector('[data-form="report-lookup"]').elements.reference.value=r.id;result.focus();return;
 }
 if(kind==='report-lookup'){
   const id=data.reference.trim().toLowerCase(),accessKey=data.accessKey.trim().toLowerCase();
   if(!/^[a-f0-9]{24}$/.test(id)||!/^[a-f0-9]{64}$/.test(accessKey))throw Error('Check the report reference and access key.');
   const r=await api('/api/reports/'+id+'/lookup','POST',{accessKey});reportAccess={id,accessKey};form.elements.accessKey.value='';
   const result=document.querySelector('#report-result');result.innerHTML=reportCase(r,'customer');result.focus();return;
 }
 if(kind==='customer-case-reply'){
   if(reportAccess?.id!==form.dataset.id)throw Error('Look up your report again.');
   const r=await api('/api/reports/'+reportAccess.id+'/reply','POST',{accessKey:reportAccess.accessKey,message:data.message,review:form.dataset.review==='true'});
   const result=document.querySelector('#report-result');result.innerHTML=reportCase(r,'customer');result.focus();toast('Case update recorded.');return;
 }
 if(kind==='vendor-case-reply'){
   const r=await api('/api/vendor/reports/'+form.dataset.id,'POST',{message:data.message,review:form.dataset.review==='true'});
   modal.close();showModal(reportCase(r,'vendor'));await refreshVendorCases();toast('Case update recorded.');return;
 }
 if(kind==='support-email-reply'){await api('/api/operator/mail/'+form.dataset.id+'/reply','POST',{message:data.message,requestId:form.dataset.requestId});form.reset();form.dataset.requestId=uid();toast('Reply queued through Resend.');return;}
 if(kind==='operator-case'){
   const r=await api('/api/operator/reports/'+form.dataset.id,'PATCH',{...data,version:Number(form.dataset.version)});
   modal.close();await operatorPage();showModal(operatorCase(r));toast('Investigation updated.');return;
 }
 if(kind==='publish-vendor'){
   if(!data.vendorAcknowledgement)throw Error('Confirm the independent vendor agreement before publishing.');
   await saveSettings({published:true,vendorAcknowledgement:true});modal.close();return;
 }
 if(kind==='rental'){await api('/api/operator/'+form.dataset.id,'PATCH',data);modal.close();await operatorPage();toast('Rental status updated.');return;}
 if(kind==='password'){if(data.password!==data.confirm)throw Error('New passwords do not match.');await api('/api/password','POST',data);session=await api('/api/session');modal.close();toast('Password changed. Other sessions were signed out.');return;}
 if(kind==='request'){
 if(!data.confirm)throw Error('Please confirm your request.');await adminMutation('requests','POST',{kind:form.dataset.kind,note:data.note});modal.close();toast('Your request was recorded.');dashboard();return;
 }
 }catch(error){const box=(kind==='signup'?form.querySelector('.start-account .form-error'):null)||form.querySelector('.form-error');if(box){box.className='form-error error';box.textContent=error.message;}else toast(error.message);}finally{if(submit)submit.disabled=false;}
});
function showOrderReceipt(o){showModal(`${o.paid?illustration('payment-success'):''}<h2>${demo?'Sample order placed':'Order received'}</h2><p>Reference: <strong>${esc(o.short_id||o.id)}</strong></p><div class="note ${o.paid?'':'warn'}">${o.paid?'Payment confirmed.':demo?'Demo order saved. View it under Orders in the demo dashboard. No payment was taken.':'Your order is recorded. Payment is pending verification. Keep this order reference.'}</div><p>Total: ${money(o.total,o.currency)}${o.discount?' · Discount '+money(o.discount,o.currency):''}</p>${!demo&&o.paid&&o.state==='fulfilled'?(o.review?'<p>Your review has been submitted.</p>':`<details><summary>Write a verified review</summary><form data-form="submit-review" data-id="${esc(o.id)}">${select('Rating','rating','5',[['5','5 stars'],['4','4 stars'],['3','3 stars'],['2','2 stars'],['1','1 star']])}${field('Display name (optional)','name')}${area('Your review','comment')}<div class="form-error"></div><button class="btn sm" type="submit">Submit review</button></form></details>`):''}${!demo?`<p>Seller: <strong>${esc(o.seller?.name||store.settings.name)}</strong>. ${(o.seller?.email||store.settings.contactEmail)?`<a href="mailto:${esc(o.seller?.email||store.settings.contactEmail)}">Contact seller</a> · `:''}<a href="${esc(reportLink(o.slug||store.slug,o.short_id||''))}">Report this vendor</a></p>`:''}${o.policySnapshot?`<details><summary>Seller policies at the time of order</summary>${[['terms','Sales terms'],['shipping','Delivery'],['returns','Returns and refunds'],['privacy','Privacy notice']].map(([k,label])=>`<h3>${label}</h3><p class="preline">${esc(o.policySnapshot[k])}</p>`).join('')}</details>`:''}${o.payment?.instructions?`<p class="preline">${esc(o.payment.instructions)}</p>`:''}${o.payment?.url?`<a class="btn" href="${esc(o.payment.url)}" rel="noreferrer">Continue to payment provider ↗</a>`:''}${o.paymentError?`<p>${esc(o.paymentError)}</p>`:''}${!demo?(!o.paid&&!o.payment?.url&&o.state!=='cancelled'?button('Retry payment setup','retry-payment','outline sm'):'')+button('Refresh payment status','order-status','outline sm'):`<a class="btn outline" href="/demo?tab=orders">View demo orders →</a>`}`);}
function publishDialog(){const selling=sellsOnline({...state.settings,...state.settings.designDraft});showModal(`<h2>${selling?'Publish as an independent vendor':'Publish your website'}</h2><p>${selling?'Your business is responsible for sales, fulfilment, returns and refunds. Your store policies must be accurate.':'Your pages and public contact details will be visible once you publish.'}</p><form data-form="publish-vendor"><label class="field check"><input name="vendorAcknowledgement" type="checkbox" required><span>I agree to the <a href="/legal/vendor-agreement" target="_blank" rel="noopener">independent vendor agreement</a> and confirm that my ${selling?'store':'website'} details and policies are current.</span></label><div class="form-error" role="alert"></div><button class="btn" type="submit">Publish ${selling?'store':'website'}</button></form>`);}
document.addEventListener('click',async e=>{
 const el=e.target.closest('[data-action],[data-tab]');if(!el)return;
 try{
 if(el.dataset.tab){goVendorTab(el.dataset.tab);return;}

 const action=el.dataset.action,pid=el.dataset.id;
 if(action==='signup-back'){showSignupStep(el.closest('form'),'design');return;}
 if(action==='copy-store'&&state?.settings.published&&!support&&!demo){
  const url=location.origin+'/s/'+state.slug;
  try{await navigator.clipboard.writeText(url);toast('Store link copied.');}
  catch{showModal(`<h2>Share your storefront</h2><label class="field">Store link<input value="${esc(url)}" readonly></label><a class="btn" href="https://wa.me/?text=${encodeURIComponent(url)}" target="_blank" rel="noopener">Share on WhatsApp ↗</a>`);}
  return;
 }

 if(action==='shop-feature'){openShopFeature(pid);return;}
 if(action==='quiz-add'){const row=modal.querySelector('.quiz-rule[hidden]');if(row){row.hidden=false;row.querySelector('input')?.focus();}return;}
 if(action==='shop-feature-remove'){
  const list=state.settings.features?.[tab]||[];
  if(window.confirm(tab==='journal'?'Remove this article?':'Remove this discount code?'))await saveShopFeature(tab,list.filter(x=>(x.id||x.code)!==pid));
  return;
 }
 if(action==='review-hidden'||action==='review-published'){
  const status=action.slice(7);
  if(demo){const o=state.orders.find(x=>x.id===pid);if(o?.review)o.review.status=status;saveDemo();dashboard();}
  else{await api('/api/admin/'+state.id+'/features/reviews/'+pid,'PUT',{status});await refreshShopReviews();}
  return;
 }
 if(action==='feature-email-preview'){
  const data=formData(el.closest('form')),target=modal.querySelector('#email-template-preview');
  if(demo){target.textContent=[data.subject||'Default Plaza subject',data.message||'Default Plaza message'].join(' — ');}
  else{
   const d=await api('/api/admin/'+state.id+'/features/email-preview','POST',{kind:pid,value:{subject:data.subject,message:data.message}});
   target.innerHTML='<strong>'+esc(d.subject)+'</strong><iframe title="Customer email preview" sandbox></iframe>';target.querySelector('iframe').srcdoc=d.html;
  }
  return;
 }
 if(action==='order-quote'){
  const form=el.closest('form');el.disabled=true;
  try{await applyOrderQuote(form);form.querySelector('.form-error').textContent='';}catch(error){form.querySelector('.form-error').textContent=error.message;}
  finally{el.disabled=false;}return;
 }
 if(action==='vendor-menu'){const open=el.getAttribute('aria-expanded')!=='true';el.setAttribute('aria-expanded',String(open));el.closest('.vendor-sidebar').classList.toggle('menu-open',open);return;}
 if(action==='vendor-stock'){stockDialog(pid);return;}
 if(action==='developer-tab'){
   const next=developerTab(pid);
   if(next)await operatorPage(next,true);
   return;
 }

 if(action==='vendor-support'){const vendor=devData.vendors.find(t=>t.id===pid);if(!vendor)return;showModal(`<h2>Open ${esc(vendor.settings.name)}</h2><p>${vendor.test?'Practice editing this test store.':'Use this for a vendor’s support request. Edits go to the real store.'} Changes are recorded under your name. This session expires in 30 minutes.</p><form data-form="vendor-support" data-id="${esc(pid)}"><label class="field">Reason or support ticket<textarea name="reason" minlength="10" maxlength="300" required placeholder="${vendor.test?'What are you testing?':'What did the vendor ask you to change?'}"></textarea></label><div class="form-error" role="alert"></div><button type="submit" class="btn">Open vendor workspace →</button></form>`);return;}
 if(action==='vendor-support-end'&&support){if(!studio.mayExit())return;try{await api('/api/operator/vendors/'+support.tenant+'/access','DELETE',{});}finally{sessionStorage.removeItem('plaza-vendor-access-'+support.tenant);location.href='/developer?tab=vendors';}return;}
 if(action==='open-consultation'){const r=devData.consultations.requests.find(x=>x.id===pid);if(r)showModal(consultantDialog(r,devData.overview.configured));return;}
 if(action==='paypal-settings'){
  const data=devData?.billing;if(!data?.canManagePayPal)return;
  const stored=data.paypalSetup.hasClientId;
  showModal(`<h2>PayPal settings</h2><p>Copy the credentials from your ICSS Plaza app in PayPal’s <strong>Live</strong> mode. Plaza will verify and encrypt them. The saved secret is never shown.</p>
  <form data-form="paypal-settings" autocomplete="off">
   <label class="field">Live Client ID ${stored?'(optional)':''}<input name="clientId" type="text" autocomplete="off" autocapitalize="none" spellcheck="false" maxlength="256" ${stored?'placeholder="Leave blank to keep the current ID"':'required'}></label>
   <label class="field">Live client secret<input name="secret" type="password" autocomplete="off" autocapitalize="none" spellcheck="false" maxlength="256" required></label>
   <label class="field">Current ICSS Plaza password<input name="currentPassword" type="password" autocomplete="current-password" maxlength="128" required></label>
   <div class="form-error" role="alert"></div><button type="submit" class="btn">Save and verify</button>
  </form>`);return;
 }
 if(action==='paypal-setup'){showModal(`<h2>Connect live PayPal subscriptions</h2><p>Verify the existing PayPal plan, connect payment notifications, and make the US$31.39 monthly rental available to vendors. This setup does not create a customer subscription or charge anyone.</p><form data-form="paypal-setup"><div class="form-error" role="alert"></div><button type="submit" class="btn">Verify and connect PayPal</button></form>`);return;}
 if(action==='new-plan'){showModal(`<h2>New monthly rental plan</h2><p>Choose a price and currency. A PayPal plan ID is optional and must match the same USD price.</p><form data-form="rental-plan">${field('Plan name','name')}<label class="field">Monthly price<input name="amount" type="number" min="0.01" step="0.01" required></label>${select('Currency','currency','JMD',[['JMD','JMD'],['USD','USD']])}${field('PayPal plan ID (optional)','paypalPlan')}<div class="form-error"></div><button type="submit" class="btn">Create plan</button></form>`);return;}
 if(action==='plan-toggle'){const p=devData.billing.plans.find(x=>x.id===pid);await api('/api/operator/billing/plans/'+pid,'PATCH',{enabled:!p.enabled});await operatorPage();return;}
 if(action==='start-fygaro'||action==='start-paypal'){el.disabled=true;try{const r=await api('/api/admin/'+state.id+'/billing/checkout','POST',{provider:action.slice(6),plan:pid});location.href=r.url;}finally{el.disabled=false;}return;}
 if(action==='cancel-paypal'||action==='operator-cancel-rental'){showModal(`<h2>Cancel automatic renewal?</h2><p>This stops future PayPal renewals. It does not issue a refund. The verified paid period remains on the rental.</p><form data-form="cancel-rental" data-id="${esc(pid)}" data-operator="${action==='operator-cancel-rental'}"><div class="form-error"></div><button type="submit" class="btn danger">Cancel automatic renewal</button></form>`);return;}
 if(action==='tenant-detail'){const r=await api('/api/operator/stores/'+pid);showModal(`<h2>${esc(r.name)}</h2><p>/s/${esc(r.slug)} · ${esc(r.status)}</p><p>Public access: ${r.accessible&&r.published?'Enabled':'Off'} · Restriction: ${esc(r.restriction||'None')}</p><p>Products: ${r.products} · Orders: ${r.orders} · Images: ${r.images} · Reports: ${r.vendor_reports}</p>`);return;}
 if(action==='create-test-account'||action==='generate-test-login'){el.disabled=true;try{const r=await api(action==='generate-test-login'?'/api/operator/vendors/test-login':'/api/operator/test-account','POST',{});showTestLogin(r);}finally{el.disabled=false;}return;}
 if(action==='close'){modal.close();return;}
 if(action==='logout'){await api('/api/logout','POST',{});location.href='/';return;}
 if(action==='reset-demo'){showModal('<h2>Reset your demo?</h2><p>This clears your sample products, settings, orders and uploaded images in this browser.</p>'+button('Reset demo','confirm-reset'));return;}
 if(action==='confirm-reset'){local.remove(demoKey);local.remove('icss-cart-demo');loadDemo();saveDemo();modal.close();dashboard();toast('Demo reset.');return;}
 if(action==='preview'){previewStore();return;}
 if(action==='studio-open'){tab='appearance';if(!demo)history.replaceState(null,'',location.pathname+'?tab=appearance');dashboard();return;}
 if(action==='add-product'||action==='edit-product'){editProduct(pid);return;}
 if(action==='add-page'){const list=modal.open?modal.querySelector('#custom-pages'):document.querySelector('#custom-pages');if(list.children.length>=10)throw Error('Add up to 10 pages.');list.insertAdjacentHTML('beforeend',customPageFields());return;}
 if(action==='remove-page'){el.closest('.custom-page').remove();return;}
 if(action==='add-variant'){modal.querySelector('.variants').insertAdjacentHTML('beforeend',variantRow());return;}
 if(action==='remove-variant'){el.closest('.variant-row').remove();return;}
 if(action==='delete-product'){showModal(`<h2>Delete this product?</h2><p>It will be removed from your catalogue. Existing order records keep their item details.</p>${button('Delete product','confirm-delete-product','danger',`data-id="${esc(pid)}"`)}`);return;}
 if(action==='confirm-delete-product'){if(demo){state.products=state.products.filter(p=>p.id!==pid);saveDemo();}else await adminMutation('products/'+pid,'DELETE');modal.close();dashboard();toast('Product deleted.');return;}
 if(action==='gateway'){gatewayDialog(pid);return;}
 if(action==='disable-gateway'){if(state.settings.defaultPayment===pid&&state.settings.published)throw Error('Choose another default method in Store settings first.');if(demo){state.gateways=state.gateways.map(g=>(g.provider||g.id)===pid?{...g,enabled:false}:g);saveDemo();}else await adminMutation('gateways/'+pid,'PUT',{enabled:false});modal.close();dashboard();toast('Payment method disabled.');return;}
 if(action==='delete-image'){
 const image=state.images.find(i=>i.id===pid),url=image?.url||'/api/images/'+pid;if(JSON.stringify(state.settings).includes(url)||state.products.some(p=>(p.image===url||p.video===url||p.gallery?.includes(url))))throw Error('Replace this image where it is used before deleting.');
 if(demo){state.images=state.images.filter(i=>i.id!==pid);saveDemo();}else await adminMutation('images/'+pid,'DELETE');dashboard();toast('Image deleted.');return;
 }
 if(action==='publish'){publishDialog();return;}
 if(action==='unpublish'){await saveSettings({published:false});return;}
 if(action==='report-filter'||action==='report-page'){if(action==='report-filter'){reportFilter=pid;reportPage=1;}else reportPage=Number(pid);await operatorPage();document.querySelector('#vendor-case-queue')?.scrollIntoView();return;}
 if(action==='open-report'){showModal(operatorCase(await api('/api/operator/reports/'+pid)));return;}
 if(action==='open-vendor-case'){showModal(reportCase(await api('/api/vendor/reports/'+pid),'vendor'));return;}
 if(action==='copy-report'){if(!reportAccess)throw Error('No report receipt is open.');await navigator.clipboard.writeText('Report reference: '+reportAccess.id+'\nPrivate access key: '+reportAccess.accessKey);toast('Private tracking details copied.');return;}
 if(action==='export'){if(demo)download(state,'icss-plaza-demo-export.json');else{const d=await api('/api/admin/'+state.id+'/export');download(d,state.slug+'-export.json');}return;}
 if(action==='password'){showModal(`<h2>Change your password</h2><form data-form="password">${field('Current password','currentPassword','','password')}${field('New password (at least 12 characters)','password','','password')}${field('Confirm new password','confirm','','password')}<div class="form-error"></div><button class="btn" type="submit">Change password</button></form>`);return;}
 if(action==='cancel-store'||action==='delete-account'){const cancel=action==='cancel-store';showModal(`<h2>${cancel?'Cancel your rental?':'Request account deletion?'}</h2><p>${cancel?'This immediately takes your store offline. Export your records first. Customer orders, refunds and outstanding rental billing must be resolved separately.':'This records a deletion request for the operator to review. It does not immediately erase records that may be subject to legal retention requirements.'}</p><form data-form="request" data-kind="${cancel?'cancellation':'deletion'}">${area('Notes for support','note')}${check('I understand and confirm this request','confirm',false)}<div class="form-error"></div><button class="btn danger" type="submit">${cancel?'Cancel and take store offline':'Record deletion request'}</button></form>`);return;}
 if(action==='order'){orderDialog(pid);return;}

 if(action==='product-photo'){const photo=el.closest('.product-showcase')?.querySelector(':scope > img');if(photo)photo.src=el.dataset.image;return;}

 if(action==='remove-cart'){const line=resolvedCart()[Number(el.dataset.index)];if(line)saveCart(cart().filter(x=>x.productId!==line.productId||x.variantId!==line.variantId));if(modal.open)modal.close();renderStore();return;}
 if(action==='checkout'){if(modal.open)modal.close();checkoutDialog();return;}
 if(action==='checkout-policy'){const titles={terms:'Sales terms',shipping:'Delivery policy',returns:'Returns policy',privacy:'Privacy notice'};const form=modal.querySelector('form');let box=modal.querySelector('.checkout-policy-view');if(!box){box=document.createElement('section');box.className='checkout-policy-view note preline';form.prepend(box);}box.innerHTML=`<strong>${titles[pid]}</strong><br>${esc(store.settings[pid])}`;box.scrollIntoView({block:'nearest'});return;}

 if(action==='retry-payment'){const saved=local.get('icss-order-'+store.slug,null);if(!saved)throw Error('No saved order reference.');const r=await api('/api/orders/'+saved.id+'/payment','POST',{token:saved.token});modal.close();showOrderReceipt(r.order);return;}
 if(action==='order-status'){const saved=local.get('icss-order-'+store.slug,null);if(!saved)throw Error('No saved order reference in this browser.');const r=await api('/api/orders/'+saved.id+'/lookup','POST',{token:saved.token});modal.close();showOrderReceipt(r.order);return;}
 if(action==='open-mail'){const d=await api('/api/operator/mail');showModal(`<h2>ICSS Plaza email</h2><p>Sending: ${d.configured?'Configured':'Needs setup'} · Receiving: ${d.inboundConfigured?'Configured':'Needs setup'}</p><p>${Object.entries(d.counts).map(([k,v])=>esc(k)+': '+esc(v)).join(' · ')||'No outgoing messages recorded.'}</p><h3>Latest replies</h3>${d.messages.map(m=>`<details><summary>${esc(m.subject||'No subject')} · ${esc(m.from)}</summary><p class="small">${esc(new Date(m.created).toLocaleString())}${m.attachments?' · Attachments are available in Resend.':''}</p><p class="preline">${esc(m.text||'No plain text is available. Open this message in Resend.')}</p>${d.configured?`<form data-form="support-email-reply" data-id="${esc(m.id)}" data-request-id="${uid()}"><label class="field">Reply<textarea name="message" required minlength="10" maxlength="5000"></textarea></label><div class="form-error" role="alert"></div><button class="btn outline sm" type="submit">Send branded reply</button></form>`:''}</details>`).join('')||'<p>No incoming messages yet.</p>'}`);return;}
 if(action==='rental'){showModal(`<h2>Manage store rental</h2><p>Paid activation is a manual operator action after a written rental agreement.</p><form data-form="rental" data-id="${esc(pid)}">${select('Rental status','status','active',['active','trial','suspended','cancelled'].map(x=>[x,x]))}<div class="form-error"></div><button class="btn" type="submit">Update rental status</button></form>`);return;}
 if(action==='issue-reset'){const r=await api('/api/operator/'+pid+'/reset','POST',{});if(r.queued){toast('Password reset email queued.');return;}showModal(`<h2>One-time access reset</h2><p>Verify the merchant’s identity before providing this token. It expires in 60 minutes. Direct them to /reset.</p><label class="field">Reset token<input readonly value="${esc(r.token)}"></label>`);return;}
 }catch(error){toast(error.message);}
});
document.addEventListener('input',e=>{
 const input=e.target;
 if(!input.matches('[data-form="signup"] input'))return;
 if(input.name==='slug'){input.dataset.edited='true';return;}
 if(input.name==='name'){
  const slug=input.closest('form').elements.slug;
  if(!slug.dataset.edited)slug.value=suggestStoreSlug(input.value);
 }
});
document.addEventListener('input',e=>{
 if(e.target.matches('[data-vendor-filter]'))updateVendorFilter(e.target.closest('.vendor-panel'));
 if(e.target.id==='developer-store-search'){const query=e.target.value.toLowerCase();for(const row of e.target.closest('.panel').querySelectorAll('tbody tr'))row.hidden=!row.textContent.toLowerCase().includes(query);}
 if(e.target.closest('#mini-editor')){const d=formData(e.target.closest('form')),s=demoStore().settings;document.querySelector('#mini-preview').innerHTML=mini({...s,...d});}
});
document.addEventListener('change',async e=>{
 try{
 if(e.target.matches('[data-form="signup"] input[name=template]')){const form=e.target.closest('form');updateSignupSelection(form,e.target.value);form.querySelector('.start-error').textContent='';return;}

 if(e.target.matches('[data-vendor-status]')){updateVendorFilter(e.target.closest('.vendor-panel'));return;}
 if(e.target.matches('[data-sort]')){navigateRetail('shop',{...retailRoute,sort:e.target.value,offset:0});}
 if(e.target.matches('[data-cart-quantity]')){const c=cart(),index=Number(e.target.dataset.cartQuantity),qty=Number(e.target.value),line=resolvedCart()[index];if(!Number.isInteger(qty)||qty<1||qty>99||qty>line.stock)throw Error('Choose a whole quantity within available stock.');const item=c.find(x=>x.productId===line.productId&&x.variantId===line.variantId);if(item)item.quantity=qty;saveCart(c);renderStore();}
 if(e.target.name==='delivery'&&e.target.closest('[data-form=checkout]')&&orderQuote){try{await applyOrderQuote(e.target.closest('form'));}catch(error){toast(error.message);}return;}
 if(e.target.name==='delivery'&&e.target.closest('[data-form=checkout]')){const total=modal.querySelector('#checkout-total');const shipping=e.target.value==='pickup'?0:Number(total.dataset.shipping);modal.querySelector('#shipping-total').textContent=money(shipping,store.settings.currency);total.textContent=money(Number(total.dataset.subtotal)+shipping,store.settings.currency);}
 if(e.target.matches('[data-product-upload]')){
  const input=e.target,file=input.files[0];if(!file)return;const form=input.closest('form'),name=input.dataset.productUpload;
  input.disabled=true;try{const url=await uploadMedia(file);if(!form.isConnected)return;const select=form.elements[name];select.add(new Option(file.name,url,true,true));toast('Media added. Save the product to attach it.');}finally{input.disabled=false;}
 }
 if(e.target.matches('[data-upload]')){
 const file=e.target.files[0];if(!file)return;
 e.target.disabled=true;try{await uploadMedia(file);toast('Media uploaded. Choose it in your Store Designer or products.');dashboard();}finally{e.target.disabled=false;}
 }
 }catch(error){toast(error.message);}
});
async function boot(){
 const path=location.pathname.replace(/\/$/,'')||'/';
 if(path==='/'){app.innerHTML=landing();return;}
 const guide=marketingPage(path);if(guide){app.innerHTML=guide;return;}
 if(path==='/test-access'){session=await api('/api/session');document.title='Plaza test access';app.innerHTML=`<main class="auth">${logo()}<h1>Open your test workspace.</h1><p>Use a private browser window to keep your live account signed in separately.</p><form data-form="claim-test">${field('Choose a password (12 or more characters)','password','','password')}${field('Confirm password','confirm','','password')}<div class="form-error" role="alert"></div><button type="submit" class="btn">Create my test account</button></form></main>`;return;}
 if(path.startsWith('/templates/')){const t=templatePage(path.split('/')[2]);if(!t){errorPage(Error('Template not found.'));return;}store=t.store;example=true;retailRoute=pathInStore(path,location.search);renderStore();return;}
 if(path==='/consultation'){session=await api('/api/session');app.innerHTML=nav()+consultationPage()+footer();return;}
 const vendorWorkspace=path.match(/^\/developer\/vendors\/([a-f0-9]{24})$/);
 if(vendorWorkspace){
  session=await api('/api/session');
  if(!session.operator){location.href='/developer';return;}
  const tenant=vendorWorkspace[1],id=sessionStorage.getItem('plaza-vendor-access-'+tenant);
  if(!id){location.href='/developer?tab=vendors';return;}
  support={id,tenant};
  catalog=await api('/api/catalog');
  try{await refresh();}catch{sessionStorage.removeItem('plaza-vendor-access-'+tenant);location.href='/developer?tab=vendors';return;}
  support={...support,...state.support};
  setTimeout(()=>{sessionStorage.removeItem('plaza-vendor-access-'+tenant);location.replace('/developer?tab=vendors');},Math.max(0,support.expires-Date.now()));
  const params=new URLSearchParams(location.search);tab=workspaceTab(params.get('tab'),workspaceMode());document.title='Vendor workspace | ICSS Plaza';if(tab==='appearance'&&params.get('view')==='preview')studio.open(true);else dashboard();return;
 }
 if(['/developer','/operator'].includes(path)){devTab=developerTab(new URLSearchParams(location.search).get('tab'))||'overview';session=await api('/api/session');document.title='Developer console | ICSS Plaza';await operatorPage();return;}
 if(path.startsWith('/legal')){legal();return;}
 if(path==='/report'){session=await api('/api/session');document.title='Report a vendor | ICSS Plaza';app.innerHTML=publicReportPage({nav,footer,query:new URLSearchParams(location.search)});return;}
 catalog=await api('/api/catalog');
 if(['/login','/signup','/reset'].includes(path)){session=await api('/api/session');authPage(path.slice(1));return;}
 if(path==='/demo'){
 demo=true;loadDemo();const params=new URLSearchParams(location.search);tab=workspaceTab(params.get('tab'),workspaceMode());if(params.get('view')==='store'){store=state;retailRoute=pathInStore(path,location.search);renderStore();}else dashboard();return;
 }
 if(path.startsWith('/s/')){
 session=await api('/api/session');
 const slug=path.split('/')[2],saved=local.get('icss-order-'+slug,null),fragment=new URLSearchParams(location.hash?.slice(1)||'');
 const orderId=fragment.get('order'),orderKey=fragment.get('key');
 let emailedOrder;
 if(/^[a-f0-9]{24}$/.test(orderId||'')&&/^[a-f0-9]{32,100}$/.test(orderKey||'')){
   try{const r=await api('/api/orders/'+orderId+'/lookup','POST',{token:orderKey});if(r.order.slug!==slug)throw Error('Order not found.');emailedOrder=r.order;local.set('icss-order-'+slug,{id:orderId,token:orderKey});history.replaceState(null,'',location.pathname+location.search);}catch(error){toast(error.message);}
 }
 let d;try{d=await api('/api/stores/'+slug);}catch(e){errorPage(e);app.querySelector('.error-page')?.insertAdjacentHTML('beforeend',`<p><a href="${esc(reportLink(slug))}">Report this vendor</a> · <a href="/legal/shopping">Shopping help</a></p>`);if(saved||emailedOrder){store={slug,settings:{name:slug}};app.querySelector('.error-page')?.insertAdjacentHTML('beforeend',button('View my last order','order-status','outline'));if(emailedOrder)showOrderReceipt(emailedOrder);}return;}store=d;retailRoute=pathInStore(path,location.search);renderStore();if(emailedOrder){showOrderReceipt(emailedOrder);return;}if(saved&&new URLSearchParams(location.search).has('payment')){try{const r=await api('/api/orders/'+saved.id+'/lookup','POST',{token:saved.token});showOrderReceipt(r.order);}catch(error){toast(error.message);}}return;
 }
 session=await api('/api/session');if(!session.user){location.href='/login';return;}
 if(path==='/admin'){
 if(!session.tenants.length){if(session.operator){location.href='/developer';return;}throw Error('No store is connected to this account. Contact support.');}
 state=session.tenants[0];await refresh();const requested=new URLSearchParams(location.search).get('tab');tab=workspaceTab(requested,workspaceMode());if(tab==='appearance'&&new URLSearchParams(location.search).get('view')==='preview')studio.open(true);else dashboard();return;
 }
 throw Error('Page not found.');
}
window.addEventListener('popstate',()=>{if(store&&(example||location.pathname.startsWith('/s/')||demo&&new URLSearchParams(location.search).get('view')==='store')){retailRoute=pathInStore(location.pathname,location.search);renderStore();}else if(demo&&store)location.reload();});
boot().catch(errorPage);

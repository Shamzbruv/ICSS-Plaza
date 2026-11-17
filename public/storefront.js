import {classicSections,sectionTypes,getTemplate,sellsOnline} from './store-templates.js?v=plaza-careers-1';
import {storefrontExtras} from './vendor-features.js?v=retail-1';
import {policyLabels,retailURL} from './retail-route.js?v=retail-1';

export const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const templateToolbar=t=>`<div class="example-toolbar"><a href="/online-store-templates">← All templates</a><strong>${esc(t.label)} · Template preview</strong><a class="btn sm" href="/signup?template=${esc(t.id)}">Use this design →</a></div>`;
export const formatMoney=(amount,currency='JMD')=>(currency==='JMD'?'J$':'US$')+new Intl.NumberFormat('en-JM',{minimumFractionDigits:2,maximumFractionDigits:2}).format(amount/100);
export const getSections=s=>s.sections??classicSections.map(x=>({...x,hidden:x.type==='hero'?!s.showHero:x.type==='about'?!s.showAbout:false}));
export const sectionPage=s=>s.page|| (s.type==='catalog'?'shop':s.type==='about'?'about':'home');
const styles=s=>['accent','background','ink'].map((k,i)=>['--accent','--bg','--ink'][i]+':'+(/^#[a-f0-9]{6}$/i.test(s[k])?s[k]:['#805323','#faf5ea','#292319'][i])).join(';');
const allow=(value,valid,fallback)=>valid.includes(value)?value:fallback;
export const image=(url,alt='',extra='')=>`<img src="${esc(url)}" alt="${esc(alt)}" ${extra}>`;
const icons={search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>',bag:'<path d="M5 8h14l2 13H3zM8 9V6a4 4 0 0 1 8 0v3"/>',box:'<path d="m12 3 9 5v8l-9 5-9-5V8zM3 8l9 5 9-5m-9 5v8"/>',truck:'<path d="M2 5h13v12H2zm13 5h4l3 4v3h-7"/><circle cx="7" cy="18" r="2"/><circle cx="18" cy="18" r="2"/>'};
const careerMarks={
 'driving-lessons':'<circle cx="12" cy="12" r="9"/><path d="M3.5 10h17m-15 0 4 4h5l4-4m-6 4v7"/>',
 'pastor-ministry':'<path d="M5 21V11l7-8 7 8v10zM12 7v8M9 11h6"/>',
 'catering':'<path d="M4 17a8 8 0 0 1 16 0M2 19h20M12 7v2"/>',
 'photography':'<path d="M3 7h5l2-3h4l2 3h5v13H3z"/><circle cx="12" cy="13" r="3.5"/>',
 'tutoring':'<path d="M12 6c-4-3-8-2-9-1v14c3-1 6-1 9 1 3-2 6-2 9-1V5c-1-1-5-2-9 1zm0 0v14"/>',
 'home-services':'<path d="m3 11 9-8 9 8m-2-2v11H5V9m5 11v-6h4v6"/>',
 site:'<path d="M3 5h18v14H3zM3 9h18m-14 4h5m-5 3h9"/>'
};
const icon=k=>`<svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${icons[k]||careerMarks[k]}</svg>`;
export const videoPlayer=(url,poster='',label='Store video')=>url?`<video controls playsinline preload="metadata"${poster?` poster="${esc(poster)}"`:''} src="${esc(url)}" aria-label="${esc(label)}">Your browser does not support this video.</video>`:'';
export function productShowcase(p){
 const pictures=[p.image||'/assets/collection.svg',...(p.gallery||[])];
 return `<div class="product-showcase">${image(pictures[0],p.name)}${pictures.length>1?`<div class="product-thumbs">${pictures.map((url,i)=>`<button type="button" data-action="product-photo" data-image="${esc(url)}" aria-label="${esc('View photo '+(i+1)+' of '+p.name)}">${image(url,'','loading="lazy"')}</button>`).join('')}</div>`:''}${videoPlayer(p.video,p.image,p.name+' video')}</div>`;
}
const price=p=>p.variants?.length?Math.min(...p.variants.map(v=>v.price)):p.price;
const hasStock=p=>p.variants?.length?p.variants.some(v=>v.stock>0):p.stock>0;

export function renderStorefront(data,{editor=false,trust=true,route={page:'home'},bag=0,basePath,preview=false,cartLines=[]}={}){
 const s=data.settings,{page,id,category='All',search='',sort='featured',offset=0}=route,visible=getSections(s).filter(x=>!x.hidden);
 const selling=sellsOnline(s),contactLabel=s.navContactLabel||'Contact';
 const items=selling?data.products.filter(p=>p.active):[],catalogue=selling&&visible.some(a=>a.type==='catalog'),story=visible.some(a=>a.type==='about');
 const base=basePath||'/s/'+data.slug, report='/report?store='+encodeURIComponent(data.slug);
 const url=(page,o)=>esc(retailURL(base,page,o));
 const marker=(id,label)=>editor?` data-edit="${esc(id)}" tabindex="0" aria-label="${esc('Edit '+label)}"`:'';
 const nav=(key,label)=>`<a href="${url(key)}" ${page===key?'aria-current="page"':''}>${esc(label)}</a>`;
 const categoryList=[...new Set([...(s.categories||[]),...items.map(p=>p.category)].filter(Boolean))];
 const chooser=getTemplate(data.template||s.template);
 const collections=chooser?.categoryImages||{};
 const filtered=items.filter(p=>(category==='All'||category===p.category)&&[p.name,p.sku,p.category,p.description].some(v=>String(v||'').toLowerCase().includes(search.trim().toLowerCase())));
 const rank=(a,b)=>sort==='price-up'?price(a)-price(b):sort==='price-down'?price(b)-price(a):sort==='name'?a.name.localeCompare(b.name):Number(b.featured)-Number(a.featured);
 filtered.sort(rank);
 const tiles=()=>`<div class="retail-departments">${categoryList.map((c,i)=>{
  const img=items.find(p=>p.category===c&&p.image)?.image||collections[c];
  return `<a href="${url('shop',{category:c})}" class="retail-department" data-swatch="${i%6}">${img?image(img,'','loading="lazy"'):`<span class="retail-department-symbol">${icon('box')}</span>`}<strong>${esc(c)}</strong><span aria-hidden="true">↗</span></a>`;
 }).join('')}</div>`;
 const crumb=(label)=>`<div class="retail-crumb"><a href="${url('home')}">Home</a><span aria-hidden="true">/</span>${page==='product'?`<a href="${url('shop')}">Shop</a><span aria-hidden="true">/</span>`:''}<span>${esc(label)}</span></div>`;
 const heading=(eyebrow,title,text)=>`${crumb(title)}<header class="retail-page-head">${eyebrow?`<span class="retail-kicker">${esc(eyebrow)}</span>`:''}<h1>${esc(title)}</h1>${text?`<p>${esc(text)}</p>`:''}</header>`;
 const card=p=>{
  const href=url('product',{id:p.id});
  return `<article class="retail-card product-card"${marker('product:'+p.id,p.name)}><a class="picture" href="${href}" aria-label="${esc(p.name)}">${image(p.image||'/assets/collection.svg',p.name,'loading="lazy"')}${p.featured?'<span class="badge">Featured</span>':''}${p.video?'<span class="product-video-mark">▶ Video</span>':''}</a><div class="retail-card-copy"><small>${esc(p.category)}</small><h3><a href="${href}">${esc(p.name)}</a></h3><p>${p.variants?.length?'From ':''}<strong>${formatMoney(price(p),s.currency)}</strong></p><a class="retail-card-link" href="${href}">${!hasStock(p)?'View · Sold out':p.variants?.length?'Choose options':'View product'} <span aria-hidden="true">→</span></a></div></article>`;
 };
 const aboutLink=story?url('about'):url('contact');
 const shopLink=selling?url('shop'):url('contact');
 const heroLink=s.heroDestination==='contact'?url('contact'):s.heroDestination==='about'?aboutLink:shopLink;
 const ctaFor=link=>{
  const custom=link?.match(/^#page-([0-9])$/);
  if(custom)return s.customPages?.[Number(custom[1])]?url('page',{id:custom[1]}):url('contact');
  return link==='#contact'?url('contact'):link==='#collection'?shopLink:link==='#our-story'?aboutLink:link==='#hero'?url('home'):/^(?:#[a-z0-9-]+|https:\/\/[^\s]+)$/i.test(link||'')?esc(link):shopLink;
 };
 function section(a){
  if(a.type==='hero')return `<section class="retail-hero${s.heroImage?'':' no-hero-image'}"${marker('hero','hero')}><div class="retail-hero-copy"><span class="retail-kicker">${esc(s.tagline)}</span><h1>${esc(s.heroTitle)}</h1><p>${esc(s.heroText)}</p>${s.heroButton&&(catalogue||!selling||['about','contact'].includes(s.heroDestination))?`<a class="store-btn" href="${heroLink}">${esc(s.heroButton)} <span aria-hidden="true">→</span></a>`:''}</div>${s.heroImage?image(s.heroImage,s.heroAlt||s.name+(selling?' collection':''),'fetchpriority="high"'):''}</section>`;
  if(a.type==='catalog'||a.type==='about'||a.type==='categories'&&!selling)return '';
  const intro=`${a.title?`<h2>${esc(a.title)}</h2>`:''}${a.text?`<p class="preline">${esc(a.text)}</p>`:''}`;
  const cta=a.button&&a.link?`<a class="store-btn" href="${ctaFor(a.link)}">${esc(a.button)}</a>`:'';
  let body=intro+cta;
  if(a.type==='image')body=`<div class="section-split">${a.image?image(a.image,a.alt,'loading="lazy"'):editor?'<div class="section-placeholder">Add an image</div>':''}<div>${intro}${cta}</div></div>`;
  if(a.type==='gallery')body=intro+`<div class="section-gallery">${(a.images||[]).map(src=>image(src,a.alt||a.title,'loading="lazy"')).join('')||(editor?'<div class="section-placeholder">Add photos</div>':'')}</div>`+cta;
  if(a.type==='video')body=intro+(videoPlayer(a.video,a.image,a.title||'Store video')||(editor?'<div class="section-placeholder">Choose a video</div>':''))+cta;
  if(a.type==='categories')body=intro+tiles()+cta;
  if(a.type==='faq')body=intro+`<div class="section-questions">${(a.items||[]).map(x=>`<details><summary>${esc(x.title)}</summary><p class="preline">${esc(x.text)}</p></details>`).join('')}</div>`+cta;
  if(a.type==='benefits')body=intro+`<div class="section-benefits">${(a.items||[]).map(x=>`<article><h3>${esc(x.title)}</h3><p>${esc(x.text)}</p></article>`).join('')}</div>`+cta;
  return `<section id="section-${esc(a.id)}" class="store-section section-${esc(a.type)} tone-${allow(a.tone,['plain','soft','accent'],'plain')} align-${allow(a.align,['left','center','right'],'left')}"${marker(a.id,sectionTypes[a.type]||'section')}>${body}</section>`;
 }
 const extra=where=>visible.filter(a=>sectionPage(a)===where).map(section).join('');
 
 let main='';
 if(page==='home'){
  const picks=[...items].sort((a,b)=>Number(b.featured)-Number(a.featured)).slice(0,4);
  main=`${!visible.some(a=>a.type==='hero')?`<header class="retail-page-head"><h1>${esc(s.name)}</h1></header>`:''}${extra('home')}
   ${catalogue&&(picks.length||editor)?`<section class="retail-picks" data-collection><header><div><span class="retail-kicker">THE COLLECTION</span><h2>${esc(s.catalogTitle||'Popular picks')}</h2></div><a href="${url('shop')}">See all products →</a></header><div class="retail-grid">${picks.map(card).join('')}</div></section>`:''}
   ${story?`<aside class="retail-story-link"><div><span class="retail-kicker">${selling?'MEET THE STORE':'GET TO KNOW US'}</span><h2>${esc(s.aboutTitle||'Our story')}</h2></div><a class="store-btn" href="${url('about')}">${esc(s.navAboutLabel||'Our story')} →</a></aside>`:''}`;
 }
 if(page==='shop'&&selling){
  const title=category==='All'?(s.catalogTitle||'Shop all products'):category,step=24;
  const start=Math.floor(Math.min(Number.isFinite(offset)?offset:0,Math.max(0,filtered.length-1))/step)*step;
  const link=o=>url('shop',{category,search,sort,...o});
  main=heading(s.navShopLabel||'Shop',title,'')+`<div class="retail-catalogue"${marker('catalog','product collection')}><aside class="retail-filter"><h2>Departments</h2>${['All',...categoryList].map(c=>`<a href="${link({category:c})}" data-category="${esc(c)}" ${category===c?'aria-current="true"':''}>${esc(c==='All'?'All products':c)} <span>${c==='All'?items.length:items.filter(p=>p.category===c).length}</span></a>`).join('')}</aside>
  <div><div class="retail-results"><span>${filtered.length} ${filtered.length===1?'product':'products'}${search?' for “'+esc(search)+'”':''}</span><label>Sort by <select aria-label="Sort products" data-sort>${[['featured','Featured'],['price-up','Price: low to high'],['price-down','Price: high to low'],['name','Name: A to Z']].map(([k,v])=>`<option value="${k}" ${k===sort?'selected':''}>${v}</option>`).join('')}</select></label></div><div class="retail-grid">${filtered.slice(start,start+step).map(card).join('')}</div>
  ${filtered.length?'':`<div class="retail-empty"><h2>${editor?'Add your first product':'No products found'}</h2><p>${editor?'Use Products in the editor to add visible items.':'Try another department or search term.'}</p><a href="${url('shop')}">View all products</a></div>`}
  ${filtered.length>step?`<nav class="retail-pagination" aria-label="Catalogue pages">${start?`<a href="${link({offset:start-step})}">← Previous</a>`:''}<span>${start+1}–${Math.min(start+step,filtered.length)} of ${filtered.length}</span>${start+step<filtered.length?`<a href="${link({offset:start+step})}">Next →</a>`:''}</nav>`:''}</div></div>`+extra('shop')+storefrontExtras({quiz:data.features?.quiz},[],c=>retailURL(base,'shop',{category:c}));
 }
 if(page==='product'&&selling){
  const p=items.find(x=>x.id===id);
  if(p){
   const stock=hasStock(p),recommend=items.filter(x=>x.id!==id).sort((a,b)=>Number(b.category===p.category)-Number(a.category===p.category)).slice(0,4);
   main=`${crumb(p.name)}<section class="retail-product"${marker('product:'+p.id,p.name)}>${productShowcase(p)}<div class="retail-product-copy"><a class="retail-kicker" href="${url('shop',{category:p.category})}">${esc(p.category)}</a><h1>${esc(p.name)}</h1><p class="retail-product-price">${p.variants?.length?'From ':''}${formatMoney(price(p),s.currency)}</p>
   <p class="preline">${esc(p.description)}</p>${p.sku?`<p class="small">SKU ${esc(p.sku)}</p>`:''}
   ${stock?`<form data-form="add-cart" data-id="${esc(p.id)}" class="retail-buy">${p.variants?.length?`<label>Choose an option<select name="variantId" required>${p.variants.map(v=>`<option value="${esc(v.id)}" ${v.stock?'':'disabled'}>${esc(v.name)} · ${formatMoney(v.price,s.currency)}${v.stock?'':' · Sold out'}</option>`).join('')}</select></label>`:''}${preview?'<p>Preview only · Purchases are disabled.</p>':data.checkoutBlocked?'<p>Ordering is currently paused.</p>':`<div class="retail-buy-row"><label>Quantity<input type="number" min="1" max="99" value="1" name="quantity" required></label><button type="submit" class="store-btn">${icon('bag')} Add to bag</button></div><p class="form-error" role="alert"></p>`}</form>`:'<p class="retail-sold-out">Currently sold out</p>'}
   <div class="retail-product-policies"><a href="${url('policies',{id:'shipping'})}">${icon('truck')} Delivery & pickup</a><a href="${url('policies',{id:'returns'})}">${icon('box')} Returns & refunds</a></div></div></section>
   ${recommend.length?`<section class="retail-picks"><header><h2>You might also like</h2><a href="${url('shop')}">Browse the shop →</a></header><div class="retail-grid">${recommend.map(card).join('')}</div></section>`:''}`;
  }
 }
 if(page==='about'&&story)main=heading(s.name,s.aboutTitle||'Our story','')+`<section class="retail-story"${marker('about','our story')}><div><p class="preline">${esc(s.about)}</p><div class="retail-story-actions">${selling?`<a class="store-btn" href="${shopLink}">Browse the shop →</a><a href="${url('contact')}">Get in touch</a>`:`<a class="store-btn" href="${url('contact')}">${esc(contactLabel)} →</a>`}</div></div>${s.heroImage?image(s.heroImage,s.heroAlt||s.name):''}</section>`+extra('about');
 if(page==='contact')main=heading(selling?'STORE SUPPORT':s.name,contactLabel,s.contactIntro||(selling?'Get in touch with the seller for product questions, order help or delivery details.':'Get in touch to ask a question or discuss your plans.'))+`<div class="retail-contact"${marker('footer','contact details')}>${s.contactEmail?`<article><h2>Email</h2><a href="mailto:${esc(s.contactEmail)}">${esc(s.contactEmail)}</a></article>`:''}${s.phone?`<article><h2>Phone</h2><a href="tel:${esc(s.phone.replace(/[^+\d]/g,''))}">${esc(s.phone)}</a></article>`:''}${s.address?`<article><h2>Find us</h2><p class="preline">${esc(s.address)}</p></article>`:''}${selling?`<article><h2>Delivery & returns</h2><p>Check the store’s policies before placing an order.</p><a href="${url('policies',{id:'shipping'})}">Delivery & pickup →</a><br><a href="${url('policies',{id:'returns'})}">Returns & refunds →</a></article>`:''}${!s.contactEmail&&!s.phone?(preview&&!selling?'<article><h2>Example contact page</h2><p>Your public email and optional phone number go here when you set up your site.</p></article>':'<article><h2>Contact details</h2><p>Contact details are not listed here yet.</p></article>'):''}</div>`+extra('contact');
 if(page==='journal')main=heading(s.name,'Journal','Guides, news and stories from this store.')+(data.features?.journal?.length?storefrontExtras({journal:data.features.journal},[]):'<div class="retail-empty">No articles yet.</div>');
 if(page==='reviews'&&selling)main=heading(s.name,'Customer reviews','Feedback from verified buyers.')+(data.reviews?.length?storefrontExtras({},data.reviews):'<div class="retail-empty">No published reviews yet.</div>');
 if(page==='bag'&&selling){
  const cost=cartLines.reduce((n,l)=>n+l.price*l.quantity,0);
  main=heading('YOUR ORDER',s.bagLabel||'Shopping bag','Review your items before checkout.')+
   (preview?'<div class="retail-empty">This is a storefront preview. Checkout is disabled.</div>':cartLines.length?`<div class="retail-bag-layout"><section>${cartLines.map((l,i)=>`<div class="cart-line"><a href="${url('product',{id:l.productId})}">${image(l.product.image||'/assets/collection.svg','')}</a><div class="details"><strong>${esc(l.name)}</strong><p>${formatMoney(l.price,s.currency)} each</p></div><label>Qty<input type="number" data-cart-quantity="${i}" min="1" max="${Math.min(99,l.stock)}" value="${l.quantity}"></label><button type="button" data-action="remove-cart" data-index="${i}" aria-label="Remove ${esc(l.name)}">×</button></div>`).join('')}</section><aside class="retail-prose"><h2>Order summary</h2><p>Subtotal <strong>${formatMoney(cost,s.currency)}</strong></p><p>Tax and delivery are calculated at checkout.</p>${selling&&data.checkoutBlocked?'<p>Ordering is currently paused.</p>':'<button type="button" class="store-btn" data-action="checkout">Continue to checkout →</button>'}</aside></div>`:`<div class="retail-empty"><h2>Your bag is empty</h2><a class="store-btn" href="${url('shop')}">Browse the shop →</a></div>`);
 }
 if(page==='policies'&&policyLabels[id]&&(selling||id==='privacy'))main=heading(s.name,policyLabels[id],'')+`<article class="retail-prose" ${marker('footer','store policies')}><p class="preline">${esc(s[id]||'The seller has not added this policy yet.')}</p></article>`;
 if(page==='page'&&id===String(Number(id))&&s.customPages?.[Number(id)]){
  const p=s.customPages[Number(id)];
  main=heading(s.name,p.title,'')+`<article class="retail-prose" ${marker('footer','custom pages')}><p class="preline">${esc(p.content)}</p>${selling?'':`<a class="store-btn" href="${url('contact')}">${esc(contactLabel)} →</a>`}</article>`;
 }
 if(!main)main=heading(selling?'STOREFRONT':s.name,'Page not found',selling?'This page or product may have moved.':'This page may have moved.')+`<div class="retail-empty"><a class="store-btn" href="${selling?shopLink:url('home')}">${selling?'Browse the shop':'Back to home'} →</a></div>`;
 return `<div class="store retail${selling?'':' retail-enquiries'} ${allow(s.font,['serif','sans'],'serif')} ${allow(s.layout,['editorial','minimal','market','runway','boutique'],'editorial')} grid-${allow(s.grid,['standard','compact','large'],'standard')} header-${allow(s.headerStyle,['split','centered'],'split')}" style="${styles(s)}">
 ${s.announcement?`<div class="retail-announcement"${marker('brand','announcement')}>${esc(s.announcement)}</div>`:''}
 ${selling&&data.checkoutBlocked?'<div class="retail-announcement">Ordering is currently paused.</div>':''}
 <header class="retail-header"${marker('brand','branding and navigation')}><div class="retail-head-inner"><a class="retail-brand" href="${url('home')}">${s.logo?image(s.logo,s.name):`<span class="retail-brand-mark" aria-hidden="true">${icon(selling?'box':chooser?.group==='professional'?chooser.id:'site')}</span><span>${esc(s.name)}</span>`}</a>${catalogue?`<form class="retail-search" data-form="retail-search" role="search"><input name="q" type="search" aria-label="Search products" placeholder="${esc(s.searchLabel||'Search products')}" value="${esc(search)}" maxlength="120"><button type="submit" aria-label="Search">${icon('search')}</button></form>`:''}${selling?`<a class="retail-bag" href="${url('bag')}" aria-label="${esc(s.bagLabel||'Shopping bag')} · ${bag} ${bag===1?'item':'items'}">${icon('bag')} <span>${esc(s.bagLabel||'Bag')}</span><span class="retail-bag-count">${bag}</span></a>`:`<a class="store-btn retail-contact-link" href="${url('contact')}">${esc(contactLabel)} <span aria-hidden="true">↗</span></a>`}</div>
 <nav class="retail-nav" aria-label="Storefront">${nav('home','Home')}${catalogue?nav('shop',s.navShopLabel||'Shop'):''}${story?nav('about',s.navAboutLabel||'Our story'):''}${data.features?.journal?.length?nav('journal','Journal'):''}${selling&&data.reviews?.length?nav('reviews','Reviews'):''}${selling?'':(s.customPages||[]).slice(0,2).map((p,i)=>`<a href="${url('page',{id:String(i)})}" ${page==='page'&&String(i)===id?'aria-current="page"':''}>${esc(p.title)}</a>`).join('')}${nav('contact',contactLabel)}</nav></header>
 <main class="retail-main" tabindex="-1">${main}</main>
 <footer class="retail-footer"${marker('footer','footer, pages and policies')}><div><h2>${esc(s.name)}</h2><p>${esc(s.footerText||s.tagline)}</p><a href="${url('contact')}">${selling?'Contact the store':esc(contactLabel)} →</a></div><div><h3>Explore</h3>${catalogue?nav('shop',s.navShopLabel||'Shop'):''}${story?nav('about',s.navAboutLabel||'Our story'):''}${(s.customPages||[]).map((p,i)=>`<a href="${url('page',{id:String(i)})}">${esc(p.title)}</a>`).join('')}</div><div><h3>${selling?'Shopping help':'Information'}</h3>${Object.entries(policyLabels).filter(([k])=>selling||k==='privacy').map(([k,label])=>`<a href="${url('policies',{id:k})}">${label}</a>`).join('')}${trust?`<a href="${esc(report)}">${selling?'Report this vendor':'Report this site'}</a>`:''}</div><div class="retail-powered"><a class="powered-by-brand" href="/" aria-label="Powered by ICSS Plaza"><img src="/assets/brand/powered-by.png" alt="Powered by ICSS Plaza" width="600" height="120" loading="lazy"></a>${trust&&selling?'<small>Independent seller on ICSS Plaza</small>':''}</div></footer></div>`;
}

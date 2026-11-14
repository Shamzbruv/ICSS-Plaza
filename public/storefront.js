import {classicSections,sectionTypes} from './store-templates.js?v=studio-1';

export const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const formatMoney=(amount,currency='JMD')=>new Intl.NumberFormat('en-JM',{style:'currency',currency,maximumFractionDigits:2}).format(amount/100);
export const getSections=s=>s.sections??classicSections.map(x=>({...x,hidden:x.type==='hero'?!s.showHero:x.type==='about'?!s.showAbout:false}));
const policyNames={shipping:'Delivery & shipping',returns:'Returns & refunds',privacy:'Privacy notice',terms:'Sales terms'};
const storeStyles=s=>['accent','background','ink'].map((k,i)=>['--accent','--bg','--ink'][i]+':'+(/^#[a-f0-9]{6}$/i.test(s[k])?s[k]:['#805323','#faf5ea','#292319'][i])).join(';');
const className=(value,allowed,fallback)=>allowed.includes(value)?value:fallback;
const safeLink=value=>typeof value==='string'&&(/^(?:#[a-z0-9-]+|https:\/\/[^\s]+)$/i.test(value))?value:'#collection';
export const image=(url,alt='',extra='')=>`<img src="${esc(url)}" alt="${esc(alt)}" ${extra}>`;
export const videoPlayer=(url,poster='',label='Store video')=>url?`<video controls playsinline preload="metadata"${poster?` poster="${esc(poster)}"`:''} src="${esc(url)}" aria-label="${esc(label)}">Your browser does not support this video.</video>`:'';

export function renderStorefront(data,{editor=false,trust=true,policy='',customPage=null,search='',category='All',sort='featured',bag=0,basePath}={}){
 const s=data.settings,sections=getSections(s),visible=sections.filter(x=>!x.hidden),list=data.products.filter(p=>p.active&&(category==='All'||p.category===category)&&[p.name,p.category,p.sku].some(v=>String(v||'').toLowerCase().includes(search.trim().toLowerCase())));
 list.sort((a,b)=>sort==='price-up'?a.price-b.price:sort==='price-down'?b.price-a.price:Number(b.featured)-Number(a.featured));
 const marker=(id,label)=>editor?` data-edit="${esc(id)}" tabindex="0" aria-label="${esc('Edit '+label)}"`:'';
 const report='/report?store='+encodeURIComponent(data.slug);
 const categoryList=s.categories||[],catalogue=visible.some(a=>a.type==='catalog'),story=visible.some(a=>a.type==='about');
 const categories=()=>['All',...categoryList].map(c=>`<button type="button" data-category="${esc(c)}" class="${category===c?'active':''}">${esc(c)}</button>`).join('');
 const card=p=>{
  const options=p.variants||[],amount=options.length?Math.min(...options.map(v=>v.price)):p.price,inStock=options.length?options.some(v=>v.stock>0):p.stock>0;
  return `<article class="product-card"${marker('product:'+p.id,p.name)}><div class="picture" data-action="product-detail" data-id="${esc(p.id)}">${image(p.image||'/assets/collection.svg',p.name,'loading="lazy"')}${p.featured?'<span class="badge">Featured</span>':''}${p.video?'<span class="product-video-mark">▶ Video</span>':''}</div><h3>${esc(p.name)}</h3><p>${options.length?'From ':''}${formatMoney(amount,s.currency)}</p><button type="button" data-action="product-detail" data-id="${esc(p.id)}">${inStock?'View product +':'Sold out'}</button></article>`;
 };
 function section(a){
  if(a.type==='hero')return !s.showHero&&s.sections==null?'':`<section class="store-hero${s.heroImage?'':' no-hero-image'}" id="hero"${marker('hero','hero')}><div class="store-hero-copy"><small>${esc(s.tagline)}</small><h1>${esc(s.heroTitle)}</h1><p>${esc(s.heroText)}</p>${catalogue&&s.heroButton?`<a class="store-btn" href="#collection">${esc(s.heroButton)}</a>`:''}</div>${s.heroImage?image(s.heroImage,s.heroAlt||s.name+' collection'):''}</section>`;
  if(a.type==='catalog')return `<section class="store-catalog" id="collection"${marker('catalog','product collection')}><h2>${esc(s.catalogTitle||'Explore the collection')}</h2><div class="catalog-top"><div class="categories">${categories()}</div><div class="row"><input aria-label="Search products" data-search value="${esc(search)}" placeholder="${esc(s.searchLabel||'Search products')}"><select aria-label="Sort products" data-sort>${[['featured','Featured'],['price-up','Price: low to high'],['price-down','Price: high to low']].map(([value,label])=>`<option value="${value}" ${value===sort?'selected':''}>${label}</option>`).join('')}</select></div></div><div class="product-grid">${list.map(card).join('')}</div>${list.length?'':`<p class="empty">${editor?'Add a visible product from the Products panel.':search||category!=='All'?'No products match your search.':'Products will appear here when they’re available.'}</p>`}</section>`;
  if(a.type==='about')return `<section class="store-about" id="our-story"${marker('about','our story')}><h2>${esc(s.aboutTitle)}</h2><p>${esc(s.about)}</p></section>`;
  const heading=`${a.title?`<h2>${esc(a.title)}</h2>`:''}${a.text?`<p class="preline">${esc(a.text)}</p>`:''}`;
  const cta=a.button&&a.link?`<a class="store-btn" href="${esc(safeLink(a.link))}">${esc(a.button)}</a>`:'';
  let body='';
  if(a.type==='image')body=`<div class="section-split">${a.image?image(a.image,a.alt,'loading="lazy"'):editor?'<div class="section-placeholder">Add an image</div>':''}<div>${heading}${cta}</div></div>`;
  else if(a.type==='gallery')body=heading+`<div class="section-gallery">${(a.images||[]).map(src=>image(src,a.alt||a.title,'loading="lazy"')).join('')|| (editor?'<div class="section-placeholder">Add photos</div>':'')}</div>`+cta;
  else if(a.type==='video')body=heading+(videoPlayer(a.video,a.image,a.title||'Store video')||(editor?'<div class="section-placeholder">Choose a video</div>':''))+cta;
  else if(a.type==='categories')body=heading+`<div class="section-category-grid">${categoryList.map((c,i)=>`<button type="button" data-category="${esc(c)}" data-jump="collection"><small>${String(i+1).padStart(2,'0')}</small><strong>${esc(c)}</strong><span aria-hidden="true">↗</span></button>`).join('')}</div>`+cta;
  else if(a.type==='faq')body=heading+`<div class="section-questions">${(a.items||[]).map(x=>`<details><summary>${esc(x.title)}</summary><p class="preline">${esc(x.text)}</p></details>`).join('')}</div>`+cta;
  else if(a.type==='benefits')body=heading+`<div class="section-benefits">${(a.items||[]).map(x=>`<article><h3>${esc(x.title)}</h3><p>${esc(x.text)}</p></article>`).join('')}</div>`+cta;
  else body=heading+cta;
  return `<section id="section-${esc(a.id)}" class="store-section section-${esc(a.type)} tone-${className(a.tone,['plain','soft','accent'],'plain')} align-${className(a.align,['left','center','right'],'left')}"${marker(a.id,sectionTypes[a.type]||'section')}>${body}</section>`;
 }
 return `<div class="store ${className(s.font,['serif','sans'],'serif')} ${className(s.layout,['editorial','minimal','market','runway','boutique'],'editorial')} grid-${className(s.grid,['standard','compact','large'],'standard')} header-${className(s.headerStyle,['split','centered'],'split')}" style="${storeStyles(s)}">
 ${trust?`<div class="store-trust"><span>Sold by <strong>${esc(s.name)}</strong> · Independent vendor</span><a href="${esc(report)}">Report this vendor</a></div>`:''}
 ${data.checkoutBlocked?'<div class="announcement">This store is not accepting new orders right now. Contact the vendor about existing orders.</div>':''}
 ${s.announcement?`<div class="announcement"${marker('brand','announcement')}>${esc(s.announcement)}</div>`:''}
 <nav class="store-nav"${marker('brand','branding and navigation')}><a class="store-brand" href="${esc(basePath||'/s/'+data.slug)}">${s.logo?image(s.logo,s.name):esc(s.name)}</a><div class="row">${catalogue?`<a class="shop-link" href="#collection">${esc(s.navShopLabel||'Shop')}</a>`:''}${story?`<a class="shop-link" href="#our-story">${esc(s.navAboutLabel||'Our story')}</a>`:''}<button data-action="cart">${esc(s.bagLabel||'Bag')} (${bag})</button></div></nav>
 ${policy||customPage?`<article class="store-policy"><button class="back-link" data-action="store-home">← Back to the store</button><h1>${esc(customPage?.title||policyNames[policy])}</h1><p class="preline">${esc(customPage?.content||s[policy])}</p>${policy==='returns'?'<p>This is the vendor’s policy. <a href="/legal/shopping">See your options if you need help.</a></p>':''}</article>`:visible.map(section).join('')}
 <footer class="store-footer"${marker('footer','footer, pages and policies')}><div class="row"><div><h3>${esc(s.name)}</h3><p>${esc(s.footerText||s.tagline)}</p><p>${esc(s.address)}</p>${s.contactEmail?`<a href="mailto:${esc(s.contactEmail)}">${esc(s.contactEmail)}</a>`:''}${s.phone?`<p>${esc(s.phone)}</p>`:''}${s.instagram?`<p>Instagram: ${esc(s.instagram)}</p>`:''}</div><div>${(s.customPages||[]).map((p,i)=>`<p><button class="back-link" data-action="custom-page" data-index="${i}">${esc(p.title)}</button></p>`).join('')}${Object.entries(policyNames).map(([k,label])=>`<p><button class="back-link" data-policy="${k}">${label}</button></p>`).join('')}</div><div><p>Secure payments through your selected provider.<br>Independent seller: ${esc(s.name)}</p><p><a class="powered-by-brand" href="/" aria-label="Powered by ICSS Plaza"><img src="/assets/brand/powered-by.png" alt="Powered by ICSS Plaza" width="600" height="120" loading="lazy"></a><br>Platform operated by iCreate Solutions &amp; Services.</p>${trust?`<a href="${esc(report)}">Report this vendor</a> · <a href="/legal/shopping">Shopping help</a>`:''}</div></div></footer></div>`;
}
export function productShowcase(p){
 const pictures=[p.image||'/assets/collection.svg',...(p.gallery||[])];
 return `<div class="product-showcase">${image(pictures[0],p.name)}${pictures.length>1?`<div class="product-thumbs">${pictures.map((url,i)=>`<button type="button" data-action="product-photo" data-image="${esc(url)}" aria-label="${esc('View photo '+(i+1)+' of '+p.name)}">${image(url,'','loading="lazy"')}</button>`).join('')}</div>`:''}${videoPlayer(p.video,p.image,p.name+' video')}</div>`;
}

import { escapeHTML as esc, footer, homeSeo, landing, marketingPage, marketingPages, nav } from '../public/marketing.js';
import { consultationPage } from '../public/platform-ui.js';
import { getSections, renderStorefront } from '../public/storefront.js';
import { pathInStore, policyLabels, retailPages, retailURL } from '../public/retail-route.js';

const site='ICSS Plaza', imagePath='/assets/brand/social-preview.png';
const consultation={
 title:'Online Store Consultation for Jamaican Businesses | ICSS Plaza',
 description:'Talk with ICSS Plaza about creating an online store in Jamaica, moving your catalogue, choosing payments, or setting up local delivery.'
};
const marketing={
 '/':{...homeSeo,render:landing},
 ...Object.fromEntries(Object.entries(marketingPages).map(([path,data])=>[path,{...data,render:()=>marketingPage(path)}])),
 '/consultation':{...consultation,render:()=>nav()+consultationPage()+footer()}
};
export const isMarketingPath=path=>Object.hasOwn(marketing,path);
export const marketingPaths=Object.keys(marketing);
const storeUnavailable=()=>nav()+'<main class="auth"><h1>Store unavailable</h1><p>This storefront is not currently available.</p><a class="btn" href="/">Go to ICSS Plaza</a></main>'+footer();
const loading='<p class="loading"><img src="/assets/brand/mark.png" alt="" width="72" height="72"><br>Opening ICSS Plaza…</p>';
const clean=(value,fallback='')=>{
 const message=String(value||'').replace(/\s+/g,' ').trim()||fallback;
 return message.length>160?message.slice(0,157).trimEnd()+'…':message;
};
const absolute=(origin,path)=>origin+path;
const safeImage=path=>typeof path==='string'&&/^\/(?:api\/images\/[a-f0-9]+|assets\/[A-Za-z0-9_./-]+\.(?:png|webp|jpe?g|svg))$/i.test(path)&&!path.includes('..')?path:null;
const serialize=data=>JSON.stringify(data).replace(/[<>&\u2028\u2029]/g,char=>'\\u'+char.charCodeAt(0).toString(16).padStart(4,'0'));
const breadcrumbs=(origin,parts)=>({'@type':'BreadcrumbList',itemListElement:parts.map(([name,path],i)=>({'@type':'ListItem',position:i+1,name,item:absolute(origin,path)}))});

function organization(origin) {
 return {'@type':'Organization','@id':origin+'/#organization',name:site,url:origin+'/',
  logo:absolute(origin,'/assets/brand/mark.png'),
  parentOrganization:{'@type':'Organization',name:'iCreate Solutions & Services'},
  areaServed:{'@type':'Country',name:'Jamaica'}};
}
function productSchema(origin,path,store,item) {
 const photos=[...new Set([item.image,...(item.gallery||[])].map(safeImage).filter(Boolean))];
 const stock=item.variants?.length?item.variants:[item];
 const base={url:absolute(origin,path),priceCurrency:store.settings.currency};
 const offers=stock.length===1||stock.every(v=>v.price===stock[0].price)?
  {'@type':'Offer',...base,price:(stock[0].price/100).toFixed(2),availability:'https://schema.org/'+(stock.some(v=>v.stock>0)?'InStock':'OutOfStock')}:
  {'@type':'AggregateOffer',...base,lowPrice:(Math.min(...stock.map(v=>v.price))/100).toFixed(2),highPrice:(Math.max(...stock.map(v=>v.price))/100).toFixed(2),offerCount:stock.length};
 return {'@type':'Product',name:item.name,url:base.url,description:clean(item.description,item.name),
  ...(item.sku?{sku:item.sku}:{}),...(photos.length?{image:photos.map(p=>absolute(origin,p))}:{}),offers};
}

function storefrontPage(path,search,store,origin) {
 if(!store)return {title:'Store unavailable | '+site,body:storeUnavailable(),status:404};
 const route=pathInStore(path,search),{page,id}=route,{settings:s}=store;
 const base='/s/'+store.slug;
 const visible=getSections(s).filter(x=>!x.hidden);
 const item=page==='product'?store.products.find(p=>p.id===id):null;
 const custom=page==='page'?s.customPages?.[Number(id)]:null;
 const missing=page==='missing'||page==='product'&&!item||page==='page'&&(!custom||id!==String(Number(id)))||page==='about'&&!visible.some(x=>x.type==='about');
 const label=item?.name||custom?.title||policyLabels[id]||retailPages[page];
 const title=missing?'Page not found | '+s.name:page==='home'?s.name+' | '+site:label+' | '+s.name;
 const description=clean(item?.description||custom?.content||({home:s.heroText,about:s.about,policies:s[id]})[page],
  page==='home'?'Shop online with '+s.name+'.':label+' at '+s.name+'.');
 const params=new URLSearchParams(search);
 const filters=page==='shop'&&['category','q','sort','offset'].some(x=>params.has(x));
 const index=!missing&&!filters&&!['bag','policies'].includes(page)&&
  !(page==='journal'&&!store.features?.journal?.length)&&!(page==='reviews'&&!store.reviews?.length);
 const body=renderStorefront(store,{route:missing?{page:'missing'}:route,basePath:base});
 const parts=[[s.name,base],...(page==='product'?[[s.navShopLabel||'Shop',base+'/shop']]:[]),[label,path]];
 const graph=index&&origin&&page!=='home'?[breadcrumbs(origin,parts),...(item&&!store.checkoutBlocked?[productSchema(origin,path,store,item)]:[])]:[];
 return {title,description,index,body,graph,image:item?[item.image,...(item.gallery||[])].map(safeImage).find(Boolean):safeImage(s.heroImage),status:missing?404:200};
}

export const storefrontPaths=store=>{
 const base='/s/'+store.slug;
 const visible=getSections(store.settings).filter(s=>!s.hidden);
 return [base,base+'/shop',base+'/contact',...(visible.some(x=>x.type==='about')?[base+'/about']:[]),
  ...(store.features?.journal?.length?[base+'/journal']:[]),
  ...(store.settings.customPages||[]).map((_,i)=>retailURL(base,'page',{id:String(i)})),
  ...store.products.map(p=>retailURL(base,'product',{id:p.id}))];
};

export function pageSeo({path,search='',origin,store,verify}) {
 let data;
 if(isMarketingPath(path)){
  const page=marketing[path];
  const graph=origin&&(path==='/'?[organization(origin),
   {'@type':'WebSite','@id':origin+'/#website',url:origin+'/',name:site,inLanguage:'en-JM',publisher:{'@id':origin+'/#organization'}},
   {'@type':'Service',name:'Online store builder for Jamaican businesses',url:origin+'/',provider:{'@id':origin+'/#organization'},areaServed:{'@type':'Country',name:'Jamaica'}}]:
   [breadcrumbs(origin,[[site,'/'],[page.kicker||'Consultation',path]])]);
  data={title:page.title,description:page.description,index:true,body:page.render(),graph};
 }else if(path.startsWith('/s/'))data=storefrontPage(path,search,store,origin);
 else{
  const label=({admin:'Store dashboard',developer:'Developer console',operator:'Developer console',login:'Log in',signup:'Start your store',reset:'Reset your password','test-access':'Test workspace',report:'Report a vendor',demo:'Store builder demo',templates:'Template preview',legal:'Policies'})[path.split('/')[1]];
  data={title:label?label+' | '+site:site};
 }
 const {title,description=homeSeo.description,index,body=loading,graph}=data;
 const socialImage=data.image||imagePath, imageURL=origin?absolute(origin,socialImage):socialImage;
 const canonical=origin?absolute(origin,path):null;
 const imageAlt=data.image?title:'ICSS Plaza storefront and lightbulb logo. Your business. Your online store.';
 const tag=(attr,key,value)=>'<meta '+attr+'="'+key+'" content="'+esc(value)+'">';
 const head=[
  '<title>'+esc(title)+'</title>',tag('name','description',description),tag('name','robots',index?'index, follow, max-image-preview:large':'noindex, follow'),
  ...(canonical&&(index||data.status===200)?['<link rel="canonical" href="'+esc(canonical)+'">',tag('property','og:url',canonical)]:[]),
  tag('property','og:type','website'),tag('property','og:locale','en_JM'),tag('property','og:site_name',site),
  tag('property','og:title',title),tag('property','og:description',description),tag('property','og:image',imageURL),tag('property','og:image:alt',imageAlt),
  ...(!data.image?[tag('property','og:image:width',1200),tag('property','og:image:height',630)]:[]),
  tag('name','twitter:card','summary_large_image'),tag('name','twitter:title',title),tag('name','twitter:description',description),
  tag('name','twitter:image',imageURL),tag('name','twitter:image:alt',imageAlt),
  ...(path==='/'&&typeof verify==='string'&&/^[a-zA-Z0-9_-]{10,160}$/.test(verify)?[tag('name','google-site-verification',verify)]:[]),
  ...(graph?.length?['<script type="application/ld+json">'+serialize({'@context':'https://schema.org','@graph':graph})+'</script>']:[])
 ].join('\n');
 return {head,body,index:!!index,status:data.status||200};
}

export function sitemapXml(origin,paths) {
 return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+
  paths.slice(0,50000).map(path=>'  <url><loc>'+esc(absolute(origin,path))+'</loc></url>').join('\n')+'\n</urlset>\n';
}

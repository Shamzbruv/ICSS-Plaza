export const policyLabels={shipping:'Delivery & pickup',returns:'Returns & refunds',privacy:'Privacy notice',terms:'Sales terms'};
export const retailPages={home:'Home',shop:'Shop',about:'Our story',contact:'Contact',journal:'Journal',reviews:'Reviews',bag:'Bag'};
const dynamic={product:/^[a-z0-9-]{1,80}$/,policies:/^(shipping|returns|privacy|terms)$/,page:/^\d{1,2}$/};
export function readRetailRoute(path,query=''){
 const [main,id]=path.replace(/^\/+|\/+$/g,'').split('/');
 const params=new URLSearchParams(query);
 if(path.replace(/^\/+|\/+$/g,'').split('/').length>(Object.hasOwn(dynamic,main)?2:1))return {page:'missing'};
 if(Object.hasOwn(dynamic,main))return dynamic[main].test(id||'')?{page:main,id}:{page:'missing'};
 if(main&&!Object.hasOwn(retailPages,main))return {page:'missing'};
 return {page:main||'home',category:params.get('category')||'All',search:(params.get('q')||'').slice(0,120),sort:['featured','price-up','price-down','name'].includes(params.get('sort'))?params.get('sort'):'featured',offset:Math.max(0,Number(params.get('offset'))||0)};
}
export function retailURL(base,page='home',{id,category,search,sort,offset}={}){
 const part=page==='home'?'':page+(id?'/'+encodeURIComponent(id):'');
 const url=new URL(base,'https://plaza.invalid');
 if(url.searchParams.has('view')){if(part)url.searchParams.set('page',part);}
 else if(part)url.pathname=url.pathname.replace(/\/$/,'')+'/'+part;
 if(category&&category!=='All')url.searchParams.set('category',category);
 if(search)url.searchParams.set('q',search);
 if(sort&&sort!=='featured')url.searchParams.set('sort',sort);
 if(offset>0)url.searchParams.set('offset',offset);
 return url.pathname+url.search;
}
export const pathInStore=(path,query)=>{
 const parts=path.split('/').slice(1);
 if(parts[0]==='demo')return readRetailRoute(new URLSearchParams(query).get('page')||'',query);
 return readRetailRoute(parts.slice(2).join('/'),query);
};

import {esc} from './storefront.js?v=growth-1';

const paths={
 overview:'<path d="M3 3v18h18M7 15l4-4 4 2 5-6"/>',
 orders:'<path d="M6 3l2 2 2-2 2 2 2-2 2 2 2-2v18l-2-2-2 2-2-2-2 2-2-2-2 2zM9 9h6m-6 4h6"/>',
 products:'<path d="m12 3 9 5v8l-9 5-9-5V8l9-5zm-9 5 9 5 9-5m-9 5v8M7 5.8l9 5"/>',
 inventory:'<path d="M8 3h8v8H8zM3 13h8v8H3zM13 13h8v8h-8zM12 3v3M7 13v3m10-3v3"/>',
 customers:'<circle cx="9" cy="8" r="3"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2M16 5a3 3 0 0 1 0 6m2 4a4 4 0 0 1 3 4v2"/>',
 appearance:'<path d="M3 4h18v16H3zM3 9h18m-12 0v11m4-6h5m-5 3h3"/>',
 content:'<path d="M4 4h16v16H4zM4 10h16m-9 0v10m3-6h3m-3 3h3"/>',
 media:'<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8" cy="9" r="1.5"/><path d="m4 18 5-5 3 3 3-4 5 6"/>',
 policies:'<path d="M6 3h8l4 4v14H6zM14 3v5h4m-9 5h6m-6 4h6"/>',
 payments:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18m-14 5h4"/>',
 billing:'<path d="M5 4h14v16H5zM8 8h8m-8 4h8m-8 4h4"/>',
 'vendor-cases':'<path d="M12 3 4 6v6c0 4 3 7 8 9 5-2 8-5 8-9V6zm0 5v5m0 3v.1"/>',
 settings:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2m0-14-2 2M7 17l-2 2"/><circle cx="12" cy="12" r="7"/>',
 preview:'<path d="M3 12s3-6 9-6 9 6 9 6-3 6-9 6-9-6-9-6z"/><circle cx="12" cy="12" r="2"/>',
 menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',
 exit:'<path d="M11 4H4v16h7m4-12 4 4-4 4m-6-4h10"/>',
 discounts:'<path d="M3 4h8l10 10-7 7L3 10zM7 8h.01"/>',
 loyalty:'<path d="M3 9h18v4H3zM5 13v8h14v-8M12 9v12m0-12c-2-7-9-5-5-1m5 1c2-7 9-5 5-1"/>',
 quiz:'<path d="M7 16 16 7l3 3-9 9zm2-11v4m-2-2h4m7 10v4m-2-2h4"/>',
 reviews:'<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2-5.5-2.9-5.5 2.9 1-6.2L3 9.6l6.2-.9z"/>',
 journal:'<path d="M4 4h16v16H4zm4 4h8m-8 4h8m-8 4h5"/>',
 emails:'<path d="M3 5h18v14H3zm0 2 9 6 9-6"/>',
 home:'<path d="M4 11l8-7 8 7v9H4zM10 20v-6h4v6"/>'
};
export const workspaceIcon=(name)=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]||''}</svg>`;
const sections=[
 ['Workspace',[['overview','Dashboard']]],
 ['Commerce',[['orders','Orders'],['products','Products'],['inventory','Inventory'],['customers','Customers']]],
 ['Growth',[['discounts','Discounts'],['loyalty','Loyalty Program'],['quiz','Quiz Rules'],['reviews','Reviews']]],
 ['Storefront',[['appearance','Store Designer'],['journal','Journal & Content'],['content','Site Content'],['media','Media Library'],['policies','Policies']]],
 ['Management',[['emails','Email Templates'],['payments','Payment Methods'],['billing','Rental Billing'],['vendor-cases','Vendor Reports'],['settings','Store Settings']]]
];
const supportTabs=['overview','products','inventory','appearance','content','media','policies'];
export const workspaceSections=({support=false,demo=false,testWorkspace=false}={})=>sections.map(([group,rows])=>[group,rows.filter(([key])=>support?(supportTabs.includes(key)||testWorkspace&&['discounts','loyalty','quiz','reviews','journal','emails'].includes(key)):!demo||!['billing','vendor-cases'].includes(key))]).filter(([,items])=>items.length);
export const workspaceTab=(key,options)=>workspaceSections(options).flatMap(([,items])=>items).some(([id])=>id===key)?key:'overview';
export const workspaceTitle=(key,options)=>workspaceSections(options).flatMap(([,items])=>items).find(([id])=>id===key)?.[1]||'Dashboard';
export function workspaceSidebar({tab,state,support,demo,operator}){
 const sections=workspaceSections({support,demo,testWorkspace:state.slug==='plaza-test-workspace'});
 return `<aside class="vendor-sidebar" aria-label="Vendor workspace sidebar">
 <div class="vendor-sidebar-top"><a class="vendor-brand" href="/" aria-label="ICSS Plaza home"><img src="/assets/brand/logo-horizontal.png" width="900" height="220" alt="ICSS Plaza"><span>VENDOR WORKSPACE</span></a><button class="vendor-menu-toggle" type="button" data-action="vendor-menu" aria-expanded="false" aria-controls="vendor-menu-body">${workspaceIcon('menu')}<span>Menu</span></button></div>
 <div class="vendor-menu-body" id="vendor-menu-body"><div class="vendor-store-card"><span class="vendor-store-icon">${workspaceIcon('home')}</span><div><strong>${esc(state.settings.name)}</strong><small>${demo?'Sample store':support?'Support access':state.settings.published?'Published storefront':'Draft storefront'}</small></div></div>
 <nav class="vendor-nav" aria-label="Store management">${sections.map(([name,items])=>`<div class="vendor-nav-group"><span>${name}</span>${items.map(([id,label])=>`<button type="button" class="vendor-nav-link${id===tab?' active':''}" data-tab="${id}" ${id===tab?'aria-current="page"':''}>${workspaceIcon(id)}<span>${label}</span></button>`).join('')}</div>`).join('')}</nav>
 <div class="vendor-sidebar-bottom">${!support&&!demo&&state.settings.published?`<a class="vendor-nav-link" href="/s/${esc(state.slug)}" target="_blank" rel="noopener">${workspaceIcon('preview')}<span>View live storefront ↗</span></a>`:`<button type="button" class="vendor-nav-link" data-action="preview">${workspaceIcon('preview')}<span>Full storefront preview</span></button>`}
 ${support?`<button type="button" class="vendor-nav-link" data-action="vendor-support-end">${workspaceIcon('exit')}<span>End support session</span></button>`:`${operator?'<a class="vendor-nav-link" href="/developer">Developer Console ↗</a>':''}${demo?'':`<button type="button" class="vendor-nav-link" data-action="logout">${workspaceIcon('exit')}<span>Sign out</span></button>`}`}</div></div></aside>`;
}
export const stockOf=p=>(p.variants||[]).length?p.variants.reduce((n,v)=>n+v.stock,0):p.stock;
const date=x=>x?new Intl.DateTimeFormat('en-JM',{dateStyle:'medium',timeZone:'America/Jamaica'}).format(x):'—';
const action=(label,id,who='')=>`<button type="button" class="btn outline sm" data-action="${id}" data-id="${esc(who)}">${label}</button>`;
const stat=(icon,label,value)=>`<div class="vendor-stat"><span class="vendor-stat-icon">${workspaceIcon(icon)}</span><div><p>${label}</p><strong>${value}</strong></div></div>`;
const filter=(name,detail,extra='')=>`<div class="vendor-list-tools"><label class="field">${name}<input type="search" data-vendor-filter placeholder="${detail}"></label>${extra}</div>`;
const empty=(title,detail)=>`<div class="vendor-empty"><h3>${title}</h3><p>${detail}</p></div>`;
const grid=(head,rows)=>`<div class="table-scroll"><table class="vendor-table"><thead><tr>${head.map(h=>`<th scope="col">${h}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div><p class="vendor-filter-empty" hidden>No matches. Try a different search.</p>`;
export function inventoryPanel({products}){
 const levels=p=>p.variants?.length?p.variants.map(v=>v.stock):[p.stock];
 const lows=products.filter(p=>p.active&&stockOf(p)>0&&levels(p).some(v=>v<=5)).length;
 const out=products.filter(p=>p.active&&stockOf(p)===0).length;
 return `<div class="vendor-stats">${stat('products','Products tracked',products.length)}${stat('inventory','Low stock · 1–5 units',lows)}${stat('orders','Sold out · visible products',out)}</div>
 <section class="panel vendor-panel"><h2>Stock levels</h2><p>Update available quantities here. Products with options track stock separately for each option.</p>${products.length?filter('Find stock','Search product, SKU or category',`<label class="field">Stock status<select data-vendor-status><option value="">All stock levels</option><option value="in">In stock</option><option value="low">Low stock</option><option value="out">Sold out</option></select></label>`)+grid(['Product','SKU','Available','Stock status','<span class="studio-sr">Actions</span>'],products.map(p=>{
  const n=stockOf(p),low=levels(p).some(v=>v<=5),status=n===0?'out':low?'low':'in';
  return `<tr data-vendor-row data-stock="${status}" data-filter="${esc([p.name,p.sku,p.category].join(' '))}"><td><strong>${esc(p.name)}</strong><p class="small">${esc(p.category)}${p.variants?.length?' · '+p.variants.length+' options':''}${p.active?'':' · Hidden'}</p></td><td>${esc(p.sku||'—')}</td><td>${n}</td><td><span class="tag ${status==='in'?'':'warn'}">${status==='out'?'Sold out':status==='low'?'Low stock':'In stock'}</span></td><td>${action('Adjust stock','vendor-stock',p.id)}</td></tr>`;
 }).join('')):empty('No inventory yet','Add a product and its starting quantity to track stock here.')}</section>`;
}
export function customersPanel(orders,money){
 const groups=new Map();
 for(const order of orders){
  if(!order.customer)continue;
  const email=String(order.customer.email||'').toLowerCase().trim();
  if(!email)continue;
  const row=groups.get(email)||{email,latest:order,count:0,paid:new Map()};
  row.count++;
  if(order.paid&&order.state!=='cancelled')row.paid.set(order.currency,(row.paid.get(order.currency)||0)+order.total);
  if(order.created>row.latest.created)row.latest=order;
  groups.set(email,row);
 }
 const customers=[...groups.values()].sort((a,b)=>b.latest.created-a.latest.created);
 return `<div class="vendor-stats">${stat('customers','Customers',customers.length)}${stat('orders','Repeat customers',customers.filter(c=>c.count>1).length)}${stat('billing','Recent orders in this view',orders.length)}</div>
 <section class="panel vendor-panel"><h2>Customer directory</h2><p>Based on your latest ${orders.length>=500?'500 orders':'orders'}. Confirmed totals exclude cancelled and unpaid orders.</p>${customers.length?filter('Find a customer','Search name or email')+grid(['Customer','Orders','Confirmed purchases','Last order','<span class="studio-sr">Actions</span>'],customers.map(c=>`<tr data-vendor-row data-filter="${esc(c.latest.customer.name+' '+c.email)}"><td><strong>${esc(c.latest.customer.name)}</strong><p class="small">${esc(c.email)}</p></td><td>${c.count}</td><td>${[...c.paid].map(([k,v])=>esc(k+' '+money(v,k))).join('<br>')||'—'}</td><td>${date(c.latest.created)}</td><td>${action('View latest order','order',c.latest.id)}</td></tr>`).join('')):empty('No customers yet','Customers will appear here after they place an order.')}</section>`;
}
export function vendorDashboard({state,money,support,demo,previewButton,setup}){
 const launchFirst=!support&&!demo&&!state.settings.published;
 const active=state.products.filter(p=>p.active).length,stock=state.products.filter(p=>p.active&&stockOf(p)===0).length;
 const counts=support?stat('products','Catalogue products',state.products.length)+stat('inventory','Visible products',active)+stat('orders','Visible products sold out',stock)
 :stat('overview','Confirmed revenue',esc(money(state.metrics?.confirmedRevenue??state.orders.filter(o=>o.paid).reduce((n,o)=>n+o.total,0))))+stat('orders','Orders to review',state.orders.filter(o=>['new','processing'].includes(o.state)).length)+stat('products','Active products',active);
 return `${launchFirst?`<div class="launchpad-first">${setup}</div>`:''}<div class="vendor-hero"><div><div class="eyebrow">ICSS Plaza · Store operations</div><h2>${support?'Storefront support':'Your store at a glance'}</h2><p>${support?'Manage the catalogue, inventory and storefront within this support session.':'See what needs attention and get straight to the parts of your shop you manage most.'}</p></div><div class="vendor-hero-actions"><button type="button" class="btn sm" data-tab="products">${workspaceIcon('products')} Products</button>${previewButton}</div></div>
 <div class="vendor-stats">${counts}</div><div class="vendor-dashboard-grid ${launchFirst?'launchpad-quick-only':''}">${launchFirst?'':setup}<section class="panel vendor-panel"><h2>${support?'Store tools':'Quick access'}</h2><p>${support?'Customer and order information is available to the store owner.':demo?'Sample activity stays in this browser.':'Open a workspace to see more details or make updates.'}</p><div class="vendor-quick-links">${(support?[['inventory','Adjust inventory'],['appearance','Open Store Designer'],['policies','Review store policies']]:[['orders','Review orders'],['inventory','Check inventory'],['customers','Open customer directory'],['appearance','Open Store Designer']]).map(([id,label])=>`<button type="button" data-tab="${id}">${workspaceIcon(id)}<span>${label}</span><span aria-hidden="true">→</span></button>`).join('')}</div></section></div>`;
}

import {demoStore} from './demo-data.js';
import {templates} from './store-templates.js?v=retail-1';
export const escapeHTML=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const esc=escapeHTML;
const arrowIcon=()=>'<svg class="plaza-arrow-icon" width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M4 12l8-8M5 4h7v7" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const logo=()=>'<a class="logo" href="/" aria-label="ICSS Plaza home"><img src="/assets/brand/logo-horizontal.png" alt="ICSS Plaza — by iCreate Solutions &amp; Services" width="900" height="220"></a>';
const field=(label,name,value='',type='text')=>`<label class="field">${esc(label)}<input type="${type}" name="${name}" value="${esc(value)}"></label>`;
export function footer(){return `<footer class="site-footer"><div class="wrap"><div class="footer-grid"><div>${logo()}<p>More businesses online. More possibilities.<br>Owned and operated by iCreate Solutions & Services, Jamaica.</p><p><a href="mailto:icreatesolutions.ja@gmail.com">icreatesolutions.ja@gmail.com</a><br><a href="https://wa.me/18765857469">WhatsApp +1 876-585-7469</a></p></div><div class="footer-links"><a href="/sell-online-jamaica">Sell online in Jamaica</a><a href="/online-store-templates">Storefront templates</a><a href="/ecommerce-payments-jamaica">Jamaican ecommerce payments</a><a href="/online-store-pricing">Trial & pricing</a><a href="/legal/terms">Terms</a><a href="/legal/privacy">Privacy</a><a href="/legal/refunds">Plaza rental refunds</a><a href="/legal/shopping">Shopping with vendors</a><a href="/legal/vendor-agreement">Vendor agreement</a><a href="/report">Report a vendor</a><a href="/legal/acceptable-use">Acceptable use</a><a href="/legal/cookies">Cookies</a><a href="/consultation">Request a consultation</a><a href="/developer">Developer sign-in</a></div></div><div class="copyright">© ${new Date().getFullYear()} iCreate Solutions & Services. ICSS Plaza. Independent stores. One place to start.</div></div></footer>`;}
export function nav(){return `<header class="wrap"><nav class="site-nav" aria-label="Main navigation">${logo()}<div class="nav-links"><a href="/sell-online-jamaica">How to sell online</a><a href="/online-store-templates">Templates</a><a href="/ecommerce-payments-jamaica">Payments</a><a href="/online-store-pricing">Pricing</a><a href="/consultation">Consultation</a></div><div class="nav-actions"><a href="/login">Log in</a><a class="btn" href="/signup">Start your store ${arrowIcon()}</a></div></nav></header>`;}
export function mini(s=demoStore().settings){return `<div class="window"><div class="window-chrome"><i></i><i></i><i></i><span>ICSS Plaza / ${esc(s.name.toLowerCase().replaceAll(' ','-'))}</span></div><div class="mini-nav">${esc(s.name)}<small><span>Shop</span><span>Our story</span><span>Bag (0)</span></small></div><div class="mini-hero"><div class="mini-copy"><small>${esc(s.tagline)}</small><h3>${esc(s.heroTitle)}</h3><span class="pill" style="background:${esc(s.accent)}">${esc(s.heroButton)}</span></div><img src="/assets/collection.svg" alt="Sample store collection"></div><div class="mini-products">${['serum','tote','candle'].map((x,i)=>`<div><img src="/assets/${x}.svg" alt="Sample product"><p>${['Botanical body oil','The everyday tote','Calm candle'][i]}</p></div>`).join('')}</div></div>`;}
function frontStage(){return `<div class="front-stage" aria-label="An example lifestyle shop created in ICSS Plaza">
 <div class="stage-orbit" aria-hidden="true"></div><div class="stage-browser">
 <div class="stage-bar"><span aria-hidden="true"><i></i><i></i><i></i></span><span>● &nbsp; STOREFRONT PREVIEW</span></div>
 <div class="stage-shop-nav"><strong>North &amp; Fern<span>.</span></strong><small>Shop &nbsp;&nbsp; Our story &nbsp;&nbsp; Bag</small></div>
 <div class="stage-shop-body"><div><span>THE EVERYDAY EDIT</span><b>Good things<br>live here.</b><small>Objects for slower mornings and well-lived days.</small><span class="stage-shop-button">Shop the collection ${arrowIcon()}</span></div><img src="/assets/plaza-studio-editorial.webp" width="780" height="650" alt="Ceramic cup, woven linens and everyday goods in a sample shop" fetchpriority="high"></div>
 <div class="stage-shop-bottom"><strong>Thoughtfully picked</strong><span>01 &nbsp; / &nbsp; THE COLLECTION</span></div>
 </div>
 <div class="stage-chip"><span aria-hidden="true">${arrowIcon()}</span><div><strong>Click to make it yours</strong><small>Edit on the page you’re looking at</small></div></div>
 <div class="stage-stamp" aria-hidden="true">BUILD <span>✳</span> SELL<br> IN JAMAICA</div>
 </div>`;}
function frontTemplate(t){return `<article class="front-template">
 <div class="front-template-art" style="--sample-bg:${esc(t.settings.background)};--sample-ink:${esc(t.settings.ink)}"><span>${esc(t.label)}</span><img src="${esc(t.art)}" alt="" width="480" height="300" loading="lazy"></div>
 <div><h3>${esc(t.label)}</h3><p>${esc(t.description)}</p><a href="/templates/${t.id}">Open full storefront preview ${arrowIcon()}</a></div></article>`;}
export function landing(){return nav()+`<main class="front-page">
 <section class="front-hero wrap" aria-labelledby="front-headline">
  <div class="front-intro"><div class="front-kicker"><span></span> THE STOREFRONT STUDIO FOR JAMAICA</div>
  <h1 id="front-headline">Your business.<br><em>Your own shop.</em></h1>
  <p>Give your business a place to sell online. Build a shop in your style, price in Jamaican dollars, and take orders for delivery or pickup.</p>
  <div class="front-hero-actions"><a class="btn front-primary" href="/signup">Start my free trial ${arrowIcon()}</a><a class="front-secondary" href="#starting-points">Explore the storefronts <span aria-hidden="true">↓</span></a></div>
  <div class="front-trial"><span>14 DAYS FREE</span><small>No card to start. You decide when to publish.</small></div></div>
  ${frontStage()}
 </section>
 <div class="wrap"><div class="front-proof" aria-label="What’s included"><div><strong>JMD or USD</strong><span>Sell in your currency</span></div><div><strong>Delivery &amp; pickup</strong><span>Set the rules for your shop</span></div><div><strong>Private drafts</strong><span>Preview before you publish</span></div><div><strong>One dashboard</strong><span>Products, stock and orders</span></div></div></div>
 <section class="wrap front-section" id="starting-points"><div class="front-section-heading"><div><div class="front-kicker">01 &nbsp; / &nbsp; THE STARTING POINT</div><h2>Pick a look.<br>Make it your own.</h2></div><p>Start with a layout built for your kind of shop. Every starter is editable, from the photos and fonts to the order of the sections.</p></div>
  <div class="front-templates">${['wholesale','fashion','yard'].map(id=>frontTemplate(templates.find(t=>t.id===id))).join('')}</div>
  <div class="front-blank"><span aria-hidden="true">＋</span><div><strong>Have something different in mind?</strong><p>Start from a blank canvas and build around your own brand.</p></div><a class="btn outline" href="/signup?template=blank">Start from scratch →</a><a class="front-secondary" href="/online-store-templates">Browse all templates →</a></div>
 </section>
 <section class="front-designer" id="demo"><div class="wrap front-section">
  <div class="front-section-heading"><div><div class="front-kicker">02 &nbsp; / &nbsp; THE STORE DESIGNER</div><h2>See the change<br>as you make it.</h2></div><p>Try a few edits in the sample below. In your own shop, click the section you want to edit, add new sections, and check how it will look on a phone before you publish.</p></div>
  <div class="demo-shell front-demo-shell"><form id="mini-editor" class="demo-editor"><div class="front-kicker">TRY AN EDIT</div><h3>Give this sample a new look.</h3><p>These edits only affect this sample.</p>${field('Store name','name','Island Studio')}${field('Hero headline','heroTitle','Everyday essentials. A little extraordinary.')}${field('Brand colour','accent','#9c7035','color')}<a class="btn" href="/demo?tab=appearance">Try the full Store Designer →</a></form><div class="demo-preview" id="mini-preview">${mini()}</div></div>
  <div class="front-editor-foot"><span>Change the wording, swap the art, or build a page from scratch.</span><a href="/demo">Explore the sample dashboard →</a></div>
 </div></section>
 <section class="wrap front-section front-business" id="payments">
  <div class="front-section-heading"><div><div class="front-kicker">03 &nbsp; / &nbsp; RUN YOUR SHOP</div><h2>From first product<br>to first order.</h2></div><p>When your design is ready, use the Launchpad to add your products, connect checkout, and publish. After launch, keep track of what sells and what needs restocking.</p></div>
  <div class="front-business-grid">
   <article><span>01</span><h3>Build your catalogue.</h3><p>Use product photos, videos, and variations for sizes, colours or pack options.</p></article>
   <article><span>02</span><h3>Set up payment and delivery.</h3><p>Connect an approved merchant account and choose delivery or pickup.</p><a href="/ecommerce-payments-jamaica">See the payment guide →</a></article>
   <article><span>03</span><h3>Share the shop.</h3><p>Copy your storefront link and share it from WhatsApp, Instagram or your business page.</p><a href="/sell-online-jamaica">Read the Jamaica selling guide →</a></article>
  </div>
  <p class="payment-note">Automated checkout adapters are included for Fygaro, PayPal and WiPay. Other options, including bank transfer and cash on delivery, use manual reconciliation. Provider approvals, currency limits and fees apply.</p>
 </section>
 <section class="wrap front-section front-pricing" id="rental"><div class="front-section-heading"><div><div class="front-kicker">THE RENTAL</div><h2>Try the shop.<br>Then decide.</h2></div><p>Test your design, catalogue and dashboard on a 14-day free trial. You can choose a paid rental from your dashboard when you’re ready.</p></div>
  <div class="front-plan-grid"><article class="front-plan"><div class="front-kicker">START HERE</div><h3>14 days free</h3><p>No card needed. Starting a trial does not enrol you in paid billing.</p><a class="btn front-primary" href="/signup">Start my free trial →</a></article>
  <article class="front-plan front-paid"><div class="front-kicker">IF YOU CHOOSE TO CONTINUE</div><h3>US$31.39 <small>/ month via PayPal</small></h3><p>Manage your subscription in Rental Billing once PayPal payments are available.</p><a href="/online-store-pricing">See trial and pricing details →</a></article></div>
 </section>
 <section class="wrap front-section front-consult" id="consultation"><div><div class="front-kicker">PREFER TO TALK IT THROUGH?</div><h2>Let’s get your shop online.</h2><p>Ask about moving your catalogue, setting up payments or choosing your starting point.</p></div><a class="btn" href="/consultation">Request a consultation →</a></section>
 </main>`+footer();}

export const homeSeo={title:'Create an Online Store in Jamaica | ICSS Plaza',description:'Build an ecommerce website for your Jamaican business. Sell products in JMD, set up delivery or pickup, and manage inventory and orders with ICSS Plaza.'};
export const marketingPages={
 '/sell-online-jamaica':{
  title:'How to Sell Products Online in Jamaica | ICSS Plaza',
  description:'A practical guide to selling products online in Jamaica: list your products, price in JMD, choose a payment method, and plan delivery or pickup.',
  kicker:'Jamaican merchant guide',h1:'How to sell products online in Jamaica',
  lead:'Start with a product range you can keep in stock, decide how customers will pay and receive orders, then launch a store you can share from WhatsApp or Instagram.',
  sections:[
   ['Build a catalogue customers can trust','Use clear photos, prices in Jamaican dollars, and descriptions that answer questions about size, ingredients, quantities or pack sizes. Keep inventory up to date so customers know what is available.'],
   ['Choose checkout options you can support','Keep payment instructions simple and verify each order before sending it. ICSS Plaza lets you configure supported payment methods for your own merchant account. Choose a method that fits how your customers pay.'],
   ['Set delivery and pickup expectations','Decide which parishes or communities you can serve. Publish clear fees, pickup instructions, estimated time frames, and how customers can get help with an order or return.'],
   ['Test your first order, then share the store','Walk through the product page, bag and checkout on a phone. Once you are ready, share the shop link with existing customers, in your social profile, and on printed receipts or packaging.']
  ]},
 '/online-store-templates':{
  title:'Online Store Templates for Jamaican Businesses | ICSS Plaza',
  description:'Preview six ecommerce storefronts for Jamaica, including grocery and wholesale, fashion, beauty, electronics, home goods and Jamaican-made products.',
  kicker:'Storefront gallery',h1:'Choose an ecommerce template for your Jamaican business',
  lead:'Preview a complete store before signing up. Every template includes a home page, product catalogue, product pages and a shopping bag you can make your own.',
  sections:[
   ['Make the store your own','Update your colours, photos, shop name and navigation. Add and arrange page sections in Store Designer, then preview the desktop or phone layout before publishing.'],
   ['Choose a layout for what you sell','Compare the catalogue, product details and category layout. For wholesale, show single items and case packs; for fashion, group sizes or colours using product options.']
  ],gallery:true},
 '/ecommerce-payments-jamaica':{
  title:'Ecommerce Payments for Jamaican Online Stores | ICSS Plaza',
  description:'Explore payment options for selling online in Jamaica, including JMD checkout, WiPay, Fygaro, PayPal, bank transfer and cash on delivery.',
  kicker:'Checkout for Jamaican merchants',h1:'How to take payments on your Jamaican online store',
  lead:'Set your selling currency and choose a payment method your business is approved to use. ICSS Plaza connects your checkout to your own merchant account.',
  sections:[
   ['Show pricing in Jamaican dollars','Set your store currency to JMD if you price for local shoppers. Choose a payment method that supports the currency you select. PayPal checkout is offered for USD stores.'],
   ['Connect a supported online payment provider','ICSS Plaza includes automated checkout adapters for Fygaro, PayPal and WiPay. Availability depends on your provider, credentials, approved use and supported currencies. Verify provider terms and fees directly before you launch.'],
   ['Offer options you can verify manually','If your shop accepts bank transfers, cash on delivery or a supported external payment link, configure clear instructions and confirm the payment manually before marking an order paid.'],
   ['Test your checkout before sharing your shop','Place a controlled test order, check the currency and final total, and confirm the payment status in your dashboard. Review delivery fees, pickup instructions and policies on a phone.']
  ]},
 '/online-store-pricing':{
  title:'Online Store Trial and Monthly Plans in Jamaica | ICSS Plaza',
  description:'Start a 14-day free ICSS Plaza trial without a card. See what’s included and how to continue with the US$31.39 monthly PayPal rental.',
  kicker:'Trial and monthly plans',h1:'What does it cost to start an online store in Jamaica?',
  lead:'Start your ICSS Plaza store with a 14-day free trial. No card is needed to start. Pay only if you choose to continue with a paid rental.',
  sections:[
   ['Use the trial to see how your shop would work','Choose a template, add products and product options, edit your pages, and check the customer experience before taking orders. Your dashboard includes inventory and order management.'],
   ['Continue with ICSS Plaza Monthly','The PayPal plan is US$31.39 per month and renews until you cancel it. When PayPal is available, choose it in Rental billing. If you subscribe during your trial, your first PayPal payment is scheduled for when the trial ends.'],
   ['Plan for the costs outside your storefront','Allow for payment processing fees, packaging, delivery and any optional domain registration. Those costs can vary by provider and by how your business fulfils orders.']
  ]}
};
export function marketingPage(path){
 const p=marketingPages[path];
 if(!Object.hasOwn(marketingPages,path))return '';
 const gallery=p.gallery?`<section class="section seo-gallery"><div class="template-grid">${templates.map(t=>`<article class="template-card"><img src="${esc(t.art)}" alt="" width="960" height="600" loading="lazy"><div class="developer-template-details"><h2>${esc(t.label)}</h2><p>${esc(t.description)}</p></div><a href="/templates/${t.id}">Preview ${esc(t.label)} →</a></article>`).join('')}</div></section>`:'';
 return nav()+`<main class="wrap seo-guide"><div class="dev-hero"><div class="eyebrow">${esc(p.kicker)}</div><h1>${esc(p.h1)}</h1><p>${esc(p.lead)}</p><div class="row"><a class="btn" href="/signup">Start my free 14-day trial →</a><a class="btn outline" href="/consultation">Ask about setup</a></div></div>${gallery}<div class="seo-guide-body"><article>${p.sections.map(([title,body])=>`<section><h2>${esc(title)}</h2><p>${esc(body)}</p></section>`).join('')}</article><aside class="feature"><h2>Plan your shop</h2><ul>${Object.entries(marketingPages).filter(([url])=>url!==path).map(([url,data])=>`<li><a href="${url}">${esc(data.kicker)} →</a></li>`).join('')}<li><a href="/consultation">Request a consultation →</a></li></ul></aside></div></main>`+footer();
}

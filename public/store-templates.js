export const sectionTypes = {
 'hero':'Hero', 'catalog':'Product collection', 'about':'Our story', 'promo':'Promotion banner',
 'image':'Image and text', 'gallery':'Photo gallery', 'video':'Video feature', 'categories':'Shop by category',
 'benefits':'Shop benefits', 'faq':'Questions and answers', 'rich':'Text block'
};
const fixed=(id,type)=>({id,type});
export const classicSections=[fixed('hero','hero'),fixed('catalog','catalog'),fixed('about','about')];
const collection=(extras,after=[])=>[fixed('hero','hero'),...extras,fixed('catalog','catalog'),...after,fixed('about','about')];
const section=(type,title,text='',extra={})=>({id:'starter-'+type,type,title,text,...extra});
const product=(name,category,price,image)=>({name,category,price,image:'/assets/'+image+'.svg'});
const starter=(id,label,description,colors,look,copy,categories,sections,items)=>({
 id,label,description,art:'/assets/template-'+id+'.svg',look,items,
 settings:{...colors,layout:look,heroImage:'/assets/template-'+id+'.svg',...copy,categories,sections}
});
export const templates=[
 starter('wholesale','Market & Wholesale','Groceries, case packs, household supplies and neighbourhood distribution.',{accent:'#176348',background:'#f6f7ec',ink:'#172e26',font:'sans'},'market',{
 tagline:'Pantry • Produce • Home',heroTitle:'Stock up. Shop local.',heroText:'Find the pantry staples, bulk essentials and everyday supplies that keep Jamaica moving.',heroButton:'Shop the aisles',announcement:'Shop pantry essentials, drinks and household supplies',catalogTitle:'Shop by the case or by the item',aboutTitle:'Built for the weekly shop',about:'A one-stop shop for families, small businesses and teams stocking up for what comes next.',navShopLabel:'Shop groceries'
 },['Produce','Pantry','Drinks','Household'],collection([
 section('categories','Shop the aisles','Find what you need faster.'),
 section('benefits','Made for everyday shopping','',{items:[{title:'Flexible quantities',text:'Shop an item at a time or by the case.'},{title:'Essentials in one place',text:'Browse groceries, drinks and household supplies.'},{title:'Delivery and pickup',text:'Check available options at checkout.'}]})
 ]),[{...product('Jamaican pantry staples','Pantry',285000,'template-wholesale'),variants:[{id:'item',name:'Single pack',price:285000},{id:'case',name:'Case of 6',price:1500000}]},product('Fresh market basket','Produce',320000,'template-wholesale'),product('Weekend refreshments','Drinks',195000,'template-wholesale')]),
 starter('fashion','Style & Streetwear','Clothing, gym wear, sneakers, shoes and accessories.',{accent:'#6c44b5',background:'#f4f1fb',ink:'#241731',font:'sans'},'runway',{
 tagline:'Street • Sport • Style',heroTitle:'Make your move.',heroText:'From the gym to the street, find pieces that work as hard as you do.',heroButton:'Explore the drop',announcement:'Discover the new collection',catalogTitle:'The latest drop',aboutTitle:'Style in motion',about:'Easy layers, good fits and statement pieces for wherever the day takes you.',navShopLabel:'Shop the drop'
 },['Clothing','Gym wear','Sneakers','Accessories'],collection([section('categories','Find your fit')],[section('image','From warm-up to weekend','Make it a set, or mix pieces to make it your own.',{image:'/assets/template-fashion.svg',button:'Shop the collection',link:'#collection'})]),[{...product('Tempo training set','Gym wear',850000,'template-fashion'),variants:['Small','Medium','Large'].map(name=>({id:name.toLowerCase(),name,price:850000}))},product('City court sneakers','Sneakers',1190000,'template-fashion'),product('Everyday oversized tee','Clothing',350000,'template-fashion')]),
 starter('yard','Made in Jamaica','Local favourites, Jamaican coffee, spices, craft and island gift boxes.',{accent:'#984117',background:'#fff3d9',ink:'#392519',font:'serif'},'editorial',{
 tagline:'Good things from yard',heroTitle:'A little taste of home.',heroText:'Explore island flavours, makers and keepsakes worth sharing, wherever home is today.',heroButton:'Explore local favourites',announcement:'Discover Jamaican flavours and makers',catalogTitle:'The yard collection',aboutTitle:'Inspired by Jamaica',about:'A place for the stories, flavours, skills and small details that make local goods feel like home.',navShopLabel:'Shop local'
 },['Coffee & cocoa','Spices & sauces','Craft','Gifts'],collection([section('image','From Jamaican makers','Introduce the people, places and stories behind your goods.',{image:'/assets/template-yard.svg'})],[section('categories','Find an island favourite')]),[product('Jamaican coffee gift bag','Coffee & cocoa',320000,'template-yard'),product('Island pepper collection','Spices & sauces',240000,'template-yard'),product('A little piece of yard','Gifts',540000,'template-yard')]),
 starter('beauty','Beauty & Wellness','Skin care, hair care, fragrances, grooming and self-care products.',{accent:'#873651',background:'#fff2ef',ink:'#452534',font:'serif'},'boutique',{
 tagline:'Make time for yourself',heroTitle:'Good skin days start here.',heroText:'Find small rituals and thoughtful essentials for hair, skin and everyday care.',heroButton:'Find your ritual',announcement:'Make space for your everyday ritual',catalogTitle:'Shop the essentials',aboutTitle:'Care, on your terms',about:'Tell customers what makes your formulas, ingredients or routines special.'
 },['Skin care','Hair care','Body','Fragrance'],collection([section('image','Your routine, made simple','Show a routine, highlight favourite ingredients or feature a before-and-after story.',{image:'/assets/template-beauty.svg'})]),[product('Daily glow serum','Skin care',360000,'serum'),product('Evening candle','Body',270000,'candle')]),
 starter('tech','Tech & Essentials','Electronics, phone accessories, home office gear and everyday upgrades.',{accent:'#234ab8',background:'#eef4ff',ink:'#141f41',font:'sans'},'market',{
 tagline:'Smart picks for daily life',heroTitle:'Get geared up.',heroText:'Shop practical accessories and everyday upgrades for work, home and on the move.',heroButton:'Browse gear',announcement:'Find the gear that fits your day',catalogTitle:'Shop tech and accessories',aboutTitle:'Practical gear, clear choices',about:'Explain product compatibility, how to get help and what customers can expect after purchase.'
 },['Audio','Phone accessories','Office','Home tech'],collection([section('categories','Explore departments')],[section('faq','Before you buy','',{items:[{title:'How can I check compatibility?',text:'Check the product description or ask us about your device before ordering.'},{title:'Where can I find delivery details?',text:'See the delivery policy at the bottom of the store.'}]})]),[product('Studio over-ear headphones','Audio',850000,'template-tech'),product('Desk charging kit','Office',370000,'template-tech')]),
 starter('home','Home & Gifts','Décor, furniture, kitchenware, handcrafted goods and celebrations.',{accent:'#6b522d',background:'#f7f1e5',ink:'#302921',font:'serif'},'boutique',{
 tagline:'For the little moments',heroTitle:'Make it feel like home.',heroText:'Objects with character, practical favourites and gifts that feel personal.',heroButton:'Explore the collection',announcement:'Thoughtful picks for home and gifting',catalogTitle:'Find something worth keeping',aboutTitle:'A home with character',about:'Share your design approach, materials and what inspires your collection.'
 },['Décor','Kitchen','Gifts','Home fragrance'],collection([],[section('gallery','Details make the difference','Show your collection in real spaces.',{images:['/assets/template-home.svg','/assets/mug.svg','/assets/candle.svg']})]),[product('Sunday morning mug','Kitchen',220000,'mug'),product('Warm amber candle','Home fragrance',290000,'candle')])
];
const market=templates.find(t=>t.id==='wholesale');
const photo=name=>'/assets/market-'+name+'.webp';
market.art=photo('hero');
market.settings.heroImage=photo('hero');
market.settings.heroAlt='A Jamaican market basket with tropical fruit, plantains and fresh greens';
market.settings.tagline='THE JAMAICAN MARKET';
market.settings.heroTitle='Your weekly shop, sorted.';
market.settings.heroText='Fresh produce, pantry staples and household essentials. Shop a few favourites or stock up by the case.';
market.settings.heroButton='Shop groceries';
market.settings.announcement='GROCERIES · HOUSEHOLD ESSENTIALS · CASE PACKS';
market.settings.catalogTitle='Shop groceries & essentials';
market.settings.aboutTitle='Good food. Smart stock-ups.';
market.settings.about='We built Market & Wholesale for the weekly grocery run and the big stock-up alike. Find produce for the kitchen, reliable pantry essentials and practical supplies for your home or business.\n\nWhether you are shopping for the family or buying by the case, browse the pack options on each product and check delivery or pickup at checkout.';
market.categoryImages={Produce:photo('produce'),Pantry:photo('pantry'),Drinks:photo('drinks'),Household:photo('household')};
market.settings.sections=[
 fixed('hero','hero'),
 section('categories','Shop by department','Find everything for the kitchen, pantry and home.'),
 {...section('benefits','Buy the way you need to','',{items:[{title:'Single packs and cases',text:'Pick a pack size that makes sense for your household or business.'},{title:'Everyday essentials',text:'Browse produce, groceries, drinks and household supplies in one shop.'},{title:'Delivery and pickup',text:'Check which options are available for your order at checkout.'}]}),tone:'soft'},
 fixed('catalog','catalog'),fixed('about','about'),
 {...section('faq','Shopping with us','',{items:[{title:'Can I order by the case?',text:'Products sold by the case show pack sizes and prices on their product pages.'},{title:'How do delivery and pickup work?',text:'See our delivery policy for details and choose an available option at checkout.'}]}),page:'contact'}
];
market.items=[
 {name:'Jamaican pantry staples',category:'Pantry',price:285000,image:photo('pantry'),sku:'MKT-101',description:'A practical mix of dry goods for the weekly shop. Choose one pack or a six-pack case for a cupboard, canteen or small business.',variants:[{id:'item',name:'Single pack',price:285000},{id:'case',name:'Case of 6',price:1500000}]},
 {name:'Fresh market basket',category:'Produce',price:320000,image:photo('produce'),sku:'MKT-102',description:'A seasonal selection of vegetables and fruit for everyday meals. Contents can vary with availability.'},
 {name:'Tropical juice selection',category:'Drinks',price:195000,image:photo('drinks'),sku:'MKT-103',description:'A mix of tropical flavours to serve chilled with lunch or set out for guests.'},
 {name:'Kitchen cleaning essentials',category:'Household',price:235000,image:photo('household'),sku:'MKT-104',description:'Kitchen basics including dishwashing supplies and reusable cleaning cloths.'},
 {name:'Wholesale grocery box',category:'Pantry',price:960000,image:photo('bulk'),sku:'MKT-105',description:'A larger grocery bundle for a shared kitchen or a small business. Review the available packs before ordering.'}
];
export const getTemplate=id=>id==='blank'?blankTemplate:templates.find(t=>t.id===id);
export function exampleStore(t){
 return {slug:t.id,template:t.id,settings:{...t.settings,name:t.label,bagLabel:'Bag',navAboutLabel:'Our story',footerText:'Thanks for shopping with us.',showHero:true,showAbout:true,currency:'JMD',customPages:[],shipping:'Sample policy: choose delivery or pickup at checkout. A live merchant sets the available service areas, fees and collection instructions.',returns:'Sample policy: contact the seller using the order reference if any goods arrive damaged or incorrect. A live merchant publishes its own returns terms.',privacy:'Sample policy: a merchant uses contact and delivery details to process and support your order.',terms:'This is an example storefront. It does not accept orders or payments.'},products:t.items.map((p,i)=>({...p,id:'sample-'+i,active:true,featured:i===0,stock:15,variants:(p.variants||[]).map(v=>({...v,stock:10})),description:p.description||'Sample product for this storefront template.'}))};
}

// A neutral starting point, intentionally without stock imagery or sample products.
export const blankTemplate={
 id:'blank',label:'Blank canvas',description:'A clean shop you can build around your own brand, photos and sections.',look:'minimal',art:'',items:[],
 settings:{accent:'#165c50',background:'#fbfaf6',ink:'#17322d',font:'sans',layout:'minimal',headerStyle:'split',grid:'standard',
  announcement:'',tagline:'WELCOME TO OUR SHOP',heroTitle:'Welcome to our shop.',heroText:'Introduce your business and tell shoppers what they can find here.',
  heroButton:'Shop our products',heroImage:'',heroAlt:'',catalogTitle:'Shop our products',navShopLabel:'Shop',navAboutLabel:'Our story',
  aboutTitle:'Our story',about:'Tell shoppers what makes your business yours.',categories:[],showHero:true,showAbout:true,sections:classicSections.map(s=>({...s}))}
};

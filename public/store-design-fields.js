export const designGroups={
 brand:{label:'Brand & navigation',fields:[
  ['name','Store name'],['logo','Store logo','image'],['announcement','Announcement bar'],['headerStyle','Header style','options',[['split','Brand left'],['centered','Centred brand']]],['navShopLabel','Shop link label'],['navAboutLabel','Story link label'],['bagLabel','Shopping bag label']
 ]},
 theme:{label:'Colours & layout',fields:[
  ['accent','Accent','color'],['background','Page background','color'],['ink','Text','color'],
  ['font','Headings','options',[['serif','Classic serif'],['sans','Modern sans serif']]],
  ['layout','Store layout','options',[['editorial','Editorial split'],['market','Market'],['runway','Runway'],['boutique','Boutique'],['minimal','Minimal']]],
  ['grid','Product grid','options',[['standard','Standard'],['compact','More per row'],['large','Large cards']]]
 ]},
 hero:{label:'Hero',fields:[['tagline','Eyebrow'],['heroTitle','Headline'],['heroText','Description','text'],['heroButton','Shop button label'],['heroImage','Hero photo','image'],['heroAlt','Photo description for screen readers']]},
 catalog:{label:'Product collection',fields:[['catalogTitle','Collection title'],['categories','Categories (one per line)','categories'],['searchLabel','Product search prompt']]},
 about:{label:'Our story',fields:[['aboutTitle','Heading'],['about','Story','text']]},
 footer:{label:'Footer & policies',fields:[['footerText','Footer note'],['address','Business address','text'],['phone','Phone'],['instagram','Instagram handle'],['shipping','Delivery & shipping','text'],['returns','Returns & refunds','text'],['privacy','Privacy notice','text'],['terms','Sales terms','text'],['customPages','Extra pages','pages']]}
};
export const designKeys=[...new Set(Object.values(designGroups).flatMap(g=>g.fields.map(f=>f[0]))) ,'sections'];

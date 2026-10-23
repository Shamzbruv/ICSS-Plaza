// Rebuild exported brand sizes from the approved master. Requires sharp available locally.
// Runtime has no image-generation dependency. Run: node scripts/build-brand-assets.mjs
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
const require=createRequire(import.meta.url);
let sharp;
try { sharp=require('sharp'); } catch { sharp=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/sharp'); }
const out=resolve('public/assets/brand');mkdirSync(out,{recursive:true});
const source=process.env.PLAZA_BRAND_MASTER || resolve(out,'mark-master.png');
const navy='#123B5A',blue='#267FB0',cyan='#39A8BF',gold='#F6BC27',paper='#FAFBF8';
const master=await sharp(source).trim().resize(1024,1024,{fit:'contain',background:'#00000000'}).png({palette:true,colours:128,dither:0.3}).toBuffer();
writeFileSync(resolve(out,'mark-master.png'),master);
const lockupMark=await sharp(master).resize(512,512).png({palette:true,colours:64,dither:0}).toBuffer();
const embedded='data:image/png;base64,'+lockupMark.toString('base64');
const svg=(width,height,body)=>`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${body}</svg>`;
const mark=(x,y,size)=>`<image x="${x}" y="${y}" width="${size}" height="${size}" xlink:href="${embedded}"/>`;
const text=(x,y,value,size=80,fill=navy,weight=700,extra='')=>`<text x="${x}" y="${y}" fill="${fill}" font-family="DejaVu Sans,Arial,sans-serif" font-size="${size}" font-weight="${weight}" ${extra}>${value}</text>`;
async function exportSVG(name,width,height,body,png=true){const content=svg(width,height,body);writeFileSync(resolve(out,name+'.svg'),content);if(png)await sharp(Buffer.from(content)).png({palette:true,colours:128,dither:0.3}).toFile(resolve(out,name+'.png'));return content;}
await exportSVG('logo-horizontal',900,220,mark(4,6,208)+text(240,131,'ICSS',93)+text(505,131,'Plaza',93,blue,400)+text(244,169,'BY iCREATE SOLUTIONS &amp; SERVICES',19,navy,500,'letter-spacing="1.2"'));
await exportSVG('logo-horizontal-light',900,220,mark(4,6,208)+text(240,131,'ICSS',93,paper)+text(505,131,'Plaza',93,gold,400)+text(244,169,'BY iCREATE SOLUTIONS &amp; SERVICES',19,paper,500,'letter-spacing="1.2"'));
await exportSVG('logo-stacked',700,760,mark(100,8,500)+text(350,613,'ICSS Plaza',88,navy,700,'text-anchor="middle"')+text(350,662,'BY iCREATE SOLUTIONS &amp; SERVICES',21,blue,500,'text-anchor="middle" letter-spacing="1.3"'));
await sharp(master).resize(512,512).png({palette:true,colours:128,dither:0.3}).toFile(resolve(out,'mark.png'));
// A deliberately simplified responsive symbol preserves legibility in 16-pixel tabs.
const small=svg(64,64,`<path fill="${navy}" d="M32 2C15 2 3 15 3 31c0 13 7 22 17 27h4v3h16v-3h4c10-5 17-14 17-27C61 15 49 2 32 2z"/><path fill="white" d="M15 29c0-12 8-20 17-20s17 8 17 20c0 9-5 15-11 18H26c-6-3-11-9-11-18z"/><path d="M21 34h22l-4-9H25z" fill="${gold}"/><path d="M24 35v12h16V35" fill="none" stroke="${blue}" stroke-width="4"/><path d="M32 15v9" stroke="${cyan}" stroke-width="4" stroke-linecap="round"/><path d="M26 54h12M28 59h8" stroke="${blue}" stroke-width="3" stroke-linecap="round"/>`);
writeFileSync(resolve(out,'favicon.svg'),small);
for(const size of [16,32,48])await sharp(Buffer.from(small)).resize(size,size).png().toFile(resolve(out,`favicon-${size}.png`));
const icoSizes=[16,32,48],icoImages=await Promise.all(icoSizes.map(size=>sharp(Buffer.from(small)).resize(size,size).png().toBuffer()));
const header=Buffer.alloc(6+icoSizes.length*16);header.writeUInt16LE(1,2);header.writeUInt16LE(icoSizes.length,4);let offset=header.length;
icoImages.forEach((b,i)=>{const at=6+i*16;header[at]=icoSizes[i];header[at+1]=icoSizes[i];header.writeUInt16LE(1,at+4);header.writeUInt16LE(32,at+6);header.writeUInt32LE(b.length,at+8);header.writeUInt32LE(offset,at+12);offset+=b.length;});
writeFileSync(resolve('public/favicon.ico'),Buffer.concat([header,...icoImages]));
writeFileSync(resolve('public/favicon.svg'),small);
writeFileSync(resolve('public/assets/plaza.svg'),small);
await exportSVG('mask-icon',64,64,`<path fill="black" fill-rule="evenodd" d="M32 2C15 2 3 15 3 31c0 13 7 22 17 27h4v3h16v-3h4c10-5 17-14 17-27C61 15 49 2 32 2zm0 8c12 0 20 9 20 21 0 8-5 16-12 19H24c-7-3-12-11-12-19 0-12 8-21 20-21zm-9 15h18l5 11H18zm1 14h16v8H24z"/>`,false);
for(const size of [192,512]){
 const base=svg(size,size,`<rect width="${size}" height="${size}" rx="${Math.round(size*.15)}" fill="${paper}"/>${mark(size*.06,size*.06,size*.88)}`);
 await sharp(Buffer.from(base)).png({palette:true,colours:128,dither:0.3}).toFile(resolve(out,`app-icon-${size}.png`));
 const maskable=svg(size,size,`<rect width="${size}" height="${size}" fill="#E9F3F8"/>${mark(size*.16,size*.16,size*.68)}`);
 await sharp(Buffer.from(maskable)).png({palette:true,colours:128,dither:0.3}).toFile(resolve(out,`app-icon-maskable-${size}.png`));
}
await sharp(resolve(out,'app-icon-512.png')).resize(180,180).png().toFile(resolve(out,'apple-touch-icon.png'));
const pattern=`<defs><pattern id="circuit" width="160" height="160" patternUnits="userSpaceOnUse"><path d="M0 30h65l30 30v100M160 110h-45l-20-20V0" fill="none" stroke="${cyan}" stroke-width="2" opacity=".16"/><circle cx="65" cy="30" r="5" fill="none" stroke="${gold}" stroke-width="2" opacity=".3"/></pattern></defs><rect width="100%" height="100%" fill="url(#circuit)"/>`;
await exportSVG('circuit-pattern',640,400,pattern,false);
await exportSVG('social-preview',1200,630,`<rect width="1200" height="630" fill="${navy}"/>${pattern}<circle cx="1060" cy="40" r="280" fill="${blue}" opacity=".13"/>${mark(735,80,440)}${text(72,100,'iCREATE SOLUTIONS &amp; SERVICES',19,'#B9DAE8',500,'letter-spacing="2"')}${text(72,210,'ICSS',82,paper)}${text(305,210,'Plaza',82,gold,400)}${text(72,312,'Your business.',57,paper,700)}${text(72,384,'Your online store.',57,paper,700)}${text(75,455,'Rent a store. Make it yours. Start selling.',25,'#BDD8E6',400)}<rect x="72" y="510" width="300" height="48" rx="12" fill="${gold}"/>${text(97,542,'Explore your possibilities',19,navy,700)}`);
await exportSVG('social-square',1080,1080,`<rect width="1080" height="1080" fill="${navy}"/>${pattern}${mark(300,85,480)}${text(540,695,'ICSS Plaza',98,paper,700,'text-anchor="middle"')}${text(540,790,'Your business. Your online store.',36,gold,400,'text-anchor="middle"')}${text(540,945,'BY iCREATE SOLUTIONS &amp; SERVICES',24,'#BED9E6',500,'text-anchor="middle" letter-spacing="2"')}`);
await exportSVG('email-header',800,200,`<rect width="800" height="200" fill="${paper}"/>${mark(36,20,160)}${text(220,112,'ICSS Plaza',68,navy,700)}${text(223,150,'BY iCREATE SOLUTIONS &amp; SERVICES',17,blue,500)}`);
await exportSVG('receipt-header',1000,220,`<rect width="1000" height="220" fill="white"/>${mark(20,10,180)}${text(230,122,'ICSS Plaza',76,navy,700)}${text(233,165,'iCreate Solutions &amp; Services',22,blue,400)}<rect y="210" width="1000" height="10" fill="${gold}"/>`);
await exportSVG('powered-by',600,120,mark(0,6,108)+text(130,44,'POWERED BY',17,blue,500,'letter-spacing="2"')+text(128,88,'ICSS Plaza',39,navy,700));
await exportSVG('brand-banner',1440,420,`<rect width="1440" height="420" fill="${navy}"/>${pattern}${mark(90,48,320)}${text(460,184,'ICSS Plaza',110,paper,700)}${text(466,260,'Your business. Your store. Within reach.',36,gold,400)}`);
await exportSVG('welcome',640,400,`<rect width="640" height="400" rx="28" fill="#EDF5FA"/><circle cx="492" cy="88" r="68" fill="#FAE9B1"/><rect x="220" y="132" width="270" height="192" rx="12" fill="white" stroke="${navy}" stroke-width="7"/><path d="M197 145h316l-35-72H232z" fill="${blue}" stroke="${navy}" stroke-width="7" stroke-linejoin="round"/><path d="M275 77l-12 65m74-65v65m65-65 12 65" stroke="${gold}" stroke-width="30"/><rect x="252" y="197" width="78" height="128" rx="7" fill="${navy}"/><rect x="359" y="198" width="98" height="73" rx="5" fill="#BDE0EB"/><path d="M86 321h476" stroke="${navy}" stroke-width="7" stroke-linecap="round"/>${mark(43,180,160)}<circle cx="536" cy="254" r="38" fill="${gold}"/><path d="m518 253 13 13 23-26" fill="none" stroke="${navy}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`,false);
const illustrations={
 'empty-products':`<path d="m180 100 140-50 140 50v160l-140 65-140-65z" fill="white" stroke="${navy}" stroke-width="7"/><path d="m180 100 140 65 140-65m-140 65v160" fill="none" stroke="${blue}" stroke-width="6"/><path d="m252 75 140 64v55l-30 15v-54L224 85" fill="${gold}"/><circle cx="468" cy="280" r="43" fill="${cyan}"/><path d="M447 280h42m-21-21v42" stroke="white" stroke-width="7" stroke-linecap="round"/>`,
 'empty-orders':`<rect x="213" y="57" width="214" height="280" rx="15" fill="white" stroke="${navy}" stroke-width="7"/><rect x="262" y="40" width="115" height="40" rx="12" fill="${gold}"/><path d="M250 126h140m-140 47h140m-140 47h82m-82 47h120" stroke="${blue}" stroke-width="9" stroke-linecap="round"/><circle cx="439" cy="281" r="53" fill="${cyan}"/><path d="m413 281 17 17 31-35" fill="none" stroke="white" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>`,
 'empty-media':`<rect x="155" y="95" width="294" height="208" rx="20" fill="#DCECF4" stroke="${blue}" stroke-width="7" transform="rotate(-8 300 200)"/><rect x="198" y="80" width="294" height="208" rx="20" fill="white" stroke="${navy}" stroke-width="7"/><circle cx="408" cy="135" r="24" fill="${gold}"/><path d="m220 261 80-92 65 75 38-43 66 60" fill="#BEE4E9" stroke="${cyan}" stroke-width="6" stroke-linejoin="round"/>`,
 'empty-cart':`<path d="M165 92h43l36 164h199l38-126H216" fill="white" stroke="${navy}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/><path d="M265 157h170m-155 42h144" stroke="${cyan}" stroke-width="9" stroke-linecap="round"/><circle cx="277" cy="296" r="23" fill="${gold}" stroke="${navy}" stroke-width="6"/><circle cx="409" cy="296" r="23" fill="${gold}" stroke="${navy}" stroke-width="6"/>`,
 'not-found':`<circle cx="327" cy="187" r="106" fill="white" stroke="${navy}" stroke-width="9"/><path d="m409 270 65 65" stroke="${blue}" stroke-width="27" stroke-linecap="round"/><path d="M280 166h94l-15-36h-64z" fill="${gold}"/><path d="M290 173v69h74v-69" fill="#D9ECF4" stroke="${blue}" stroke-width="8"/><path d="m304 195 42 31m0-31-42 31" stroke="${navy}" stroke-width="7" stroke-linecap="round"/>`,
 'payment-success':`<circle cx="320" cy="190" r="125" fill="#DCEFF1"/><circle cx="320" cy="190" r="91" fill="${navy}"/><path d="m270 191 33 33 67-73" fill="none" stroke="${gold}" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/><circle cx="155" cy="103" r="11" fill="${cyan}"/><circle cx="481" cy="280" r="10" fill="${gold}"/>`
};
for(const [name,body] of Object.entries(illustrations))await exportSVG(name,640,400,`<ellipse cx="320" cy="340" rx="220" ry="19" fill="#DDEBF2"/>${body}`,false);
writeFileSync(resolve('public/site.webmanifest'),JSON.stringify({id:'/',name:'ICSS Plaza — iCreate Solutions & Services',short_name:'ICSS Plaza',description:'Rent your online store. Make it yours. Start selling.',start_url:'/',scope:'/',display:'standalone',background_color:paper,theme_color:navy,lang:'en-JM',icons:[{src:'/assets/brand/app-icon-192.png',sizes:'192x192',type:'image/png',purpose:'any'},{src:'/assets/brand/app-icon-512.png',sizes:'512x512',type:'image/png',purpose:'any'},{src:'/assets/brand/app-icon-maskable-192.png',sizes:'192x192',type:'image/png',purpose:'maskable'},{src:'/assets/brand/app-icon-maskable-512.png',sizes:'512x512',type:'image/png',purpose:'maskable'}]},null,2)+'\n');
writeFileSync(resolve(out,'tokens.json'),JSON.stringify({name:'ICSS Plaza',parent:'iCreate Solutions & Services',colours:{navy,blue,cyan,gold,lime:'#8EB83D',paper},typography:{ui:'Arial, Helvetica, sans-serif',wordmark:'DejaVu Sans, Arial, sans-serif'},clearSpace:'At least one quarter of the mark width on each side',minimumMarkSize:24,responsiveMark:'Use favicon.svg below 24px'},null,2)+'\n');
console.log('Brand assets exported.');

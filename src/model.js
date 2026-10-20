import { randomBytes, scryptSync, timingSafeEqual, createCipheriv, createDecipheriv, createHash } from 'node:crypto';
export const id = () => randomBytes(12).toString('hex');
export const hash = x => createHash('sha256').update(x).digest('hex');
export const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
export function text(x, max = 500, min = 0) { if (typeof x !== 'string' || x.trim().length < min || x.length > max) fail(`Expected text between ${min} and ${max} characters.`); return x.trim(); }
export function integer(x, max = 100000000, min = 0) { if (!Number.isSafeInteger(x) || x < min || x > max) fail('Invalid numeric value.'); return x; }
export function passwordHash(password) { text(password, 128, 12); const salt = randomBytes(16).toString('hex'); return salt + ':' + scryptSync(password, salt, 64).toString('hex'); }
export function passwordMatches(password, encoded) { try { const [salt, key] = encoded.split(':'); return timingSafeEqual(scryptSync(password, salt, 64), Buffer.from(key, 'hex')); } catch { return false; } }
export function encrypt(value, key) { if (!/^[a-f0-9]{64}$/i.test(key || '')) fail('Gateway secrets require the platform encryption key to be configured.', 503); const iv = randomBytes(12); const c = createCipheriv('aes-256-gcm', Buffer.from(key, 'hex'), iv); return [iv.toString('hex'), Buffer.concat([c.update(JSON.stringify(value)), c.final()]).toString('hex'), c.getAuthTag().toString('hex')].join(':'); }
export function decrypt(value, key) { const [iv, data, tag] = value.split(':'); const d = createDecipheriv('aes-256-gcm', Buffer.from(key, 'hex'), Buffer.from(iv, 'hex')); d.setAuthTag(Buffer.from(tag, 'hex')); return JSON.parse(Buffer.concat([d.update(Buffer.from(data, 'hex')), d.final()]).toString()); }
export function safeURL(value, hosts) { const u = new URL(value); if (u.protocol !== 'https:' || u.username || u.password || (hosts && !hosts.some(h => u.hostname === h || u.hostname.endsWith('.' + h)))) fail('Use an approved HTTPS payment URL.'); return u.toString(); }
export function imageURL(value) { if (!value) return ''; if (/^\/assets\/[a-z0-9-]+\.svg$/.test(value) || /^\/api\/images\/[a-f0-9]{24}$/.test(value)) return value; fail('Upload an image using the media library.'); }
export const defaults = () => ({
  name: 'Your store', tagline: 'Good things. Made for you.', heroTitle: 'Your next favourite starts here.', heroText: 'Discover a thoughtful collection, selected with care. Shop your favourites and find something new.', heroButton: 'Explore the collection', heroImage: '/assets/collection.svg', logo: '', announcement: 'Welcome to our store • Shop something special',
  accent: '#9c7035', background: '#f8f5ef', ink: '#332a24', font: 'serif', layout: 'editorial', currency: 'JMD',
  catalogTitle: 'Explore the collection', navShopLabel: 'Shop', navAboutLabel: 'Our story', footerText: 'Thank you for supporting our business.', customPages: [], aboutTitle: 'A little about us', about: 'We believe in good products and even better service.', contactEmail: '', phone: '', address: '', instagram: '',
  shipping: 'Contact us for delivery areas and estimated delivery times.', returns: 'Contact the seller before returning an item. Your statutory rights remain unaffected.', privacy: 'We use your order details to fulfil your purchase and provide customer service. Contact us about access, correction or deletion of your personal information.', terms: 'Orders are subject to stock availability. Please check product descriptions and delivery details before ordering.',
  shippingFee: 0, freeShippingOver: 0, taxBps: 0, taxLabel: 'Tax', pickup: true, shippingEnabled: true, showAbout: true, showHero: true,
  categories: ['All products'], defaultPayment: '', published: false
});
export function settings(input, current) {
 const out = {...current};
 for (const k of ['name','tagline','heroTitle','heroButton','aboutTitle','announcement','taxLabel','catalogTitle','navShopLabel','navAboutLabel','footerText']) if (k in input) out[k] = text(input[k], 180, k === 'name' ? 1 : 0);
 for (const k of ['heroText','about','shipping','returns','privacy','terms','address']) if (k in input) out[k] = text(input[k], 6000);
 for (const k of ['contactEmail','phone','instagram']) if (k in input) out[k] = text(input[k], 200);
 if (out.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(out.contactEmail)) fail('Enter a valid contact email.');
 for (const k of ['accent','background','ink']) if (k in input) { if (!/^#[0-9a-f]{6}$/i.test(input[k])) fail('Invalid theme colour.'); out[k] = input[k]; }
 for (const k of ['logo','heroImage']) if (k in input) out[k] = imageURL(input[k]);
 for (const [k, values] of Object.entries({font:['serif','sans'],layout:['editorial','minimal'],currency:['JMD','USD']})) if (k in input) { if (!values.includes(input[k])) fail('Invalid setting.'); out[k] = input[k]; }
 for (const k of ['shippingFee','freeShippingOver']) if (k in input) out[k] = integer(input[k]);
 if ('taxBps' in input) out.taxBps = integer(input.taxBps, 10000);
 for (const k of ['published','pickup','shippingEnabled','showAbout','showHero']) if (k in input) { if (typeof input[k] !== 'boolean') fail('Invalid toggle.'); out[k] = input[k]; }
 if ('categories' in input) { if (!Array.isArray(input.categories) || input.categories.length > 30) fail('Up to 30 categories.'); out.categories = [...new Set(input.categories.map(x => text(x, 60, 1)))]; }
 if ('customPages' in input) { if(!Array.isArray(input.customPages)||input.customPages.length>10)fail('Up to 10 custom pages.'); out.customPages=input.customPages.map(p=>({title:text(p.title,100,1),content:text(p.content,10000,1)})); }
 if ('defaultPayment' in input) out.defaultPayment = text(input.defaultPayment, 40);
 return out;
}
export function product(input) {
 const p = { name: text(input.name,180,1), description: text(input.description || '',6000), category: text(input.category || 'General',60), sku: text(input.sku || '',100), price: integer(input.price), stock: integer(input.stock,1000000), image: imageURL(input.image || ''), active: input.active !== false, featured: input.featured === true, type: input.type === 'service' ? 'service' : 'physical', variants: [] };
 if (input.variants) { if (!Array.isArray(input.variants) || input.variants.length > 30) fail('Up to 30 variants.'); p.variants = input.variants.map(v => ({id: text(v.id || id(),60,1), name: text(v.name,100,1), price: integer(v.price), stock: integer(v.stock,1000000)})); if (new Set(p.variants.map(v=>v.id)).size !== p.variants.length) fail('Duplicate variant.'); }
 return p;
}
export function totals(lines, s, delivery) { const subtotal = lines.reduce((a,x) => a + x.price*x.quantity, 0); const shipping = delivery === 'pickup' || (s.freeShippingOver && subtotal >= s.freeShippingOver) ? 0 : s.shippingFee; const tax = Math.round(subtotal*s.taxBps/10000); const total = subtotal+shipping+tax; integer(total,100000000,1); return {subtotal,shipping,tax,total}; }

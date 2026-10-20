import { createHmac, createHash, timingSafeEqual } from 'node:crypto';
import { fail, safeURL } from './model.js';
export const gateways = [
 {id:'fygaro',name:'Fygaro',mode:'automated',currencies:['JMD','USD'],url:'https://help.fygaro.com/en-us/article/fygaro-links-integration-api-h78p9y/',fields:['buttonURL','keyId','secret'],note:'Signed checkout and verified payment hooks. Merchant approval and a plan supporting JWT are required.'},
 {id:'paypal',name:'PayPal',mode:'automated',currencies:['USD'],url:'https://developer.paypal.com/docs/api/orders/v2/',fields:['clientId','secret'],note:'Server-created orders and verified captures. USD stores only; no automatic currency conversion.'},
 {id:'wipay',name:'WiPay Jamaica',mode:'automated',currencies:['JMD','USD'],url:'https://docs.wipayfinancial.com/payments-api',fields:['accountNumber','secret'],note:'Hosted checkout with server-side response-hash validation. A verified business account is required.'},
 {id:'ezee',name:'EzeePayments',mode:'manual',currencies:['JMD'],url:'https://ezeepayments.com/',fields:['paymentURL','instructions'],note:'Merchant-issued payment link / instructions. Confirm each payment in your provider account. Bespoke API activation requires provider documentation.'},
 {id:'ncb',name:'NCB eCommerce / Powertranz',mode:'manual',currencies:['JMD','USD'],url:'https://www.jncb.com/ecommerce/index.html',fields:['paymentURL','instructions'],note:'Approved merchant hosted link / instructions. A bank-specific API adapter requires your acquiring-bank documentation.'},
 {id:'scotia',name:'Scotiabank eCommerce',mode:'manual',currencies:['JMD','USD'],url:'https://jm.scotiabank.com/corporate-commercial/scotia-e-commerce/ecommerce-solutions.html',fields:['paymentURL','instructions'],note:'Approved merchant hosted link / instructions. Direct API integration requires your bank’s technical specification.'},
 {id:'lynk',name:'Lynk Business',mode:'manual',currencies:['JMD'],url:'https://www.lynk.us/lynk-for-business',fields:['paymentURL','instructions'],note:'Merchant payment link or Lynk ID. Verify receipt in your business account before marking paid.'},
 {id:'bank',name:'Bank transfer',mode:'manual',currencies:['JMD','USD'],fields:['instructions'],note:'Show your business bank details. Confirm receipt before fulfilling.'},
 {id:'cod',name:'Cash on delivery / pickup',mode:'manual',currencies:['JMD','USD'],fields:['instructions'],note:'Collect payment on delivery or pickup and record it in the dashboard.'},
 {id:'custom',name:'Other approved provider',mode:'manual',currencies:['JMD','USD'],fields:['label','paymentURL','instructions'],note:'Use your provider’s hosted HTTPS payment link. Payments require manual reconciliation until a dedicated adapter is added.'}
];
export function validateGateway(provider, input, old={}) {
 const g = gateways.find(g=>g.id===provider); if (!g) fail('Unknown gateway.');
 const c = { environment: input.environment === 'live' ? 'live' : 'sandbox' };
 for (const field of g.fields) { const value = input[field] || old[field] || ''; if (typeof value !== 'string' || value.length > 3000) fail('Invalid gateway setting.'); c[field] = value.trim(); }
 if (g.mode === 'automated' && g.fields.some(k=>!c[k])) fail('Complete all gateway credentials.');
 if (c.buttonURL) c.buttonURL = safeURL(c.buttonURL,['fygaro.com']);
 if (c.paymentURL) c.paymentURL = safeURL(c.paymentURL);
 if (g.mode==='manual' && !c.paymentURL && !c.instructions) fail('Add payment instructions or a merchant payment link.');
 return c;
}
export const same = (a,b) => { const x=Buffer.from(String(a)),y=Buffer.from(String(b)); return x.length===y.length && timingSafeEqual(x,y); };
export function fygaroJWT(order,c) {
 const now=Math.floor(Date.now()/1000); const enc = x=>Buffer.from(JSON.stringify(x)).toString('base64url');
 const unsigned = enc({alg:'HS256',typ:'JWT',kid:c.keyId})+'.'+enc({amount:(order.total/100).toFixed(2),currency:order.currency,custom_reference:order.id,exp:now+3600,nbf:now-30});
 return unsigned+'.'+createHmac('sha256',c.secret).update(unsigned).digest('base64url');
}
export function verifyFygaro(raw, headers, c, now=Date.now()) {
 if (headers['fygaro-key-id']!==c.keyId) return false;
 const parts=String(headers['fygaro-signature']||'').split(',').map(x=>x.trim());
 const t=parts.find(x=>x.startsWith('t='))?.slice(2); if (!/^\d+$/.test(t||'') || Math.abs(now/1000-Number(t))>300) return false;
 const expected=createHmac('sha256',c.secret).update(Buffer.concat([Buffer.from(t+'.'),raw])).digest('hex');
 return parts.filter(x=>x.startsWith('v1=')).some(x=>same(expected,x.slice(3)));
}
export const wiHash = (transaction,total,key)=>createHash('md5').update(transaction+(total/100).toFixed(2)+key).digest('hex');
async function request(url, options, fetcher) {
 const response=await fetcher(url,{...options,signal:AbortSignal.timeout(20000)});
 if (!response.ok) fail('The payment provider could not complete this request. Contact the store with your order reference.',502);
 return response.json();
}
async function paypalToken(c, fetcher) {
 const base=c.environment==='live'?'https://api-m.paypal.com':'https://api-m.sandbox.paypal.com';
 const result=await request(base+'/v1/oauth2/token',{method:'POST',headers:{Authorization:'Basic '+Buffer.from(c.clientId+':'+c.secret).toString('base64'),'Content-Type':'application/x-www-form-urlencoded'},body:'grant_type=client_credentials'},fetcher);
 if (!result.access_token) fail('PayPal access failed.',502); return {base,token:result.access_token};
}
export async function initiate(order,c,baseURL,fetcher=fetch) {
 const callback=`${baseURL}/api/payments/${order.tenant_id}/${order.gateway}/return?order=${order.id}`;
 if (order.gateway==='fygaro') { const u=new URL(c.buttonURL); u.searchParams.set('jwt',fygaroJWT(order,c)); return {url:u.toString()}; }
 if (order.gateway==='paypal') {
 const {base,token}=await paypalToken(c,fetcher);
 const p=await request(base+'/v2/checkout/orders',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json','PayPal-Request-Id':order.id},body:JSON.stringify({intent:'CAPTURE',purchase_units:[{reference_id:order.id,custom_id:order.id,amount:{currency_code:order.currency,value:(order.total/100).toFixed(2)}}],payment_source:{paypal:{experience_context:{return_url:callback,cancel_url:baseURL+'/s/'+order.slug+'?payment=cancelled',user_action:'PAY_NOW'}}}})},fetcher);
 const link=p.links?.find(x=>['payer-action','approve'].includes(x.rel)); if (!link) fail('PayPal did not return a checkout URL.',502);
 return {url:safeURL(link.href,['paypal.com']),providerId:p.id}; }
 if (order.gateway==='wipay') {
 const host=c.environment==='live'?'jm.wipayfinancial.com':'jmsb.wipayfinancial.com';
 const p=await request(`https://${host}/plugins/payments/request`,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({account_number:c.accountNumber,country_code:'JM',currency:order.currency,environment:c.environment,fee_structure:'merchant_absorb',method:'credit_card_co',order_id:order.short_id,origin:'ICSSPlaza',response_url:callback,total:(order.total/100).toFixed(2),email:order.customer.email})},fetcher);
 return {url:safeURL(p.url,['wipayfinancial.com']),providerId:p.transaction_id || ''}; }
 return {url:c.paymentURL || null,instructions:c.instructions || '',manual:true};
}
export async function capturePayPal(order,c,tokenId,fetcher=fetch) {
 if (!order.provider_id || tokenId!==order.provider_id) fail('Payment reference mismatch.');
 const {base,token}=await paypalToken(c,fetcher);
 const url=`${base}/v2/checkout/orders/${encodeURIComponent(tokenId)}`;
 const headers={Authorization:'Bearer '+token,'Content-Type':'application/json'};
 // Reconcile an already completed capture before attempting another. This also
 // recovers when capture succeeded but the customer lost their connection.
 let result=await request(url,{headers},fetcher);
 if(result.status!=='COMPLETED') {
  try { result=await request(url+'/capture',{method:'POST',headers:{...headers,'PayPal-Request-Id':'capture-'+order.id},body:'{}'},fetcher); }
  catch(error) { result=await request(url,{headers},fetcher); if(result.status!=='COMPLETED') throw error; }
 }
 const unit=result.purchase_units?.[0]; const capture=unit?.payments?.captures?.[0];
 if (result.id!==tokenId || result.status!=='COMPLETED' || unit?.reference_id!==order.id || capture?.status!=='COMPLETED' || capture.amount?.currency_code!==order.currency || Math.round(Number(capture.amount?.value)*100)!==order.total) fail('Payment is awaiting verification.',409);
 return capture.id;
}

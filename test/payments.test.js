import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {initiate,capturePayPal,fygaroJWT,verifyFygaro,wiHash,validateGateway} from '../src/payments.js';
const order={id:'abc123',tenant_id:'tenant123',slug:'test-store',short_id:'abc123short',gateway:'paypal',currency:'USD',total:12345,customer:{email:'buyer@example.com'}};
const credentials={clientId:'example-client',secret:'example-secret',environment:'sandbox'};
const response=x=>new Response(JSON.stringify(x),{status:200,headers:{'Content-Type':'application/json'}});
test('PayPal creates server-priced orders with idempotency and fixed callback origin',async()=>{
 const calls=[];const fetcher=async(url,opts)=>{calls.push({url,opts});return response(url.endsWith('/token')?{access_token:'test-token'}:{id:'PP-123',links:[{rel:'payer-action',href:'https://www.sandbox.paypal.com/checkoutnow?token=PP-123'}]});};
 const result=await initiate(order,credentials,'https://plaza.example',fetcher);assert.equal(result.providerId,'PP-123');const body=JSON.parse(calls[1].opts.body);assert.equal(body.purchase_units[0].amount.value,'123.45');assert.equal(calls[1].opts.headers['PayPal-Request-Id'],order.id);assert.match(body.payment_source.paypal.experience_context.return_url,/^https:\/\/plaza.example\/api\/payments\/tenant123\/paypal\/return/);
});
const completed=(extra={})=>({id:'PP-123',status:'COMPLETED',purchase_units:[{reference_id:order.id,payments:{captures:[{id:'CAP-1',status:'COMPLETED',amount:{currency_code:'USD',value:'123.45',...extra}}]}}]});
test('PayPal confirms amount, currency, provider ID and order reference; completed captures reconcile',async()=>{
 const o={...order,provider_id:'PP-123'};let calls=0;let result=completed();const f=async(url)=>{calls++;return response(url.endsWith('/token')?{access_token:'token'}:result);};
 assert.equal(await capturePayPal(o,credentials,'PP-123',f),'CAP-1');assert.equal(calls,2);
 await assert.rejects(()=>capturePayPal(o,credentials,'wrong',f),/reference mismatch/);
 result=completed({value:'1.00'});await assert.rejects(()=>capturePayPal(o,credentials,'PP-123',f),/verification/);
 result=completed({currency_code:'JMD'});await assert.rejects(()=>capturePayPal(o,credentials,'PP-123',f),/verification/);
 result=completed();result.purchase_units[0].reference_id='other-order';await assert.rejects(()=>capturePayPal(o,credentials,'PP-123',f),/verification/);
});
test('PayPal approved orders capture once with a stable idempotency key',async()=>{
 const calls=[];const f=async(url,opts)=>{calls.push({url,opts});return response(url.endsWith('/token')?{access_token:'token'}:url.endsWith('/capture')?completed():{id:'PP-123',status:'APPROVED'});};
 assert.equal(await capturePayPal({...order,provider_id:'PP-123'},credentials,'PP-123',f),'CAP-1');assert.equal(calls.length,3);assert.equal(calls[2].opts.headers['PayPal-Request-Id'],'capture-'+order.id);
});
test('Fygaro uses signed immutable amounts and rejects stale or wrong-key webhooks',()=>{
 const c={keyId:'test-key',secret:'test-secret'},jwt=fygaroJWT(order,c),parts=jwt.split('.');const payload=JSON.parse(Buffer.from(parts[1],'base64url'));assert.equal(payload.amount,'123.45');assert.equal(payload.custom_reference,order.id);assert.equal(parts[2],createHmac('sha256',c.secret).update(parts.slice(0,2).join('.')).digest('base64url'));
 const raw=Buffer.from('{"amount":"123.45"}'),now=Date.now(),t=Math.floor(now/1000),sig=createHmac('sha256',c.secret).update(Buffer.concat([Buffer.from(t+'.'),raw])).digest('hex'),headers={'fygaro-key-id':c.keyId,'fygaro-signature':`t=${t},v1=${sig}`};
 assert.equal(verifyFygaro(raw,headers,c,now),true);assert.equal(verifyFygaro(raw,headers,c,now+301000),false);assert.equal(verifyFygaro(raw,{...headers,'fygaro-key-id':'wrong'},c,now),false);assert.equal(verifyFygaro(Buffer.from('{}'),headers,c,now),false);
});
test('WiPay uses Jamaica hosts, documented request fields and secret-based response hashes',async()=>{
 let request;const c={accountNumber:'1234567890',secret:'123',environment:'sandbox'};const result=await initiate({...order,gateway:'wipay'},c,'https://plaza.example',async(url,opts)=>{request={url,body:JSON.parse(opts.body)};return response({url:'https://jmsb.wipayfinancial.com/checkout/payment?test=1',transaction_id:'SB-1'});});assert.match(request.url,/jmsb\.wipayfinancial\.com/);assert.equal(request.body.country_code,'JM');assert.equal(request.body.method,'credit_card_co');assert.equal(request.body.total,'123.45');assert.ok(!('secret' in request.body));assert.equal(result.providerId,'SB-1');assert.equal(wiHash('t',1000,'key'), 'e421372d158ce3326af87ff4830e9372');
});
test('gateway configuration rejects executable URLs and unsupported providers',()=>{
 assert.throws(()=>validateGateway('fygaro',{buttonURL:'https://evil.example/checkout',keyId:'k',secret:'s'}));assert.throws(()=>validateGateway('custom',{paymentURL:'javascript:alert(1)',label:'x'}));assert.throws(()=>validateGateway('nonexistent',{}));assert.throws(()=>validateGateway('bank',{}));
 assert.equal(validateGateway('bank',{instructions:'Contact the seller to transfer.'}).instructions,'Contact the seller to transfer.');
});

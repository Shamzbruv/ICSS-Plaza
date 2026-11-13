const escape = value => String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const base = 'https://icss-plaza-production.up.railway.app';
const support = 'icreatesolutions.ja@gmail.com';
export function brandEmail({subject, eyebrow, title, paragraphs, details=[], cta, url, origin=base, template=false}) {
 const safeURL=template?'{{ .ConfirmationURL }}':escape(url);
 const detailHTML=details.length?`<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:22px 0;border:1px solid #dce7ef;border-radius:10px;background:#f4f8fb">${details.map(([k,v])=>`<tr><td style="padding:10px 14px;color:#4d6374;font-size:14px">${escape(k)}</td><td align="right" style="padding:10px 14px;font-weight:bold;color:#15334b;font-size:14px;word-break:break-word">${escape(v)}</td></tr>`).join('')}</table>`:'';
 const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(subject)}</title></head><body style="margin:0;background:#edf3f7;font-family:Arial,Helvetica,sans-serif;color:#18374e">
 <div style="display:none;max-height:0;overflow:hidden;opacity:0">${escape(paragraphs[0])}</div>
 <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#edf3f7"><tr><td align="center" style="padding:28px 12px">
 <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:16px;border:1px solid #dce7ef;overflow:hidden"><tr><td style="padding:20px 28px;border-top:6px solid #2bc4ca;border-bottom:1px solid #e0ebf2">
 <img src="${escape(origin)}/assets/brand/logo-horizontal.png" width="184" alt="ICSS Plaza" style="width:184px;height:auto;display:block;border:0"></td></tr>
 <tr><td style="padding:30px 28px"><p style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#006f78;font-weight:bold;margin:0 0 12px">${escape(eyebrow)}</p>
 <h1 style="font-size:30px;line-height:1.15;margin:0 0 18px;color:#123b5a">${escape(title)}</h1>
 ${paragraphs.map(p=>`<p style="margin:0 0 14px;line-height:1.6;font-size:16px;white-space:pre-line">${escape(p)}</p>`).join('')}${detailHTML}
 ${cta?`<table role="presentation" cellpadding="0" cellspacing="0"><tr><td bgcolor="#123b5a" style="border-radius:8px"><a href="${safeURL}" style="display:inline-block;padding:13px 19px;font-size:15px;color:#fff;text-decoration:none;font-weight:bold">${escape(cta)} →</a></td></tr></table>`:''}
 </td></tr><tr><td style="padding:20px 28px;background:#f4f8fb;color:#455f71;font-size:13px;line-height:1.6"><strong style="color:#123b5a">ICSS Plaza</strong> · A product of iCreate Solutions &amp; Services<br><a style="color:#123b5a" href="${escape(origin)}/legal/privacy">Privacy</a> · <a style="color:#123b5a" href="mailto:${support}">Platform support</a></td></tr></table></td></tr></table></body></html>`;
 return {subject,html,text:[title,...paragraphs,...details.map(([k,v])=>k+': '+v),...(cta?[cta+': '+url]:[]),'ICSS Plaza · A product of iCreate Solutions & Services',origin+'/legal/privacy'].join('\n\n')};
}

export const authTemplateSpecs = {
 confirmation:['Confirm your ICSS Plaza email','Account setup','Confirm your email','Confirm your email address to complete your ICSS Plaza account setup.','Confirm email'],
 invite:['You’re invited to ICSS Plaza','Your invitation','Make room for your business','You’ve been invited to ICSS Plaza. Accept the invitation to set up your access.','Accept invitation'],
 recovery:['Reset your ICSS Plaza password','Account security','Choose a new password','A password reset was requested for your account. If you didn’t request it, you can ignore this message.','Reset password'],
 magic_link:['Sign in to ICSS Plaza','Secure sign-in','Your sign-in link','Use this private link to sign in. If you didn’t request it, ignore this message.','Sign in'],
 email_change:['Confirm your ICSS Plaza email change','Account security','Confirm this email change','A change to the email address on your account was requested. Confirm it only if you made the request.','Confirm email change'],
 reauthentication:['Your ICSS Plaza security code','Account security','Confirm it’s you','Use this one-time code to confirm your identity. Never share it with anyone.'],
 password_changed_notification:['Your ICSS Plaza password changed','Account security','Password changed','If you did not make this change, contact ICSS Plaza support immediately.'],
 email_changed_notification:['Your ICSS Plaza email changed','Account security','Email address changed','If you did not make this change, contact ICSS Plaza support immediately.'],
 phone_changed_notification:['Your ICSS Plaza phone number changed','Account security','Phone number changed','If you did not make this change, contact ICSS Plaza support immediately.'],
 mfa_factor_enrolled_notification:['A security method was added','Account security','Security method added','If you didn’t add a security method, contact ICSS Plaza support.'],
 mfa_factor_unenrolled_notification:['A security method was removed','Account security','Security method removed','If you didn’t remove a security method, contact ICSS Plaza support.'],
 identity_linked_notification:['A sign-in method was linked','Account security','Sign-in method linked','If you didn’t link a sign-in method, contact ICSS Plaza support.'],
 identity_unlinked_notification:['A sign-in method was unlinked','Account security','Sign-in method unlinked','If you didn’t unlink a sign-in method, contact ICSS Plaza support.']
};
export function authTemplates(origin=base) {
 return Object.fromEntries(Object.entries(authTemplateSpecs).map(([key,[subject,eyebrow,title,copy,cta]])=>{
  const spec={subject,eyebrow,title,paragraphs:[copy],cta,url:'{{ .ConfirmationURL }}',origin,template:true};
  if(key==='reauthentication')spec.details=[['Security code','{{ .Token }}']];
  return [key,brandEmail(spec)];
 }));
}
const statusText={received:'Received',reviewing:'Under review',awaiting_customer:'Waiting for your response',awaiting_vendor:'Waiting for vendor',resolved:'Resolved',closed:'Closed'};
const orderState={new:'Order received',processing:'Order processing',fulfilled:'Order fulfilled',cancelled:'Order cancelled'};
export function emailMessage(kind,p,origin) {
 const store=p.store||'your store', reference=p.reference||'';
 const orderDetails=[['Seller',store],['Order reference',reference],...(p.amount?[['Total',p.amount]]:[])];
 const caseDetails=[['Case reference',reference],['Status',statusText[p.status]||'Under review']];
 const map={
  welcome:['Welcome to ICSS Plaza','Your storefront','Welcome, '+store+'!',['Your ICSS Plaza account is ready. Add your products, set your policies, and configure your payment method before publishing.','Your 14-day trial has no automatic charge.'],[['Store',store]],'Open your dashboard','/admin'],
  password_changed:['Your ICSS Plaza password changed','Account security','Password changed',['Your ICSS Plaza password was updated. If you didn’t make this change, contact platform support immediately.'],[],'Go to sign-in','/login'],
  reset:['Reset your ICSS Plaza password','Account security','Choose a new password',['ICSS Plaza support issued a one-time password reset. The link expires in 60 minutes. Ignore this message if you weren’t expecting it.'],[],'Reset password','/reset#token='+encodeURIComponent(p.token||'')],
  order_buyer:['Order '+reference+' received','Order receipt','Your order was received',['You placed an order with '+store+', an independent seller on ICSS Plaza.','This confirms the order only. Payment is pending verification. For delivery, returns or refunds, contact the seller.'],orderDetails,'View your order','/s/'+p.slug+'#order='+p.id+'&key='+p.token],
  order_vendor:['New order '+reference,'Store activity','You have a new order',['Review this order in your dashboard. Verify payment before fulfilling it.'],orderDetails,'Open orders','/admin?tab=orders'],
  payment:['Payment confirmed for '+reference,'Order update','Payment confirmed',['Payment has been recorded for your order with '+store+'. Contact the seller for delivery, fulfilment or refunds.'],orderDetails,'Visit the seller','/s/'+p.slug],
  order_status:[(orderState[p.state]||'Order updated')+' · '+reference,'Order update',orderState[p.state]||'Your order was updated',['The seller, '+store+', updated your order. Contact the seller if you need more information.'],orderDetails,'Visit the seller','/s/'+p.slug],
  case_customer:['ICSS Plaza report '+reference,'Trust & safety',p.status==='received'?'Your report was received':'There’s an update to your report',['Use your private access key to view case details. Case evidence and access keys are never included in these emails.'],caseDetails,'Track your report','/report?case='+reference],
  case_vendor:['A vendor case needs your attention','Trust & safety','Update on a vendor report',['Sign in to see the case summary and respond privately to ICSS Plaza.'],[['Case reference',reference]],'Open vendor reports','/admin?tab=vendor-cases'],
  case_operator:['Vendor report needs review','Trust & safety','A vendor case needs review',['Sign in to review the report or new response. Case details stay in the private dashboard.'],[['Case reference',reference],['Priority',p.priority||'Standard']],'Open investigations','/operator'],
  rental:['ICSS Plaza rental update','Store rental','Your rental status changed',['Your store rental was updated. Visit the dashboard for details. This message is not a vendor purchase refund or payment receipt.'],[['Store',store],['Status',p.status]],'Open your dashboard','/admin'],
  service_request:['ICSS Plaza support request received','Platform support','We received your request',['Your request has been recorded. The platform team can review it.'],[['Store',store],['Request type',p.type]],'Open your dashboard','/admin'],
  support_reply:['ICSS Plaza support · '+reference,'Platform support','A reply from ICSS Plaza',[p.message],[],null,'/'],
  service_operator:['New ICSS Plaza service request','Platform support','A store needs assistance',['A vendor submitted a service request. Sign in to review it.'],[['Store',store],['Request type',p.type]],'Open operator dashboard','/operator']
 };
 const [subject,eyebrow,title,paragraphs,details,cta,path]=map[kind];
 return brandEmail({subject,eyebrow,title,paragraphs,details,cta,url:origin+path,origin});
}

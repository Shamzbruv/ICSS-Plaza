const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=x=>x?new Date(x).toLocaleDateString('en-JM',{dateStyle:'medium'}):'—';
const money=(amount,currency)=>new Intl.NumberFormat('en-JM',{style:'currency',currency}).format(amount/100);
const title=s=>String(s||'').replaceAll('_',' ').replace(/^./,x=>x.toUpperCase());
const act=(label,action,id='')=>`<button class="btn outline sm" data-action="${action}" data-id="${esc(id)}">${esc(label)}</button>`;
const pill=s=>`<span class="tag">${esc(title(s))}</span>`;
const empty='—';
export const consoleTabs=[['overview','Overview','◈'],['vendors','Vendors','▦'],['subscriptions','Subscriptions','▤'],['consultations','Consultations','◷'],['trust','Trust & safety','◇'],['support','Support & email','✉'],['audit','Audit trail','≡'],['system','System & testing','⚙']];
const table=(headers,rows,none='No records yet.')=>rows.length?`<div class="table-scroll"><table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(cells=>`<tr>${cells.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`:`<p>${none}</p>`;
const card=(label,value)=>`<article class="dev-stat"><span>${esc(label)}</span><strong>${esc(value)}</strong></article>`;
const panel=(heading,description,body,actions='')=>`<section class="panel"><div class="dev-panel-head"><div><h2>${heading}</h2><p>${description}</p></div>${actions}</div>${body}</section>`;

export function consultationPage() {
 return `<main class="wrap trust-page consultation-page"><header><div class="eyebrow">Talk with ICSS Plaza</div><h1>Let’s talk about your online store.</h1><p>Ask about moving your catalogue, taking payments, or getting your first store online. No account required.</p></header>
 <div class="trust-grid"><section class="panel"><h2>Request a consultation</h2><form data-form="consultation">
 <div class="form-grid"><label class="field">Your name<input name="name" maxlength="100" required autocomplete="name"></label><label class="field">Business name<input name="business" maxlength="100" required autocomplete="organization"></label>
 <label class="field">Email<input name="email" type="email" maxlength="200" required autocomplete="email"></label><label class="field">Phone or WhatsApp (optional)<input name="phone" type="tel" maxlength="35" autocomplete="tel"></label></div>
 <label class="field">What would you like to discuss?<select name="topic" required><option value="">Choose a topic</option><option value="setup">Setting up a store</option><option value="payments">Payments and checkout</option><option value="migration">Moving an existing store</option><option value="pricing">Plans and pricing</option><option value="other">Something else</option></select></label>
 <label class="field">When are you available? (optional)<input name="availability" maxlength="250" placeholder="Include your time zone"></label>
 <label class="field">Tell us about your plans<textarea name="message" minlength="10" maxlength="2500" required></textarea></label>
 <label class="trust-trap" aria-hidden="true">Leave blank<input name="website" autocomplete="off" tabindex="-1"></label>
 <label class="field check"><input type="checkbox" name="consent" required><span>I agree to be contacted about this request and have read the <a href="/legal/privacy" target="_blank" rel="noopener">privacy notice</a>.</span></label>
 <div class="form-error" role="alert"></div><button type="submit" class="btn">Request a consultation →</button></form></section>
 <aside class="panel"><h2>What to expect</h2><ol><li>Tell us what you want to sell and where you are in the process.</li><li>We’ll follow up to agree on a time and answer your questions.</li><li>Decide whether Plaza is a fit before starting your trial.</li></ol><p>Sending a request does not book a slot or start a subscription.</p></aside></div></main>`;
}

export function consultantDialog(r,mailReady) {
 return `<h2>${esc(r.business)}</h2><p>${esc(r.name)} · <a href="mailto:${esc(r.email)}">${esc(r.email)}</a>${r.phone?' · '+esc(r.phone):''}</p>
 <p><strong>Topic:</strong> ${esc(title(r.topic))}<br><strong>Availability:</strong> ${esc(r.availability||empty)}<br><strong>Reference:</strong> ${esc(r.id)}</p><p class="preline">${esc(r.message)}</p>
 <form data-form="consultation-update" data-id="${esc(r.id)}" data-updated="${r.updated}"><label class="field">Status<select name="status">${['new','contacted','scheduled','completed','closed'].map(s=>`<option value="${s}" ${s===r.status?'selected':''}>${title(s)}</option>`).join('')}</select></label>
 <label class="field">Private notes<textarea name="notes" maxlength="2500">${esc(r.notes)}</textarea></label>
 ${mailReady?'<label class="field">Optional email to the customer<textarea name="message" maxlength="1500" placeholder="Confirm a time, include a meeting link, or share next steps."></textarea></label>':'<p class="small">Connect Resend in Railway to send replies from here.</p>'}
 <div class="form-error" role="alert"></div><button class="btn" type="submit">Save consultation</button></form>`;
}

export function developerShell({tab,logo,content}) {
 return `<div class="workspace developer-workspace"><aside class="sidebar dev-sidebar">${logo()}<div class="eyebrow">Developer console</div>
 ${consoleTabs.map(([id,label,icon])=>`<button class="${tab===id?'active':''}" data-action="developer-tab" data-id="${id}" ${tab===id?'aria-current="page"':''}><span aria-hidden="true">${icon}</span> ${label}</button>`).join('')}
 <div class="side-bottom"><a href="/">Plaza website ↗</a>${act('Change password','password')} ${act('Sign out','logout')}</div></aside>
 <main class="main-work"><header class="dev-hero"><div class="eyebrow">ICSS Plaza · Operations workspace</div><h1>${esc(consoleTabs.find(x=>x[0]===tab)?.[1])}</h1><p>Manage storefronts, rental billing, and customer support from one place.</p></header>${content}</main></div>`;
}

export function developerView(tab,d,{trustHTML='' }={}) {
 const {overview:o,operator:k,billing:b,consultations:c}=d;
 if(tab==='overview')return `<div class="dev-stats">${card('Stores',o.stores.reduce((n,x)=>n+x.n,0))}${card('Paid rentals',o.paidRentals)}${card('Open consultations',o.consultations)}${card('Open investigations',o.reports)}</div>`+
  panel('Rental receipts · last 30 days','Platform rental collections are separate from vendor sales.',o.revenue.length?`<div class="dev-stats">${o.revenue.map(x=>card(x.currency,money(x.n,x.currency))).join('')}</div>`:'<p>No rental payments recorded.</p>')+
  panel('Storefront order activity','Platform-wide order counts by status.',table(['Status','Orders'],o.orders.map(x=>[pill(x.state),esc(x.n)])));
 if(tab==='vendors')return panel('Vendor workspaces','Find a vendor and open their storefront editor when they request help. You can also review rentals and issue password resets.',
  `<label class="field">Find a store<input id="developer-store-search" placeholder="Search by store, email or status"></label>`+
  table(['Store','Owner','Rental status','Trial ends','Actions'],k.tenants.map(t=>[`<strong>${esc(t.settings.name)}</strong><p class="small">/s/${esc(t.slug)}</p>`,esc(t.email),pill(t.status),fmt(t.trial_end),
  act('Open vendor workspace','vendor-support',t.id)+act('Details','tenant-detail',t.id)+act('Rental','rental',t.id)+act('Reset access','issue-reset',t.id)])));
 if(tab==='subscriptions')return panel('Platform rental plans','Create a monthly plan in JMD or USD. Link a matching USD PayPal plan to offer automatic renewal.',table(['Plan','Monthly price','PayPal plan','Status','Actions'],b.plans.map(p=>[esc(p.name),esc(money(p.amount,p.currency)),esc(p.paypal_plan||empty),pill(p.enabled?'available':'retired'),act(p.enabled?'Retire':'Reopen','plan-toggle',p.id)])),act('New plan','new-plan'))+
  panel('Subscription and renewal ledger','Fygaro collects individual monthly payments. PayPal subscriptions renew automatically after approval.',
  table(['Store','Plan','Provider','Status','Paid through','Actions'],b.rentals.map(r=>[esc(r.slug),esc(r.plan_name),esc(title(r.provider)),pill(r.status),fmt(r.paid_until),r.provider==='paypal'&&r.provider_id&&!['cancelled','expired'].includes(r.status)?act('Cancel renewal','operator-cancel-rental',r.id):empty])))+
  panel('Recent billing activity','Verified provider events and renewal status changes.',table(['When','Provider','Event'],b.events.map(e=>[fmt(e.created),esc(title(e.provider)),esc(title(e.kind))])));
 if(tab==='consultations')return panel('Consultation requests','Follow up, record appointments and keep private notes. New requests do not book a time automatically.',
  table(['Business','Contact','Topic','Status','Received',''],c.requests.map(r=>[esc(r.business),esc(r.name),esc(title(r.topic)),pill(r.status),fmt(r.created),act('Open','open-consultation',r.id)])));
 if(tab==='trust')return trustHTML;
 if(tab==='support')return panel('Support and email','Review service requests and use the private Resend inbox.',
  table(['Store','Request','Notes','Date'],k.requests.map(r=>[esc(r.slug),esc(title(r.kind)),esc(r.note||empty),fmt(r.created)])),act('Open email inbox','open-mail'));
 if(tab==='audit')return panel('Recent audit events','Track privileged actions and changes across the platform.',table(['Time','Store ID','Action'],k.audit.map(a=>[esc(new Date(a.created).toLocaleString('en-JM')),esc(a.tenant_id||empty),esc(a.action)+(a.reason?`<p class="small preline">${esc(a.reason)}</p>`:'')])));
 return panel('Service connections','Check provider configuration before enabling paid plans.',
  table(['Service','Status'],[['Database',pill(o.database)],['Email sending',pill(o.configured?'configured':'needs setup')],['Inbound support',pill(o.inboundConfigured?'configured':'needs setup')],['Fygaro rentals',pill(o.billing.fygaro?'configured':'needs setup')],['PayPal subscriptions',pill(o.billing.paypal?o.paypalMode:'needs setup')]]))+
  panel('Test workspace','Generate a separate merchant login for 14 days. Test stores cannot publish or enter live billing.','<p>Copy the password when it appears; it is shown only once.</p>',act('Create test account','create-test-account'));
}

export function billingPanel(data) {
 const ready=data.providers||{};
 const options=data.plans.map(p=>`<article class="feature"><h3>${esc(p.name)}</h3><p><strong>${esc(money(p.amount,p.currency))}</strong> / month</p><div class="row trust-actions">
 ${ready.fygaro?act('Pay with Fygaro','start-fygaro',p.id):''}${ready.paypal&&data.paypalMode==='live'&&p.paypal_plan?act('Subscribe with PayPal','start-paypal',p.id):''}</div></article>`).join('');
 return panel('Your Plaza rental','Pay ICSS Plaza for your storefront. This billing is separate from payments your customers make to you.',
  `<p>Fygaro is the primary option for monthly payments. PayPal subscriptions renew automatically until cancelled.</p>${options?`<div class="dev-plans">${options}</div>`:'<p>No online plans are currently available. Contact Plaza for rental options.</p>'}
  ${!ready.fygaro&&(!ready.paypal||data.paypalMode!=='live')?'<p>Online rental payments are not active yet.</p>':''}`)+
  panel('Your billing activity','Paid access follows verified provider payments, not the checkout return page.',table(['Plan','Provider','Status','Paid through',''],data.rentals.map(r=>[esc(r.plan_name),esc(title(r.provider)),pill(r.status),fmt(r.paid_until),
  r.provider==='paypal'&&r.provider_id&&!['cancelled','expired'].includes(r.status)?act('Cancel automatic renewal','cancel-paypal',r.id):empty])));
}

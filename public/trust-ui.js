import { reportReasons, reportStatuses, reportOutcomes } from './trust-data.js';

const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const options=(items,selected)=>items.map(([id,label])=>`<option value="${esc(id)}" ${id===selected?'selected':''}>${esc(label)}</option>`).join('');
const time=x=>new Intl.DateTimeFormat('en-JM',{dateStyle:'medium',timeStyle:'short'}).format(x);
const labels={customer:'Customer',vendor:'Vendor',platform:'ICSS Plaza'};
const end=r=>r.status==='resolved'||r.status==='closed';
const reportUrl=slug=>'/report?store='+encodeURIComponent(slug);

export function publicReportPage({nav,footer,query}) {
  const raw=query.get('store')||'', slug=/^[a-z0-9-]{3,48}$/.test(raw)?raw:'';
  const ref=query.get('order')||'';
  return nav()+`<main class="wrap trust-page">
    <header><div class="eyebrow">ICSS Plaza · Trust &amp; safety</div><h1>Report a vendor</h1><p>Tell us what happened with an independent store. You don’t need an account or an order to report a serious concern.</p></header>
    <div class="note">For a return, refund or delivery update, contact the seller first when safe. <a href="/legal/shopping">Shopping and refund guidance</a> · <a href="/legal/vendor-reports">How investigations work</a></div>
    <div class="trust-grid">
      <section class="panel"><h2>Start a report</h2>
        <form data-form="vendor-report">
          <label class="field">Plaza store address or store name in the URL<input name="slug" maxlength="350" required value="${esc(slug)}" placeholder="my-store or the full storefront URL"></label>
          <label class="field">Your email<input name="email" type="email" autocomplete="email" maxlength="200" required><span class="helper">Private to Plaza. Use the tracking form to see case updates.</span></label>
          <label class="field">What are you reporting?<select name="reason" required>${options([['','Choose a reason'],...Object.entries(reportReasons)],'')}</select></label>
          <label class="field">Order reference (optional)<input name="orderReference" maxlength="40" value="${esc(ref.slice(0,40))}" placeholder="The reference on your receipt"></label>
          <label class="field">What happened?<textarea name="description" required minlength="20" maxlength="4000" placeholder="Give dates, what the seller said, and what would resolve the issue."></textarea></label>
          <label class="field">Evidence images (optional)<input type="file" name="evidence" accept="image/png,image/jpeg,image/webp" multiple><span class="helper">Up to 2 images, 1 MB each. Remove card details, passwords and other private information before uploading.</span></label>
          <label class="trust-trap" aria-hidden="true">Leave this blank<input name="website" tabindex="-1" autocomplete="off"></label>
          <label class="field check"><input type="checkbox" name="acknowledge" required><span>I have read the <a href="/legal/vendor-reports">reporting policy</a> and <a href="/legal/privacy">privacy notice</a>. Plaza may share a limited summary with the vendor.</span></label>
          <div class="form-error" role="alert"></div><button class="btn" type="submit">Submit private report</button>
        </form>
      </section>
      <div><section class="panel"><h2>Track a report</h2><p>Use the reference and private access key shown when you submitted your report.</p>
        <form data-form="report-lookup">
          <label class="field">Report reference<input name="reference" required minlength="24" maxlength="24" autocomplete="off" spellcheck="false"></label>
          <label class="field">Private access key<input name="accessKey" type="password" required minlength="64" maxlength="64" autocomplete="off" spellcheck="false"></label>
          <div class="form-error" role="alert"></div><button class="btn outline" type="submit">Check case status</button>
        </form></section><div id="report-result" tabindex="-1" aria-live="polite"></div></div>
    </div>
  </main>`+footer();
}

export function reportReceipt(r) {
  return `<section class="panel trust-case"><span class="tag">Received</span><h2>Your report is recorded</h2><p>Save both values now. Plaza will not display this access key again. Do not share it with the vendor.</p>
    <label class="field">Report reference<input readonly value="${esc(r.id)}"></label>
    <label class="field">Private access key<input readonly value="${esc(r.accessKey)}"></label>
    <button class="btn outline" type="button" data-action="copy-report">Copy tracking details</button></section>`;
}

function timeline(events) {
  return events.length?`<ol class="case-timeline">${events.map(e=>`<li><strong>${esc(labels[e.author]||e.author)}${e.audience?' · '+esc(e.audience):''}${e.kind==='appeal'?' · Review request':''}</strong><small>${esc(time(e.created))}</small><p class="preline">${esc(e.message)}</p></li>`).join('')}</ol>`:'<p>No messages yet.</p>';
}

export function reportCase(r,who) {
  const close=end(r), canAppeal=close&&Date.now()-r.closed<=30*86400000;
  const kind=who==='vendor'?'vendor-case-reply':'customer-case-reply';
  return `<section class="panel trust-case"><div class="eyebrow">${esc(r.storeName)}</div><h2>${esc(reportReasons[r.reason])}</h2>
    <p>Case <code>${esc(r.id)}</code></p><p><span class="tag">${esc(who==='vendor'&&r.status==='awaiting_customer'?'Under review':reportStatuses[r.status])}</span></p>
    ${r.storeRestriction?`<div class="note warn">Storefront action: ${r.storeRestriction==='suspend'?'Storefront suspended':'New checkout paused'}. Continue to handle existing customer orders.</div>`:''}
    ${r.outcome?`<p><strong>Outcome:</strong> ${esc(reportOutcomes[r.outcome])}</p>`:''}
    <h3>Case updates</h3>${timeline(r.events)}
    ${who==='customer'&&r.evidence?.length?`<p>Evidence received: ${r.evidence.map(e=>esc(e.name)).join(', ')}</p>`:''}
    ${!close||canAppeal?`<form data-form="${kind}" data-id="${esc(r.id)}" data-review="${canAppeal}"><label class="field">${canAppeal?'Why should we review this decision?':'Add information for Plaza'}<textarea name="message" required minlength="10" maxlength="3000"></textarea></label><div class="form-error" role="alert"></div><button class="btn" type="submit">${canAppeal?'Request a review':'Send update'}</button></form>`:'<p>For questions about this closed case, contact Plaza support with your reference.</p>'}</section>`;
}

export function reportQueue(data,filter='open',page=1,operator=true) {
  return `<section class="panel" id="vendor-case-queue"><h2>${operator?'Vendor investigations':'Reports shared with your business'}</h2>
    <p>${operator?'Review evidence privately, request a response and record the outcome.':'Respond to the platform here. Customer contact details and private case files are not shared.'}</p>
    ${operator?`<div class="row trust-actions">${[['open','Open'],['closed','Closed'],['all','All']].map(([k,label])=>`<button class="btn outline sm" data-action="report-filter" data-id="${k}" aria-pressed="${filter===k}">${label}</button>`).join('')}</div>`:''}
    ${data.reports.length?`<div class="table-scroll"><table><thead><tr><th>Case</th><th>Store</th>${operator?'<th>Priority</th>':''}<th>Status</th><th></th></tr></thead><tbody>${data.reports.map(r=>`<tr><td>${esc(reportReasons[r.reason])}<p class="small">${esc(time(r.updated))}</p></td><td>/s/${esc(r.slug)}</td>${operator?`<td><span class="tag ${r.priority==='urgent'?'warn':''}">${esc(r.priority)}</span></td>`:''}<td>${esc(!operator&&r.status==='awaiting_customer'?'Under review':reportStatuses[r.status])}</td><td><button class="btn outline sm" data-action="${operator?'open-report':'open-vendor-case'}" data-id="${esc(r.id)}">Open case</button></td></tr>`).join('')}</tbody></table></div>`:'<p>No cases in this view.</p>'}
    ${operator&&(page>1||data.hasNext)?`<div class="row trust-actions">${page>1?`<button class="btn outline sm" data-action="report-page" data-id="${page-1}">Previous</button>`:''}<span>Page ${page}</span>${data.hasNext?`<button class="btn outline sm" data-action="report-page" data-id="${page+1}">Next</button>`:''}</div>`:''}</section>`;
}

export function operatorCase(r) {
  const choices={
    received:['reviewing','awaiting_customer','awaiting_vendor','resolved','closed'],
    reviewing:['awaiting_customer','awaiting_vendor','resolved','closed'],
    awaiting_customer:['reviewing','awaiting_vendor','resolved','closed'],
    awaiting_vendor:['reviewing','awaiting_customer','resolved','closed'],
    resolved:['reviewing','closed'],closed:['reviewing']
  };
  return `<section class="trust-case"><div class="eyebrow">Private investigation · ${esc(r.id)}</div><h2>${esc(reportReasons[r.reason])}</h2>
    <p><a href="/s/${esc(r.slug)}" target="_blank" rel="noopener">${esc(r.storeName)}</a> · <a href="${reportUrl(r.slug)}">Reporting page</a></p>
    <p><strong>Customer email:</strong> ${esc(r.email)}<br><strong>Order reference:</strong> ${esc(r.orderReference||'None')} ${r.orderReference?`(${r.matchedOrder?'matches this store':'unverified'})`:''}</p>
    <p class="preline">${esc(r.description)}</p>
    <h3>Private evidence</h3>${r.evidence.length?`<ul>${r.evidence.map(e=>`<li><a href="/api/operator/reports/${esc(r.id)}/evidence/${esc(e.id)}" download>${esc(e.name)}</a></li>`).join('')}</ul>`:'<p>No files submitted.</p>'}
    <h3>Case history</h3>${timeline(r.events)}
    <form data-form="operator-case" data-id="${esc(r.id)}" data-version="${r.version}">
      <div class="form-grid"><label class="field">Case status<select name="status">${options([r.status,...choices[r.status]].map(k=>[k,reportStatuses[k]]),r.status)}</select></label>
      <label class="field">Priority<select name="priority">${options([['urgent','Urgent'],['high','High'],['standard','Standard']],r.priority)}</select></label></div>
      <label class="field">Outcome (required to close)<select name="outcome">${options([['','Choose an outcome'],...Object.entries(reportOutcomes)],r.outcome)}</select></label>
      <label class="field">Message visible to the customer<textarea name="customerMessage" maxlength="3000"></textarea></label>
      <label class="field">${r.vendorVisible?'Message visible to the vendor':'Share a limited summary with the vendor (optional)'}<textarea name="vendorMessage" maxlength="3000"></textarea><span class="helper">Do not include customer contact details, payment credentials, or private evidence.</span></label>
      <label class="field">Private investigator note<textarea name="note" maxlength="3000"></textarea></label>
      <label class="field">Storefront action<select name="restriction">${options([['none','No change'],['checkout','Pause new checkout'],['suspend','Suspend storefront'],...(r.restriction&&(!r.restriction.report_id||r.restriction.report_id===r.id)?[['lift','Lift restriction']]:[])],'none')}</select><span class="helper">Current: ${esc(r.restriction?.mode||'none')}. Record the reason in the private note for any change.</span></label>
      <label class="field check"><input type="checkbox" name="legalHold" ${r.legalHold?'checked':''}>Keep case beyond the retention period (record the reason)</label>
      <div class="form-error" role="alert"></div><button class="btn" type="submit">Save case update</button>
    </form></section>`;
}

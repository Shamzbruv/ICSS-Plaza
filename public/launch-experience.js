import {blankTemplate,getTemplate,templates} from './store-templates.js?v=plaza-launch-1';
import {esc} from './storefront.js?v=retail-1';

const startOptions=[blankTemplate,...templates];
const isTemplate=id=>startOptions.some(t=>t.id===id);
const number=n=>String(n).padStart(2,'0');
const editingNotes=[
 ['Make it yours','Add your logo, choose colours and fonts, and replace the starter photos and wording.'],
 ['Arrange the pages','Add, move or hide sections. Add pages for things like size guides and FAQs.'],
 ['See the result live','Click a section in Store Designer, check it on a phone, and save privately before publishing.']
];
const palette=s=>`<span class="start-swatches" aria-hidden="true">${[s.accent,s.background,s.ink].map(c=>`<i style="--swatch:${esc(c)}"></i>`).join('')}</span>`;

export function startPreview(id){
 const t=getTemplate(id)||blankTemplate,s=t.settings;
 return `<div class="start-preview" style="--start-bg:${esc(s.background)};--start-ink:${esc(s.ink)};--start-accent:${esc(s.accent)}">
  <div class="start-preview-bar"><span aria-hidden="true"><i></i><i></i><i></i></span><small>STOREFRONT PREVIEW</small></div>
  <div class="start-preview-nav"><strong>${esc(t.id==='blank'?'Your store':t.label)}</strong><span>Shop &nbsp; About &nbsp; Bag</span></div>
  <div class="start-preview-page">
   <div><small>${esc(s.tagline)}</small><strong>${esc(s.heroTitle)}</strong><span>${esc(s.heroButton)}</span></div>
   ${t.art?`<img src="${esc(t.art)}" width="420" height="320" alt="">`:'<div class="start-placeholder" aria-hidden="true"><svg viewBox="0 0 32 32" fill="none"><rect x="4" y="4" width="24" height="24" rx="4"/><path d="M8 23l6-7 4 4 3-3 3 6"/><circle cx="20" cy="11" r="2"/></svg><span>Your photo here</span></div>'}
  </div>
 </div><div class="start-preview-caption"><strong>${esc(t.label)}</strong>${palette(s)}</div><p>${esc(t.description)}</p>${id&&t.art?`<a class="start-preview-link" href="/templates/${t.id}" target="_blank" rel="noopener">Open full preview ↗</a>`:''}`;
}

export function signupExperience({logo,selected,details}){
 return `<main class="plaza-start"><header class="start-header">${logo}<a href="/login">Already have a store? <strong>Sign in ↗</strong></a></header>
 <form data-form="signup" data-signup-step="design" novalidate>
  <div class="start-inner">
   <ol class="start-progress" aria-label="Signup progress"><li data-progress="design" aria-current="step"><span>1</span> Store design</li><li data-progress="details"><span>2</span> Store details</li><li><span>3</span> Launchpad</li></ol>
   <section data-signup-pane="design" aria-labelledby="start-design-heading">
    <div class="start-intro"><div class="start-kicker"><span></span> FREE FOR 14 DAYS · NO CARD NEEDED</div><h1 id="start-design-heading" tabindex="-1">What should your shop <em>start with?</em></h1><p>Pick a starting look below or begin with a blank canvas. You’ll see a preview, then continue to name your store. You can make it yours in Store Designer.</p></div>
    <div class="start-grid">
     <fieldset class="start-choices"><legend>Choose a starting point</legend>
      ${startOptions.map((t,i)=>`<label class="start-choice ${i===0?'start-choice-blank':''}">
       <input type="radio" name="template" value="${t.id}" ${selected===t.id?'checked':''} required>
       ${t.art?`<img src="${esc(t.art)}" width="104" height="78" alt="" loading="lazy">`:'<span class="start-choice-icon" aria-hidden="true">＋</span>'}
       <span class="start-choice-text"><strong>${esc(t.label)}</strong><small>${esc(t.description)}</small></span>
       <span class="start-choice-tick" aria-hidden="true">✓</span></label>`).join('')}
     </fieldset>
     <aside class="start-context"><div class="start-preview-wrap" data-start-preview>${startPreview(selected)}</div>
      <div class="start-edit-guide"><h2>What can I change later?</h2>${editingNotes.map(([h,p],i)=>`<div><span>${number(i+1)}</span><p><strong>${h}</strong><br>${p}</p></div>`).join('')}<p class="start-guide-note">The starting point is chosen once. You can still change the design, add content and rebuild the layout.</p></div>
     </aside>
    </div>
   </section>
   <section data-signup-pane="details" hidden aria-labelledby="start-details-heading">
    <div class="start-intro"><div class="start-kicker"><span></span> YOUR SHOP, YOUR BRAND</div><h2 id="start-details-heading" tabindex="-1">Give your shop <em>a name.</em></h2><p>We’ll create your private workspace. Your shop won’t be published until you’re ready.</p></div>
    <div class="start-grid start-details-grid">${details}<aside class="start-context start-details-aside"><div class="start-preview-wrap" data-start-preview>${startPreview(selected)}</div><div class="start-edit-guide"><h2>Next: your Launchpad</h2><p>Edit the storefront as customers would see it, add your first product, and follow a checklist to get ready to publish.</p><p><strong>14 days free.</strong> No payment card or paid subscription when you sign up.</p></div></aside></div>
   </section>
  </div>
  <footer class="start-controls"><div><strong data-start-selection aria-live="polite">${selected?esc(getTemplate(selected).label):'Choose a starting point'}</strong><span data-start-next>${selected?'Next: name your shop':'Select any design to continue'}</span></div><div class="start-cta-row"><button type="button" class="btn outline" data-action="signup-back" hidden>← Back</button><button type="submit" class="btn" data-start-continue>Continue to store details <span aria-hidden="true">→</span></button></div></footer>
  <p class="form-error start-error" role="alert"></p>
 </form></main>`;
}

export function updateSignupSelection(form,raw){
 const choice=isTemplate(raw)?raw:null;
 for(const box of form.querySelectorAll('[data-start-preview]'))box.innerHTML=startPreview(choice);
 form.querySelector('[data-start-selection]').textContent=choice?getTemplate(choice).label:'Choose a starting point';
 form.querySelector('[data-start-next]').textContent=choice?'Next: name your shop':'Select any design to continue';
}
export function showSignupStep(form,step){
 form.dataset.signupStep=step;
 const details=step==='details';
 for(const pane of form.querySelectorAll('[data-signup-pane]'))pane.hidden=pane.dataset.signupPane!==step;
 for(const flag of form.querySelectorAll('[data-progress]'))flag.setAttribute('aria-current',flag.dataset.progress===step?'step':'false');
 form.querySelector('[data-action="signup-back"]').hidden=!details;
 form.querySelector('[data-start-continue]').textContent=details?'Create my store →':'Continue to store details →';
 form.querySelector('[data-start-next]').textContent=details?'No card needed to start':form.elements.template.value?'Next: name your shop':'Select any design to continue';
 form.querySelector('.start-error').textContent='';
 form.querySelector(`[data-signup-pane="${step}"] [tabindex="-1"]`)?.focus({preventScroll:true});
 window.scrollTo({top:0,behavior:'instant'});
}
export function suggestStoreSlug(input){
 return String(input).normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,48).replace(/-$/,'');
}

export function launchpad(state,{demo=false,publicOrigin=''}={}){
 const s=state.settings,base=getTemplate(s.template)?.settings;
 const paymentTab=state.gateways.some(g=>g.enabled)?'settings':'payments';
 const ready=[
  [!!s.logo||!!s.designDraft||!!base&&['heroTitle','accent','heroImage','announcement'].some(k=>(s[k]||'')!==(base[k]||'')),
   'Make it look like your brand','Edit the headline, colours and photos directly in the storefront preview.','appearance'],
  [state.products.some(p=>p.active),'Add a product shoppers can buy','Add photos, a price and available stock. Use variants for sizes or pack options.','products'],
  [!!s.address&&!!s.contactEmail,'Add your seller details','Show customers who they’re buying from and how to reach you.','content'],
  [!!(s.shipping&&s.returns&&s.privacy&&s.terms),'Review your store policies','Review the starter wording and make sure it matches your delivery, returns, privacy and sales terms.','policies'],
  [!!s.defaultPayment&&state.gateways.some(g=>g.enabled&&(g.provider||g.id)===s.defaultPayment),'Connect checkout','Connect a payment method and set it as your default in Store Settings.',paymentTab]
 ];
 const done=ready.filter(([valid])=>valid).length,next=ready.find(([valid])=>!valid);
 const progress=Math.round(done/ready.length*100);
 if(s.published&&!demo)return `<section class="launchpad launchpad-live panel"><div><div class="start-kicker"><span></span> STOREFRONT LIVE</div><h2>Get your shop in front of people.</h2><p>Share your storefront link so customers can browse and order.</p><code>/s/${esc(state.slug)}</code></div><div><button type="button" class="btn" data-action="copy-store">Copy store link</button>${publicOrigin?`<a class="btn outline" href="https://wa.me/?text=${encodeURIComponent(publicOrigin+'/s/'+state.slug)}" target="_blank" rel="noopener">WhatsApp ↗</a>`:''}<a class="btn outline" href="/s/${esc(state.slug)}" target="_blank" rel="noopener">View live shop ↗</a></div></section>`;
 return `<section class="launchpad panel"><div class="launchpad-lead"><div><div class="start-kicker"><span></span> ${demo?'PRACTICE WORKSPACE':'YOUR PRIVATE LAUNCHPAD'}</div><h2>Your store, step by step.</h2><p>${next?'Up next: '+next[1]+'.':'Ready to preview and publish your shop.'}</p></div><div class="launchpad-progress"><strong>${done} of ${ready.length} ready</strong><progress value="${progress}" max="100" aria-label="Launch checklist progress">${progress}%</progress></div></div>
 <ol class="launchpad-steps">${ready.map(([ok,title,detail,tab],i)=>`<li class="${ok?'launchpad-done':next?.[3]===tab?'launchpad-next':''}"><button type="button" data-tab="${tab}"><span class="launchpad-index" aria-label="${ok?'Ready':'Pending'}">${ok?'✓':number(i+1)}</span><span><strong>${title}</strong><small>${detail}</small></span><span class="launchpad-arrow" aria-hidden="true">→</span></button></li>`).join('')}</ol>
 <div class="launchpad-actions">${next?`<button class="btn" type="button" data-tab="${next[3]}">Go to next step →</button>`:`<button class="btn" type="button" data-action="${demo?'preview':'publish'}">${demo?'Preview my shop':'Review and publish →'}</button>`}<button class="btn outline" type="button" data-action="preview">Preview storefront</button></div>
 </section>`;
}

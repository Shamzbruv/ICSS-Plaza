import { randomBytes, timingSafeEqual } from 'node:crypto';
import { decrypt, encrypt, fail, hash, id, text } from './model.js';
import { policyVersion, reportReasons, reportOutcomes } from '../public/trust-data.js';

const terminal = status => status === 'resolved' || status === 'closed';
const day = 86400000;
const priorities = ['urgent','high','standard'];
const transitions = {
  received: ['reviewing','awaiting_customer','awaiting_vendor','resolved','closed'],
  reviewing: ['awaiting_customer','awaiting_vendor','resolved','closed'],
  awaiting_customer: ['reviewing','awaiting_vendor','resolved','closed'],
  awaiting_vendor: ['reviewing','awaiting_customer','resolved','closed'],
  resolved: ['reviewing','closed'], closed: ['reviewing']
};

export function createVendorTrust({db,key,limit,email,requireOperator,requireUser,audit}) {
  const {one,all,run,tx} = db;
  const secret = value => encrypt(value,key);
  const unseal = value => decrypt(value,key);
  const addEvent = (rid,audience,author,kind,message) => run(
    'INSERT INTO vendor_report_events VALUES(?,?,?,?,?,?,?)',id(),rid,audience,author,kind,secret(message),Date.now()
  );
  const getCase = async rid => {
    const report = await one('SELECT * FROM vendor_reports WHERE id=?',rid);
    if(!report) fail('Report not found or access key is incorrect.',404);
    return report;
  };
  async function customerAccess(rid, accessKey) {
    if(typeof accessKey!=='string'||!/^[a-f0-9]{64}$/.test(accessKey)) fail('Report not found or access key is incorrect.',404);
    const report = await getCase(rid);
    if(!timingSafeEqual(Buffer.from(report.access_hash,'hex'),Buffer.from(hash(accessKey),'hex'))) fail('Report not found or access key is incorrect.',404);
    return report;
  }
  async function ownerAccess(req,rid) {
    requireUser(req);
    const report = await one('SELECT r.* FROM vendor_reports r JOIN tenants t ON t.id=r.tenant_id WHERE r.id=? AND t.owner=? AND r.vendor_visible=1',rid,req.user.id);
    if(!report) fail('Report not found or access denied.',404);
    return report;
  }
  function evidenceInput(item) {
    const name=text(item?.name,120,1);
    const m=String(item?.data||'').match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/);
    if(!m) fail('Evidence must be a PNG, JPEG or WebP image.');
    const bytes=Buffer.from(m[2],'base64');
    if(bytes.length>1024*1024) fail('Each evidence image must be 1 MB or smaller.');
    const valid=m[1]==='image/png'?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
      :m[1]==='image/jpeg'?bytes.subarray(0,3).equals(Buffer.from([255,216,255]))
      :bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP';
    if(!valid) fail('Evidence image does not match its file type.');
    return {name,mime:m[1],bytes:m[2]};
  }
  const activeLock = tenantId => 'tenant:'+tenantId;
  const latest = 'SELECT r.id,r.reason,r.priority,r.status,r.outcome,r.vendor_visible,r.created,r.updated,t.slug FROM vendor_reports r JOIN tenants t ON t.id=r.tenant_id';
  async function caseView(report, who) {
    const isOperator=who==='operator', vendor=who==='vendor';
    const t=await one('SELECT slug,settings FROM tenants WHERE id=?',report.tenant_id);
    const events=isOperator?await all('SELECT * FROM vendor_report_events WHERE report_id=? ORDER BY created,id',report.id)
      :await all('SELECT * FROM vendor_report_events WHERE report_id=? AND audience=? ORDER BY created,id',report.id,who);
    const restriction=(isOperator||vendor)?await one('SELECT mode,report_id FROM vendor_restrictions WHERE tenant_id=?',report.tenant_id):null;
    return {
      id:report.id,slug:t.slug,storeName:JSON.parse(t.settings).name,reason:report.reason,status:report.status,
      ...(!vendor?{outcome:report.outcome}:{}),...(vendor&&restriction?{storeRestriction:restriction.mode}:{}),created:report.created,updated:report.updated,closed:report.closed,
      ...(isOperator?{priority:report.priority,version:report.version,vendorVisible:!!report.vendor_visible,legalHold:!!report.legal_hold,restriction,...unseal(report.payload)}:{}),
      ...(!vendor?{evidence:(await all('SELECT id,name,mime,created FROM vendor_report_evidence WHERE report_id=? ORDER BY created,id',report.id)).map(e=>({...e,name:unseal(e.name)}))}:{}),
      events:events.map(e=>({author:e.author,kind:e.kind,created:e.created,...(isOperator?{audience:e.audience}:{}),message:unseal(e.payload)}))
    };
  }
  async function submit(req,b) {
    limit(req,'vendor-report-submit',5);
    if(b.website) fail('Report could not be submitted.');
    if(b.acknowledge!==true) fail('Acknowledge the reporting notice before submitting.');
    const slug=text(b.slug,48,3).toLowerCase();
    if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) fail('Enter a valid Plaza store address.');
    const t=await one('SELECT id,settings,status FROM tenants WHERE slug=?',slug);
    if(!t) fail('That Plaza store could not be found.',404);
    const reference=text(b.orderReference||'',40);
    const order=reference?await one('SELECT id FROM orders WHERE tenant_id=? AND short_id=?',t.id,reference):null;
    if(!order&&!JSON.parse(t.settings).published&&!['suspended','cancelled'].includes(t.status)&&
        !await one('SELECT tenant_id FROM vendor_restrictions WHERE tenant_id=?',t.id)) fail('That Plaza store could not be found.',404);
    if(!Object.hasOwn(reportReasons,b.reason)) fail('Choose a reason for your report.');
    const contact=email(b.email),description=text(b.description,4000,20);
    const images=Array.isArray(b.evidence)?b.evidence:[];
    if(images.length>2) fail('You can attach up to two evidence images.');
    const evidence=images.map(evidenceInput);
    const priority=b.reason==='safety'?'urgent':['fraud','privacy','abuse'].includes(b.reason)?'high':'standard';
    const rid=id(),accessKey=randomBytes(32).toString('hex'),now=Date.now();
    const payload=secret({email:contact,description,orderReference:reference,matchedOrder:!!order,policyVersion});
    await tx(async()=>{
      await run('INSERT INTO vendor_reports(id,tenant_id,access_hash,reason,priority,status,payload,created,updated) VALUES(?,?,?,?,?,?,?,?,?)',
        rid,t.id,hash(accessKey),b.reason,priority,'received',payload,now,now);
      for(const e of evidence) await run('INSERT INTO vendor_report_evidence VALUES(?,?,?,?,?,?)',id(),rid,secret(e.name),e.mime,secret(e.bytes),now);
      await addEvent(rid,'customer','platform','received','We received your report. Keep your reference and access key to check for updates.');
      await audit(t.id,'customer','vendor-report.received.'+rid);
    },activeLock(t.id));
    return {id:rid,accessKey,status:'received'};
  }
  async function reply(report,who,b) {
    const message=text(b.message,3000,10);
    await tx(async()=>{
      const latest=await getCase(report.id);
      if(who==='vendor'&&!latest.vendor_visible) fail('Report not found or access denied.',404);
      const appeal=b.review===true;
      if(terminal(latest.status)&&(!appeal||Date.now()-latest.closed>30*day)) fail('This case is closed. You can request a review within 30 days or contact support with your reference.',409);
      if(appeal&&!terminal(latest.status)) fail('Only a closed case can be appealed.',409);
      const now=Date.now();
      if(appeal&&await one('SELECT id FROM vendor_report_events WHERE report_id=? AND author=? AND kind=? AND created>=?',latest.id,who,'appeal',latest.closed)) fail('A review request is already recorded.',409);
      const recent=await one('SELECT COUNT(*) AS n FROM vendor_report_events WHERE report_id=? AND author=? AND created>?',latest.id,who,now-day);
      if(recent.n>=10) fail('Too many messages for this case. Try again later.',429);
      await addEvent(latest.id,who,who,appeal?'appeal':'reply',message);
      const review=appeal||latest.status==='awaiting_'+who;
      await run('UPDATE vendor_reports SET status=?,outcome=?,closed=?,updated=?,version=version+1 WHERE id=?',
        review?'reviewing':latest.status,review?null:latest.outcome,review?null:latest.closed,now,latest.id);
      await audit(latest.tenant_id,who,'vendor-report.'+(appeal?'appeal.':'reply.')+latest.id);
    },activeLock(report.tenant_id));
    return caseView(await getCase(report.id),who);
  }
  async function update(req,report,b) {
    await tx(async()=>{
      const current=await getCase(report.id);
      if(b.version!==current.version) fail('This case was updated. Reopen it to see the latest details.',409);
      const status=b.status||current.status,priority=b.priority||current.priority;
      if(status!==current.status&&!transitions[current.status]?.includes(status)) fail('That status change is not available.',409);
      if(!priorities.includes(priority)) fail('Choose a valid priority.');
      const customerMessage=text(b.customerMessage||'',3000),vendorMessage=text(b.vendorMessage||'',3000),note=text(b.note||'',3000);
      if(terminal(status)&&status!==current.status&&(!Object.hasOwn(reportOutcomes,b.outcome)||!customerMessage)) fail('Choose an outcome and enter a customer-facing explanation.');
      if(!current.vendor_visible&&status==='awaiting_vendor'&&!vendorMessage) fail('Write a redacted summary for the vendor first.');
      if(status==='awaiting_customer'&&status!==current.status&&!customerMessage) fail('Tell the customer what information is needed.');
      if(status==='awaiting_vendor'&&status!==current.status&&!vendorMessage) fail('Tell the vendor what information is needed.');
      const action=b.restriction||'none';
      if(!['none','checkout','suspend','lift'].includes(action)) fail('Choose a valid storefront action.');
      if(action!=='none'&&!note) fail('Record an internal reason for the storefront action.');
      if(action==='lift'){
        const restriction=await one('SELECT report_id FROM vendor_restrictions WHERE tenant_id=?',current.tenant_id);
        if(!restriction||restriction.report_id&&restriction.report_id!==current.id) fail('Only the case responsible for the current restriction can lift it.',409);
        await run('DELETE FROM vendor_restrictions WHERE tenant_id=?',current.tenant_id);
      }else if(action!=='none'){
        const restriction=await one('SELECT report_id FROM vendor_restrictions WHERE tenant_id=?',current.tenant_id);
        if(restriction?.report_id&&restriction.report_id!==current.id) fail('This store is already restricted under another case. Review that case first.',409);
        await run('INSERT INTO vendor_restrictions VALUES(?,?,?,?) ON CONFLICT(tenant_id) DO UPDATE SET report_id=excluded.report_id,mode=excluded.mode,updated=excluded.updated',
          current.tenant_id,current.id,action,Date.now());
      }
      if(note) await addEvent(current.id,'internal','platform','note',note);
      if(customerMessage) await addEvent(current.id,'customer','platform','message',customerMessage);
      if(vendorMessage) await addEvent(current.id,'vendor','platform','message',vendorMessage);
      if(action!=='none') await addEvent(current.id,'internal','platform','enforcement',action);
      if(typeof b.legalHold==='boolean'&&b.legalHold!==!!current.legal_hold&&!note) fail('Record why the retention hold was changed.');
      if(b.outcome&&!Object.hasOwn(reportOutcomes,b.outcome)) fail('Choose a valid outcome.');
      if(terminal(current.status)&&status===current.status&&b.outcome&&b.outcome!==current.outcome&&!customerMessage) fail('Explain the revised outcome to the customer.');
      const now=Date.now(), hold=typeof b.legalHold==='boolean'?Number(b.legalHold):current.legal_hold;
      await run('UPDATE vendor_reports SET status=?,priority=?,outcome=?,vendor_visible=?,legal_hold=?,updated=?,closed=?,version=version+1 WHERE id=?',
        status,priority,terminal(status)?b.outcome||current.outcome:null,current.vendor_visible||vendorMessage?1:0,hold,now,terminal(status)?current.closed||now:null,current.id);
      await audit(current.tenant_id,req.user.id,'vendor-report.'+status+'.'+current.id);
    },activeLock(report.tenant_id));
    return caseView(await getCase(report.id),'operator');
  }
  return {
    async purge() {
      const cutoff=Date.now()-365*day;
      // Keep an active enforcement case until the action has been lifted.
      await run('DELETE FROM vendor_reports WHERE closed<? AND legal_hold=0 AND id NOT IN (SELECT report_id FROM vendor_restrictions WHERE report_id IS NOT NULL)',cutoff);
    },
    async handle({req,res,u,path,method,b,respond}) {
      if(path==='/api/reports'&&method==='POST') return respond(res,await submit(req,b),201);
      let m=path.match(/^\/api\/reports\/([a-f0-9]{24})\/(lookup|reply)$/);
      if(m&&method==='POST'){
        limit(req,'vendor-report-access',40);
        const report=await customerAccess(m[1],b.accessKey);
        return respond(res,m[2]==='reply'?await reply(report,'customer',b):await caseView(report,'customer'));
      }
      if(path==='/api/vendor/reports'&&method==='GET'){
        requireUser(req);
        const reports=await all(latest+' WHERE t.owner=? AND r.vendor_visible=1 ORDER BY r.updated DESC LIMIT 200',req.user.id);
        return respond(res,{reports:reports.map(({id,reason,status,updated,slug})=>({id,reason,status,updated,slug}))});
      }
      m=path.match(/^\/api\/vendor\/reports\/([a-f0-9]{24})$/);
      if(m&&['GET','POST'].includes(method)){
        const report=await ownerAccess(req,m[1]);
        return respond(res,method==='POST'?await reply(report,'vendor',b):await caseView(report,'vendor'));
      }
      if(path==='/api/operator/reports'&&method==='GET'){
        requireOperator(req);
        const filter=u.searchParams.get('status')||'open';
        let where=filter==='open'?" WHERE r.status NOT IN ('resolved','closed')":'';
        if(filter==='closed')where=" WHERE r.status IN ('resolved','closed')";
        const page=Math.min(Math.max(Number.parseInt(u.searchParams.get('page')||'1',10)||1,1),10000);
        const rows=await all(latest+where+" ORDER BY CASE r.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 ELSE 2 END,r.updated DESC LIMIT 51 OFFSET ?",(page-1)*50);
        return respond(res,{reports:rows.slice(0,50),hasNext:rows.length>50});
      }
      m=path.match(/^\/api\/operator\/reports\/([a-f0-9]{24})(?:\/evidence\/([a-f0-9]{24}))?$/);
      if(m){
        requireOperator(req);
        const report=await getCase(m[1]);
        if(m[2]&&method==='GET'){
          const e=await one('SELECT * FROM vendor_report_evidence WHERE report_id=? AND id=?',report.id,m[2]);
          if(!e) fail('Evidence not found.',404);
          const bytes=Buffer.from(unseal(e.payload),'base64');
          await audit(report.tenant_id,req.user.id,'vendor-report.evidence-viewed.'+report.id);
          res.writeHead(200,{'Content-Type':e.mime,'Cache-Control':'no-store','Content-Disposition':'attachment; filename="case-evidence.'+e.mime.split('/')[1]+'"'});
          return res.end(bytes);
        }
        if(!m[2]&&method==='GET') return respond(res,await caseView(report,'operator'));
        if(!m[2]&&method==='PATCH') return respond(res,await update(req,report,b));
      }
      fail('Endpoint not found.',404);
    }
  };
}

import {readAccountBody} from './account.mjs';
const reply=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const hash=/^[a-f0-9]{64}$/;
const status=row=>({accepted:true,complete:!!row.complete,cleanup:row.complete?'complete':'pending'});
const bindingSQL="((? IS NULL AND NOT EXISTS(SELECT 1 FROM billing_customers WHERE owner=account_security.owner)) OR EXISTS(SELECT 1 FROM billing_customers b WHERE b.owner=account_security.owner AND b.customer_id=? AND b.mode=? AND b.revision=? AND b.reservation IS NULL AND b.session_id IS NULL AND b.lease_until=0))";
export async function accountDeletionRequest(request,env){
 const owner=request.headers.get('x-qr-user'),path=new URL(request.url).pathname;
 if(!hash.test(owner||'')||new URL(request.url).search)return reply({error:'Invalid request.'},400);
 if(path==='/account/deletion/status'&&request.method==='GET'){
  const id=request.headers.get('x-qr-deletion-id');if(!hash.test(id||''))return reply({error:'Invalid receipt.'},400);
  const row=await env.DB.prepare('SELECT * FROM account_deletions WHERE owner=? AND id=?').bind(owner,id).first();
  return row?reply(status(row)):reply({accepted:false,complete:false,cleanup:'not_started'});
 }
 if(request.method!=='POST')return reply({error:'Method not allowed.'},405);
 let b;try{b=await readAccountBody(request);}catch{return reply({error:'Invalid request.'},400);}
 if(!Number.isSafeInteger(b.version)||b.version<1||b.version>=Number.MAX_SAFE_INTEGER||!hash.test(b.intent||''))return reply({error:'Invalid request.'},400);
 if(path==='/account/deletion/intent'){
  if(Object.keys(b).sort().join(',')!=='intent,version')return reply({error:'Invalid request.'},400);
  const result=await env.DB.batch([
   env.DB.prepare('DELETE FROM account_deletion_intents WHERE owner=? AND consumed=0').bind(owner),
   env.DB.prepare("INSERT INTO account_deletion_intents(id,owner,version,expires_at) SELECT ?,owner,session_version,? FROM account_security WHERE owner=? AND session_version=? AND lifecycle='active' RETURNING id").bind(b.intent,Date.now()+5*60000,owner,b.version)
  ]);
  return result[1].results.length?reply({intent:b.intent}):reply({error:'Sign in again before closing this account.'},409);
 }
 if(path!=='/account/deletion/start'||Object.keys(b).sort().join(',')!=='binding,intent,version')return reply({error:'Invalid request.'},400);
 const existing=await env.DB.prepare('SELECT * FROM account_deletions WHERE owner=? AND id=? AND version=?').bind(owner,b.intent,b.version).first();
 if(existing)return reply(status(existing),202);
 const expected=b.binding;
 if(expected!==null&&(!expected||Object.keys(expected).sort().join(',')!=='customerId,mode,revision'||!/^cus_[A-Za-z0-9]{1,180}$/.test(expected.customerId)||!['test','live'].includes(expected.mode)||!Number.isSafeInteger(expected.revision)||expected.revision<0))return reply({error:'Invalid billing check.'},400);
 const now=Date.now();
 // D1 batch is a real transaction. Billing mutations have revision and closed-owner triggers.
 const result=await env.DB.batch([
  env.DB.prepare(`UPDATE account_security SET lifecycle='closed',session_version=session_version+1,deletion_id=? WHERE owner=? AND session_version=? AND lifecycle='active' AND EXISTS(SELECT 1 FROM account_deletion_intents i WHERE i.id=? AND i.owner=account_security.owner AND i.version=account_security.session_version AND i.consumed=0 AND i.expires_at>=?) AND NOT EXISTS(SELECT 1 FROM billing_customer_creations pending WHERE pending.owner=account_security.owner) AND ${bindingSQL} RETURNING owner`).bind(b.intent,owner,b.version,b.intent,now,expected?.customerId??null,expected?.customerId??null,expected?.mode??null,expected?.revision??null),
  env.DB.prepare('INSERT INTO account_deletions(id,owner,version,accepted_at) SELECT deletion_id,owner,?,? FROM account_security WHERE owner=? AND deletion_id=? AND changes()=1').bind(b.version,now,owner,b.intent),
  env.DB.prepare('UPDATE account_deletion_intents SET consumed=1 WHERE id=? AND owner=? AND EXISTS(SELECT 1 FROM account_deletions WHERE id=? AND owner=?)').bind(b.intent,owner,b.intent,owner)
 ]);
 if(!result[0].results.length)return reply({error:'Closure was not accepted. Verify your account again and check Billing; a checkout or account change may be in progress.'},409);
 return reply({accepted:true,complete:false,cleanup:'pending'},202);
}

// All work, including selection and R2 listing, is bounded. Tombstones remain in rotation forever.
export async function cleanupAccount(env,row){
 const owner=row.owner;
 if(!row.ledger_ready){
  // Independent of D1 snapshots; never public, and outside account content prefixes.
  await env.ASSETS.put(`deletion-ledger/v1/${owner}/${row.id}.json`,JSON.stringify({format:1,owner,deletionId:row.id,revokedThroughVersion:row.version,acceptedAt:row.accepted_at,closed:true}),{httpMetadata:{contentType:'application/json'}});
  await env.DB.prepare('UPDATE account_deletions SET ledger_ready=1 WHERE id=?').bind(row.id).run();
 }
 const stmts=[];
 for(const table of ['cloud_designs','content_assets']){
  stmts.push(env.DB.prepare(`INSERT OR IGNORE INTO account_deletion_objects(owner,r2key) SELECT owner,r2key FROM ${table} WHERE owner=? ORDER BY id LIMIT 25`).bind(owner));
  stmts.push(env.DB.prepare(`DELETE FROM ${table} WHERE id IN (SELECT id FROM ${table} WHERE owner=? ORDER BY id LIMIT 25)`).bind(owner));
 }
 stmts.push(env.DB.prepare("INSERT OR IGNORE INTO account_deletion_objects(owner,r2key) SELECT owner,r2key FROM account_uploads WHERE owner=? AND state='settled' ORDER BY r2key LIMIT 25").bind(owner));
 stmts.push(env.DB.prepare('DELETE FROM content_submissions WHERE id IN (SELECT s.id FROM content_submissions s JOIN content_pages p ON p.id=s.page_id WHERE p.owner=? LIMIT 25)').bind(owner));
 stmts.push(env.DB.prepare('DELETE FROM link_daily_counts WHERE rowid IN (SELECT c.rowid FROM link_daily_counts c JOIN dynamic_links l ON l.slug=c.slug WHERE l.owner=? LIMIT 25)').bind(owner));
 stmts.push(env.DB.prepare('DELETE FROM content_pages WHERE id IN (SELECT p.id FROM content_pages p WHERE p.owner=? AND NOT EXISTS(SELECT 1 FROM content_submissions s WHERE s.page_id=p.id) LIMIT 25)').bind(owner));
 stmts.push(env.DB.prepare('DELETE FROM dynamic_links WHERE id IN (SELECT l.id FROM dynamic_links l WHERE l.owner=? AND NOT EXISTS(SELECT 1 FROM link_daily_counts c WHERE c.slug=l.slug) LIMIT 25)').bind(owner));
 stmts.push(env.DB.prepare('DELETE FROM account_security_events WHERE id IN (SELECT id FROM account_security_events WHERE owner=? LIMIT 25)').bind(owner));
 await env.DB.batch(stmts);
 // Legacy content keys are covered by the captured D1 manifest. New uploads are attributable.
 const prefixes=[`accounts/${owner}/`,`content/${owner}/`];
 const list=await env.ASSETS.list({prefix:prefixes[row.scan_prefix],limit:25,...(row.scan_cursor?{cursor:row.scan_cursor}:{})});
 if(!Array.isArray(list.objects)||list.objects.length>25||typeof list.truncated!=='boolean'||list.truncated&&typeof list.cursor!=='string')throw new Error('Invalid object listing');
 if(list.objects.length)await env.DB.batch(list.objects.map(object=>{
  if(typeof object.key!=='string'||!object.key.startsWith(prefixes[row.scan_prefix]))throw new Error('Invalid object key');
  return env.DB.prepare('INSERT OR IGNORE INTO account_deletion_objects(owner,r2key) VALUES(?,?)').bind(owner,object.key);
 }));
 await env.DB.prepare('UPDATE account_deletions SET scan_cursor=?,scan_prefix=?,scanned=?,complete=0 WHERE id=?').bind(list.truncated?list.cursor:null,list.truncated?row.scan_prefix:(row.scan_prefix+1)%2,Number(!list.truncated&&row.scan_prefix===1)||row.scanned,row.id).run();
 const manifest=await env.DB.prepare('SELECT r2key FROM account_deletion_objects WHERE owner=? ORDER BY r2key LIMIT 25').bind(owner).all();
 for(const {r2key} of manifest.results){
  // Never delete another owner's reference, nor an active owner reference, even in corrupt legacy data.
  const referenced=await env.DB.prepare('SELECT 1 AS present FROM cloud_designs WHERE r2key=? UNION ALL SELECT 1 FROM content_assets WHERE r2key=? LIMIT 1').bind(r2key,r2key).first();
  const foreign=await env.DB.prepare('SELECT 1 AS present FROM account_uploads WHERE r2key=? AND owner<>?').bind(r2key,owner).first();
  if(referenced||foreign||r2key.startsWith('deletion-ledger/'))continue;
  await env.ASSETS.delete(r2key);
  await env.DB.batch([
   env.DB.prepare("DELETE FROM account_uploads WHERE owner=? AND r2key=? AND state='settled'").bind(owner,r2key),
   env.DB.prepare('DELETE FROM account_deletion_objects WHERE owner=? AND r2key=?').bind(owner,r2key)
  ]);
 }
 // Pending upload journals are deliberate: no timeout can prove an ambiguous put did not execute.
 const tables=['cloud_designs','content_assets','content_pages','dynamic_links','account_uploads','account_deletion_objects','account_security_events'];
 const remains=tables.map(table=>`NOT EXISTS(SELECT 1 FROM ${table} WHERE owner=account_deletions.owner)`).join(' AND ');
 await env.DB.prepare(`UPDATE account_deletions SET complete=CASE WHEN ledger_ready=1 AND scanned=1 AND ${remains} THEN 1 ELSE 0 END WHERE id=?`).bind(row.id).run();
}
export async function cleanupAccounts(env){
 const rows=await env.DB.prepare('SELECT * FROM account_deletions ORDER BY last_sweep,id LIMIT 5').all();
 for(const row of rows.results){
  await env.DB.prepare('UPDATE account_deletions SET last_sweep=? WHERE id=?').bind(Date.now(),row.id).run();
  try{await cleanupAccount(env,row);}catch{/* Keep all durable remaining work; retry on the next scheduled pass. */}
 }
 await env.DB.prepare('DELETE FROM account_deletion_intents WHERE id IN (SELECT id FROM account_deletion_intents WHERE expires_at<? LIMIT 100)').bind(Date.now()).run();
}

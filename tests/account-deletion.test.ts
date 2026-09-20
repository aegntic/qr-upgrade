import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import Stripe from 'stripe';
import {migrate} from './fixtures/migrations';
import worker from '../workers/qr-service/worker.mjs';
import {cleanupAccounts} from '../workers/qr-service/account-deletion.mjs';
import {beginDeletion,closeAccount,deletionStatus} from '../src/lib/server/account-deletion';
import {callback,getAccount,signAccountToken,verifyToken,cloudProxy,type AccountConfig} from '../src/lib/server/account';
import {checkClosureBilling,type BillingConfig} from '../src/lib/server/billing';
import {assetProxy} from '../src/lib/server/content';
import {newDesign} from '../src/lib/new-design';
const c:AccountConfig={clientId:'fixture',clientSecret:'fixture',secret:'s'.repeat(64),serviceUrl:'https://service.example',development:true};
const owner=createHash('sha256').update('google:subject').digest('hex'),other='b'.repeat(64),intent='c'.repeat(64),now='2026-09-20T00:00:00.000Z';
const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const form={kind:'form',title:'Form',description:'',accent:'#ffffff',items:[],fileId:'',formMessage:''};
const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';
function fixture(){
 const sqlite=new DatabaseSync(':memory:');migrate(sqlite);
 for(const user of [owner,other])sqlite.prepare('INSERT INTO account_security(owner,session_version) VALUES(?,1)').run(user);
 const objects=new Map<string,Uint8Array>(),deleted:string[]=[],queries:string[]=[];
 const wrap=(sql:string,params:any[]=[])=>({sql,params,bind:(...v:any[])=>wrap(sql,v),first:async()=>{queries.push(sql);return sqlite.prepare(sql).get(...params)||null;},all:async()=>{queries.push(sql);return {results:sqlite.prepare(sql).all(...params)};},run:async()=>sqlite.prepare(sql).run(...params)});
 const DB={prepare:wrap,async batch(statements:ReturnType<typeof wrap>[]){sqlite.exec('BEGIN');try{const results=statements.map(s=>({results:sqlite.prepare(s.sql).all(...s.params)}));sqlite.exec('COMMIT');return results;}catch(error){sqlite.exec('ROLLBACK');throw error;}}};
 const ASSETS={async put(key:string,value:string|Uint8Array){objects.set(key,typeof value==='string'?new TextEncoder().encode(value):value);},async get(key:string){const v=objects.get(key);return v?{size:v.length,body:new Response(new Uint8Array(v)).body,json:async()=>JSON.parse(new TextDecoder().decode(v))}:null;},async delete(key:string){deleted.push(key);objects.delete(key);},async list({prefix,limit,cursor}:{prefix:string;limit:number;cursor?:string}){assert.ok(limit<=25);const keys=[...objects.keys()].filter(k=>k.startsWith(prefix)&&(!cursor||k>cursor)).sort(),page=keys.slice(0,limit);return {objects:page.map(key=>({key})),truncated:keys.length>limit,cursor:page.at(-1)};}};
 const env={DB,ASSETS,SERVICE_SECRET:c.secret};
 const deps={fetch:async(input:RequestInfo|URL,init?:RequestInit)=>worker.fetch(new Request(String(input),init),env,{waitUntil(){}})};
 const call=(path:string,method='GET',body?:unknown,user=owner,version=1,headers:Record<string,string>={})=>deps.fetch(c.serviceUrl+path,{method,headers:{Authorization:`Bearer ${c.secret}`,'x-qr-user':user,'x-qr-session-version':String(version),'x-qr-deletion-id':intent,'Content-Type':'application/json',...headers},body:body===undefined?undefined:JSON.stringify(body)});
 const prepare=async()=>assert.equal((await call('/account/deletion/intent','POST',{version:1,intent})).status,200);
 const start=async(binding:unknown=null)=>call('/account/deletion/start','POST',{version:1,intent,binding});
 return {sqlite,objects,deleted,queries,DB,ASSETS,env,deps,call,prepare,start};
}
async function cookies(user=owner){return `qr-session=${await signAccountToken({sub:user,sv:1,name:'Fixture',email:'fixture@example.com'},'session',c)}; qr-deletion-intent=${await signAccountToken({owner,version:1,intent},'deletion-intent',c)}; qr-deletion-status=${await signAccountToken({owner,version:1,intent},'deletion-status',c)}`;}
function browser(cookie:string,method='POST',body:unknown={confirm:true},headers:Record<string,string>={}){return new Request('http://localhost:3040/api/account/deletion',{method,headers:{cookie,origin:'http://localhost:3040','Content-Type':'application/json',...headers},body:method==='GET'?undefined:JSON.stringify(body)});}
function seed(f:ReturnType<typeof fixture>,n:number,user=owner,key=`accounts/${user}/old-${n}`){
 f.sqlite.prepare('INSERT INTO cloud_designs VALUES(?,?,?,?,?,?,?,?)').run(id(n),user,'Cloud',0,now,now,key,n%2);
 f.objects.set(key,new TextEncoder().encode('private'));
 f.sqlite.prepare('INSERT INTO content_assets VALUES(?,?,?,?,?,?,?,?)').run(id(n),user,'file','application/pdf',7,`content/legacy-${user}-${n}`,n%2,now);f.objects.set(`content/legacy-${user}-${n}`,new TextEncoder().encode('private'));
 f.sqlite.prepare('INSERT INTO content_pages VALUES(?,?,?,?,?,?,?,?,?)').run(id(n),user,String(n).padStart(16,'0'),JSON.stringify(form),JSON.stringify(form),'published',0,now,now);
 f.sqlite.prepare('INSERT INTO content_submissions VALUES(?,?,?,?,?,?,?)').run(id(n),id(n),'Sender','sender@example.com','Private',now,'f'.repeat(64));
 f.sqlite.prepare('INSERT INTO dynamic_links VALUES(?,?,?,?,?,?,?,?,?)').run(id(n),user,String(n).padStart(16,'0'),'Link','https://openai.com','published',0,now,now);
 f.sqlite.prepare('INSERT INTO link_daily_counts VALUES(?,?,?)').run(String(n).padStart(16,'0'),'2026-09-20',1);
}
test('explicit same-account Google reauthentication uses PKCE/max_age; ordinary login and identity switch cannot approve deletion',async()=>{
 const f=fixture();try{
 const cookie=await cookies(),begin=await beginDeletion(browser(cookie),c,f.deps);assert.equal(begin.status,200);const url=new URL((await begin.json()).url);assert.equal(url.searchParams.get('max_age'),'0');assert.equal(url.searchParams.get('code_challenge_method'),'S256');
 const oauth=begin.headers.getSetCookie().find(x=>x.startsWith('qr-oauth='))!.split(';')[0],p=await verifyToken(oauth.slice(9),'oauth',c);
 for(const change of [{sub:'other'}, {auth_time:0}, {email_verified:false}, {nonce:'wrong'}]){
  const r=await callback(new Request(`http://localhost:3040/api/account/callback?state=${p.state}&code=code`,{headers:{cookie:`${cookie}; ${oauth}`}}),c,{fetch:async(input,init)=>String(input).includes('oauth2.googleapis.com')?Response.json({id_token:'fixture'}):f.deps.fetch(input,init),verifyGoogleToken:async()=>({sub:'subject',email:'fixture@example.com',email_verified:true,nonce:p.nonce,auth_time:Math.floor(Date.now()/1000),...change})});
  assert.match(r.headers.get('location')!,/error=signin/);assert.ok(!r.headers.getSetCookie().some(x=>x.startsWith('qr-deletion-intent=')));assert.equal(f.sqlite.prepare('SELECT count(*) n FROM account_deletion_intents').get()!.n,0);
 }
 const valid=await callback(new Request(`http://localhost:3040/api/account/callback?state=${p.state}&code=code`,{headers:{cookie:`${cookie}; ${oauth}`}}),c,{fetch:async(input,init)=>String(input).includes('oauth2.googleapis.com')?Response.json({id_token:'fixture'}):f.deps.fetch(input,init),verifyGoogleToken:async()=>({sub:'subject',email:'fixture@example.com',email_verified:true,nonce:p.nonce,auth_time:Math.floor(Date.now()/1000)})});
 assert.equal(valid.headers.get('location'),'http://localhost:3040/account?closure=confirm');assert.equal(valid.headers.getSetCookie().filter(x=>x.startsWith('qr-deletion-')).length,2);assert.equal(f.sqlite.prepare('SELECT count(*) n FROM account_deletions').get()!.n,0);
 }finally{f.sqlite.close();}
});
test('exact-origin fixed confirmation and owner-bound proof reject CSRF, tampering, account switch and expired/replayed intent',async()=>{
 const f=fixture();try{await f.prepare();const cookie=await cookies();
 for(const headers of [{origin:'https://evil.example'},{origin:'null'},{'x-qr-user':other},{'sec-fetch-site':'cross-site'}] as Record<string,string>[])assert.equal((await closeAccount(browser(cookie,'POST',{confirm:true},headers),c,f.deps)).status,403);
 for(const body of [{},{confirm:false},{confirm:true,owner:other},{confirm:true,intent},{confirm:true,version:1},{confirm:true,extra:'a'.repeat(1200)}])assert.equal((await closeAccount(browser(cookie,'POST',body),c,f.deps)).status,400);
 assert.equal((await closeAccount(browser(await cookies(other)),c,f.deps)).status,401);
 assert.equal((await closeAccount(browser(cookie.replace('qr-deletion-intent=','qr-deletion-intent=tampered')),c,f.deps)).status,401);
 f.sqlite.prepare('UPDATE account_deletion_intents SET expires_at=0').run();assert.equal((await closeAccount(browser(cookie),c,f.deps)).status,409);
 await f.prepare();assert.equal((await closeAccount(browser(cookie),c,f.deps,{account:c,enabled:false})).status,202);
 assert.equal((await closeAccount(browser(cookie),c,f.deps)).status,202);assert.equal(f.sqlite.prepare('SELECT session_version FROM account_security WHERE owner=?').get(owner)!.session_version,2);
 assert.equal((await f.call('/account/sign-in','POST',{})).status,409);assert.equal((await f.call('/account/deletion/intent','POST',{version:2,intent:'d'.repeat(64)})).status,409);
 }finally{f.sqlite.close();}
});
test('response loss recovers through independent status receipt; revocation is immediate and failures retain cookies',async()=>{
 const f=fixture();try{await f.prepare();const cookie=await cookies();const response=await closeAccount(browser(cookie),c,{fetch:async(input,init)=>{const r=await f.deps.fetch(input,init);if(String(input).endsWith('/start'))throw new Error('lost after commit');return r;}},{account:c,enabled:false});
 assert.equal(response.status,503);assert.equal(response.headers.get('set-cookie'),null);assert.equal(await getAccount(browser(cookie,'GET'),c,f.deps),null);
 const status=await deletionStatus(browser(cookie,'GET'),c,f.deps);assert.equal(status.status,202);assert.equal((await status.json()).cleanup,'pending');assert.equal(status.headers.getSetCookie().length,3);
 const denied=await deletionStatus(browser(cookie,'GET'),c,{fetch:async()=>{throw new Error();}});assert.equal(denied.status,503);assert.equal(denied.headers.get('set-cookie'),null);
 const invalid=await f.call('/account/deletion/status','GET',undefined,other);assert.equal((await invalid.json()).accepted,false);
 }finally{f.sqlite.close();}
});
test('D1 acceptance is atomic with intent consumption and billing reservations; rollback leaves account open',async()=>{
 const f=fixture();try{await f.prepare();f.sqlite.exec("CREATE TRIGGER fail_receipt BEFORE INSERT ON account_deletions BEGIN SELECT RAISE(ABORT,'fixture'); END");assert.equal((await f.start()).status,503);assert.equal(f.sqlite.prepare('SELECT lifecycle FROM account_security WHERE owner=?').get(owner)!.lifecycle,'active');assert.equal(f.sqlite.prepare('SELECT consumed FROM account_deletion_intents').get()!.consumed,0);f.sqlite.exec('DROP TRIGGER fail_receipt');
 f.sqlite.prepare("INSERT INTO billing_customers(owner,customer_id,mode) VALUES(?,'cus_owned','test')").run(owner);
 assert.equal((await f.start()).status,409);
 const reserved=await f.call('/billing/checkout','POST',{action:'reserve',token:'d'.repeat(32),tier:'pro'});assert.equal(reserved.status,200);assert.equal((await f.start({customerId:'cus_owned',mode:'test',revision:0})).status,409);
 await f.call('/billing/checkout','POST',{action:'release',token:'d'.repeat(32)});assert.equal((await f.start({customerId:'cus_owned',mode:'test',revision:0})).status,409);
 const revision=f.sqlite.prepare('SELECT revision FROM billing_customers WHERE owner=?').get(owner)!.revision;assert.equal((await f.start({customerId:'cus_owned',mode:'test',revision})).status,202);
 assert.equal((await f.call('/billing/checkout','POST',{action:'reserve',token:'e'.repeat(32),tier:'pro'})).status,409);
 assert.throws(()=>f.sqlite.prepare("UPDATE billing_customers SET reservation='late' WHERE owner=?").run(owner),/account closed/);
 }finally{f.sqlite.close();}
});
test('all public delivery and private dispatcher/proxy reads are fenced, with legacy owners still public before closing',async()=>{
 const f=fixture();try{seed(f,1);seed(f,2,other);f.sqlite.prepare('DELETE FROM account_security WHERE owner=?').run(other);
 assert.equal((await f.call('/resolve/0000000000000002')).status,200);assert.equal((await f.call('/public-content/0000000000000002')).status,200);
 await f.prepare();await f.start();
 for(const path of ['/resolve/0000000000000001','/public-content/0000000000000001',`/public-content/0000000000000001/assets/${id(1)}`])assert.equal((await f.call(path)).status,404,path);
 assert.equal((await f.call('/public-content/0000000000000001/submissions','POST',{name:'',email:'',message:'test',consent:true,website:''},owner,1,{'x-qr-network':'f'.repeat(64)})).status,404);
 for(const path of ['/cloud/designs',`/cloud/designs/${id(1)}`,'/content',`/content-assets/${id(1)}`,'/links'])assert.equal((await f.call(path)).status,401,path);
 const cookie=await cookies();assert.equal((await cloudProxy(browser(cookie,'GET'),undefined,c,{accountDeps:f.deps})).status,401);assert.equal((await assetProxy(browser(cookie,'GET'),id(1),c,{accountDeps:f.deps})).status,401);
 assert.equal((await f.call('/account/export/files/design/'+id(1))).status,409);
 assert.equal((await f.call('/cloud/designs','GET',undefined,owner,2)).status,401);
 for(const sql of ["UPDATE cloud_designs SET name='late' WHERE owner=?","UPDATE content_assets SET ready=1 WHERE owner=?","UPDATE content_pages SET draft='late' WHERE owner=?","UPDATE dynamic_links SET name='late' WHERE owner=?"])assert.throws(()=>f.sqlite.prepare(sql).run(owner),/account closed/);
 assert.throws(()=>f.sqlite.prepare('UPDATE link_daily_counts SET count=count+1 WHERE slug=?').run('0000000000000001'),/account closed/);
 assert.throws(()=>f.sqlite.prepare('INSERT INTO content_submissions VALUES(?,?,?,?,?,?,?)').run(id(3),id(1),'','','late',now,null),/account closed/);
 }finally{f.sqlite.close();}
});
test('bounded retry cleanup deletes every owned child, pending row and orphan, preserves other owners and records minimal independent ledger',async()=>{
 const f=fixture();try{for(let n=1;n<=65;n++)seed(f,n);seed(f,90,other);f.objects.set(`accounts/${owner}/orphan`,new Uint8Array([1]));await f.prepare();await f.start();
 const originalDelete=f.ASSETS.delete;let failure=true;f.ASSETS.delete=async key=>{if(failure){failure=false;throw new Error('transient delete');}return originalDelete(key);};
 await cleanupAccounts(f.env);assert.equal(f.sqlite.prepare('SELECT complete FROM account_deletions').get()!.complete,0);assert.equal(f.sqlite.prepare('SELECT count(*) n FROM cloud_designs WHERE owner=?').get(owner)!.n,40);
 for(let n=0;n<20;n++)await cleanupAccounts(f.env);
 assert.equal(f.sqlite.prepare('SELECT complete FROM account_deletions').get()!.complete,1);
 for(const table of ['cloud_designs','content_assets','content_pages','dynamic_links']){assert.equal(f.sqlite.prepare(`SELECT count(*) n FROM ${table} WHERE owner=?`).get(owner)!.n,0);assert.equal(f.sqlite.prepare(`SELECT count(*) n FROM ${table} WHERE owner=?`).get(other)!.n,1);}
 assert.equal(f.sqlite.prepare('SELECT count(*) n FROM content_submissions').get()!.n,1);assert.equal(f.sqlite.prepare('SELECT count(*) n FROM link_daily_counts').get()!.n,1);
 assert.equal([...f.objects.keys()].filter(k=>!k.startsWith('deletion-ledger/')&&!k.includes(other)).length,0);
 const ledger=JSON.parse(new TextDecoder().decode(f.objects.get(`deletion-ledger/v1/${owner}/${intent}.json`)!));assert.deepEqual(Object.keys(ledger).sort(),['acceptedAt','closed','deletionId','format','owner','revokedThroughVersion']);assert.equal(ledger.revokedThroughVersion,1);
 }finally{f.sqlite.close();}
});
function stripeFixture(subStatus:string|null=null,sessionStatus:string|null=null){
 const sub={id:'sub_owned',customer:'cus_owned',livemode:false,metadata:{owner},status:subStatus};
 const session={id:'cs_owned',customer:'cus_owned',livemode:false,metadata:{owner},mode:'subscription',status:sessionStatus,subscription:subStatus?'sub_owned':null};
 const stripe={customers:{retrieve:async()=>({id:'cus_owned',livemode:false,metadata:{owner}})},subscriptions:{list:async()=>({has_more:false,data:subStatus?[sub]:[]}),retrieve:async()=>sub},checkout:{sessions:{list:async()=>({has_more:false,data:sessionStatus?[session]:[]}),retrieve:async()=>session}}};
 return {stripe:stripe as unknown as Stripe,raw:stripe,sub,session};
}
function bindBilling(f:ReturnType<typeof fixture>,reserved=false){f.sqlite.prepare('INSERT INTO billing_customers(owner,customer_id,mode,reservation,tier,reserved_at,session_id,lease_until) VALUES(?,?,?,?,?,?,?,?)').run(owner,'cus_owned','test',reserved?'d'.repeat(32):null,reserved?'pro':null,reserved?1:null,reserved?'cs_owned':null,0);}
const bc:BillingConfig={account:c,enabled:false,key:'sk_test_fixture'};
test('disabled billing still inspects persisted owner/mode/customer; every live or unknown subscription and open checkout blocks',async()=>{
 for(const subStatus of ['active','trialing','past_due','unpaid','incomplete','paused','unknown']){const f=fixture();try{bindBilling(f);const s=stripeFixture(subStatus);await assert.rejects(()=>checkClosureBilling(owner,1,bc,{...f.deps,stripe:s.stripe}),/Billing/);}finally{f.sqlite.close();}}
 for(const change of ['mode','owner','open','unknown-create','provider-failure','overflow']){const f=fixture();try{bindBilling(f,change==='unknown-create');const s=stripeFixture(null,change==='open'?'open':null);
  if(change==='mode')f.sqlite.prepare("UPDATE billing_customers SET mode='live'").run();
  if(change==='owner')s.raw.customers.retrieve=async()=>({id:'cus_owned',livemode:false,metadata:{owner:other}});
  if(change==='unknown-create')f.sqlite.prepare('UPDATE billing_customers SET session_id=NULL').run();
  if(change==='provider-failure')s.raw.subscriptions.list=async()=>{throw new Error('provider unavailable');};
  if(change==='overflow')s.raw.subscriptions.list=async()=>({has_more:true,data:[]});
  await assert.rejects(()=>checkClosureBilling(owner,1,bc,{...f.deps,stripe:s.stripe}));
 }finally{f.sqlite.close();}}
 const f=fixture();try{bindBilling(f);await assert.rejects(()=>checkClosureBilling(owner,1,{account:c,enabled:false},f.deps));}finally{f.sqlite.close();}
});
test('verified terminal or expired checkout retires only its exact reservation after fresh subscription recheck',async()=>{
 for(const [sub,session] of [['canceled','complete'],['incomplete_expired','complete'],[null,'expired']] as const){const f=fixture();try{bindBilling(f,true);const s=stripeFixture(sub,session);let checks=0;const list=s.raw.subscriptions.list;s.raw.subscriptions.list=async()=>{checks++;return list();};const binding=await checkClosureBilling(owner,1,bc,{...f.deps,stripe:s.stripe});assert.ok(checks>=2);assert.deepEqual(binding,{customerId:'cus_owned',mode:'test',revision:1});assert.equal(f.sqlite.prepare('SELECT reservation FROM billing_customers').get()!.reservation,null);await f.prepare();assert.equal((await f.start(binding)).status,202);}finally{f.sqlite.close();}}
 const f=fixture();try{bindBilling(f,true);const s=stripeFixture('canceled','complete'),list=s.raw.subscriptions.list;let checks=0;s.raw.subscriptions.list=async()=>{checks++;if(checks===2)f.sqlite.prepare('UPDATE billing_customers SET lease_until=?').run(Math.floor(Date.now()/1000)+60);return list();};await assert.rejects(()=>checkClosureBilling(owner,1,bc,{...f.deps,stripe:s.stripe}));assert.notEqual(f.sqlite.prepare('SELECT reservation FROM billing_customers').get()!.reservation,null);}finally{f.sqlite.close();}
});
test('late successful upload settles into cleanup after closure; uncertain put remains pending even when all visible keys are gone',async()=>{
 for(const uncertain of [false,true]){const f=fixture();try{let began!:()=>void,release!:()=>void;const started=new Promise<void>(r=>began=r),wait=new Promise<void>(r=>release=r),put=f.ASSETS.put;
 f.ASSETS.put=async(key,value)=>{if(key.startsWith('accounts/')){began();await wait;await put(key,value);if(uncertain)throw new Error('lost acknowledgement');}else await put(key,value);};
 const draft=newDesign('https://openai.com','Late upload'),upload=f.call('/cloud/designs','POST',{name:draft.name,draft,artifact:{png}});
 await started;assert.equal(f.sqlite.prepare('SELECT state FROM account_uploads').get()!.state,'pending');await f.prepare();await f.start();await cleanupAccounts(f.env);release();assert.ok([409,503].includes((await upload).status));
 for(let n=0;n<4;n++)await cleanupAccounts(f.env);
 assert.equal(f.sqlite.prepare('SELECT complete FROM account_deletions').get()!.complete,uncertain?0:1);
 assert.equal(f.sqlite.prepare('SELECT count(*) n FROM cloud_designs').get()!.n,0);assert.equal([...f.objects.keys()].filter(k=>k.startsWith('accounts/')).length,0);
 if(uncertain)assert.equal(f.sqlite.prepare('SELECT state FROM account_uploads').get()!.state,'pending');
 }finally{f.sqlite.close();}}
});
test('late asset upload uses owner generation prefix, remains fenced, and cleanup preserves shared foreign references',async()=>{
 const f=fixture();try{let began!:()=>void,release!:()=>void;const started=new Promise<void>(r=>began=r),wait=new Promise<void>(r=>release=r),put=f.ASSETS.put;
 f.ASSETS.put=async(key,value)=>{if(key.startsWith('content/')){assert.match(key,new RegExp(`^content/${owner}/g1/`));began();await wait;}return put(key,value);};
 const upload=f.call('/content-assets','POST',{name:'file.pdf',mime:'application/pdf',data:Buffer.from('%PDF-1.7\n%%EOF').toString('base64')});await started;await f.prepare();await f.start();release();assert.equal((await upload).status,409);for(let n=0;n<4;n++)await cleanupAccounts(f.env);assert.equal(f.sqlite.prepare('SELECT complete FROM account_deletions').get()!.complete,1);
 // A later R2 object under a closed owner prefix is rediscovered; other-owner references stop deletion.
 const key=`accounts/${owner}/shared`;f.sqlite.prepare('INSERT INTO cloud_designs VALUES(?,?,?,?,?,?,?,?)').run(id(90),other,'Foreign',0,now,now,key,1);f.objects.set(key,new Uint8Array([9]));
 for(let n=0;n<3;n++)await cleanupAccounts(f.env);assert.ok(f.objects.has(key));assert.equal(f.sqlite.prepare('SELECT complete FROM account_deletions').get()!.complete,0);
 assert.equal((await f.call(`/cloud/designs/${id(90)}`,'GET',undefined,owner)).status,401);
 }finally{f.sqlite.close();}
});
test('failed independent ledger write retains all D1 content and retries before deletion; bearer protects receipt and intent routes',async()=>{
 const f=fixture();try{seed(f,1);await f.prepare();await f.start();const put=f.ASSETS.put;f.ASSETS.put=async()=>{throw new Error('ledger unavailable');};await cleanupAccounts(f.env);assert.equal(f.sqlite.prepare('SELECT count(*) n FROM cloud_designs').get()!.n,1);assert.equal(f.sqlite.prepare('SELECT ledger_ready FROM account_deletions').get()!.ledger_ready,0);f.ASSETS.put=put;for(let n=0;n<3;n++)await cleanupAccounts(f.env);assert.equal(f.sqlite.prepare('SELECT complete FROM account_deletions').get()!.complete,1);
 for(const path of ['intent','start','status'])assert.equal((await f.call('/account/deletion/'+path,'GET',undefined,owner,1,{Authorization:'Bearer forged'})).status,401);
 }finally{f.sqlite.close();}
});
test('receipt cannot read content or approve an unstarted deletion; session revocation invalidates an outstanding intent',async()=>{
 const f=fixture();try{await f.prepare();const receipt=`qr-deletion-status=${await signAccountToken({owner,version:1,intent},'deletion-status',c)}`;
 assert.equal(await getAccount(browser(receipt,'GET'),c,f.deps),null);assert.equal((await closeAccount(browser(receipt),c,f.deps)).status,401);
 assert.equal((await f.call('/account/revoke','POST',{version:1})).status,200);assert.equal((await f.start()).status,409);assert.equal(f.sqlite.prepare('SELECT consumed FROM account_deletion_intents').get()!.consumed,0);
 assert.equal((await closeAccount(browser(await cookies()),c,f.deps)).status,401);
 }finally{f.sqlite.close();}
});
test('deletion retries loss of R2 deletion acknowledgement without losing its durable manifest',async()=>{
 const f=fixture();try{seed(f,1);await f.prepare();await f.start();const remove=f.ASSETS.delete;let fail=true;f.ASSETS.delete=async key=>{await remove(key);if(fail){fail=false;throw new Error('delete response lost');}};
 await cleanupAccounts(f.env);assert.ok(Number(f.sqlite.prepare('SELECT count(*) n FROM account_deletion_objects').get()!.n)>0);assert.equal(f.sqlite.prepare('SELECT complete FROM account_deletions').get()!.complete,0);
 for(let n=0;n<4;n++)await cleanupAccounts(f.env);assert.equal(f.sqlite.prepare('SELECT complete FROM account_deletions').get()!.complete,1);assert.ok(f.deleted.length>new Set(f.deleted).size);
 }finally{f.sqlite.close();}
});
test('application proxies propagate current session versions and reject old versions through the real dispatcher',async()=>{
 const f=fixture(),original=globalThis.fetch;try{const seen:string[]=[];globalThis.fetch=async(input,init)=>{seen.push(new Headers(init?.headers).get('x-qr-session-version')||'');return f.deps.fetch(input,init);};const cookie=await cookies();
 assert.equal((await cloudProxy(browser(cookie,'GET'),undefined,c,{accountDeps:f.deps})).status,200);
 assert.equal((await assetProxy(browser(cookie,'GET'),undefined,c,{accountDeps:f.deps})).status,200);assert.deepEqual(seen,['1','1']);
 await f.call('/account/revoke','POST',{version:1});assert.equal((await f.call('/cloud/designs')).status,401);assert.equal((await f.call('/content-assets')).status,401);
 }finally{globalThis.fetch=original;f.sqlite.close();}
});
test('pre-customer reservation excludes closure before external create; exact binding clears it and closed identities cannot reserve',async()=>{
 const f=fixture();try{await f.prepare();const token='d'.repeat(32);
 const reserved=await f.call('/billing/customer-start','POST',{mode:'test',token});assert.equal(reserved.status,200);assert.equal((await f.start()).status,409);
 await assert.rejects(()=>checkClosureBilling(owner,1,bc,f.deps),/setup is still pending/);
 assert.equal((await f.call('/billing/customer-start','POST',{mode:'live',token:'e'.repeat(32)})).status,409);
 await f.call('/billing/customer-abort','POST',{token:'e'.repeat(32)});assert.equal((await f.start()).status,409);
 assert.equal((await f.call('/billing/customer','PUT',{customerId:'cus_owned',mode:'test'})).status,200);assert.equal(f.sqlite.prepare('SELECT count(*) n FROM billing_customer_creations').get()!.n,0);
 assert.equal((await f.start({customerId:'cus_owned',mode:'test',revision:0})).status,202);
 assert.equal((await f.call('/billing/customer-start','POST',{mode:'test',token})).status,409);
 assert.throws(()=>f.sqlite.prepare('INSERT INTO billing_customer_creations VALUES(?,?,?,?)').run(owner,'test',token,1),/account closed/);
 }finally{f.sqlite.close();}
});

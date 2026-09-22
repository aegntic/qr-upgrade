import {migrate} from './fixtures/migrations';
import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {createHmac} from 'node:crypto';
import worker from '../workers/qr-service/worker.mjs';
import {accountExport} from '../src/lib/server/account-export';
import {signAccountToken,type AccountConfig,type AccountDeps} from '../src/lib/server/account';
import {EXPORT_SECTIONS,EXPORT_PAGE_ROWS,EXPORT_PAGE_BYTES,EXPORT_FILE_LIMITS} from '../workers/qr-service/account-export.mjs';
import {newDesign} from '../src/lib/new-design';

const config:AccountConfig={clientId:'fixture',clientSecret:'fixture',secret:'s'.repeat(64),serviceUrl:'https://service.example',development:true};
const owner='a'.repeat(64),other='b'.repeat(64),date='2026-09-01T00:00:00.000Z';
const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const draft={kind:'form',title:'Owned form',description:'',accent:'#abcdef',items:[],fileId:'',formMessage:'Thank you'};
const snapshot=()=>({name:'Fixture',draft:newDesign('https://qrupgrade.com/','Fixture'),artifact:{png:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg=='}});
type Stored={bytes:Uint8Array;size?:number;failure?:boolean};
function fixture(){
 const sqlite=new DatabaseSync(':memory:');
 migrate(sqlite);
 const queries:string[]=[],objects=new Map<string,Stored>(),reads:string[]=[];
 const wrap=(sql:string,params:any[]=[])=>({bind:(...values:any[])=>wrap(sql,values),first:async()=>{queries.push(sql);return sqlite.prepare(sql).get(...params)||null;},all:async()=>{queries.push(sql);return {results:sqlite.prepare(sql).all(...params)};},run:async()=>sqlite.prepare(sql).run(...params),sql,params});
 const DB={prepare:wrap,async batch(statements:ReturnType<typeof wrap>[]){sqlite.exec('BEGIN');try{const results=statements.map(s=>({results:sqlite.prepare(s.sql).all(...s.params)}));sqlite.exec('COMMIT');return results;}catch(error){sqlite.exec('ROLLBACK');throw error;}}};
 const env={DB,SERVICE_SECRET:config.secret,ASSETS:{async get(key:string){reads.push(key);const stored=objects.get(key);if(!stored)return null;if(stored.failure)throw new Error('private bucket error');return {size:stored.size??stored.bytes.byteLength,body:new Response(new Uint8Array(stored.bytes)).body};}}};
 const paths:string[]=[],deps:AccountDeps={fetch:async(input,init)=>{paths.push(new URL(String(input)).pathname);return worker.fetch(new Request(String(input),init),env,{waitUntil(){}});}};
 sqlite.prepare('INSERT INTO account_security(owner,session_version) VALUES(?,1)').run(owner);sqlite.prepare('INSERT INTO account_security(owner,session_version) VALUES(?,1)').run(other);
 function design(n:number,user=owner,ready=1){sqlite.prepare('INSERT INTO cloud_designs VALUES(?,?,?,?,?,?,?,?)').run(id(n),user,user===owner?'Owned design':'FOREIGN_PRIVATE',n%2,date,date,`private/${user}/${n}`,ready);}
 function asset(n:number,user=owner,ready=1){sqlite.prepare('INSERT INTO content_assets VALUES(?,?,?,?,?,?,?,?)').run(id(n),user,user===owner?'../../unsafe.html':'FOREIGN_PRIVATE','image/png',1,`private/${user}/${n}`,ready,date);}
 function page(n:number,user=owner){sqlite.prepare('INSERT INTO content_pages VALUES(?,?,?,?,?,?,?,?,?)').run(id(n),user,String(n).padStart(16,'0'),JSON.stringify(draft),JSON.stringify({...draft,title:'Published version'}),'published',1,date,date);}
 function link(n:number,user=owner){sqlite.prepare('INSERT INTO dynamic_links VALUES(?,?,?,?,?,?,?,?,?)').run(id(n),user,String(n).padStart(16,'0'),'Owned link','https://qrupgrade.com/','paused',1,date,date);}
 return {sqlite,objects,reads,queries,DB,env,deps,paths,design,asset,page,link};
}
async function token(user=owner,sv:unknown=1){return signAccountToken({sub:user,name:'Verified name',email:'verified@example.com',...(sv===undefined?{}:{sv})},'session',config);}
async function browser(body:unknown={section:'profile'},options:{user?:string;sv?:unknown;headers?:Record<string,string>;method?:string;url?:string;raw?:string}={}){
 const method=options.method??'POST';return new Request(options.url??'http://localhost:3040/api/account/export',{method,headers:{cookie:`qr-session=${await token(options.user,options.sv??1)}`,origin:'http://localhost:3040','Content-Type':'application/json',...options.headers},body:method==='GET'?undefined:options.raw??JSON.stringify(body)});
}
async function pageRequest(f:ReturnType<typeof fixture>,section:string,cursor:string|null=null,user=owner){return accountExport(await browser({section,cursor},{user}),undefined,config,f.deps);}
async function fileRequest(f:ReturnType<typeof fixture>,kind:'design'|'asset',n:number,options:Parameters<typeof browser>[1]={}){return accountExport(await browser(undefined,{...options,method:'GET',url:`http://localhost:3040/api/account/export/files/${kind}/${id(n)}`}),{kind,id:id(n)},config,f.deps);}
async function traverse(f:ReturnType<typeof fixture>,section:string){
 const records:any[]=[];let cursor:string|null=null,parts=0;
 do{const response=await pageRequest(f,section,cursor);assert.equal(response.status,200,await response.clone().text());const text=await response.text();assert.ok(new TextEncoder().encode(text).byteLength<=EXPORT_PAGE_BYTES);const data=JSON.parse(text);assert.equal(data.counts.records,data.records.length);assert.ok(data.records.length<=EXPORT_PAGE_ROWS);assert.equal(data.complete,data.nextCursor===null);assert.ok(!Number.isNaN(Date.parse(data.generatedAt)));assert.match(data.consistency,/not a transactional snapshot/);records.push(...data.records);cursor=data.nextCursor;assert.ok(++parts<50,'bounded traversal');}while(cursor);
 return {records,parts};
}

test('production proxy/dispatcher exports fixed sections across owners, archived/pending data, >100 feedback and tied scan keys',async()=>{
 const f=fixture();try{
  for(let n=1;n<=63;n++){f.design(n,owner,n%3===0?0:1);f.asset(n,owner,n%3===0?0:1);f.page(n);f.link(n);}
  f.design(900,other);f.asset(900,other);f.page(900,other);f.link(900,other);
  for(let n=1;n<=137;n++)f.sqlite.prepare('INSERT INTO content_submissions VALUES(?,?,?,?,?,?,?)').run(id(n),id(1),'Sender','sender@example.com',`Message ${n}`,date,'quota-secret');
  f.sqlite.prepare('INSERT INTO content_submissions VALUES(?,?,?,?,?,?,?)').run(id(900),id(900),'FOREIGN_PRIVATE','foreign@example.com','FOREIGN_PRIVATE',date,'foreign-network');
  for(let link=1;link<=2;link++)for(let day=1;day<=31;day++)f.sqlite.prepare('INSERT INTO link_daily_counts VALUES(?,?,?)').run(String(link).padStart(16,'0'),`2026-08-${String(day).padStart(2,'0')}`,day);
  f.sqlite.prepare('INSERT INTO link_daily_counts VALUES(?,?,?)').run('0000000000000900','2026-08-01',900);
  for(const user of [owner,other]){
   const customer=user===owner?'cus_owned':'cus_FOREIGN_PRIVATE';f.sqlite.prepare('INSERT INTO billing_customers(owner,customer_id,mode,reservation,tier,reserved_at,session_id,lease_until) VALUES(?,?,?,?,?,?,?,?)').run(user,customer,'test','reservation-secret','brand',100,'checkout-secret',200);
   for(let n=1;n<=61;n++)f.sqlite.prepare('INSERT INTO billing_events VALUES(?,?,?,?,?,?)').run(`evt_${user===owner?'owned':'foreign'}_${String(n).padStart(4,'0')}`,'checkout.session.completed',100,customer,'sub_fixture','test');
  }
  for(let n=1;n<=61;n++)f.sqlite.prepare('INSERT INTO account_security_events VALUES(?,?,?,?)').run(id(n),owner,'sign_in',Date.now()-10000);
  f.sqlite.prepare('INSERT INTO account_security_events VALUES(?,?,?,?)').run(id(900),other,'sign_in',Date.now());
  f.sqlite.prepare('INSERT INTO account_security_events VALUES(?,?,?,?)').run(id(901),owner,'sign_in',0);
  const expected:Record<string,number>={profile:1,designs:63,links:63,scans:62,pages:63,assets:63,feedback:137,billing_customer:1,billing_events:61};
  for(const section of EXPORT_SECTIONS){
   const result=await traverse(f,section),text=JSON.stringify(result.records);
   if(section!=='security')assert.equal(result.records.length,expected[section],section);
   assert.doesNotMatch(text,/FOREIGN_PRIVATE|quota-secret|foreign-network|reservation-secret|checkout-secret|r2key|private\/|session_version|network/);
   if(section==='profile')assert.deepEqual(result.records,[{name:'Verified name',email:'verified@example.com'}]);
   if(section==='designs'||section==='assets'){
    assert.ok(result.parts>1);assert.ok(result.records.some(row=>row.ready===0&&row.file.status==='unavailable_pending'&&row.file.download===null));
    assert.ok(result.records.some(row=>row.ready===1&&row.file.status==='ready_to_request'&&row.file.download.startsWith('/api/account/export/files/')));
   }
   if(section==='pages'){assert.equal(result.records[0].archived,1);assert.equal(result.records[0].published.title,'Published version');}
   if(section==='feedback')assert.equal(new Set(result.records.map(row=>row.id)).size,137);
   if(section==='scans')assert.equal(new Set(result.records.map(row=>row.slug+row.day)).size,62);
   if(section==='security'){assert.ok(result.records.length>0);assert.ok(result.records.every(row=>row.created_at>0));assert.ok(result.records.every(row=>!Object.hasOwn(row,'owner')));}
  }
  assert.ok(f.queries.filter(sql=>sql.includes('ORDER BY')).every(sql=>sql.includes('LIMIT ?')));
  assert.ok(f.paths.every(path=>path==='/account/session'||path==='/account/export')); // no billing or Stripe call, regardless of plan
  assert.equal(f.reads.length,0);
  assert.ok(Number(f.sqlite.prepare('SELECT count(*) n FROM account_security_events WHERE owner=?').get(owner)!.n)<=100);
 }finally{f.sqlite.close();}
});

test('empty sections complete truthfully; exact row boundary and byte boundary provide complete continuation',async()=>{
 const f=fixture();try{
  for(const section of EXPORT_SECTIONS.filter(s=>!['profile','security'].includes(s))){const data=await(await pageRequest(f,section)).json();assert.deepEqual(data.records,[]);assert.equal(data.complete,true);assert.equal(data.nextCursor,null);}
  for(let n=1;n<=25;n++)f.design(n);
  let data=await(await pageRequest(f,'designs')).json();assert.equal(data.records.length,25);assert.equal(data.complete,true);
  f.design(26);data=await(await pageRequest(f,'designs')).json();assert.equal(data.records.length,25);assert.equal(data.complete,false);
  const last=await(await pageRequest(f,'designs',data.nextCursor)).json();assert.equal(last.records.length,1);assert.equal(last.complete,true);
  // Historic unbounded feedback text can fill the byte budget before the fixed row budget.
  f.page(1);for(let n=1;n<=5;n++)f.sqlite.prepare('INSERT INTO content_submissions VALUES(?,?,?,?,?,?,?)').run(id(n),id(1),'Sender','','é'.repeat(150000),date,'fixture');
  const result=await traverse(f,'feedback');assert.equal(result.records.length,5);assert.equal(result.parts,2);assert.ok(result.records.every(row=>row.message.length===150000));
  f.sqlite.prepare('UPDATE content_submissions SET message=? WHERE id=?').run('x'.repeat(EXPORT_PAGE_BYTES+1),id(1));
  const before=f.sqlite.prepare("SELECT count(*) n FROM account_security_events WHERE type='data_export'").get()!.n;
  const oversized=await pageRequest(f,'feedback');assert.equal(oversized.status,413);assert.match((await oversized.json()).error,/not completed/);
  assert.equal(f.sqlite.prepare("SELECT count(*) n FROM account_security_events WHERE type='data_export'").get()!.n,before);
 }finally{f.sqlite.close();}
});

test('security keyset traverses all initial retained events with tied timestamps while export events apply retention',async()=>{
 const f=fixture();try{
  const now=Date.now()-10000;
  for(let n=1;n<=100;n++)f.sqlite.prepare('INSERT INTO account_security_events VALUES(?,?,?,?)').run(id(n),owner,'sign_in',now);
  const result=await traverse(f,'security');
  const initial=result.records.filter(row=>row.type==='sign_in');assert.equal(initial.length,100);assert.equal(new Set(initial.map(row=>row.id)).size,100);
  assert.ok(result.parts>=4);assert.equal(f.sqlite.prepare('SELECT count(*) n FROM account_security_events WHERE owner=?').get(owner)!.n,100);
 }finally{f.sqlite.close();}
});

test('section-specific signed cursors reject edits, cross-owner/section reuse and schema/CSRF/header injection',async()=>{
 const f=fixture();try{
  for(let n=1;n<=26;n++)f.design(n);
  const data=await(await pageRequest(f,'designs')).json(),cursor=data.nextCursor as string;
  assert.equal((await pageRequest(f,'assets',cursor)).status,400);
  assert.equal((await pageRequest(f,'designs',cursor,other)).status,400);
  assert.equal((await pageRequest(f,'designs',cursor.slice(0,3)+'a'+cursor.slice(4))).status,400);
  for(const section of EXPORT_SECTIONS){
   for(const body of [{section,cursor:{id:id(1)}},{section,cursor:'invalid'},{section,owner:other},{section,version:2},{section,key:'private/key'},{section,limit:99999},{section,offset:25},{section,extra:true}])assert.equal((await accountExport(await browser(body),undefined,config,f.deps)).status,400);
  }
  for(const body of [{section:'unknown'},[],{},null,{section:'profile',cursor}, {section:'profile',extra:'x'.repeat(1024)}])assert.equal((await accountExport(await browser(body),undefined,config,f.deps)).status,400);
  for(const origin of ['https://evil.example','null','http://localhost:3041',''])assert.equal((await accountExport(await browser({section:'profile'},{headers:{origin}}),undefined,config,f.deps)).status,403);
  assert.equal((await accountExport(await browser({section:'profile'},{headers:{'sec-fetch-site':'cross-site'}}),undefined,config,f.deps)).status,403);
  for(const name of ['x-qr-user','x-qr-session-version','x-qr-owner','x-qr-plan','x-qr-key'])assert.equal((await accountExport(await browser({section:'profile'},{headers:{[name]:other}}),undefined,config,f.deps)).status,400);
  assert.equal((await accountExport(await browser({section:'profile'},{url:'http://localhost:3040/api/account/export?owner=forged'}),undefined,config,f.deps)).status,400);
  assert.equal((await accountExport(await browser(undefined,{method:'GET'}),undefined,config,f.deps)).status,405);
  assert.equal((await accountExport(await browser(undefined,{raw:'{broken'}),undefined,config,f.deps)).status,400);
 }finally{f.sqlite.close();}
});

test('cursor payloads are fixed per section even when correctly authenticated; all direct Worker injections fail',async()=>{
 const f=fixture();try{
  const signed=(value:unknown)=>{const payload=Buffer.from(JSON.stringify(value)).toString('base64url');return `${payload}.${createHmac('sha256',config.secret!).update(`account-export:v1:${owner}:${payload}`).digest('base64url')}`;};
  for(const section of EXPORT_SECTIONS.filter(value=>value!=='profile')){
   for(const payload of [{section,keys:[]},{section,keys:[{}]},{section,keys:['../secret']},{section,keys:[id(1)],owner},{section,keys:[id(1)],offset:1},{section:'profile',keys:[id(1)]}])assert.equal((await pageRequest(f,section,signed(payload))).status,400,section);
  }
  for(const keys of [['0000000000000001','2026-02-30'],['0000000000000001','9999-99-99'],['bad','2026-01-01']])assert.equal((await pageRequest(f,'scans',signed({section:'scans',keys}))).status,400);
  const call=(path:string,body:unknown={section:'profile'},extra:Record<string,string>={})=>worker.fetch(new Request(config.serviceUrl+path,{method:'POST',headers:{Authorization:`Bearer ${config.secret}`,'x-qr-user':owner,'x-qr-session-version':'1','Content-Type':'application/json',...extra},body:JSON.stringify(body)}),f.env,{});
  for(const body of [{section:'profile',owner:other},{section:'profile',version:2},{section:'profile',r2key:'private'},{section:'profile',cursor:null,unknown:true}])assert.equal((await call('/account/export',body)).status,400);
  assert.equal((await call('/account/export?key=private')).status,400);
  assert.equal((await call('/account/export',{section:'profile'},{'x-qr-user':'invalid'})).status,400);
  // A stale/unknown plan cannot take away access to owner data; no billing lookup is involved.
  assert.equal((await call('/account/export',{section:'profile'},{'x-qr-plan':'unavailable-downgraded'})).status,200);
  const absent='c'.repeat(64),missing=await call('/account/export',{section:'profile'},{'x-qr-user':absent});assert.equal(missing.status,409);assert.deepEqual(await missing.json(),{code:'account_session_invalid',owner:absent});
 }finally{f.sqlite.close();}
});

test('original files resolve keys from owned rows, safely attach validated design JSON and inert asset bytes',async()=>{
 const f=fixture();try{
  f.design(1);f.asset(2);f.design(3,owner,0);f.asset(4,owner,0);f.design(900,other);f.asset(900,other);
  const value=snapshot();f.objects.set(`private/${owner}/1`,{bytes:new TextEncoder().encode(JSON.stringify(value))});
  const upload=new TextEncoder().encode('<html><script>private upload</script></html>');f.objects.set(`private/${owner}/2`,{bytes:upload});
  const design=await fileRequest(f,'design',1);assert.equal(design.status,200);assert.deepEqual(await design.json(),value);
  const asset=await fileRequest(f,'asset',2);assert.equal(asset.status,200);assert.equal(await asset.text(),new TextDecoder().decode(upload));
  for(const response of [design,asset]){assert.match(response.headers.get('cache-control')!,/private, no-store/);assert.equal(response.headers.get('x-content-type-options'),'nosniff');assert.match(response.headers.get('content-disposition')!,/^attachment; filename="qrupgrade-(design|asset)-[a-f0-9-]+\.(json|bin)"$/);assert.match(response.headers.get('content-security-policy')!,/sandbox/);assert.equal(response.headers.get('set-cookie'),null);}
  assert.equal(asset.headers.get('content-type'),'application/octet-stream');assert.equal(design.headers.get('content-type'),'application/json');
  for(const [kind,n,status] of [['design',3,409],['asset',4,409],['design',900,404],['asset',900,404],['asset',888,404]] as const)assert.equal((await fileRequest(f,kind,n)).status,status);
  assert.deepEqual(f.reads,[`private/${owner}/1`,`private/${owner}/2`]);
  assert.equal((await fileRequest(f,'asset',2,{headers:{'sec-fetch-site':'cross-site'}})).status,403);
  assert.equal((await fileRequest(f,'asset',2,{headers:{'x-qr-user':other}})).status,400);
  for(const bad of ['../secret','not-a-uuid',id(1)+'/private'])assert.equal((await accountExport(await browser(undefined,{method:'GET'}),{kind:'design',id:bad},config,f.deps)).status,400);
  const forged=await accountExport(await browser(undefined,{method:'GET'}),{kind:'arbitrary' as 'asset',id:id(1)},config,f.deps);assert.equal(forged.status,400);
  assert.ok(f.paths.every(path=>path.startsWith('/account/')));
 }finally{f.sqlite.close();}
});

test('missing, oversized, incomplete and malformed objects fail explicitly using actual bytes, independent of stored metadata',async()=>{
 const f=fixture();try{
  f.design(1);f.asset(2);
  assert.equal((await fileRequest(f,'design',1)).status,404);
  for(const stored of [
   {bytes:new Uint8Array(1),size:EXPORT_FILE_LIMITS.asset+1},
   {bytes:new Uint8Array(EXPORT_FILE_LIMITS.asset+1),size:1},
   {bytes:new Uint8Array(3),size:1},
   {bytes:new Uint8Array(0),size:0}
  ]){f.objects.set(`private/${owner}/2`,stored);const result=await fileRequest(f,'asset',2);assert.ok([413,422].includes(result.status));assert.doesNotMatch(await result.text(),/private\//);assert.equal(result.headers.get('content-disposition'),null);}
  for(const malformed of ['{bad','null','{"serviceSecret":"sensitive"}',JSON.stringify({...snapshot(),serviceSecret:'sensitive'})]){
   f.objects.set(`private/${owner}/1`,{bytes:new TextEncoder().encode(malformed)});const result=await fileRequest(f,'design',1);assert.equal(result.status,422);assert.doesNotMatch(await result.text(),/sensitive/);
  }
  f.objects.set(`private/${owner}/1`,{bytes:new Uint8Array(EXPORT_FILE_LIMITS.design+1),size:1});assert.equal((await fileRequest(f,'design',1)).status,422);
  f.objects.set(`private/${owner}/2`,{bytes:new Uint8Array(EXPORT_FILE_LIMITS.asset)});const max=await fileRequest(f,'asset',2);assert.equal(max.status,200);assert.equal((await max.arrayBuffer()).byteLength,EXPORT_FILE_LIMITS.asset);
 }finally{f.sqlite.close();}
});

test('revoked, missing and legacy sessions fail closed; Worker checks service bearer and central version itself',async()=>{
 const f=fixture();try{
  f.asset(1);f.objects.set(`private/${owner}/1`,{bytes:new Uint8Array([1])});
  for(const path of ['/account/export','/account/export/files/asset/'+id(1)]){
   const post=path.endsWith('/export');
   const request=(headers:Record<string,string>)=>new Request(config.serviceUrl+path,{method:post?'POST':'GET',headers:{'Content-Type':'application/json','x-qr-user':owner,'x-qr-session-version':'1',...headers},body:post?JSON.stringify({section:'profile'}):undefined});
   assert.equal((await worker.fetch(request({Authorization:'Bearer forged'}),f.env,{})).status,401);
   for(const version of ['0','01','1.0','1e0','-1','abc','9007199254740992'])assert.equal((await worker.fetch(request({Authorization:`Bearer ${config.secret}`,'x-qr-session-version':version}),f.env,{})).status,400);
   const stale=await worker.fetch(request({Authorization:`Bearer ${config.secret}`,'x-qr-session-version':'2'}),f.env,{});assert.equal(stale.status,409);assert.deepEqual(await stale.json(),{code:'account_session_invalid',owner});
  }
  const legacy=await signAccountToken({sub:owner,name:'Name',email:'legacy@example.com'},'session',config);
  assert.equal((await accountExport(await browser({section:'profile'},{headers:{cookie:`qr-session=${legacy}`}}),undefined,config,f.deps)).status,401);
  f.sqlite.prepare('UPDATE account_security SET session_version=2 WHERE owner=?').run(owner);
  assert.equal((await pageRequest(f,'profile')).status,401);assert.equal((await fileRequest(f,'asset',1)).status,401);
  const raced={fetch:async(input:RequestInfo|URL,init?:RequestInit)=>{
   const response=await f.deps.fetch!(input,init);if(String(input).endsWith('/session'))f.sqlite.prepare('UPDATE account_security SET session_version=3 WHERE owner=?').run(owner);return response;
  }};
  assert.equal((await accountExport(await browser({section:'profile'},{sv:2}),undefined,config,raced)).status,401);
  assert.equal(f.reads.length,0);
 }finally{f.sqlite.close();}
});

test('D1, R2, bearer and response failures preserve cookies, keep error details private and never claim logout',async()=>{
 const f=fixture();try{
  f.asset(1);f.objects.set(`private/${owner}/1`,{bytes:new Uint8Array(1),failure:true});
  const check=async(response:Response)=>{assert.equal(response.status,503);assert.equal(response.headers.get('set-cookie'),null);const text=await response.text();assert.match(text,/temporarily unavailable/);assert.doesNotMatch(text,/private bucket|private database|signedIn|signed out/);};
  await check(await fileRequest(f,'asset',1));
  const failures:AccountDeps[]=[{fetch:async()=>{throw new Error('private database');}},...['t'.repeat(64),undefined].map(secret=>({fetch:async(input:RequestInfo|URL,init?:RequestInit)=>worker.fetch(new Request(String(input),init),{...f.env,SERVICE_SECRET:secret},{})}))];
  for(const deps of failures)await check(await accountExport(await browser(),undefined,config,deps));
  for(const [status,body] of [[401,{}],[409,{code:'account_session_invalid',owner:other}],[409,{code:'account_session_invalid',owner,extra:true}],[409,{error:'broken'}],[503,{error:'private database'}]] as const){
   const deps={fetch:async(input:RequestInfo|URL,init?:RequestInit)=>String(input).endsWith('/session')?f.deps.fetch!(input,init):Response.json(body,{status})};
   await check(await accountExport(await browser(),undefined,config,deps));
  }
  const huge={fetch:async(input:RequestInfo|URL,init?:RequestInit)=>String(input).endsWith('/session')?f.deps.fetch!(input,init):new Response('x'.repeat(EXPORT_PAGE_BYTES+1),{headers:{'Content-Length':'1'}})};
  await check(await accountExport(await browser(),undefined,config,huge));
  const hugeFile={fetch:async(input:RequestInfo|URL,init?:RequestInit)=>String(input).endsWith('/session')?f.deps.fetch!(input,init):new Response('x'.repeat(EXPORT_FILE_LIMITS.asset+1),{headers:{'Content-Length':'1'}})};
  await check(await accountExport(await browser(undefined,{method:'GET'}),{kind:'asset',id:id(1)},config,hugeFile));
  for(const body of [{code:'account_session_invalid',owner:other},{code:'account_session_invalid',owner,extra:true},{error:'Unexpected denial'}]){
   const malformed={fetch:async(input:RequestInfo|URL,init?:RequestInit)=>String(input).endsWith('/session')?f.deps.fetch!(input,init):Response.json(body,{status:409})};
   await check(await accountExport(await browser(undefined,{method:'GET'}),{kind:'asset',id:id(1)},config,malformed));
  }
  f.sqlite.exec("CREATE TRIGGER fail_export_event BEFORE INSERT ON account_security_events BEGIN SELECT RAISE(ABORT,'private database'); END");
  await check(await pageRequest(f,'profile'));
  assert.equal(f.sqlite.prepare('SELECT count(*) n FROM account_security_events').get()!.n,0);
 }finally{f.sqlite.close();}
});

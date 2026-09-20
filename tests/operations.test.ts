import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { sanitize, persistTail, advance, transition, retention, sendOne, probe, createOperations, PUBLIC_MARKER, type State, type Env, type Database } from '../workers/operations/worker';
import serviceWorker from '../workers/qr-service/worker.mjs';
import { contentSecurityPolicy } from '../src/lib/security/headers';
const migration = readFileSync(new URL('../workers/operations/migrations/0001_operations.sql',import.meta.url),'utf8');
function fixture() {
 const sqlite = new DatabaseSync(':memory:'); sqlite.exec('PRAGMA foreign_keys=ON'); sqlite.exec(migration);
 let batches=0, fail=false, afterStatement=-1;
 const wrap=(sql:string,values:(string|number|null)[]=[])=>({
  sql,values,bind:(...next:(string|number|null)[])=>wrap(sql,next),
  async first<T>():Promise<T|null>{if(fail)throw Error('private sink canary');return sqlite.prepare(sql).get(...values) as T ?? null;},
  async all<T>(){if(fail)throw Error('private sink canary');return {results:sqlite.prepare(sql).all(...values) as T[]};},
  async run(){if(fail)throw Error('private sink canary');return sqlite.prepare(sql).run(...values);},
 });
 const db={prepare:wrap,async batch(statements:ReturnType<typeof wrap>[]){
  batches++;if(fail)throw Error('private sink canary');sqlite.exec('BEGIN');
  try{const results=statements.map((s,i)=>{const results=sqlite.prepare(s.sql).all(...s.values);if(i===afterStatement)throw Error('rollback');return {results};});sqlite.exec('COMMIT');return results;}
  catch(error){sqlite.exec('ROLLBACK');throw error;}
 }};
 const messages:unknown[]=[];
 const env:Env={OPERATIONS_DB:db as Database,QR_SERVICE:{async fetch(){return Response.json({ready:true});}},SERVICE_SECRET:'synthetic-service-secret-'.repeat(3),ALERTS_ENABLED:'false',INCIDENT_EMAIL:{async send(message){messages.push(message);return {messageId:'synthetic-ack'};}}};
 const state=(component='web_probe')=>sqlite.prepare('SELECT * FROM monitor_state WHERE component=?').get(component) as unknown as State;
 const notify=()=>sqlite.prepare('SELECT * FROM notifications ORDER BY component,incident_seq,kind').all();
 return {sqlite,db:db as Database,env,messages,state,notify,get batches(){return batches;},fail(){fail=true;},rollbackAfter(i:number){afterStatement=i;}};
}
const trace=(status=500,outcome:unknown='ok',url:unknown='https://qrupgrade.com/api/art?private=canary',scriptName='qr-upgrade-web')=>({scriptName,outcome,event:{request:{url},response:{status}}});
const headers={'content-security-policy':contentSecurityPolicy('a'.repeat(24),true),'cache-control':'private, no-store'};
const goodWeb=()=>new Response(PUBLIC_MARKER+' />',{headers});
async function tick(f:ReturnType<typeof fixture>,bucket:number,failed:boolean,component='web_probe',errors=0,healthy=!failed){const old=f.state(component);await transition(f.db,old,advance(old,bucket,bucket+1,failed?'probe_http':'none',errors,healthy));}
async function open(f:ReturnType<typeof fixture>){await tick(f,300,true);await tick(f,600,true);}

test('tail allowlist never reads ignored fields; actual SQLite dump contains only sparse literals',async()=>{
 const f=fixture(),canary='SECRET_USER_QUERY_IP_COOKIE_BODY_ERROR_CANARY';let ignoredReads=0;
 const item=trace();item.event.request.url=`https://qrupgrade.com/private/${canary}?q=${canary}`;
 const poison=(target:object,key:string)=>Object.defineProperty(target,key,{get(){ignoredReads++;throw Error(canary);}});
 for(const key of ['logs','exceptions','diagnosticsChannelEvents','getUnredacted','eventTimestamp','cf'])poison(item,key);
 for(const key of ['headers','cf','body','ip','getUnredacted'])poison(item.event.request,key);
 for(const key of ['headers','body'])poison(item.event.response,key);
 await persistTail(f.db,sanitize([item,trace(200),trace(302),trace(400),trace(429),trace(0,'canceled'),trace(0,'streamDisconnected')],600));
 assert.equal(ignoredReads,0);assert.equal(f.batches,1);
 const rows=f.sqlite.prepare('SELECT * FROM error_rollups').all();assert.equal(rows.length,1);assert.equal(rows[0].route_class,'other');
 const dump=JSON.stringify([...rows,...f.sqlite.prepare('SELECT * FROM monitor_state').all(),...f.notify()]);assert.ok(!dump.includes(canary));
 assert.deepEqual(Object.keys(rows[0]),['bucket_start','producer','route_class','status_class','outcome_class','occurrences']);f.sqlite.close();
});
test('tail handles malformed input, fatal outcomes, fixed routes, item cap and saturated counters',async()=>{
 const f=fixture();assert.deepEqual(sanitize({},600),[]);assert.deepEqual(sanitize([null,{},trace(500,'ok','https://x','unknown')],600),[]);
 assert.deepEqual(sanitize([trace(200,'unknown'),trace(500.1),trace(600),trace(200,'canceled')],600),[]);
 for(const [name,outcome] of [['exception','exception'],['exceededCpu','cpu'],['exceededMemory','memory'],['scriptNotFound','script']])assert.equal(sanitize([trace(0,name)],600)[0].outcome,outcome);
 assert.equal(sanitize([trace(500,'canceled')],600)[0].outcome,'other');
 for(const [url,route] of [['/','html'],['/api/billing/webhook','billing_webhook'],['/api/art','api'],['/robots.txt','static'],['/r/secret','other'],['/api/art/secret','other'],['/api/%61rt','other']])assert.equal(sanitize([trace(500,'ok','https://qrupgrade.com'+url)],600)[0].route,route);
 assert.equal(sanitize([trace(500,'ok','https://service/health','qr-upgrade-service')],600)[0].route,'health');
 assert.equal(sanitize([trace(500,'ok','https://service/art','qr-upgrade-service')],600)[0].route,'private_api');
 assert.equal(sanitize([{scriptName:'qr-upgrade-service',outcome:'exception'}],600)[0].route,'scheduled');
 const rows=sanitize(Array.from({length:100},()=>trace()),600);assert.equal(rows[0].count,8);await persistTail(f.db,rows);
 f.sqlite.exec('UPDATE error_rollups SET occurrences=999999');await persistTail(f.db,rows);assert.equal(f.sqlite.prepare('SELECT occurrences n FROM error_rollups').get()!.n,1000000);
 await persistTail(f.db,[]);assert.equal(f.batches,2);f.fail();await persistTail(f.db,rows);assert.equal(f.batches,3);f.sqlite.close();
});
test('schema rejects forbidden labels/ranges, prevents deleting fixed monitor rows, transaction rolls back notification with state',async()=>{
 const f=fixture();for(const values of [[600,'customer','other','5xx','ok',1],[600,'web','health','5xx','ok',1],[600,'web','other','200','ok',1],[600,'web','other','none','ok',1],[601,'web','other','5xx','ok',1],[600,'web','other','5xx','secret',1],[600,'web','other','5xx','ok',1000001]])assert.throws(()=>f.sqlite.prepare('INSERT INTO error_rollups VALUES(?,?,?,?,?,?)').run(...values));
 assert.throws(()=>f.sqlite.exec('DELETE FROM monitor_state'));assert.equal(f.sqlite.prepare('SELECT COUNT(*) n FROM monitor_state').get()!.n,4);
 await tick(f,300,true);f.rollbackAfter(0);await assert.rejects(()=>tick(f,600,true));assert.equal(f.state().phase,'suspect');assert.equal(f.notify().length,0);f.sqlite.close();
});
test('concurrent CAS transitions create one logical incident/recovery; stale and missed runs cannot falsely recover',async()=>{
 const f=fixture();await tick(f,300,true);const old=f.state(),next=advance(old,600,601,'probe_timeout',0,false);
 await Promise.all([transition(f.db,old,next),transition(f.db,old,next)]);assert.equal(f.notify().length,1);assert.equal(f.state().incident_seq,1);
 await tick(f,900,false);assert.equal(f.state().phase,'recovering');await tick(f,600,false);assert.equal(f.state().phase,'recovering');
 await tick(f,1500,false);assert.equal(f.state().phase,'recovering');await tick(f,1800,false);assert.equal(f.state().phase,'healthy');assert.equal(f.notify().length,2);f.sqlite.close();
});
test('runtime opens at five or two consecutive errors and requires three clear chronological buckets plus healthy probe',async()=>{
 const f=fixture(),component='web_runtime';await tick(f,300,false,component,4,true);assert.equal(f.state(component).phase,'suspect');
 await tick(f,600,false,component,1,true);assert.equal(f.state(component).phase,'open');
 await tick(f,900,false,component,0,true);await tick(f,1200,false,component,0,false);await tick(f,1500,false,component,0,true);await tick(f,1800,false,component,0,true);assert.equal(f.state(component).phase,'recovering');
 await tick(f,2100,false,component,0,true);assert.equal(f.state(component).phase,'healthy');await tick(f,2400,false,component,5,true);assert.equal(f.state(component).incident_seq,2);assert.equal(f.notify().length,3);f.sqlite.close();
});
test('cleanup deletes at most 250 expired rows total and preserves pending notifications and four monitors',async()=>{
 const f=fixture();for(let n=0;n<240;n++)f.sqlite.prepare("INSERT INTO error_rollups VALUES(?,'web','other','5xx','ok',1)").run(n*300);
 for(let n=1;n<=30;n++)f.sqlite.prepare("INSERT INTO notifications VALUES('web_probe',?,'incident','accepted',1,0,0,NULL,1)").run(n);
 f.sqlite.exec("INSERT INTO notifications VALUES('service_probe',1,'incident','pending',0,0,0,NULL,NULL)");
 await retention(f.db,100*86400);assert.equal(f.sqlite.prepare('SELECT COUNT(*) n FROM error_rollups').get()!.n,0);assert.equal(f.notify().length,21);assert.equal(f.state().component,'web_probe');f.sqlite.close();
});
test('mail disabled by default; concurrent sends atomically lease one row and use only fixed message content',async()=>{
 const f=fixture();await open(f);await sendOne(f.env,700);assert.equal(f.messages.length,0);f.env.ALERTS_ENABLED='true';
 await Promise.all([sendOne(f.env,700),sendOne(f.env,700)]);assert.equal(f.messages.length,1);assert.equal(f.notify()[0].state,'accepted');
 const msg=f.messages[0] as {subject:string;text:string;from:string;to:string};assert.equal(msg.from,'monitor@alerts.qrupgrade.com');assert.equal(msg.to,'aegntic.dev@gmail.com');assert.match(msg.subject,/web_probe · 1$/);assert.ok(!JSON.stringify(msg).includes(f.env.SERVICE_SECRET));assert.ok(!JSON.stringify(f.notify()).includes('synthetic-ack'));f.sqlite.close();
});
test('unknown send acknowledgement has bounded backoff and abandonment, never a fourth delivery',async()=>{
 const f=fixture();await open(f);f.env.ALERTS_ENABLED='true';let sends=0;f.env.INCIDENT_EMAIL={async send(){sends++;throw Error('private provider payload');}};
 await sendOne(f.env,700);assert.equal(f.notify()[0].next_attempt_at,1000);await sendOne(f.env,999);assert.equal(sends,1);
 await sendOne(f.env,1000);assert.equal(f.notify()[0].next_attempt_at,1900);await sendOne(f.env,1900);await sendOne(f.env,10000);assert.equal(sends,3);assert.equal(f.notify()[0].state,'abandoned');assert.ok(!JSON.stringify(f.notify()).includes('payload'));f.sqlite.close();
});
test('lease expiry after lost acknowledgement and lost state update bounds possible duplicates to three',async()=>{
 const f=fixture();await open(f);f.env.ALERTS_ENABLED='true';
 f.sqlite.exec("UPDATE notifications SET state='leased',attempts=1,lease_until=760");await sendOne(f.env,759);assert.equal(f.messages.length,0);await sendOne(f.env,760);assert.equal(f.messages.length,1);assert.equal(f.notify()[0].attempts,2);
 f.sqlite.exec("UPDATE notifications SET state='leased',attempts=3,lease_until=900,terminal_at=NULL");await sendOne(f.env,900);assert.equal(f.messages.length,1);assert.equal(f.notify()[0].state,'abandoned');f.sqlite.close();
});
test('hanging email times out, recovery waits for incident, and sink failure prevents delivery',async()=>{
 const f=fixture();await open(f);await tick(f,900,false);await tick(f,1200,false);f.env.ALERTS_ENABLED='true';let sends=0;
 f.env.INCIDENT_EMAIL={send(){sends++;return new Promise(()=>{});}};await sendOne(f.env,1300,5);assert.equal(sends,1);await sendOne(f.env,1400,5);assert.equal(sends,1);
 f.fail();await assert.rejects(()=>sendOne(f.env,1600,5));assert.equal(sends,1);f.sqlite.close();
});
test('probes verify actual production CSP, marker, status, fixed service shape, byte bound and cancellation',async()=>{
 assert.equal(await probe(async init=>{assert.equal(init.redirect,'manual');assert.equal(init.cache,'no-store');return goodWeb();},true),'none');
 assert.equal(await probe(async()=>new Response('x',{status:302}),true),'probe_http');
 assert.equal(await probe(async()=>new Response(PUBLIC_MARKER,{headers:{...headers,'content-security-policy':contentSecurityPolicy('a'.repeat(24),false)}}),true),'probe_shape');
 assert.equal(await probe(async()=>Response.json({ready:true}),false),'none');assert.equal(await probe(async()=>Response.json({ready:true,model:'secret'}),false),'probe_shape');
 assert.equal(await probe(async()=>new Response('x'.repeat(16385),{headers}),true),'probe_shape');
 let cancelled=0;const stream=new ReadableStream<Uint8Array>({start(c){c.enqueue(new TextEncoder().encode(PUBLIC_MARKER));},cancel(){cancelled++;}});
 assert.equal(await probe(async()=>new Response(stream,{headers}),true),'none');assert.equal(cancelled,1);
 const hanging=new ReadableStream<Uint8Array>({cancel(){cancelled++;}});assert.equal(await probe(async()=>new Response(hanging,{headers}),true,5),'probe_timeout');assert.equal(cancelled,2);
 assert.equal(await probe(()=>new Promise(()=>{}),true,5),'probe_timeout');
});
test('scheduled probes run concurrently, fixed private transport; sink outage aborts without mail and bucket catch-up remains chronological',async()=>{
 const f=fixture();let webStarted=false,serviceStarted=false;
 const app=createOperations(undefined,async url=>{assert.equal(url,'https://qrupgrade.com/');webStarted=true;await new Promise(resolve=>setTimeout(resolve,1));assert.ok(serviceStarted);return goodWeb();});
 f.env.QR_SERVICE={async fetch(url,init){serviceStarted=true;assert.ok(webStarted);assert.equal(url,'https://qr-service.internal/health');assert.equal(new Headers(init.headers).get('authorization'),`Bearer ${f.env.SERVICE_SECRET}`);return Response.json({ready:true});}};
 await persistTail(f.db,sanitize([trace(),trace(),trace(),trace(),trace()],300));await app.scheduled({scheduledTime:600000},f.env);assert.equal(f.state('web_runtime').phase,'open');
 // Insert later errors; chronological catch-up must not clear then ignore intervening errors.
 await persistTail(f.db,sanitize([trace()],900));await app.scheduled({scheduledTime:1800000},f.env);assert.equal(f.state('web_runtime').phase,'recovering');assert.equal(f.state('web_runtime').last_bucket,1500);
 await app.scheduled({scheduledTime:2100000},f.env);assert.equal(f.state('web_runtime').phase,'healthy');
 f.env.ALERTS_ENABLED='true';f.fail();await app.scheduled({scheduledTime:2400000},f.env);assert.equal(f.messages.length,0);f.sqlite.close();
});
test('service health retains bearer boundary, actually executes only SELECT 1, and fails closed',async()=>{
 let queries=0;const forbidden=()=>{throw Error('customer/paid access forbidden');};
 const env={SERVICE_SECRET:'synthetic-'.repeat(8),DB:{prepare(sql:string){assert.equal(sql,'SELECT 1 AS ready');queries++;return {async first(){return {ready:1};}};}},AI:{run:forbidden},AI_MODEL:'synthetic-model',ASSETS:{get:forbidden,put:forbidden}};
 const req=()=>new Request('https://service/health',{headers:{authorization:`Bearer ${env.SERVICE_SECRET}`}});const ctx={waitUntil(){}};
 assert.equal((await serviceWorker.fetch(new Request('https://service/health'),env,ctx)).status,401);assert.equal(queries,0);
 const ready=await serviceWorker.fetch(req(),env,ctx);assert.equal(ready.status,200);assert.deepEqual(await ready.json(),{ready:true});assert.equal(ready.headers.get('cache-control'),'no-store');assert.equal(queries,1);
 for(const missing of ['DB','AI','ASSETS','AI_MODEL']){const response=await serviceWorker.fetch(req(),{...env,[missing]:undefined},ctx);assert.equal(response.status,503);assert.deepEqual(await response.json(),{ready:false});}
 const failed=await serviceWorker.fetch(req(),{...env,DB:{prepare(){throw Error('private failure');}}},ctx);assert.equal(failed.status,503);assert.equal(await failed.text(),'{"ready":false}');
});

test('checked deployment template stays private, unconfigured, operations-only and sender/recipient restricted',()=>{
 const config=JSON.parse(readFileSync(new URL('../workers/operations/wrangler.jsonc',import.meta.url),'utf8'));
 assert.equal(config.workers_dev,false);assert.equal(config.preview_urls,false);assert.equal(config.observability.enabled,false);
 for(const key of ['routes','route','tail_consumers','r2_buckets','queues','durable_objects'])assert.equal(config[key],undefined);
 assert.equal(config.d1_databases.length,1);assert.equal(config.d1_databases[0].binding,'OPERATIONS_DB');assert.equal(config.d1_databases[0].database_id,'REQUIRED_SEPARATE_OPERATIONS_DATABASE_ID');
 assert.deepEqual(config.send_email,[{name:'INCIDENT_EMAIL',destination_address:'aegntic.dev@gmail.com',allowed_sender_addresses:['monitor@alerts.qrupgrade.com']}]);assert.equal(config.vars.ALERTS_ENABLED,'false');
 assert.deepEqual(config.triggers.crons,['*/5 * * * *']);
 for(const path of ['../wrangler.jsonc','../workers/qr-service/wrangler.jsonc'])assert.equal(JSON.parse(readFileSync(new URL(path,import.meta.url),'utf8')).tail_consumers,undefined);
 const f=fixture();assert.throws(()=>f.sqlite.prepare("INSERT INTO error_rollups VALUES(600,'web','other','5xx','ok',?)").run(1.5));assert.throws(()=>f.sqlite.exec("INSERT INTO notifications VALUES('unknown',1,'incident','pending',0,0,0,NULL,NULL)"));f.sqlite.close();
});
test('tail waitUntil isolates sink outage and exact isolated configuration rejects unknown producers',async()=>{
 const f=fixture();f.fail();let work:Promise<unknown>|undefined;
 const app=createOperations({isolated:true,web:'qr-test-web',service:'qr-test-service',publicUrl:'https://isolated.example/'});
 app.tail([trace()],f.env,{waitUntil(p){work=p;}});await work;assert.equal(f.batches,0);
 app.tail([trace(500,'ok','https://isolated.example/','qr-test-web')],f.env,{waitUntil(p){work=p;}});await work;assert.equal(f.batches,1);assert.equal(f.messages.length,0);f.sqlite.close();
});
test('runtime catch-up is limited to twelve completed buckets and cannot apply future or current buckets',async()=>{
 const f=fixture(),app=createOperations(undefined,async()=>goodWeb());
 await app.scheduled({scheduledTime:600000},f.env);await app.scheduled({scheduledTime:30000000},f.env);
 assert.equal(f.state('web_runtime').last_bucket,3900);assert.equal(f.state('service_runtime').last_bucket,3900);
 const before=f.state('web_runtime').revision;await app.scheduled({scheduledTime:300000},f.env);assert.equal(f.state('web_runtime').revision,before);f.sqlite.close();
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {linksRequest,resolveLink,validateTarget,readLinkBody} from '../workers/qr-service/links.mjs';
import {linksProxy,linkRedirect} from '../src/lib/server/links';
import {signAccountToken,type AccountConfig} from '../src/lib/server/account';
const owner='a'.repeat(64),other='b'.repeat(64);
const config:AccountConfig={clientId:'test',clientSecret:'test',secret:'s'.repeat(64),serviceUrl:'https://service.example',development:true};
function database(){
 const sqlite=new DatabaseSync(':memory:');sqlite.exec(readFileSync(new URL('../workers/qr-service/migrations/0003_links.sql',import.meta.url),'utf8'));
 const wrap=(sql:string,params:any[]=[])=>({bind:(...p:any[])=>wrap(sql,p),first:async()=>sqlite.prepare(sql).get(...params)||null,all:async()=>({results:sqlite.prepare(sql).all(...params)}),sql,params});
 return {sqlite,DB:{prepare:wrap,async batch(statements:ReturnType<typeof wrap>[]){sqlite.exec('BEGIN');try{const results=statements.map(s=>({results:sqlite.prepare(s.sql).all(...s.params)}));sqlite.exec('COMMIT');return results;}catch(e){sqlite.exec('ROLLBACK');throw e;}}}};
}
function request(method='GET',body?:unknown,id='',user=owner){return new Request(`https://service.example/links${id?'/'+id:''}`,{method,headers:{'x-qr-user':user,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});}
async function create(env:ReturnType<typeof database>){const r=await linksRequest(request('POST',{name:'My link',target:'https://example.com/a'}),env);assert.equal(r.status,201);return (await r.json()).link;}
function resolve(slug:string,count=true){return new Request(`https://service.example/resolve/${slug}`,{headers:{'x-qr-count':count?'1':'0'}});}
test('destination validation rejects unsafe literals, obfuscation, loops, credentials and controls',()=>{
 for(const target of ['http://example.com','https://localhost','https://host.local','https://127.0.0.1','https://2130706433','https://0x7f000001','https://0177.0.0.1','https://10.2.3.4','https://192.168.1.1','https://100.64.1.1','https://169.254.169.254','https://[::1]','https://[::ffff:127.0.0.1]','https://[2001:db8::1]','https://a:b@example.com','https://example.com/\nfoo','https://qrupgrade.com/r/anything','https://www.qrupgrade.com/%72/anything'])assert.throws(()=>validateTarget(target),target);
 assert.equal(validateTarget('https://example.com/path?x=1'),'https://example.com/path?x=1');assert.equal(validateTarget('https://8.8.8.8'),'https://8.8.8.8/');assert.equal(validateTarget('https://[2606:4700:4700::1111]'),'https://[2606:4700:4700::1111]/');
});
test('owner-scoped lifecycle, explicit publish, stable slug, atomic counts, pause/archive',async()=>{
 const env=database(),link=await create(env);assert.equal(link.status,'draft');assert.match(link.slug,/^[A-Za-z0-9_-]{16}$/);
 assert.equal((await resolveLink(resolve(link.slug),env)).status,404);
 assert.equal((await linksRequest(request('GET',undefined,link.id,other),env)).status,404);
 assert.equal((await linksRequest(request('PATCH',{status:'published'},link.id,other),env)).status,404);
 assert.deepEqual((await (await linksRequest(request('GET',undefined,'',other),env)).json()).links,[]);
 assert.equal((await linksRequest(request('PATCH',{status:'published'},link.id),env)).status,200);
 assert.equal((await resolveLink(resolve(link.slug),env)).status,200);await resolveLink(resolve(link.slug,false),env);
 await resolveLink(new Request(`https://service.example/resolve/${link.slug}`,{method:'HEAD'}),env);
 const updated=await (await linksRequest(request('PATCH',{target:'https://example.org/new'},link.id),env)).json();assert.equal(updated.link.slug,link.slug);assert.equal(updated.link.analytics.totalOpens,1);
 assert.equal((await (await resolveLink(resolve(link.slug),env)).json()).target,'https://example.org/new');
 await linksRequest(request('PATCH',{status:'paused'},link.id),env);assert.equal((await resolveLink(resolve(link.slug),env)).status,404);
 await linksRequest(request('PATCH',{status:'published',archived:true},link.id),env);assert.equal((await resolveLink(resolve(link.slug),env)).status,404);
 const stored=await (await linksRequest(request('GET',undefined,link.id),env)).json();assert.equal(stored.link.analytics.totalOpens,2);assert.equal(stored.link.archived,true);
 env.sqlite.close();
});
test('atomic quota counts draft, paused and archived rows; injected fields never reach SQL',async()=>{
 const env=database();for(let n=0;n<50;n++)await create(env);
 assert.equal((await linksRequest(request('POST',{name:'Overflow',target:'https://example.com'}),env)).status,409);
 assert.equal((await linksRequest(request('POST',{name:'x',target:'https://example.com',owner:other}),env)).status,400);
 const list=await (await linksRequest(request(),env)).json();const first=list.links[0];
 await linksRequest(request('PATCH',{archived:true,status:'paused',name:"quote '; DROP TABLE dynamic_links; --"},first.id),env);
 assert.equal((await linksRequest(request('POST',{name:'Overflow',target:'https://example.com'}),env)).status,409);
 assert.equal((await (await linksRequest(request(),env)).json()).links.length,50);env.sqlite.close();
});
test('analytics limits daily series to 30 days while preserving lifetime totals',async()=>{
 const env=database(),link=await create(env);env.sqlite.prepare('INSERT INTO link_daily_counts VALUES (?,?,?)').run(link.slug,'2000-01-01',10);
 const today=new Date().toISOString().slice(0,10);env.sqlite.prepare('INSERT INTO link_daily_counts VALUES (?,?,?)').run(link.slug,today,2);
 const data=await (await linksRequest(request('GET',undefined,link.id),env)).json();assert.deepEqual(data.link.analytics,{totalOpens:12,opensLast30Days:2,daily:[{day:today,count:2}]});env.sqlite.close();
});
test('identity and origin gates, bounded JSON, service failures, fixed forwarding identity',async()=>{
 assert.equal((await linksRequest(request('GET',undefined,'',''),{})).status,401);
 assert.equal((await linksProxy(request(),undefined,config)).status,401);
 const token=await signAccountToken({sub:owner,name:'User',email:'a@example.com'},'session',config);
 const make=(origin:string,body='{}')=>new Request('http://localhost:3040/api/links',{method:'POST',headers:{cookie:`qr-session=${token}`,origin,'Content-Type':'application/json','x-qr-user':other},body});
 assert.equal((await linksProxy(make('https://evil.example'),undefined,config)).status,403);
 assert.equal((await linksProxy(make('http://localhost:3040','x'.repeat(16385)),undefined,config)).status,400);
 await assert.rejects(()=>readLinkBody(new Request('https://example.com',{method:'POST',headers:{'Content-Type':'application/json'},body:'{'})));
 const original=globalThis.fetch;
 try{globalThis.fetch=async(_input,init)=>{const h=new Headers(init?.headers);assert.equal(h.get('x-qr-user'),owner);assert.equal(h.get('Authorization'),`Bearer ${config.secret}`);assert.ok(init?.signal);throw new Error('private failure detail');};const r=await linksProxy(make('http://localhost:3040'),undefined,config);assert.equal(r.status,503);assert.doesNotMatch(await r.text(),/private failure/);}finally{globalThis.fetch=original;}
 assert.equal((await linksRequest(request(),{DB:{prepare(){throw new Error('database');}}})).status,503);
});
test('public redirect has safe headers; HEAD resolves without counting; outages and invalid targets fail closed',async()=>{
 const original=globalThis.fetch,slug='a'.repeat(16);
 try{
  globalThis.fetch=async(_input,init)=>{assert.equal(new Headers(init?.headers).get('x-qr-count'),'0');return Response.json({target:'https://example.com/'});};
  const r=await linkRedirect(new Request('https://qrupgrade.com/r/'+slug,{method:'HEAD'}),slug,config);assert.equal(r.status,307);assert.equal(r.headers.get('location'),'https://example.com/');assert.equal(r.headers.get('cache-control'),'no-store');assert.equal(r.headers.get('referrer-policy'),'no-referrer');assert.equal(await r.text(),'');
  globalThis.fetch=async()=>Response.json({target:'https://127.0.0.1'});assert.equal((await linkRedirect(request(),slug,config)).status,503);
  globalThis.fetch=async()=>new Response('',{status:404});assert.equal((await linkRedirect(request(),slug,config)).status,404);
  globalThis.fetch=async()=>{throw new Error('timeout');};assert.equal((await linkRedirect(request(),slug,config)).status,503);
  assert.equal((await linkRedirect(request(),'invalid',config)).status,404);
 }finally{globalThis.fetch=original;}
});
test('resolver batches lookup and count atomically and fails safely if aggregation fails',async()=>{
 const slug='a'.repeat(16);let batchSize=0;
 const env={DB:{prepare(sql:string){return{bind(...values:unknown[]){assert.ok(values.includes(slug));assert.match(sql,/status='published' AND archived=0/);return{sql,values};}};},async batch(statements:unknown[]){batchSize=statements.length;throw new Error('private database error');}}};
 const r=await resolveLink(resolve(slug),env);assert.equal(r.status,503);assert.equal(batchSize,2);assert.doesNotMatch(await r.text(),/private database/);
 await resolveLink(resolve(slug,false),env);assert.equal(batchSize,1);
});

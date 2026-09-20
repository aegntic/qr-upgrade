import {migrate} from './fixtures/migrations';
import {validAccountDeps} from './fixtures/account-deps';
import test from 'node:test';
import assert from 'node:assert/strict';
import Stripe from 'stripe';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {PLAN_LIMITS,type PlanTier} from '../shared/plan-limits.mjs';
import {cloudRequest} from '../workers/qr-service/cloud.mjs';
import {linksRequest} from '../workers/qr-service/links.mjs';
import {assetRequest,contentRequest} from '../workers/qr-service/content.mjs';
import {linksProxy} from '../src/lib/server/links';
import {signAccountToken,type AccountConfig} from '../src/lib/server/account';
import {resolveEntitlement,type BillingConfig} from '../src/lib/server/billing';
import {newDesign} from '../src/lib/new-design';
import type {ContentDraft} from '../src/lib/content-types';

const owner='e'.repeat(64),other='f'.repeat(64),tiers=Object.keys(PLAN_LIMITS) as PlanTier[];
const account:AccountConfig={clientId:'test',clientSecret:'test',secret:'s'.repeat(64),serviceUrl:'https://service.example',development:true};
const disabled:BillingConfig={account,enabled:false};
const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';
const pngBytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
const contentDraft=():ContentDraft=>({kind:'links',title:'My page',description:'Description',accent:'#123abc',items:[{title:'Link',description:'',price:'',url:'https://openai.com',assetId:''}],fileId:'',formMessage:''});

test('shared plan catalog and each tier are immutable',()=>{assert.equal(Object.isFrozen(PLAN_LIMITS),true);for(const tier of tiers)assert.equal(Object.isFrozen(PLAN_LIMITS[tier]),true);});

function d1(migration:string){
 const sqlite=new DatabaseSync(':memory:');migrate(sqlite);
 const wrap=(sql:string,params:any[]=[])=>({bind:(...next:any[])=>wrap(sql,next),first:async()=>sqlite.prepare(sql).get(...params)||null,all:async()=>({results:sqlite.prepare(sql).all(...params)}),run:async()=>sqlite.prepare(sql).run(...params),sql,params});
 const DB={prepare:wrap,async batch(statements:ReturnType<typeof wrap>[]){sqlite.exec('BEGIN');try{const results=statements.map(statement=>({results:sqlite.prepare(statement.sql).all(...statement.params)}));sqlite.exec('COMMIT');return results;}catch(error){sqlite.exec('ROLLBACK');throw error;}}};
 return {sqlite,DB};
}
function headers(tier?:string){return {'x-qr-user':owner,'Content-Type':'application/json',...(tier===undefined?{}:{'x-qr-plan':tier})};}
function cloudBody(){const draft=newDesign('https://openai.com','Entitlement design');return {name:draft.name,draft,artifact:{png}};}

test('real SQLite enforces every free and paid cloud-design boundary atomically',async()=>{
 for(const tier of tiers){
  const env=d1('../workers/qr-service/migrations/0002_accounts.sql'),objects=new Map<string,string>();
  const limit=PLAN_LIMITS[tier].cloudDesigns,seed=env.sqlite.prepare('INSERT INTO cloud_designs VALUES(?,?,?,?,?,?,?,?)'),now=new Date().toISOString();
  for(let n=0;n<limit-1;n++)seed.run(crypto.randomUUID(),owner,`Archived ${n}`,1,now,now,`seed-${n}`,0);
  const service={...env,ASSETS:{async put(key:string,value:string){objects.set(key,value);},async get(key:string){const value=objects.get(key);return value?{json:async()=>JSON.parse(value)}:null;},async delete(key:string){objects.delete(key);}}};
  const make=()=>new Request('https://service.example/cloud/designs',{method:'POST',headers:headers(tier),body:JSON.stringify(cloudBody())});
  assert.equal((await cloudRequest(make(),service)).status,201,tier);const blocked=await cloudRequest(make(),service);assert.equal(blocked.status,409,tier);assert.match((await blocked.json()).error,new RegExp(String(limit)));env.sqlite.close();
 }
});

test('real SQLite enforces every free and paid dynamic-link boundary',async()=>{
 for(const tier of tiers){
  const env=d1('../workers/qr-service/migrations/0003_links.sql'),limit=PLAN_LIMITS[tier].dynamicLinks,seed=env.sqlite.prepare('INSERT INTO dynamic_links VALUES(?,?,?,?,?,?,?,?,?)'),now=new Date().toISOString();
  for(let n=0;n<limit-1;n++)seed.run(crypto.randomUUID(),owner,n.toString(36).padStart(16,'0'),`Archived ${n}`,'https://openai.com','paused',1,now,now);
  const make=()=>new Request('https://service.example/links',{method:'POST',headers:headers(tier),body:JSON.stringify({name:'New link',target:'https://openai.com'})});
  assert.equal((await linksRequest(make(),env)).status,201,tier);const blocked=await linksRequest(make(),env);assert.equal(blocked.status,409,tier);assert.match((await blocked.json()).error,new RegExp(String(limit)));env.sqlite.close();
 }
});

test('real SQLite enforces every free and paid hosted-page and pending-asset boundary',async()=>{
 for(const tier of tiers){
  const env=d1('../workers/qr-service/migrations/0004_content.sql'),objects=new Map<string,Uint8Array>(),service={...env,ASSETS:{async put(key:string,value:Uint8Array){objects.set(key,value);},async get(key:string){const value=objects.get(key);return value?{body:value}:null;},async delete(key:string){objects.delete(key);}}},now=new Date().toISOString();
  const pageLimit=PLAN_LIMITS[tier].hostedPages,pageSeed=env.sqlite.prepare('INSERT INTO content_pages VALUES(?,?,?,?,?,?,?,?,?)');for(let n=0;n<pageLimit-1;n++)pageSeed.run(crypto.randomUUID(),owner,n.toString(36).padStart(16,'0'),JSON.stringify(contentDraft()),null,'paused',1,now,now);
  const page=()=>new Request('https://service.example/content',{method:'POST',headers:headers(tier),body:JSON.stringify(contentDraft())});assert.equal((await contentRequest(page(),service)).status,201,tier);const pageBlocked=await contentRequest(page(),service);assert.equal(pageBlocked.status,409,tier);assert.match((await pageBlocked.json()).error,new RegExp(String(pageLimit)));
  const assetLimit=PLAN_LIMITS[tier].uploadedAssets,assetSeed=env.sqlite.prepare('INSERT INTO content_assets VALUES(?,?,?,?,?,?,?,?)');for(let n=0;n<assetLimit-1;n++)assetSeed.run(crypto.randomUUID(),owner,'pending','image/png',1,`pending-${n}`,0,now);
  const asset=()=>new Request('https://service.example/content-assets',{method:'POST',headers:headers(tier),body:JSON.stringify({name:'image.png',mime:'image/png',data:pngBytes.toString('base64')})});assert.equal((await assetRequest(asset(),service)).status,201,tier);const assetBlocked=await assetRequest(asset(),service);assert.equal(assetBlocked.status,409,tier);assert.match((await assetBlocked.json()).error,new RegExp(String(assetLimit)));env.sqlite.close();
 }
});

test('missing tier stays free and negative or unknown tiers fail before storage',async()=>{
 for(const tier of ['-1','enterprise']){
  assert.equal((await cloudRequest(new Request('https://service.example/cloud/designs',{headers:headers(tier)}),{})).status,400);
  assert.equal((await linksRequest(new Request('https://service.example/links',{headers:headers(tier)}),{})).status,400);
  assert.equal((await contentRequest(new Request('https://service.example/content',{headers:headers(tier)}),{})).status,400);
  assert.equal((await assetRequest(new Request('https://service.example/content-assets',{headers:headers(tier)}),{})).status,400);
 }
 const env=d1('../workers/qr-service/migrations/0003_links.sql'),now=new Date().toISOString(),seed=env.sqlite.prepare('INSERT INTO dynamic_links VALUES(?,?,?,?,?,?,?,?,?)');for(let n=0;n<50;n++)seed.run(crypto.randomUUID(),owner,n.toString(36).padStart(16,'0'),`Link ${n}`,'https://openai.com','draft',0,now,now);
 const free=new Request('https://service.example/links',{method:'POST',headers:headers(),body:JSON.stringify({name:'Overflow',target:'https://openai.com'})});assert.equal((await linksRequest(free,env)).status,409);env.sqlite.close();
});

test('downgrade over quota preserves reads, edits, pause and archive operations',async()=>{
 const links=d1('../workers/qr-service/migrations/0003_links.sql'),now=new Date().toISOString(),linkId=crypto.randomUUID(),linkSeed=links.sqlite.prepare('INSERT INTO dynamic_links VALUES(?,?,?,?,?,?,?,?,?)');for(let n=0;n<51;n++)linkSeed.run(n?crypto.randomUUID():linkId,owner,n.toString(36).padStart(16,'0'),`Link ${n}`,'https://openai.com','published',0,now,now);
 const update=new Request(`https://service.example/links/${linkId}`,{method:'PATCH',headers:headers(),body:JSON.stringify({status:'paused',archived:true})});assert.equal((await linksRequest(update,links)).status,200);assert.equal((await linksRequest(new Request(`https://service.example/links/${linkId}`,{headers:headers()}),links)).status,200);links.sqlite.close();

 const content=d1('../workers/qr-service/migrations/0004_content.sql'),pageId=crypto.randomUUID(),pageSeed=content.sqlite.prepare('INSERT INTO content_pages VALUES(?,?,?,?,?,?,?,?,?)');for(let n=0;n<51;n++)pageSeed.run(n?crypto.randomUUID():pageId,owner,n.toString(36).padStart(16,'0'),JSON.stringify(contentDraft()),null,'draft',0,now,now);
 const contentEnv={...content,ASSETS:{async get(){return null;}}};assert.equal((await contentRequest(new Request(`https://service.example/content/${pageId}`,{method:'PUT',headers:headers(),body:JSON.stringify(contentDraft())}),contentEnv)).status,200);assert.equal((await contentRequest(new Request(`https://service.example/content/${pageId}`,{method:'PATCH',headers:headers(),body:JSON.stringify({action:'archive'})}),contentEnv)).status,200);content.sqlite.close();

 const cloud=d1('../workers/qr-service/migrations/0002_accounts.sql'),cloudId=crypto.randomUUID(),cloudSeed=cloud.sqlite.prepare('INSERT INTO cloud_designs VALUES(?,?,?,?,?,?,?,?)');for(let n=0;n<51;n++)cloudSeed.run(n?crypto.randomUUID():cloudId,owner,`Design ${n}`,0,now,now,`key-${n}`,1);
 assert.equal((await cloudRequest(new Request(`https://service.example/cloud/designs/${cloudId}`,{method:'PATCH',headers:headers(),body:JSON.stringify({archived:true})}),{...cloud,ASSETS:{}})).status,200);cloud.sqlite.close();
});

test('proxy ignores a browser-forged plan and sends only its server-resolved tier',async()=>{
 const token=await signAccountToken({sv:1,sub:owner,name:'User',email:'user@example.com'},'session',account),original=globalThis.fetch;let forwarded='';
 try{
  globalThis.fetch=async(_url,init)=>{const sent=new Headers(init?.headers);forwarded=sent.get('x-qr-plan')||'';assert.equal(sent.get('x-qr-user'),owner);return Response.json({link:{}},{status:201});};
  const request=new Request('http://localhost:3040/api/links',{method:'POST',headers:{cookie:`qr-session=${token}`,origin:'http://localhost:3040','Content-Type':'application/json','x-qr-plan':'brand','x-qr-user':other},body:JSON.stringify({name:'Link',target:'https://openai.com'})});
  assert.equal((await linksProxy(request,undefined,account,{config:disabled,accountDeps:validAccountDeps(owner)})).status,201);assert.equal(forwarded,'free');
 }finally{globalThis.fetch=original;}
});

test('authenticated paid collection GET omits unknown capacity and survives billing outage',async()=>{
 const config:BillingConfig={account,enabled:true,key:'sk_test_fixture',webhookSecret:'whsec_fixture',pro:'price_pro',brand:'price_brand',portalConfiguration:'bpc_qrupgrade'};
 const binding={owner,customer_id:'cus_paid',mode:'test',reservation:null,tier:null,reserved_at:null,session_id:null,lease_until:0};
 const stripe={
  prices:{retrieve:async(id:string)=>({id,active:true,livemode:false,type:'recurring',recurring:{interval:'month',interval_count:1,usage_type:'licensed'},billing_scheme:'per_unit',unit_amount:id==='price_brand'?2500:1200,currency:'usd'})},
  customers:{retrieve:async()=>({id:'cus_paid',livemode:false,metadata:{owner}})},
  subscriptions:{list:async()=>({data:[{customer:'cus_paid',livemode:false,status:'active',cancel_at:null,cancel_at_period_end:false,items:{data:[{quantity:1,price:{id:'price_brand'},current_period_end:123}]}}],has_more:false})}
 } as unknown as Stripe;
 const verified=await resolveEntitlement(owner,config,{stripe,fetch:async()=>Response.json({binding})});assert.equal(verified.tier,'brand');assert.equal(verified.limits.dynamicLinks,500);

 const env=d1('../workers/qr-service/migrations/0003_links.sql'),token=await signAccountToken({sv:1,sub:owner,name:'Paid User',email:'paid@example.com'},'session',account),original=globalThis.fetch;
 try{
  globalThis.fetch=async(input,init)=>linksRequest(new Request(input as string,init),env);
  const outage={stripe:new Proxy({} as Stripe,{get(){throw new Error('Billing provider should not be read for collection GET');}}),fetch:async()=>{throw new Error('Billing service should not be read for collection GET');}};
  const response=await linksProxy(new Request('http://localhost:3040/api/links',{headers:{cookie:`qr-session=${token}`}}),undefined,account,{config,deps:outage,accountDeps:validAccountDeps(owner)});assert.equal(response.status,200);
  const collection=await response.json();assert.deepEqual(collection,{links:[]});assert.equal(Object.hasOwn(collection,'limit'),false);
  const authoritative=await (await linksRequest(new Request('https://service.example/links',{headers:headers('brand')}),env)).json();assert.equal(authoritative.limit,500);
 }finally{globalThis.fetch=original;env.sqlite.close();}
});

test('collection handlers expose capacity only with an authoritative tier header',async()=>{
 const cloud=d1('../workers/qr-service/migrations/0002_accounts.sql'),content=d1('../workers/qr-service/migrations/0004_content.sql'),links=d1('../workers/qr-service/migrations/0003_links.sql');
 try{
  const calls=[
   {key:'designs',limit:500,run:(tier?:string)=>cloudRequest(new Request('https://service.example/cloud/designs',{headers:headers(tier)}),{...cloud,ASSETS:{}})},
   {key:'links',limit:500,run:(tier?:string)=>linksRequest(new Request('https://service.example/links',{headers:headers(tier)}),links)},
   {key:'pages',limit:500,run:(tier?:string)=>contentRequest(new Request('https://service.example/content',{headers:headers(tier)}),{...content,ASSETS:{}})},
   {key:'assets',limit:1000,run:(tier?:string)=>assetRequest(new Request('https://service.example/content-assets',{headers:headers(tier)}),{...content,ASSETS:{}})}
  ];
  for(const call of calls){const unknown=await (await call.run()).json();assert.deepEqual(unknown[call.key],[]);assert.equal(Object.hasOwn(unknown,'limit'),false);const known=await (await call.run('brand')).json();assert.equal(known.limit,call.limit);}
 }finally{cloud.sqlite.close();content.sqlite.close();links.sqlite.close();}
});

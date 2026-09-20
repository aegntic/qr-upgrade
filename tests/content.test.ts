import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {contentRequest,assetRequest,publicContent,validateDraft,validateUpload,readContentBody} from '../workers/qr-service/content.mjs';
import {contentProxy,assetProxy,publicSubmission,getPublicContent,publicContentAsset} from '../src/lib/server/content';
import {signAccountToken,type AccountConfig} from '../src/lib/server/account';
import type {ContentDraft} from '../src/lib/content-types';
const owner='a'.repeat(64),other='b'.repeat(64),network='c'.repeat(64);
const config:AccountConfig={clientId:'test',clientSecret:'test',secret:'s'.repeat(64),serviceUrl:'https://service.example',development:true};
const draft=(kind:ContentDraft['kind']='links'):ContentDraft=>({kind,title:'My page',description:'Description',accent:'#123abc',items:kind==='links'?[{title:'Link',description:'',price:'',url:'https://example.com',assetId:''}]:[],fileId:'',formMessage:''});
function environment(){
 const sqlite=new DatabaseSync(':memory:');sqlite.exec(readFileSync(new URL('../workers/qr-service/migrations/0004_content.sql',import.meta.url),'utf8'));const objects=new Map<string,Uint8Array>();
 const wrap=(sql:string,params:any[]=[])=>({bind:(...p:any[])=>wrap(sql,p),first:async()=>sqlite.prepare(sql).get(...params)||null,all:async()=>({results:sqlite.prepare(sql).all(...params)}),sql,params});
 return {sqlite,objects,ASSETS:{async put(key:string,bytes:Uint8Array){objects.set(key,bytes);},async delete(key:string){objects.delete(key);},async get(key:string){const v=objects.get(key);return v?{body:v}:null;}},DB:{prepare:wrap,async batch(statements:ReturnType<typeof wrap>[]){sqlite.exec('BEGIN');try{const results=statements.map(s=>({results:sqlite.prepare(s.sql).all(...s.params)}));sqlite.exec('COMMIT');return results;}catch(e){sqlite.exec('ROLLBACK');throw e;}}}};
}
function req(path='/content',method='GET',body?:unknown,user=owner,net=network){return new Request(`https://service.example${path}`,{method,headers:{'x-qr-user':user,'x-qr-network':net,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});}
async function create(env:ReturnType<typeof environment>,value=draft()){const r=await contentRequest(req('/content','POST',value),env);assert.equal(r.status,201,await r.clone().text());return (await r.json()).page;}
async function action(env:ReturnType<typeof environment>,id:string,value:string){return contentRequest(req(`/content/${id}`,'PATCH',{action:value}),env);}
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
async function upload(env:ReturnType<typeof environment>,mime='image/png',bytes=png,user=owner){const r=await assetRequest(req('/content-assets','POST',{name:'file',mime,data:bytes.toString('base64')},user),env);assert.equal(r.status,201,await r.clone().text());return (await r.json()).asset;}
test('private owner isolation and published snapshot separation; archive and pause disable delivery',async()=>{
 const env=environment(),p=await create(env);assert.equal(p.status,'draft');assert.equal((await publicContent(req(`/public-content/${p.slug}`),env)).status,404);
 assert.equal((await contentRequest(req(`/content/${p.id}`,'GET',undefined,other),env)).status,404);
 assert.equal((await contentRequest(req(`/content/${p.id}`,'PUT',draft(),other),env)).status,404);
 assert.equal((await action(env,p.id,'publish')).status,200);
 const changed={...draft(),title:'Private edit'};await contentRequest(req(`/content/${p.id}`,'PUT',changed),env);
 const pub=await (await publicContent(req(`/public-content/${p.slug}`),env)).json();assert.deepEqual(Object.keys(pub.page).sort(),['content','slug','url']);assert.equal(pub.page.content.title,'My page');
 const privatePage=(await (await contentRequest(req(`/content/${p.id}`),env)).json()).page;assert.equal(privatePage.hasUnpublishedChanges,true);assert.equal(privatePage.draft.title,'Private edit');
 await action(env,p.id,'publish');assert.equal((await (await publicContent(req(`/public-content/${p.slug}`),env)).json()).page.content.title,'Private edit');
 await action(env,p.id,'pause');assert.equal((await publicContent(req(`/public-content/${p.slug}`),env)).status,404);await action(env,p.id,'publish');await action(env,p.id,'archive');assert.equal((await publicContent(req(`/public-content/${p.slug}`),env)).status,404);assert.equal((await action(env,p.id,'publish')).status,409);env.sqlite.close();
});
test('strict schema, safe external URLs, incomplete drafts and publish requirements',async()=>{
 assert.throws(()=>validateDraft({...draft(),owner}));assert.throws(()=>validateDraft({...draft(),accent:'red'}));assert.throws(()=>validateDraft({...draft(),items:[{...draft().items[0],url:'https://127.0.0.1'}]}));assert.throws(()=>validateDraft({...draft(),items:Array(13).fill(draft().items[0])}));
 const env=environment();for(const kind of ['gallery','document','links'] as const){const p=await create(env,{...draft(kind),items:[]});assert.equal((await action(env,p.id,'publish')).status,400);}const p=await create(env,draft('menu'));assert.equal((await action(env,p.id,'publish')).status,200);env.sqlite.close();
});
test('asset ownership, published membership, headers, edit separation and immediate revocation',async()=>{
 const env=environment(),a=await upload(env),b=await upload(env),foreign=await upload(env,'image/png',png,other);
 assert.equal((await assetRequest(req(`/content-assets/${a.id}`,'GET',undefined,other),env)).status,404);
 const make=(id:string)=>({...draft('gallery'),items:[{title:'Photo',description:'',price:'',url:'',assetId:id}]});
 assert.equal((await contentRequest(req('/content','POST',make(foreign.id)),env)).status,400);
 const p=await create(env,make(a.id));await action(env,p.id,'publish');await contentRequest(req(`/content/${p.id}`,'PUT',make(b.id)),env);
 const get=(id:string)=>publicContent(req(`/public-content/${p.slug}/assets/${id}`),env);
 assert.equal((await get(b.id)).status,404);const file=await get(a.id);assert.equal(file.status,200);assert.equal(file.headers.get('content-type'),'image/png');assert.equal(file.headers.get('cache-control'),'no-store');assert.equal(file.headers.get('x-content-type-options'),'nosniff');assert.equal(file.headers.get('referrer-policy'),'no-referrer');assert.match(file.headers.get('content-security-policy')!,/sandbox/);assert.deepEqual(Buffer.from(await file.arrayBuffer()),png);
 await action(env,p.id,'pause');assert.equal((await get(a.id)).status,404);await action(env,p.id,'publish');assert.equal((await get(a.id)).status,404);assert.equal((await get(b.id)).status,200);await action(env,p.id,'archive');assert.equal((await get(b.id)).status,404);env.sqlite.close();
});
test('upload rejects spoofed MIME, unsafe formats, oversized data and dimensions; PDFs are attachments',async()=>{
 for(const mime of ['text/html','image/svg+xml','image/jpeg','image/webp','application/pdf'])assert.throws(()=>validateUpload({name:'f',mime,data:png.toString('base64')}));
 const huge=Buffer.from(png);huge.writeUInt32BE(4097,16);assert.throws(()=>validateUpload({name:'f',mime:'image/png',data:huge.toString('base64')}));
 assert.throws(()=>validateUpload({name:'f',mime:'image/png',data:Buffer.alloc(2097153).toString('base64')}));assert.throws(()=>validateUpload({name:'f',mime:'image/png',data:'%%%%'}));
 const env=environment(),a=await upload(env,'application/pdf',Buffer.from('%PDF-1.7\ncontent\n%%EOF\n'));const p=await create(env,{...draft('document'),fileId:a.id});await action(env,p.id,'publish');const r=await publicContent(req(`/public-content/${p.slug}/assets/${a.id}`),env);assert.match(r.headers.get('content-disposition')!,/^attachment;/);assert.equal(r.headers.get('content-type'),'application/pdf');
 assert.equal((await contentRequest(req('/content','POST',{...draft('gallery'),items:[{title:'Photo',description:'',price:'',url:'',assetId:a.id}]}),env)).status,400);env.sqlite.close();
});
test('atomic page and file quotas count archived pages and pending files',async()=>{
 const env=environment();const pages=await Promise.all(Array.from({length:52},()=>contentRequest(req('/content','POST',draft()),env)));assert.equal(pages.filter(r=>r.status===201).length,50);assert.equal(pages.filter(r=>r.status===409).length,2);
 const p=(await (await contentRequest(req(),env)).json()).pages[0];await action(env,p.id,'archive');assert.equal((await contentRequest(req('/content','POST',draft()),env)).status,409);
 const now=new Date().toISOString();for(let n=0;n<100;n++)env.sqlite.prepare('INSERT INTO content_assets VALUES(?,?,?,?,?,?,?,?)').run(crypto.randomUUID(),owner,'file','image/png',1,`key-${n}`,0,now);
 assert.equal((await assetRequest(req('/content-assets','POST',{name:'file',mime:'image/png',data:png.toString('base64')}),env)).status,409);env.sqlite.close();
});
test('failed upload cleans pending reservation; ambiguous finalized write never deletes committed file',async()=>{
 const env=environment();env.ASSETS.put=async()=>{throw new Error('private failure');};const body={name:'f',mime:'image/png',data:png.toString('base64')};const r=await assetRequest(req('/content-assets','POST',body),env);assert.equal(r.status,503);assert.doesNotMatch(await r.text(),/private failure/);assert.equal(env.sqlite.prepare('SELECT count(*) AS n FROM content_assets').get()!.n,0);
 env.ASSETS.put=async(key,bytes)=>{env.objects.set(key,bytes);};const original=env.DB.prepare;env.DB.prepare=((sql:string)=>{const statement=original(sql);if(sql.startsWith('UPDATE content_assets SET ready=1'))return {...statement,bind:(...values:any[])=>({...statement.bind(...values),first:async()=>{await statement.bind(...values).first();throw new Error('lost response');}})};return statement;}) as typeof original;
 assert.equal((await assetRequest(req('/content-assets','POST',body),env)).status,201);assert.equal(env.objects.size,1);env.sqlite.close();
});
const message={name:'Visitor',email:'visitor@example.com',message:'Hello',consent:true,website:''};
test('forms enforce consent, honeypot, publication, owner-only access and atomic hourly network limit',async()=>{
 const env=environment(),p=await create(env,draft('form')),path=`/public-content/${p.slug}/submissions`;
 assert.equal((await publicContent(req(path,'POST',message),env)).status,404);await action(env,p.id,'publish');
 for(const bad of [{...message,consent:false},{...message,website:'bot'},{...message,email:'bad'},{...message,message:''}])assert.equal((await publicContent(req(path,'POST',bad),env)).status,400);
 assert.equal((await publicContent(req(path,'POST',message,owner,''),env)).status,503);
 const results=await Promise.all(Array.from({length:8},()=>publicContent(req(path,'POST',message),env)));assert.equal(results.filter(r=>r.status===201).length,5);assert.equal(results.filter(r=>r.status===429).length,3);
 assert.equal(env.sqlite.prepare('SELECT count(*) AS n FROM content_submissions WHERE network IS NOT NULL').get()!.n,0);
 assert.equal((await contentRequest(req(`/content/${p.id}/submissions`,'GET',undefined,other),env)).status,404);const list=await (await contentRequest(req(`/content/${p.id}/submissions`),env)).json();assert.equal(list.total,5);assert.deepEqual(Object.keys(list.submissions[0]).sort(),['createdAt','email','id','message','name']);await action(env,p.id,'pause');assert.equal((await publicContent(req(path,'POST',message),env)).status,404);env.sqlite.close();
});
test('forms enforce atomic daily and lifetime boundaries and last-100 limit',async()=>{
 const env=environment(),p=await create(env,draft('form'));await action(env,p.id,'publish');const today=new Date().toISOString();
 const seed=env.sqlite.prepare('INSERT INTO content_submissions VALUES(?,?,?,?,?,?,?)');for(let n=0;n<99;n++)seed.run(crypto.randomUUID(),p.id,'','',`Message ${n}`,today,'d'.repeat(64));
 const path=`/public-content/${p.slug}/submissions`;const results=await Promise.all([publicContent(req(path,'POST',message),env),publicContent(req(path,'POST',message,owner,'e'.repeat(64)),env)]);assert.deepEqual(results.map(r=>r.status).sort(),[201,429]);
 for(let n=100;n<1000;n++)seed.run(crypto.randomUUID(),p.id,'','','Old message','2000-01-01T00:00:00.000Z','f'.repeat(64));
 assert.equal((await publicContent(req(path,'POST',message,owner,'1'.repeat(64)),env)).status,429);const list=await (await contentRequest(req(`/content/${p.id}/submissions`),env)).json();assert.equal(list.total,1000);assert.equal(list.submissions.length,100);env.sqlite.close();
});
test('bounded bodies, private auth/origin, fixed proxy identity, trusted network header and failure behavior',async()=>{
 assert.equal((await contentProxy(req(),undefined,config)).status,401);assert.equal((await assetProxy(req(),undefined,config)).status,401);
 const token=await signAccountToken({sub:owner,name:'User',email:'user@example.com'},'session',config);
 const make=(origin='http://localhost:3040',body=JSON.stringify(draft()))=>new Request('http://localhost:3040/api/content',{method:'POST',headers:{cookie:`qr-session=${token}`,origin,'Content-Type':'application/json','x-qr-user':other,'x-qr-network':other,'x-forwarded-for':'8.8.8.8'},body});
 assert.equal((await contentProxy(make('https://evil.example'),undefined,config)).status,403);assert.equal((await contentProxy(make(undefined,'x'.repeat(32769)),undefined,config)).status,400);await assert.rejects(()=>readContentBody(req('/content','POST','x'.repeat(33000))));
 const original=globalThis.fetch;try{globalThis.fetch=async(_url,init)=>{const h=new Headers(init?.headers);assert.equal(h.get('Authorization'),`Bearer ${config.secret}`);assert.equal(h.get('x-qr-user'),owner);assert.equal(h.get('x-qr-network'),null);assert.ok(init?.signal);return Response.json({pages:[]});};assert.equal((await contentProxy(make(),undefined,config)).status,200);
 let captured='';globalThis.fetch=async(_url,init)=>{const h=new Headers(init?.headers);captured=h.get('x-qr-network')!;assert.match(captured,/^[a-f0-9]{64}$/);assert.notEqual(captured,other);assert.equal(h.get('x-qr-user'),null);return Response.json({received:true}, {status:201});};assert.equal((await publicSubmission(make(), 'a'.repeat(16),config)).status,201);
 const production={...config,development:false};const publicReq=new Request('https://qrupgrade.com/api/content/public/'+ 'a'.repeat(16)+'/submissions',{method:'POST',headers:{origin:'https://qrupgrade.com','Content-Type':'application/json','x-forwarded-for':'8.8.8.8'},body:JSON.stringify(message)});assert.equal((await publicSubmission(publicReq,'a'.repeat(16),production)).status,503);
 const trusted=new Request(publicReq,{headers:{origin:'https://qrupgrade.com','Content-Type':'application/json','x-vercel-forwarded-for':'8.8.8.8'}});assert.equal((await publicSubmission(trusted,'a'.repeat(16),production)).status,201);
 globalThis.fetch=async()=>new Response('',{status:404});assert.equal(await getPublicContent('a'.repeat(16),config),null);globalThis.fetch=async()=>{throw new Error('private details');};await assert.rejects(()=>getPublicContent('a'.repeat(16),config));const failed=await contentProxy(make(),undefined,config);assert.equal(failed.status,503);assert.doesNotMatch(await failed.text(),/private details/);assert.equal((await publicContentAsset(req(),'a'.repeat(16),crypto.randomUUID(),config)).status,503);
 }finally{globalThis.fetch=original;}
});
test('publish rejects a draft changed after validation and keeps the prior public snapshot',async()=>{
 const env=environment(),p=await create(env);await action(env,p.id,'publish');const original=env.DB.prepare;let raced=false;
 env.DB.prepare=((sql:string)=>{if(sql.startsWith('UPDATE content_pages SET published=')&&!raced){raced=true;env.sqlite.prepare('UPDATE content_pages SET draft=? WHERE id=? AND owner=?').run(JSON.stringify({...draft(),title:'Concurrent private edit'}),p.id,owner);}return original(sql);}) as typeof original;
 assert.equal((await action(env,p.id,'publish')).status,409);assert.equal((await (await publicContent(req(`/public-content/${p.slug}`),env)).json()).page.content.title,'My page');env.sqlite.close();
});
test('storage outages are safe and uncertain reservation recovery preserves objects',async()=>{
 const env=environment(),a=await upload(env);env.ASSETS.get=async()=>{throw new Error('secret storage error');};const file=await assetRequest(req(`/content-assets/${a.id}`),env);assert.equal(file.status,503);assert.doesNotMatch(await file.text(),/secret storage/);
 const original=env.DB.prepare;env.ASSETS.put=async(key,bytes)=>{env.objects.set(key,bytes);throw new Error('uncertain put');};env.DB.prepare=((sql:string)=>{if(sql.startsWith('SELECT * FROM content_assets WHERE id='))throw new Error('uncertain read');return original(sql);}) as typeof original;
 const response=await assetRequest(req('/content-assets','POST',{name:'file',mime:'image/png',data:png.toString('base64')}),env);assert.equal(response.status,503);assert.equal(env.objects.size,2);assert.equal(env.sqlite.prepare('SELECT count(*) AS n FROM content_assets WHERE ready=0').get()!.n,1);env.sqlite.close();
});
test('streaming reader cancels requests that cross byte limits',async()=>{
 let cancelled=false;const body=new ReadableStream<Uint8Array>({pull(controller){controller.enqueue(new Uint8Array(20000));},cancel(){cancelled=true;}});
 await assert.rejects(()=>readContentBody(new Request('https://service.example/content',{method:'POST',headers:{'Content-Type':'application/json'},body,duplex:'half'} as RequestInit)));assert.equal(cancelled,true);
});

import { withWebEntry } from '../cloudflare/runtime';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createArtHandler, sameOrigin } from '../src/lib/server/art-service';
import worker, { validateArtInput } from '../workers/qr-service/worker.mjs';
const secret='test-secret-not-a-real-credential'.repeat(2);
const id='0325ab19-ff7e-4e87-943a-6d99064b7700';
const cfg={url:'https://worker.example',secret,production:true};
const session='c'.repeat(64);
const req=(body:unknown,extra:Record<string,string>={})=>new Request('https://qrupgrade.com/api/art',{method:'POST',headers:{origin:'https://qrupgrade.com','content-type':'application/json','x-vercel-forwarded-for':'192.0.2.1',cookie:`qr-art-session=${session}`,...extra},body:JSON.stringify(body)});
test('art generation fails closed, requires same-origin and validated bounded prompts',async()=>{
 assert.equal((await createArtHandler({production:true})(req({}))).status,503);
 assert.equal(sameOrigin(req({}, {origin:'https://other.example'}),cfg),false);
 const handler=createArtHandler({...cfg,fetcher:async()=>{throw new Error('must not reach provider');}});
 assert.equal((await handler(req({requestId:id,prompt:'valid enough prompt',style:'steel'},{origin:'https://attacker.example'}))).status,403);
 for(const body of [{requestId:id,prompt:'short',style:'steel'},{requestId:id,prompt:'A valid artwork prompt',style:'unknown'},{requestId:id,prompt:'x'.repeat(5000),style:'steel'},{requestId:id,prompt:'valid enough prompt',style:'steel',destination:'private'}])assert.equal((await handler(req(body))).status,400);
});
test('art proxy gives worker hashed ownership/network, no raw IP or public credential',async()=>{
 let target='',sent:RequestInit|undefined;
 const handler=createArtHandler({...cfg,fetcher:async(url,init)=>{target=String(url);sent=init;return Response.json({id,status:'pending'},{status:202});}});
 const bootstrap=await handler(new Request('https://qrupgrade.com/api/art'));
 const cookie=bootstrap.headers.get('set-cookie')!;
 assert.match(cookie,/HttpOnly; SameSite=Strict/);assert.match(cookie,/; Secure$/);
 assert.equal((await handler(new Request('https://qrupgrade.com/api/art',{method:'POST',headers:{origin:'https://qrupgrade.com','content-type':'application/json','x-vercel-forwarded-for':'192.0.2.1'},body:JSON.stringify({requestId:id,prompt:'Sculptural glass with steel details',style:'steel'})}))).status,409);
 const result=await withWebEntry({},'192.0.2.1',()=>handler(req({requestId:id,prompt:'Sculptural glass with steel details',style:'steel'})));
 assert.equal(result.status,202);assert.equal(target,'https://worker.example/art');
 const input=JSON.parse(sent!.body as string);assert.match(input.owner,/^[a-f0-9]{64}$/);assert.match(input.network,/^[a-f0-9]{64}$/);assert.doesNotMatch(sent!.body as string,/192\.0\.2\.1/);
 assert.equal(result.headers.get('set-cookie'),null);
 assert.doesNotMatch(await result.text(),new RegExp(secret));
 const get=await handler(new Request('https://qrupgrade.com/api/art?id='+id,{headers:{cookie:`qr-art-session=${session}`}}));assert.equal(get.status,202);assert.match(String(new Headers(sent!.headers).get('x-qr-owner')),/^[a-f0-9]{64}$/);
 assert.equal((await handler(new Request('https://qrupgrade.com/api/art?id='+id))).status,404);
});
test('bootstrap cookie lets a lost POST response recover the same job without another charge',async()=>{
 let postOwner='',getOwner='',posts=0;
 const handler=createArtHandler({...cfg,fetcher:async(_url,init)=>{
  const headers=Object.fromEntries(new Headers(init!.headers));
  if(init!.method==='POST'){posts++;postOwner=headers['x-qr-owner'];throw new Error('response lost');}
  getOwner=headers['x-qr-owner'];return Response.json({id,status:'pending'},{status:202});
 }});
 const bootstrap=await handler(new Request('https://qrupgrade.com/api/art'));
 const cookie=bootstrap.headers.get('set-cookie')!.split(';')[0];
 const post=await withWebEntry({},'192.0.2.1',()=>handler(req({requestId:id,prompt:'Sculptural glass with steel details',style:'steel'},{cookie})));
 assert.equal(post.status,503);
 const recovery=await handler(new Request(`https://qrupgrade.com/api/art?id=${id}`,{headers:{cookie}}));
 assert.equal(recovery.status,202);assert.equal(posts,1);assert.equal(getOwner,postOwner);
});
test('worker rejects unexpected private content and invalid prompt/style/owner before AI',()=>{
 const good={id,owner:'a'.repeat(64),network:'b'.repeat(64),prompt:'Sculptural glass and steel',style:'glass'};
 assert.equal(validateArtInput(good).style,'glass');
 for(const value of [{...good,destination:'private'},{...good,owner:'guessed'},{...good,prompt:'a'.repeat(801)},{...good,prompt:'bad\u0000prompt'},{...good,style:'toString'}])assert.throws(()=>validateArtInput(value));
});
test('worker expires old jobs consistently on GET and duplicate POST',async()=>{
 const old={id,owner:'a'.repeat(64),network:'b'.repeat(64),prompt:'Sculptural glass and steel',style:'glass',state:'ready',image:'data:image/jpeg;base64,AA==',created_at:Date.now()-3600001};
 const DB={prepare:(sql:string)=>({bind:()=>({first:async()=>sql.startsWith('SELECT')?old:null})})};
 const env={SERVICE_SECRET:secret,DB,AI:{},AI_MODEL:'model',DAILY_GLOBAL_LIMIT:'50',DAILY_NETWORK_LIMIT:'3'};
 const headers={authorization:`Bearer ${secret}`,'x-qr-owner':old.owner,'content-type':'application/json'};
 const get=await worker.fetch(new Request(`https://worker.example/art?id=${id}`,{headers}),env,{waitUntil(){}});
 assert.equal(get.status,410);
 const post=await worker.fetch(new Request('https://worker.example/art',{method:'POST',headers,body:JSON.stringify({id,owner:old.owner,network:old.network,prompt:old.prompt,style:old.style})}),env,{waitUntil(){}});
 assert.equal(post.status,410);
});
test('scheduled cleanup removes expired images but retains same-day quota rows',async()=>{
 const realNow=Date.now;
 const now=Date.UTC(2026,8,20,12);
 Date.now=()=>now;
 const rows=[
  {id:'same-day',created_at:now-2*3600000,state:'ready',image:'private-image'},
  {id:'old-metadata',created_at:now-4*86400000,state:'expired',image:null},
 ];
 const DB={
  prepare:(sql:string)=>({all:async()=>({results:[]}),bind:(...args:unknown[])=>({sql,args,run:async()=>({success:true})})}),
  batch:async(statements:{sql:string,args:unknown[]}[])=>{
   const expiry=Number(statements[0].args[0]);
   for(const row of rows)if(row.created_at<expiry&&row.state!=='expired'){row.image=null;row.state='expired';}
   const deletion=Number(statements[1].args[0]);
   for(let index=rows.length-1;index>=0;index--)if(rows[index].created_at<deletion)rows.splice(index,1);
  },
 };
 let cleanup:Promise<unknown>|undefined;
 try{
  await worker.scheduled({}, {DB}, {waitUntil(value:Promise<unknown>){cleanup=value;}});
  await cleanup;
  assert.deepEqual(rows,[{id:'same-day',created_at:now-2*3600000,state:'expired',image:null}]);
 }finally{Date.now=realNow;}
});

test('acknowledged bootstrap renews the same owner beyond a new job recovery window',async()=>{
 const handler=createArtHandler(cfg);
 const value='b'.repeat(64);
 const response=await handler(new Request('https://qrupgrade.com/api/art',{headers:{cookie:'qr-art-session='+value}}));
 const renewed=response.headers.get('set-cookie')!;
 assert.ok(renewed.includes('qr-art-session='+value));
 assert.match(renewed,/Max-Age=7200/);
});

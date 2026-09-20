import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createArtHandler, sameOrigin } from '../src/lib/server/art-service';
import { validateArtInput } from '../workers/qr-service/worker.mjs';
const secret='test-secret-not-a-real-credential'.repeat(2);
const id='0325ab19-ff7e-4e87-943a-6d99064b7700';
const cfg={url:'https://worker.example',secret,production:true};
const req=(body:unknown,extra:Record<string,string>={})=>new Request('https://qrupgrade.com/api/art',{method:'POST',headers:{origin:'https://qrupgrade.com','content-type':'application/json','x-vercel-forwarded-for':'192.0.2.1',...extra},body:JSON.stringify(body)});
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
 const result=await handler(req({requestId:id,prompt:'Sculptural glass with steel details',style:'steel'}));
 assert.equal(result.status,202);assert.equal(target,'https://worker.example/art');
 const input=JSON.parse(sent!.body as string);assert.match(input.owner,/^[a-f0-9]{64}$/);assert.match(input.network,/^[a-f0-9]{64}$/);assert.doesNotMatch(sent!.body as string,/192\.0\.2\.1/);
 const cookie=result.headers.get('set-cookie')!;assert.match(cookie,/HttpOnly; SameSite=Strict/);assert.match(cookie,/; Secure$/);
 assert.doesNotMatch(await result.text(),new RegExp(secret));
 const get=await handler(new Request('https://qrupgrade.com/api/art?id='+id,{headers:{cookie:cookie.split(';')[0]}}));assert.equal(get.status,202);assert.match(String((sent!.headers as Record<string,string>)['x-qr-owner']),/^[a-f0-9]{64}$/);
 assert.equal((await handler(new Request('https://qrupgrade.com/api/art?id='+id))).status,404);
});
test('worker rejects unexpected private content and invalid prompt/style/owner before AI',()=>{
 const good={id,owner:'a'.repeat(64),network:'b'.repeat(64),prompt:'Sculptural glass and steel',style:'glass'};
 assert.equal(validateArtInput(good).style,'glass');
 for(const value of [{...good,destination:'private'},{...good,owner:'guessed'},{...good,prompt:'a'.repeat(801)},{...good,prompt:'bad\u0000prompt'},{...good,style:'toString'}])assert.throws(()=>validateArtInput(value));
});

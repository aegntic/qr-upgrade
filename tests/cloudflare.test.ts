import { test } from 'node:test';
import assert from 'node:assert/strict';
import { guardRequest } from '../cloudflare/guard';
import { runtimeVariable, trustedRequestIp, validProviderIp, withWebEntry } from '../cloudflare/runtime';
import { serviceAvailable, serviceFetch } from '../cloudflare/service';
import { sameOrigin } from '../src/lib/server/art-service';
const request = (path = '/api/unknown', method = 'GET', headers: Record<string,string> = {}) => new Request(`https://qrupgrade.com${path}`, { method, headers: { 'cf-connecting-ip': '192.0.2.1', ...headers } });
test('API guard permits 120, blocks 121; hashes identity and fails closed', async () => {
 let calls = 0;
 const env = { API_RATE_LIMITER: { async limit({key}: {key:string}) { assert.match(key,/^[a-f0-9]{64}$/); return {success: ++calls <= 120}; } } };
 for(let i=0;i<120;i++) assert.equal((await guardRequest(request(),env,async()=>new Response(null,{status:404}))).status,404);
 const blocked=await guardRequest(request(),env,async()=>assert.fail('Must not dispatch'));
 assert.equal(blocked.status,429); assert.equal(blocked.headers.get('retry-after'),'60'); assert.match(blocked.headers.get('cache-control')!,/no-store/);
 for(const env of [{}, { API_RATE_LIMITER: { async limit() { throw new Error('private'); } } }]) assert.equal((await guardRequest(request(),env,async()=>assert.fail())).status,503);
 for(const ip of ['', '192.0.2.1, 192.0.2.2','not-an-ip']) assert.equal((await guardRequest(request('/api/no','GET',{'cf-connecting-ip':ip}),env,async()=>assert.fail())).status,503);
});
test('only exact POST webhook is exempt; API variants and other methods consume the bucket', async()=>{
 let calls=0; const env={API_RATE_LIMITER:{async limit(){calls++;return {success:true};}}};
 await guardRequest(request('/api/billing/webhook','POST'),env,async()=>new Response()); assert.equal(calls,0);
 for(const [path,method] of [['/api/billing/webhook','GET'],['/api/billing/webhook/','POST'],['/api//billing/webhook','POST'],['/api/billing/%77ebhook','POST'],['/api/404','OPTIONS'],['/%61pi/404','POST'],['/api','GET']]) await guardRequest(request(path,method),env,async()=>new Response());
 assert.equal(calls,7);
});
test('provider metadata comes from entry context, ignores spoofed internal hints, and remains request scoped',async()=>{
 const r=request('/api/art','POST',{'x-vercel-forwarded-for':'198.51.100.1','x-forwarded-for':'198.51.100.2','x-qr-network':'spoof','x-real-ip':'198.51.100.3'});
 assert.equal(trustedRequestIp(r,false),null); assert.equal(trustedRequestIp(r,true),'local-development');
 assert.equal(validProviderIp('::1'),'::1'); assert.equal(validProviderIp('192.0.2.1,192.0.2.2'),null);
 const env={QR_SERVICE_SECRET:'runtime-only',API_RATE_LIMITER:{async limit(){return {success:true};}}};
 await guardRequest(r,env,async()=>{assert.equal(trustedRequestIp(r,false),'192.0.2.1'); assert.equal(runtimeVariable('QR_SERVICE_SECRET'),'runtime-only');return new Response();});
 const results=await Promise.all(['192.0.2.5','192.0.2.6'].map(ip=>withWebEntry({},ip,async()=>{await new Promise(resolve=>setTimeout(resolve,5));return trustedRequestIp(r,false);})));assert.deepEqual(results,['192.0.2.5','192.0.2.6']);
 assert.equal(sameOrigin(new Request(r,{headers:{origin:'https://qr-upgrade.vercel.app'}}),{production:true}),false);
});
test('service binding preserves bearer, streams, errors, injected fallback and cancellation',async()=>{
 const secret='synthetic-transport-key-'.repeat(3),config={secret};
 const binding={fetch:(async(_url,init)=>{assert.equal(new Headers(init?.headers).get('authorization'),`Bearer ${secret}`);assert.equal(new Headers(init?.headers).get('x-qr-user'),'owner');return new Response(new Uint8Array([0,255,1]),{status:206});}) as typeof fetch};
 await withWebEntry({QR_SERVICE:binding},null,async()=>{
  assert.equal(serviceAvailable(config),true);
  const r=await serviceFetch(config,'/asset',{headers:{'x-qr-user':'owner',authorization:'attacker'}});assert.equal(r.status,206);assert.deepEqual([...new Uint8Array(await r.arrayBuffer())],[0,255,1]);
  const fallback=await serviceFetch({...config,serviceUrl:'https://test.invalid'},'/asset',{},async url=>{assert.equal(String(url),'https://test.invalid/asset');return new Response(null,{status:409});});assert.equal(fallback.status,409);
 });
 await assert.rejects(()=>serviceFetch(config,'/asset'));
 const deadline=new AbortController();
 const timer=setTimeout(()=>deadline.abort(new DOMException('Fixture deadline','TimeoutError')),10);
 try {
  await assert.rejects(()=>withWebEntry({QR_SERVICE:{fetch:async()=>new Promise(()=>{})}},null,()=>serviceFetch(config,'/slow',{signal:deadline.signal})),{name:'TimeoutError'});
 } finally { clearTimeout(timer); }
});

test('binding response stream retains the caller deadline after response headers arrive',async()=>{
 let cancelled=false;
 const abort=new AbortController();
 const response=await withWebEntry({QR_SERVICE:{fetch:async()=>new Response(new ReadableStream({cancel(){cancelled=true;}}))}},null,()=>serviceFetch({secret:'synthetic-stream-key-'.repeat(3)},'/stream',{signal:abort.signal}));
 const body=response.arrayBuffer();abort.abort(new DOMException('Stopped','AbortError'));
 await assert.rejects(()=>body,{name:'AbortError'});assert.equal(cancelled,true);
});

test('OpenNext API data aliases share the canonical bucket for every method without a webhook exemption',async()=>{
 let calls=0;
 const env={API_RATE_LIMITER:{async limit(){return {success:++calls<=1};}}};
 assert.equal((await guardRequest(request('/api/art'),env,async()=>new Response())).status,200);
 const aliases=['/_next/data/build/api/art.json','/_next/data/build/api/account.json','/_next/data/build/api/billing/webhook.json','/_next/data/build/api.json','/_next/data/build/%61pi/art.json','/_next/data/build//api/art.json'];
 for(const method of ['GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS']) {
  for(const alias of aliases) {
   const response=await guardRequest(request(alias,method),env,async()=>assert.fail('Alias must not dispatch after exhaustion'));
   assert.equal(response.status,429,method+' '+alias);assert.match(response.headers.get('cache-control')!,/no-store/);assert.equal(response.headers.get('x-content-type-options'),'nosniff');
  }
 }
 assert.equal(calls,1+7*aliases.length);
 const canonical=await guardRequest(request('/api/billing/webhook','POST'),env,async()=>new Response(null,{status:204}));
 assert.equal(canonical.status,204);assert.equal(calls,1+7*aliases.length);
});
test('API data aliases fail closed on absent or invalid provider metadata; page data remains unaffected',async()=>{
 const env={API_RATE_LIMITER:{async limit(){assert.fail('Unverified identity must not reach the bucket');}}};
 for(const method of ['GET','POST','HEAD','OPTIONS']) {
  for(const alias of ['/_next/data/build/api/art.json','/_next/data/build/api/billing/webhook.json']) {
   for(const value of [null,'','invalid','192.0.2.1,192.0.2.2']) {
    const headers:Record<string,string>=value===null?{}:{'cf-connecting-ip':value};
    const response=await guardRequest(new Request('https://qrupgrade.com'+alias,{method,headers}),env,async()=>assert.fail('Unverified alias must not dispatch'));
    assert.equal(response.status,503);assert.deepEqual(await response.json(),{error:'Request could not be verified.'});
   }
  }
 }
 const page=await guardRequest(new Request('https://qrupgrade.com/_next/data/build/account.json'),env,async()=>new Response(null,{status:204}));
 assert.equal(page.status,204);
});

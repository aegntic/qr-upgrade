import {validAccountDeps} from './fixtures/account-deps';
import test from 'node:test';
import assert from 'node:assert/strict';
import { accountSameOrigin, callback, cloudProxy, configured, getAccount, login, logout, signAccountToken, boundedCloudBody, MAX_CLOUD_BYTES, type AccountConfig } from '../src/lib/server/account';
import { cloudRequest, validateSnapshot } from '../workers/qr-service/cloud.mjs';
import { newDesign } from '../src/lib/new-design';
const config:AccountConfig={clientId:'test.apps.googleusercontent.com',clientSecret:'private-test',secret:'a'.repeat(64),serviceUrl:'https://service.example',development:true};
const owner='b'.repeat(64),id='11111111-1111-4111-8111-111111111111';
const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';
function snapshot(){return {name:'Test design',draft:{version:1,kind:'website',content:{type:'url',url:'https://example.com',ssid:'',password:'',name:'',email:'',phone:''},mode:'custom',appearance:{foreground:'#000000',background:'#ffffff',quietZone:4,style:'square'},template:'classic',art:'dragon',studyActive:false,customImage:'',logo:'',logoSize:20,logoFrame:'plain',strength:60,sizeMm:50,showUtm:false,utm:{source:'',medium:'',campaign:''},adjustments:{zoom:1,x:50,y:50,opacity:100,brightness:100},caption:{text:'',color:'#ffffff',font:'sans',position:'bottom'},name:'Test design',destinationDrafts:{}},artifact:{png,svg:'<svg/>',pristine:true}};}
function request(method='GET',body?:unknown,path=''){return new Request(`https://service.example/cloud/designs${path}`,{method,headers:{'x-qr-user':owner,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});}
test('credential gate fails closed',async()=>{assert.equal(configured({...config,clientSecret:undefined}),false);assert.equal((await login(new Request('http://localhost:3040/api/account/login'),{...config,clientSecret:undefined})).status,503);assert.equal(await getAccount(new Request('http://localhost:3040'),{...config,secret:undefined}),null);});
test('PKCE login sets bounded HttpOnly cookie and exact callback',async()=>{const r=await login(new Request('http://localhost:3040/api/account/login'),config),url=new URL(r.headers.get('location')!);assert.equal(url.origin,'https://accounts.google.com');assert.equal(url.searchParams.get('redirect_uri'),'http://localhost:3040/api/account/callback');assert.equal(url.searchParams.get('code_challenge_method'),'S256');assert.ok(url.searchParams.get('nonce'));assert.match(r.headers.get('set-cookie')!,/HttpOnly; SameSite=Lax; Path=\/; Max-Age=600/);});
test('verified session rejects tampering and OAuth-purpose tokens',async()=>{const user={sv:1,sub:owner,name:'A User',email:'a@example.com'},token=await signAccountToken(user,'session',config);const req=(t:string)=>new Request('http://localhost:3040',{headers:{cookie:`qr-session=${t}`}});assert.deepEqual(await getAccount(req(token),config,validAccountDeps(owner)),{id:owner,name:'A User',email:'a@example.com'});assert.equal(await getAccount(req(`${token.slice(0,-3)}xxx`),config),null);assert.equal(await getAccount(req(await signAccountToken(user,'oauth',config)),config),null);});
test('state mismatch fails without exchanging provider code and clears state',async()=>{const token=await signAccountToken({state:'expected',nonce:'n',verifier:'v'},'oauth',config);const r=await callback(new Request('http://localhost:3040/api/account/callback?state=wrong&code=never-exchange',{headers:{cookie:`qr-oauth=${token}`}}),config);assert.match(r.headers.get('location')!,/error=signin/);assert.match(r.headers.get('set-cookie')!,/Max-Age=0/);});
test('mutations require exact origin and signed account',async()=>{for(const origin of ['https://evil.example','http://localhost:3041','null'])assert.equal(accountSameOrigin(new Request('http://localhost:3040',{headers:{origin}}),config),false);assert.equal(logout(new Request('http://localhost:3040',{method:'POST'}),config).status,403);assert.equal((await cloudProxy(new Request('http://localhost:3040/api/account/designs'),undefined,config)).status,401);const token=await signAccountToken({sv:1,sub:owner,name:'A',email:'a@example.com'},'session',config);assert.equal((await cloudProxy(new Request('http://localhost:3040/api/account/designs',{method:'POST',headers:{cookie:`qr-session=${token}`,origin:'https://evil.example'}}),undefined,config,{accountDeps:validAccountDeps(owner)})).status,403);});
test('stream limit rejects oversized bodies without trusting Content-Length',async()=>{await assert.rejects(()=>boundedCloudBody(new Request('http://localhost',{method:'POST',headers:{'Content-Type':'application/json'},body:'x'.repeat(MAX_CLOUD_BYTES+1)})));});
test('snapshot strips scan verdicts and SVG, rejects remote images and injected ownership',()=>{assert.deepEqual(validateSnapshot(snapshot()).artifact,{png});for(const source of ['https://evil.example/image.png','data:image/svg+xml;base64,PHN2Zy8+','/unknown.png','data:image/png;base64,PGh0bWw+']){const s=snapshot();s.draft.customImage=source;assert.throws(()=>validateSnapshot(s));}assert.throws(()=>validateSnapshot({...snapshot(),owner}));assert.throws(()=>validateSnapshot({...snapshot(),draft:{...snapshot().draft,sizeMm:NaN}}));});
test('fresh published-link design satisfies the cloud snapshot contract',()=>{
 const draft=newDesign('https://qrupgrade.com/','Release check — editable destination');
 assert.deepEqual(Object.keys(draft.appearance).sort(),['background','foreground','quietZone','style']);
 const saved=validateSnapshot({name:draft.name,draft,artifact:{png}});
 assert.equal(saved.draft.mode,'art');assert.equal(saved.draft.art,'vinyl');assert.equal(saved.draft.content.url,'https://qrupgrade.com/');
});
test('worker rejects absent identity; foreign IDs query with owner and return 404 without R2 access',async()=>{assert.equal((await cloudRequest(new Request('https://service.example/cloud/designs'),{})).status,401);let bound:unknown[]=[];const env={DB:{prepare(sql:string){assert.match(sql,/id=\? AND owner=\?/);return{bind(...v:unknown[]){bound=v;return{first:async()=>null};}};}},ASSETS:{get(){throw new Error('Must not access private object');}}};const r=await cloudRequest(request('GET',undefined,`/${id}`),env);assert.equal(r.status,404);assert.deepEqual(bound,[id,owner]);});
test('quota atomically reserves including archived designs before touching R2',async()=>{let reserved=false;const env={DB:{prepare(sql:string){assert.match(sql,/INSERT INTO cloud_designs.*SELECT COUNT\(\*\).*owner=\?\) < 50/);assert.doesNotMatch(sql,/archived=/);reserved=true;return{bind(){return{first:async()=>null};}};}},ASSETS:{put(){throw new Error('Quota must run first');}}};assert.equal((await cloudRequest(request('POST',snapshot()),env)).status,409);assert.ok(reserved);});
test('failed R2 write rolls back pending metadata reservation',async()=>{
 let deleted=false,objectDeleted=false;
 const env={
  DB:{prepare(sql:string){return {bind(){return {
   first:async()=>sql.startsWith('INSERT')?{id}:null,
   run:async()=>{assert.match(sql,/ready=0/);deleted=true;}
  };}};}},
  ASSETS:{put:async()=>{throw new Error('offline');},delete:async()=>{objectDeleted=true;}}
 };
 assert.equal((await cloudRequest(request('POST',snapshot()),env)).status,503);
 assert.ok(deleted);assert.ok(objectDeleted);
});
test('successful save uses owner-scoped private key and stores only PNG artifact',async()=>{
 let key='',stored='';const now=new Date().toISOString();
 const env={DB:{prepare(sql:string){return {bind(...values:unknown[]){return {first:async()=>{
  if(sql.startsWith('INSERT'))return{id:values[0]};
  assert.match(sql,/AND owner=\? AND r2key=\?/);assert.equal(values[4],owner);
  return{id:values[3],name:values[0],created_at:now,updated_at:now,archived:0,r2key:values[2],ready:1};
 }};}};}},ASSETS:{put:async(k:string,v:string)=>{key=k;stored=v;},delete:async()=>{}}};
 const response=await cloudRequest(request('POST',snapshot()),env);
 assert.equal(response.status,201);assert.match(key,new RegExp(`^accounts/${owner}/`));assert.deepEqual(JSON.parse(stored).artifact,{png});const data=await response.json();assert.equal(data.design.name,'Test design');assert.equal(data.design.archived,false);assert.equal(data.design.r2key,undefined);
});
test('ambiguous committed metadata does not delete the referenced private object',async()=>{
 let key='';const now=new Date().toISOString();
 const env={DB:{prepare(sql:string){return {bind(){return{first:async()=>{
  if(sql.startsWith('INSERT'))return{id};
  if(sql.startsWith('UPDATE'))throw new Error('response lost after commit');
  return{id,owner,name:'Test design',created_at:now,updated_at:now,r2key:key,ready:1};
 },run:async()=>{throw new Error('Must not delete committed metadata');}};}};}},ASSETS:{put:async(k:string)=>{key=k;},delete:async()=>{assert.fail('Must not delete referenced object');}}};
 assert.equal((await cloudRequest(request('POST',snapshot()),env)).status,201);
});

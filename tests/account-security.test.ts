import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import worker from '../workers/qr-service/worker.mjs';
import {recordSecurityEvent,securityCleanupStatements} from '../workers/qr-service/account.mjs';
import {accountSecurity,accountStatus,callback,cloudProxy,getAccount,signAccountToken,type AccountConfig,AccountUnavailable} from '../src/lib/server/account';
import {linksProxy} from '../src/lib/server/links';
import {contentProxy,assetProxy} from '../src/lib/server/content';
import {billingAction,billingStatus} from '../src/lib/server/billing';
const config:AccountConfig={clientId:'fixture.apps.googleusercontent.com',clientSecret:'fixture',secret:'s'.repeat(64),serviceUrl:'https://service.example',development:true};
const owner=createHash('sha256').update('google:verified-subject').digest('hex'),other='b'.repeat(64);
function environment(){
 const sqlite=new DatabaseSync(':memory:');sqlite.exec(readFileSync(new URL('../workers/qr-service/migrations/0006_account_security.sql',import.meta.url),'utf8'));
 const wrap=(sql:string,params:any[]=[])=>({bind:(...values:any[])=>wrap(sql,values),first:async()=>sqlite.prepare(sql).get(...params)||null,all:async()=>({results:sqlite.prepare(sql).all(...params)}),run:async()=>sqlite.prepare(sql).run(...params),sql,params});
 const DB={prepare:wrap,async batch(statements:ReturnType<typeof wrap>[]){sqlite.exec('BEGIN');try{const result=statements.map(s=>({results:sqlite.prepare(s.sql).all(...s.params)}));sqlite.exec('COMMIT');return result;}catch(error){sqlite.exec('ROLLBACK');throw error;}}};
 const env={DB,SERVICE_SECRET:config.secret},deps={fetch:async(input:RequestInfo|URL,init?:RequestInit)=>worker.fetch(new Request(String(input),init),env,{waitUntil(){}})};
 const service=(path:string,method='GET',body?:unknown,user=owner)=>deps.fetch(config.serviceUrl+'/account/'+path,{method,headers:{Authorization:`Bearer ${config.secret}`,'x-qr-user':user,'x-qr-session-version':'1','Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
 return {sqlite,DB,env,deps,service};
}
async function session(version:unknown=1,user=owner){return signAccountToken({sub:user,name:'Fixture',email:'fixture@example.com',...(version===undefined?{}:{sv:version})},'session',config);}
function browser(token:string,method='GET',body?:unknown,headers:Record<string,string>={}){return new Request('http://localhost:3040/api/account/security',{method,headers:{cookie:`qr-session=${token}`,origin:'http://localhost:3040','Content-Type':'application/json',...headers},body:body===undefined?undefined:JSON.stringify(body)});}
async function verifiedLogin(f:ReturnType<typeof environment>,overrides:Record<string,unknown>={}){
 const oauth=await signAccountToken({state:'state',nonce:'nonce',verifier:'verifier'},'oauth',config);
 const request=new Request('http://localhost:3040/api/account/callback?state=state&code=verified',{headers:{cookie:`qr-oauth=${oauth}`}});
 const response=await callback(request,config,{fetch:async(input,init)=>String(input).startsWith('https://oauth2.googleapis.com/')?Response.json({id_token:'test-provider-token'}):f.deps.fetch(input,init),verifyGoogleToken:async()=>({sub:'verified-subject',email:'fixture@example.com',email_verified:true,nonce:'nonce',...overrides})});
 const token=response.headers.getSetCookie().find(value=>value.startsWith('qr-session='))?.split(';')[0].slice('qr-session='.length);
 return {response,token};
}
test('production Worker routing: two browser sessions revoked; replay denied; verified callback issues current version',async()=>{
 const f=environment();try{
 const first=await verifiedLogin(f),second=await verifiedLogin(f,{name:'Second browser'});assert.ok(first.token&&second.token);assert.notEqual(first.token,second.token);
 assert.ok(await getAccount(browser(first.token),config,f.deps));assert.ok(await getAccount(browser(second.token),config,f.deps));
 const revoked=await accountSecurity(browser(first.token,'POST',{confirm:true}),'revoke',config,f.deps);assert.equal(revoked.status,200);assert.equal(revoked.headers.getSetCookie().length,2);for(const value of revoked.headers.getSetCookie())assert.match(value,/Max-Age=0/);
 assert.equal(await getAccount(browser(first.token),config,f.deps),null);assert.equal(await getAccount(browser(second.token),config,f.deps),null);
 assert.equal((await accountSecurity(browser(first.token,'POST',{confirm:true}),'revoke',config,f.deps)).status,401);
 assert.equal((await accountSecurity(browser(first.token),'history',config,f.deps)).status,401);
 const fresh=await verifiedLogin(f);assert.ok(fresh.token);assert.ok(await getAccount(browser(fresh.token),config,f.deps));assert.equal(f.sqlite.prepare('SELECT session_version FROM account_security').get()!.session_version,2);
 assert.equal(f.sqlite.prepare("SELECT count(*) n FROM account_security_events WHERE type='sign_out_everywhere'").get()!.n,1);
 }finally{f.sqlite.close();}
});
test('missing state, legacy, malformed version, tamper and owner mismatch fail closed',async()=>{
 const f=environment();try{
 assert.equal(await getAccount(browser(await session()),config,f.deps),null);assert.equal(f.sqlite.prepare('SELECT count(*) n FROM account_security').get()!.n,0);
 await f.service('sign-in','POST',{});
 for(const version of [null,0,-1,1.5,'1',Number.MAX_SAFE_INTEGER+1])assert.equal(await getAccount(browser(await session(version)),config,f.deps),null);
 const legacy=await signAccountToken({sub:owner,name:'Fixture',email:'fixture@example.com'},'session',config);assert.equal(await getAccount(browser(legacy),config,f.deps),null);
 const token=await session();assert.equal(await getAccount(browser(token.slice(0,-8)+'tampered'),config,f.deps),null);assert.equal(await getAccount(browser(await session(1,other)),config,f.deps),null);
 await assert.rejects(()=>getAccount(browser(token),config,{fetch:async()=>Response.json({owner:other,version:1})}),AccountUnavailable);
 }finally{f.sqlite.close();}
});
test('exact-origin POST, fixed bounded schema and browser identity headers cannot revoke',async()=>{
 const f=environment();try{await f.service('sign-in','POST',{});const token=await session();
 for(const origin of ['https://evil.example','null','http://localhost:3041'])assert.equal((await accountSecurity(browser(token,'POST',{confirm:true},{origin}),'revoke',config,f.deps)).status,403);
 assert.equal((await accountSecurity(browser(token,'POST',{confirm:true},{'sec-fetch-site':'cross-site'}),'revoke',config,f.deps)).status,403);
 assert.equal((await accountSecurity(browser(token),'revoke',config,f.deps)).status,405);
 for(const body of [{},{confirm:false},{confirm:true,owner:other},{confirm:true,version:2},{confirm:true,id:'forged'},[],{confirm:true,extra:'x'.repeat(1024)}])assert.equal((await accountSecurity(browser(token,'POST',body),'revoke',config,f.deps)).status,400);
 for(const header of ['x-qr-user','x-qr-session-version','x-qr-owner'])assert.equal((await accountSecurity(browser(token,'POST',{confirm:true},{[header]:other}),'revoke',config,f.deps)).status,400);
 assert.equal(f.sqlite.prepare('SELECT session_version FROM account_security').get()!.session_version,1);
 }finally{f.sqlite.close();}
});
test('service bearer protects registration, history, session reads and revocation',async()=>{
 const f=environment();try{for(const path of ['sign-in','history','session','revoke']){
 const result=await worker.fetch(new Request(`${config.serviceUrl}/account/${path}`,{headers:{'x-qr-user':owner,Authorization:'Bearer forged'}}),f.env,{waitUntil(){}});assert.equal(result.status,401);
 }assert.equal(f.sqlite.prepare('SELECT count(*) n FROM account_security').get()!.n,0);
 assert.equal((await f.service('sign-in','POST',{owner:other})).status,400);assert.equal((await f.service('events','POST',{type:'sign_in'})).status,404);
 }finally{f.sqlite.close();}
});
test('history isolates owners; records fixed fields; insert and scheduled pruning retain durable state',async()=>{
 const f=environment();try{await f.service('sign-in','POST',{});await f.service('sign-in','POST',{},other);
 const insert=f.sqlite.prepare('INSERT INTO account_security_events VALUES(?,?,?,?)');for(let n=0;n<110;n++)insert.run(crypto.randomUUID(),owner,'sign_in',Date.now()-n);insert.run(crypto.randomUUID(),owner,'sign_in',Date.now()-31*86400000);
 await recordSecurityEvent(f.env,owner,'data_export');await assert.rejects(()=>recordSecurityEvent(f.env,owner,'arbitrary private text'));
 let response=await accountSecurity(browser(await session()),'history',config,f.deps),body=await response.json();assert.equal(response.status,200);assert.equal(body.events.length,100);assert.deepEqual(Object.keys(body.events[0]).sort(),['created_at','id','type']);assert.equal(body.retentionDays,30);assert.equal(f.sqlite.prepare('SELECT count(*) n FROM account_security_events WHERE owner=?').get(owner)!.n,100);
 body=await(await accountSecurity(browser(await session(1,other)),'history',config,f.deps)).json();assert.equal(body.events.length,1);
 f.sqlite.prepare('UPDATE account_security_events SET created_at=0').run();await f.DB.batch(securityCleanupStatements(f.env));assert.equal(f.sqlite.prepare('SELECT count(*) n FROM account_security_events').get()!.n,0);assert.equal(f.sqlite.prepare('SELECT count(*) n FROM account_security').get()!.n,2);
 }finally{f.sqlite.close();}
});
test('concurrent duplicate revocations increment exactly once and cannot reinstate prior versions',async()=>{
 const f=environment();try{await f.service('sign-in','POST',{});const results=await Promise.all([f.service('revoke','POST',{version:1}),f.service('revoke','POST',{version:1})]);assert.deepEqual(results.map(r=>r.status).sort(),[200,401]);
 assert.equal(f.sqlite.prepare('SELECT session_version FROM account_security').get()!.session_version,2);await f.service('sign-in','POST',{});assert.equal((await f.service('revoke','POST',{version:1})).status,401);assert.equal((await f.service('revoke','POST',{version:2})).status,200);assert.equal(await getAccount(browser(await session(2)),config,f.deps),null);
 }finally{f.sqlite.close();}
});
test('callback provider verification or central state failure never sets a session cookie',async()=>{
 const f=environment();try{for(const overrides of [{email_verified:false},{nonce:'wrong'},{azp:'wrong'}]){const result=await verifiedLogin(f,overrides);assert.equal(result.token,undefined);assert.match(result.response.headers.get('location')!,/error=signin/);}
 assert.equal(f.sqlite.prepare('SELECT count(*) n FROM account_security').get()!.n,0);f.deps.fetch=async()=>{throw new Error('private database detail');};const failed=await verifiedLogin(f);assert.equal(failed.token,undefined);assert.match(failed.response.headers.get('location')!,/error=unavailable/);
 }finally{f.sqlite.close();}
});
test('outages return 503 across all account consumers without clearing cookies or claiming data loss',async()=>{
 const token=await session(),deps={fetch:async()=>{throw new Error('private outage');}},request=()=>browser(token);
 for(const response of [await accountStatus(request(),config,deps),await accountSecurity(request(),'history',config,deps),await accountSecurity(browser(token,'POST',{confirm:true}),'revoke',config,deps),await cloudProxy(request(),undefined,config,{accountDeps:deps}),await linksProxy(request(),undefined,config,{accountDeps:deps}),await contentProxy(request(),undefined,config,false,{accountDeps:deps}),await assetProxy(request(),undefined,config,{accountDeps:deps}),await billingStatus(request(),{account:config,enabled:false},deps),await billingAction(request(),'portal',{account:config,enabled:false},deps)]){assert.equal(response.status,503);assert.equal(response.headers.get('set-cookie'),null);const text=await response.text();assert.match(text,/temporarily unavailable/);assert.doesNotMatch(text,/private outage|signedIn/);}
});
test('revocation response loss fails safely and preserves durable denial',async()=>{
 const f=environment();try{await f.service('sign-in','POST',{});const token=await session();const response=await accountSecurity(browser(token,'POST',{confirm:true}),'revoke',config,{fetch:async(input,init)=>{const result=await f.deps.fetch(input,init);if(String(input).endsWith('/revoke'))throw new Error('response lost');return result;}});assert.equal(response.status,503);assert.equal(response.headers.get('set-cookie'),null);assert.equal(await getAccount(browser(token),config,f.deps),null);
 }finally{f.sqlite.close();}
});
test('revocation and sign-in transactions roll back if security event insertion fails',async()=>{
 const f=environment();try{await f.service('sign-in','POST',{});const token=await session();f.sqlite.exec("CREATE TRIGGER fail_events BEFORE INSERT ON account_security_events BEGIN SELECT RAISE(ABORT,'fixture event failure'); END");
 const failed=await accountSecurity(browser(token,'POST',{confirm:true}),'revoke',config,f.deps);assert.equal(failed.status,503);assert.equal(failed.headers.get('set-cookie'),null);assert.ok(await getAccount(browser(token),config,f.deps));assert.equal(f.sqlite.prepare('SELECT session_version FROM account_security').get()!.session_version,1);
 assert.equal((await f.service('sign-in','POST',{},other)).status,503);assert.equal(f.sqlite.prepare('SELECT count(*) n FROM account_security WHERE owner=?').get(other)!.n,0);
 }finally{f.sqlite.close();}
});
test('Worker scheduled cleanup prunes expired and excess events, preserving durable revocation rows',async()=>{
 const f=environment();try{f.sqlite.exec(readFileSync(new URL('../workers/qr-service/migrations/0001_art_jobs.sql',import.meta.url),'utf8'));await f.service('sign-in','POST',{});
 const insert=f.sqlite.prepare('INSERT INTO account_security_events VALUES(?,?,?,?)');for(let n=0;n<110;n++)insert.run(crypto.randomUUID(),owner,'sign_in',Date.now()-n);insert.run(crypto.randomUUID(),owner,'sign_in',0);
 let work:Promise<unknown>|undefined;await worker.scheduled({},f.env,{waitUntil(p:Promise<unknown>){work=p;}});await work;
 assert.equal(f.sqlite.prepare('SELECT count(*) n FROM account_security_events').get()!.n,100);assert.equal(f.sqlite.prepare('SELECT count(*) n FROM account_security_events WHERE created_at=0').get()!.n,0);assert.equal(f.sqlite.prepare('SELECT session_version FROM account_security').get()!.session_version,1);
 }finally{f.sqlite.close();}
});

// Only the bearer-protected dispatcher calls this handler. Browser identity is never forwarded.
const ownerPattern=/^[a-f0-9]{64}$/;
const types=new Set(['sign_in','sign_out_everywhere','data_export','account_deletion']);
export const SECURITY_HISTORY_DAYS=30;
export const SECURITY_HISTORY_LIMIT=100;
const reply=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export async function readAccountBody(request){
 if(request.headers.get('content-type')?.split(';')[0]!=='application/json')throw new Error('JSON required');
 const reader=request.body?.getReader();if(!reader)throw new Error('Missing body');
 let size=0,timer;const chunks=[];
 const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>{reject(new Error('Timeout'));void reader.cancel();},5000);});
 try{while(true){const item=await Promise.race([reader.read(),timeout]);if(item.done)break;size+=item.value.length;if(size>1024){void reader.cancel();throw new Error('Too large');}chunks.push(item.value);}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
 const body=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));if(!body||typeof body!=='object'||Array.isArray(body))throw new Error('Invalid body');return body;
 }finally{clearTimeout(timer);reader.releaseLock();}
}
function pruneOwner(env,owner,now){return [
 env.DB.prepare('DELETE FROM account_security_events WHERE owner=? AND created_at<?').bind(owner,now-SECURITY_HISTORY_DAYS*86400000),
 env.DB.prepare('DELETE FROM account_security_events WHERE owner=? AND id NOT IN (SELECT id FROM account_security_events WHERE owner=? ORDER BY created_at DESC,id DESC LIMIT 100)').bind(owner,owner)
 ];}
// Internal extension point only; deliberately no generic event HTTP endpoint.
export async function recordSecurityEvent(env,owner,type){
 if(!ownerPattern.test(owner)||!types.has(type))throw new Error('Invalid security event');
 const now=Date.now();await env.DB.batch([
 env.DB.prepare('INSERT INTO account_security_events(id,owner,type,created_at) SELECT ?,owner,?,? FROM account_security WHERE owner=?').bind(crypto.randomUUID(),type,now,owner),
 ...pruneOwner(env,owner,now)
 ]);
}
export function securityCleanupStatements(env,now=Date.now()){return [
 env.DB.prepare('DELETE FROM account_security_events WHERE created_at<?').bind(now-SECURITY_HISTORY_DAYS*86400000),
 env.DB.prepare('DELETE FROM account_security_events WHERE id IN (SELECT id FROM (SELECT id,ROW_NUMBER() OVER (PARTITION BY owner ORDER BY created_at DESC,id DESC) AS rank FROM account_security_events) WHERE rank>100)')
 ];}
export async function accountRequest(request,env){
 const owner=request.headers.get('x-qr-user');if(!ownerPattern.test(owner||''))return reply({error:'Invalid owner.'},401);
 const path=new URL(request.url).pathname;
 if(path==='/account/session'&&request.method==='GET'){
 const row=await env.DB.prepare('SELECT owner,session_version FROM account_security WHERE owner=?').bind(owner).first();
 return row?reply({owner:row.owner,version:row.session_version}):reply({error:'Session unavailable.'},401);
 }
 if(path==='/account/history'&&request.method==='GET'){
 const version=Number(request.headers.get('x-qr-session-version'));
 if(!Number.isSafeInteger(version)||version<1)return reply({error:'Invalid session.'},401);
 const row=await env.DB.prepare('SELECT owner FROM account_security WHERE owner=? AND session_version=?').bind(owner,version).first();if(!row)return reply({error:'Sign in again.'},401);
 const data=await env.DB.prepare('SELECT id,type,created_at FROM account_security_events WHERE owner=? AND created_at>=? ORDER BY created_at DESC,id DESC LIMIT 100').bind(owner,Date.now()-SECURITY_HISTORY_DAYS*86400000).all();
 return reply({events:data.results,retentionDays:SECURITY_HISTORY_DAYS,limit:SECURITY_HISTORY_LIMIT});
 }
 if(!['/account/sign-in','/account/revoke'].includes(path)||request.method!=='POST')return reply({error:'Not found.'},404);
 let body;try{body=await readAccountBody(request);}catch{return reply({error:'Invalid request.'},400);}
 const now=Date.now(),eventId=crypto.randomUUID();
 if(path==='/account/sign-in'){
 if(Object.keys(body).length)return reply({error:'Invalid request.'},400);
 // This registration path is called exclusively after successful Google verification.
 const result=await env.DB.batch([
 env.DB.prepare('INSERT INTO account_security(owner,session_version) VALUES(?,1) ON CONFLICT(owner) DO UPDATE SET session_version=account_security.session_version RETURNING owner,session_version').bind(owner),
 env.DB.prepare("INSERT INTO account_security_events(id,owner,type,created_at) VALUES(?,?,'sign_in',?)").bind(eventId,owner,now),
 ...pruneOwner(env,owner,now)
 ]);
 const row=result[0].results[0];return reply({owner:row.owner,version:row.session_version});
 }
 if(Object.keys(body).length!==1||!Number.isSafeInteger(body.version)||body.version<1||body.version>=Number.MAX_SAFE_INTEGER)return reply({error:'Invalid request.'},400);
 // Compare-and-increment and its event share a transaction. A replay cannot bump or restore access.
 const result=await env.DB.batch([
 env.DB.prepare('UPDATE account_security SET session_version=session_version+1 WHERE owner=? AND session_version=? RETURNING session_version').bind(owner,body.version),
 env.DB.prepare("INSERT INTO account_security_events(id,owner,type,created_at) SELECT ?,?,'sign_out_everywhere',? WHERE changes()=1").bind(eventId,owner,now),
 ...pruneOwner(env,owner,now)
 ]);
 return result[0].results.length?reply({revoked:true}):reply({error:'Sign in again.'},401);
}

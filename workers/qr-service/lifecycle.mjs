// Bearer-protected handlers only. A missing row is a legacy active public owner.
export async function ownerClosed(env,owner){return !!await env.DB.prepare("SELECT owner FROM account_security WHERE owner=? AND lifecycle='closed'").bind(owner).first();}
export async function privateSession(request,env){
 const owner=request.headers.get('x-qr-user'),version=Number(request.headers.get('x-qr-session-version'));
 if(!/^[a-f0-9]{64}$/.test(owner||'')||!Number.isSafeInteger(version)||version<1)return false;
 return !!await env.DB.prepare("SELECT owner FROM account_security WHERE owner=? AND session_version=? AND lifecycle='active'").bind(owner,version).first();
}
export async function journalUpload(env,owner,version,key){
 await env.DB.prepare("INSERT INTO account_uploads(r2key,owner,version,state) VALUES(?,?,?,'pending')").bind(key,owner,version).run();
}
export async function settleUpload(env,owner,key){
 // A successful put remains attributable even if closure or the metadata commit raced it.
 await env.DB.prepare("UPDATE account_uploads SET state='settled' WHERE owner=? AND r2key=?").bind(owner,key).run();
 if(await ownerClosed(env,owner)){
  await env.DB.batch([
   env.DB.prepare('INSERT OR IGNORE INTO account_deletion_objects(owner,r2key) VALUES(?,?)').bind(owner,key),
   env.DB.prepare('UPDATE account_deletions SET complete=0,scanned=0 WHERE owner=?').bind(owner)
  ]);
  return false;
 }
 return true;
}
export async function deleteUnreferencedObject(env,owner,key){
 const reference=await env.DB.prepare('SELECT 1 AS present FROM cloud_designs WHERE r2key=? UNION ALL SELECT 1 FROM content_assets WHERE r2key=? UNION ALL SELECT 1 FROM account_uploads WHERE r2key=? AND owner<>? LIMIT 1').bind(key,key,key,owner).first();
 if(reference||key.startsWith('deletion-ledger/'))return false;
 await env.ASSETS.delete(key);
 await env.DB.prepare("DELETE FROM account_uploads WHERE owner=? AND r2key=? AND state='settled'").bind(owner,key).run();
 return true;
}

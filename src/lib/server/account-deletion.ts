import {createHash,randomBytes} from 'node:crypto';
import type {JWTPayload} from 'jose';
import {accountConfig,configured,accountOrigin,accountSameOrigin,accountReply,accountUnavailable,currentSession,readCookie,cookie,signAccountToken,verifyToken,type AccountConfig,type AccountDeps,type CallbackDeps} from './account';
import {readAccountBody} from '../../../workers/qr-service/account.mjs';
import {billingConfig,checkClosureBilling,ClosureBillingBlocked,type BillingConfig,type BillingDeps} from './billing';
const hash=/^[a-f0-9]{64}$/;
type Proof={owner:string;version:number;intent:string};
async function proof(r:Request,c:AccountConfig,purpose:'deletion-intent'|'deletion-status'):Promise<Proof|null>{
 try{const value=readCookie(r,c,purpose);if(!value||value.length>4096)return null;const p=await verifyToken(value,purpose,c);if(!hash.test(String(p.owner))||!hash.test(String(p.intent))||!Number.isSafeInteger(p.version)||Number(p.version)<1)return null;return {owner:String(p.owner),version:Number(p.version),intent:String(p.intent)};}catch{return null;}
}
async function service(c:AccountConfig,d:AccountDeps,p:Proof,path:string,body?:unknown){
 return (d.fetch||fetch)(`${c.serviceUrl!.replace(/\/$/,'')}/account/deletion/${path}`,{method:body===undefined?'GET':'POST',headers:{Authorization:`Bearer ${c.secret}`,'x-qr-user':p.owner,'x-qr-deletion-id':p.intent,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(10000),cache:'no-store'});
}
function validBrowser(r:Request,c:AccountConfig,post=false){return !new URL(r.url).search&&![...r.headers.keys()].some(name=>name.startsWith('x-qr-'))&&(!post||accountSameOrigin(r,c));}
async function confirmation(r:Request){try{const b=await readAccountBody(r);return Object.keys(b).length===1&&b.confirm===true;}catch{return false;}}
export async function beginDeletion(r:Request,c=accountConfig(),d:AccountDeps={}){
 if(r.method!=='POST')return accountReply({error:'Method not allowed.'},405);
 if(!validBrowser(r,c,true))return accountReply({error:'Open Account to confirm account closure.'},403);
 if(!await confirmation(r))return accountReply({error:'Confirm that you want to close this account.'},400);
 try{
  const session=await currentSession(r,c,d);if(!session)return accountReply({error:'Sign in before closing your account.'},401);
  const state=randomBytes(32).toString('base64url'),nonce=randomBytes(32).toString('base64url'),verifier=randomBytes(48).toString('base64url');
  const url=new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.search=new URLSearchParams({client_id:c.clientId!,redirect_uri:`${accountOrigin(c)}/api/account/callback`,response_type:'code',scope:'openid email profile',state,nonce,code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256',prompt:'select_account',max_age:'0'}).toString();
  const response=accountReply({url:url.toString()});
  response.headers.append('Set-Cookie',cookie(c,'oauth',await signAccountToken({state,nonce,verifier,action:'delete',owner:session.id,version:session.version,started:Math.floor(Date.now()/1000)},'oauth',c),600));
  response.headers.append('Set-Cookie',cookie(c,'deletion-intent','',0));return response;
 }catch{return accountReply({error:'Closure verification is temporarily unavailable. Please try again. Your cookies have been retained.'},503);}
}
// Called only after the ordinary callback's PKCE exchange, signature, nonce and identity checks.
export async function finishDeletionVerification(r:Request,c:AccountConfig,d:CallbackDeps,oauth:JWTPayload,google:JWTPayload,owner:string){
 const session=await currentSession(r,c,d),now=Math.floor(Date.now()/1000);
 if(!session||session.id!==owner||oauth.owner!==owner||oauth.version!==session.version||!Number.isSafeInteger(oauth.started)||!Number.isSafeInteger(google.auth_time)||Number(google.auth_time)<Number(oauth.started)-60||Number(google.auth_time)>now+60||Number(google.auth_time)<now-300)throw new Error('Fresh same-account sign-in required');
 const p:Proof={owner,version:session.version,intent:randomBytes(32).toString('hex')};
 const response=await service(c,d,p,'intent',{version:p.version,intent:p.intent});if(!response.ok||(await response.json()).intent!==p.intent)throw new Error('Verification could not be saved');
 const redirect=new Response(null,{status:303,headers:{Location:`${accountOrigin(c)}/account?closure=confirm`,'Cache-Control':'no-store'}});
 redirect.headers.append('Set-Cookie',cookie(c,'oauth','',0));
 redirect.headers.append('Set-Cookie',cookie(c,'deletion-intent',await signAccountToken(p,'deletion-intent',c),300));
 // This status-only receipt exists before acceptance so a lost response can be recovered safely.
 redirect.headers.append('Set-Cookie',cookie(c,'deletion-status',await signAccountToken(p,'deletion-status',c),30*86400));return redirect;
}
async function readStatus(c:AccountConfig,d:AccountDeps,p:Proof){const response=await service(c,d,p,'status');if(!response.ok)throw new Error();const data=await response.json();if(typeof data.accepted!=='boolean'||typeof data.complete!=='boolean'||!['not_started','pending','complete'].includes(data.cleanup)||data.complete!==(data.cleanup==='complete')||data.accepted!==(data.cleanup!=='not_started'))throw new Error();return data;}
function acceptedResponse(c:AccountConfig,data:{accepted:boolean;complete:boolean;cleanup:string}){
 const response=accountReply(data,202);
 for(const purpose of ['session','oauth','deletion-intent'])response.headers.append('Set-Cookie',cookie(c,purpose,'',0));
 return response;
}
export async function deletionStatus(r:Request,c=accountConfig(),d:AccountDeps={}){
 if(r.method!=='GET')return accountReply({error:'Method not allowed.'},405);
 if(!validBrowser(r,c))return accountReply({error:'Invalid request.'},400);
 if(!configured(c))return accountUnavailable();
 try{const receipt=await proof(r,c,'deletion-status');if(receipt){const data=await readStatus(c,d,receipt);if(data.accepted)return acceptedResponse(c,data);}
  const p=await proof(r,c,'deletion-intent'),session=p?await currentSession(r,c,d):null;
  return accountReply({accepted:false,complete:false,cleanup:'not_started',ready:!!p&&session?.id===p.owner&&session?.version===p.version});
 }catch{return accountReply({error:'Closure status could not be confirmed. Please try again. Your cookies have been retained.'},503);}
}
export async function closeAccount(r:Request,c=accountConfig(),d:AccountDeps&BillingDeps={},bc:BillingConfig={...billingConfig(),account:c}){
 if(r.method!=='POST')return accountReply({error:'Method not allowed.'},405);
 if(!validBrowser(r,c,true))return accountReply({error:'Open Account to confirm account closure.'},403);
 if(!await confirmation(r))return accountReply({error:'Confirm account closure.'},400);
 try{
  const receipt=await proof(r,c,'deletion-status');if(receipt){const data=await readStatus(c,d,receipt);if(data.accepted)return acceptedResponse(c,data);}
  const p=await proof(r,c,'deletion-intent'),session=p?await currentSession(r,c,d):null;
  if(!p||!session||session.id!==p.owner||session.version!==p.version)return accountReply({error:'Verify the same Google account again before confirming closure.'},401);
  const binding=await checkClosureBilling(p.owner,p.version,bc,d);
  const response=await service(c,d,p,'start',{intent:p.intent,version:p.version,binding});
  if(response.status===409)return accountReply({error:'Closure was not accepted. Check Billing and verify your account again; a checkout or account change may be in progress.'},409);
  if(!response.ok)throw new Error();const data=await response.json();if(data.accepted!==true||typeof data.complete!=='boolean'||!['pending','complete'].includes(data.cleanup))throw new Error();
  return acceptedResponse(c,data);
 }catch(error){return accountReply({error:error instanceof ClosureBillingBlocked?error.message:'Closure could not be confirmed because account security, storage or Billing is unavailable. Try again; status will recover an accepted request. Your cookies have been retained.'},error instanceof ClosureBillingBlocked?409:503);}
}

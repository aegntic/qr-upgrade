import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { createRemoteJWKSet, jwtVerify, SignJWT } from 'jose';
import type {BillingConfig,BillingDeps} from './billing';
import {readAccountBody} from '../../../workers/qr-service/account.mjs';
import type {JWTPayload} from 'jose';

const JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'), { timeoutDuration: 5000 });
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
export const MAX_CLOUD_BYTES = 3 * 1024 * 1024;
export type Account = { id: string; name: string; email: string };
export type AccountConfig = { clientId?: string; clientSecret?: string; secret?: string; serviceUrl?: string; development: boolean };
export type EntitlementOptions={config?:BillingConfig;deps?:BillingDeps;accountDeps?:AccountDeps};
export function accountConfig(): AccountConfig { return {clientId:process.env.GOOGLE_CLIENT_ID,clientSecret:process.env.GOOGLE_CLIENT_SECRET,secret:process.env.QR_SERVICE_SECRET,serviceUrl:process.env.QR_SERVICE_URL,development:process.env.NODE_ENV==='development'}; }
export function configured(c=accountConfig()) { return !!(c.clientId&&c.clientSecret&&c.secret&&c.secret.length>=32&&c.serviceUrl); }
export function accountOrigin(c=accountConfig()) { return c.development?'http://localhost:3040':'https://qrupgrade.com'; }
export function accountSameOrigin(r:Request,c=accountConfig()) { return r.headers.get('origin')===accountOrigin(c)&&r.headers.get('sec-fetch-site')!=='cross-site'; }
export function accountReply(body:unknown,status=200) { return Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}}); }
function key(c:AccountConfig,purpose:string) { if(!c.secret||c.secret.length<32)throw new Error('Not configured');return createHmac('sha256',c.secret).update(`qr-upgrade:account:${purpose}:v1`).digest(); }
function cookieName(c:AccountConfig,purpose:string) { return `${c.development?'':'__Host-'}qr-${purpose}`; }
function readCookie(r:Request,c:AccountConfig,purpose:string) { return (r.headers.get('cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(`${cookieName(c,purpose)}=`))?.split('=').slice(1).join('='); }
function cookie(c:AccountConfig,purpose:string,value:string,age:number) { return `${cookieName(c,purpose)}=${value}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${age}${c.development?'':'; Secure'}`; }
export async function signAccountToken(payload:Record<string,unknown>,purpose:'session'|'oauth',c=accountConfig()) { return new SignJWT(payload).setProtectedHeader({alg:'HS256'}).setIssuer('qrupgrade').setAudience(purpose).setIssuedAt().setExpirationTime(purpose==='session'?'7d':'10m').sign(key(c,purpose)); }
async function verifyToken(token:string,purpose:string,c:AccountConfig) { return (await jwtVerify(token,key(c,purpose),{algorithms:['HS256'],issuer:'qrupgrade',audience:purpose,requiredClaims:['exp','iat']})).payload; }
export type AccountDeps={fetch?:typeof fetch};
export type CallbackDeps=AccountDeps & {verifyGoogleToken?:(token:string,c:AccountConfig)=>Promise<JWTPayload>};
export class AccountUnavailable extends Error {}
export const accountUnavailable=()=>accountReply({error:'Account security is temporarily unavailable. Please try again. Your saved designs remain stored.'},503);
async function securityService(path:string,owner:string,c:AccountConfig,deps:AccountDeps={},body?:unknown,version?:number){
 try{
 const result=await(deps.fetch||fetch)(`${c.serviceUrl!.replace(/\/$/,'')}/account/${path}`,{method:body===undefined?'GET':'POST',headers:{Authorization:`Bearer ${c.secret}`,'x-qr-user':owner,'Content-Type':'application/json',...(version===undefined?{}:{'x-qr-session-version':String(version)})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(5000),cache:'no-store'});
 // Never interpret service-bearer rejection (401) as a browser account transition.
 if(result.status===409&&['session','history','revoke'].includes(path)){
 const denial=await result.json();
 if(denial&&typeof denial==='object'&&!Array.isArray(denial)&&Object.keys(denial).length===2&&denial.code==='account_session_invalid'&&denial.owner===owner)return null;
 throw new Error('Invalid session denial');
 }
 if(!result.ok)throw new Error();return await result.json();
 }catch{throw new AccountUnavailable('Account security unavailable');}
}
async function signedSession(r:Request,c:AccountConfig){
 if(!configured(c))return null;
 try{const token=readCookie(r,c,'session');if(!token||token.length>4096)return null;const p=await verifyToken(token,'session',c);
 if(typeof p.sub!=='string'||!/^[a-f0-9]{64}$/.test(p.sub)||typeof p.name!=='string'||p.name.length>120||typeof p.email!=='string'||p.email.length>254||!Number.isSafeInteger(p.sv)||Number(p.sv)<1)return null;
 return {id:p.sub,name:p.name,email:p.email,version:Number(p.sv)};
 }catch{return null;}
}
export async function currentSession(r:Request,c:AccountConfig,deps:AccountDeps={}){
 const session=await signedSession(r,c);if(!session)return null;
 const state=await securityService('session',session.id,c,deps);
 if(!state)return null;
 if(state.owner!==session.id||!Number.isSafeInteger(state.version)||state.version<1)throw new AccountUnavailable('Invalid security response');
 return state.version===session.version?session:null;
}
export async function getAccount(r:Request,c=accountConfig(),deps:AccountDeps={}):Promise<Account|null>{
 const session=await currentSession(r,c,deps);return session?{id:session.id,name:session.name,email:session.email}:null;
}
// Route consumers keep service failure distinct from an absent or revoked session.
export async function checkedAccount(r:Request,c=accountConfig(),deps:AccountDeps={}):Promise<Account|null|Response>{
 try{return await getAccount(r,c,deps);}catch{return accountUnavailable();}
}
export async function accountStatus(r:Request,c=accountConfig(),deps:AccountDeps={}){
 const user=await checkedAccount(r,c,deps);if(user instanceof Response)return user;
 return accountReply({configured:configured(c),signedIn:!!user,user:user?{name:user.name,email:user.email}:null});
}
export async function accountSecurity(r:Request,action:'history'|'revoke',c=accountConfig(),deps:AccountDeps={}){
 if(r.method!==(action==='history'?'GET':'POST'))return accountReply({error:'Method not allowed.'},405);
 if(action==='revoke'&&!accountSameOrigin(r,c))return accountReply({error:'Open your account to sign out everywhere.'},403);
 if([...r.headers.keys()].some(name=>name.startsWith('x-qr-')))return accountReply({error:'Invalid request.'},400);
 if(action==='revoke')try{const body=await readAccountBody(r);if(Object.keys(body).length!==1||body.confirm!==true)throw new Error();}catch{return accountReply({error:'Confirm sign out everywhere.'},400);}
 try{
 const session=await currentSession(r,c,deps);if(!session)return accountReply({error:'Sign in again to access account security.'},401);
 const data=await securityService(action,session.id,c,deps,action==='revoke'?{version:session.version}:undefined,session.version);
 if(!data)return accountReply({error:'Sign in again to access account security.'},401);
 if(action==='history')return accountReply(data);
 if(data.revoked!==true)throw new AccountUnavailable();
 const response=accountReply({signedIn:false,revoked:true});response.headers.append('Set-Cookie',cookie(c,'session','',0));response.headers.append('Set-Cookie',cookie(c,'oauth','',0));return response;
 }catch{return accountUnavailable();}
}

function redirect(c:AccountConfig,error?:string) { return new Response(null,{status:303,headers:{Location:`${accountOrigin(c)}/account${error?'?error=signin':''}`,'Cache-Control':'no-store'}}); }
export async function login(r:Request,c=accountConfig()) {
 if(!configured(c))return accountReply({error:'Google sign-in is not configured yet.'},503);
 // The callback and its host-only cookie must share the canonical origin.
 if(new URL(r.url).origin!==accountOrigin(c))return Response.redirect(`${accountOrigin(c)}/api/account/login`,303);
 const state=randomBytes(32).toString('base64url'),nonce=randomBytes(32).toString('base64url'),verifier=randomBytes(48).toString('base64url');
 const url=new URL('https://accounts.google.com/o/oauth2/v2/auth');
 url.search=new URLSearchParams({client_id:c.clientId!,redirect_uri:`${accountOrigin(c)}/api/account/callback`,response_type:'code',scope:'openid email profile',state,nonce,code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256',prompt:'select_account'}).toString();
 return new Response(null,{status:303,headers:{Location:url.toString(),'Cache-Control':'no-store','Set-Cookie':cookie(c,'oauth',await signAccountToken({state,nonce,verifier},'oauth',c),600)}});
}
export async function callback(r:Request,c=accountConfig(),deps:CallbackDeps={}) {
 const response=redirect(c);response.headers.append('Set-Cookie',cookie(c,'oauth','',0));
 try {
  if(!configured(c)||new URL(r.url).origin!==accountOrigin(c))throw new Error();const q=new URL(r.url).searchParams,token=readCookie(r,c,'oauth');if(!token||token.length>4096||q.has('error'))throw new Error();
  const p=await verifyToken(token,'oauth',c),state=q.get('state'),code=q.get('code');
  if(typeof p.state!=='string'||typeof p.nonce!=='string'||typeof p.verifier!=='string'||!state||state.length!==p.state.length||!timingSafeEqual(Buffer.from(state),Buffer.from(p.state))||!code||code.length>4096)throw new Error();
  const exchange=await(deps.fetch||fetch)('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:c.clientId!,client_secret:c.clientSecret!,redirect_uri:`${accountOrigin(c)}/api/account/callback`,grant_type:'authorization_code',code,code_verifier:p.verifier}),signal:AbortSignal.timeout(10000),cache:'no-store'});
  if(!exchange.ok)throw new Error();const tokens=await exchange.json();if(typeof tokens.id_token!=='string')throw new Error();
  const payload=deps.verifyGoogleToken?await deps.verifyGoogleToken(tokens.id_token,c):(await jwtVerify(tokens.id_token,JWKS,{algorithms:['RS256'],issuer:['https://accounts.google.com','accounts.google.com'],audience:c.clientId!,requiredClaims:['sub','exp','iat','nonce','email','email_verified']})).payload;
  if(payload.nonce!==p.nonce||payload.email_verified!==true||!payload.sub||payload.sub.length>255||typeof payload.email!=='string'||payload.email.length>254||(payload.azp!==undefined&&payload.azp!==c.clientId))throw new Error();
  const user={sub:createHash('sha256').update(`google:${payload.sub}`).digest('hex'),email:payload.email,name:typeof payload.name==='string'?payload.name.slice(0,120):'Your account'};
  const security=await securityService('sign-in',user.sub,c,deps,{});if(!security||security.owner!==user.sub||!Number.isSafeInteger(security.version)||security.version<1)throw new AccountUnavailable();
  response.headers.append('Set-Cookie',cookie(c,'session',await signAccountToken({...user,sv:security.version},'session',c),604800));
 } catch(error) { response.headers.set('Location',`${accountOrigin(c)}/account?error=${error instanceof AccountUnavailable?'unavailable':'signin'}`); }
 return response;
}
export function logout(r:Request,c=accountConfig()) { if(!accountSameOrigin(r,c))return accountReply({error:'Open your account to sign out.'},403);const response=accountReply({signedIn:false});response.headers.append('Set-Cookie',cookie(c,'session','',0));response.headers.append('Set-Cookie',cookie(c,'oauth','',0));return response; }
export async function boundedCloudBody(r:Request) {
 if(r.headers.get('content-type')?.split(';')[0]!=='application/json')throw new Error('Use JSON.');
 const reader=r.body?.getReader();if(!reader)throw new Error('Missing design.');let size=0;const chunks:Uint8Array[]=[];let timer:ReturnType<typeof setTimeout>|undefined;
 const timeout=new Promise<never>((_,reject)=>{timer=setTimeout(()=>{reject(new Error('Timed out'));void reader.cancel();},5000);});
 try {while(true){const part=await Promise.race([reader.read(),timeout]);if(part.done)break;size+=part.value.length;if(size>MAX_CLOUD_BYTES){void reader.cancel();throw new Error('Too large');}chunks.push(part.value);}return new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks));}finally{clearTimeout(timer);reader.releaseLock();}
}
export async function cloudProxy(r:Request,id?:string,c=accountConfig(),entitlementOptions?:EntitlementOptions) {
 const user=await checkedAccount(r,c,entitlementOptions?.accountDeps);if(user instanceof Response)return user;if(!user)return accountReply({error:'Sign in to access your private cloud library.'},401);
 if(id&&!UUID.test(id))return accountReply({error:'Design not found.'},404);
 if(!['GET','POST','PUT','PATCH'].includes(r.method)||(!id&&['PUT','PATCH'].includes(r.method))||(id&&r.method==='POST'))return accountReply({error:'Method not allowed.'},405);
 let body:string|undefined;if(r.method!=='GET'){if(!accountSameOrigin(r,c))return accountReply({error:'Open the studio to update your designs.'},403);try{body=await boundedCloudBody(r);}catch{return accountReply({error:'Use a valid JSON design smaller than 3 MB.'},400);}}
 try {let plan:string|undefined;if(!id&&r.method==='POST'){const billing=await import('./billing');const config=entitlementOptions?.config||{...billing.billingConfig(),account:c};plan=(await billing.resolveEntitlement(user.id,config,entitlementOptions?.deps)).tier;}
 const response=await fetch(`${c.serviceUrl!.replace(/\/$/,'')}/cloud/designs${id?`/${id}`:''}`,{method:r.method,headers:{Authorization:`Bearer ${c.secret}`,'x-qr-user':user.id,'Content-Type':'application/json',...(plan?{'x-qr-plan':plan}:{})},body,signal:AbortSignal.timeout(15000),cache:'no-store'});if(response.status>=500)return accountReply({error:'Cloud storage is temporarily unavailable. Your local designs remain available.'},503);return accountReply(await response.json(),response.status);}catch{return accountReply({error:'Cloud storage is temporarily unavailable. Your local designs remain available.'},503);}
}

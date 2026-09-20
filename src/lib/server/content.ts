import {createHmac} from 'node:crypto';
import {isIP} from 'node:net';
import {accountConfig,accountReply,accountSameOrigin,checkedAccount,type AccountConfig,type EntitlementOptions} from './account';
import {billingConfig,resolveEntitlement} from './billing';
import {readContentBody} from '../../../workers/qr-service/content.mjs';
import type {PublicContentPage} from '../content-types';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const SLUG=/^[A-Za-z0-9_-]{16}$/;
const unavailable=()=>accountReply({error:'Content is temporarily unavailable.'},503);
function service(path:string,c:AccountConfig,init:RequestInit={}){
 if(!c.serviceUrl||!c.secret||c.secret.length<32)throw new Error('Service unavailable');
 return fetch(`${c.serviceUrl.replace(/\/$/,'')}${path}`,{...init,headers:{...Object.fromEntries(new Headers(init.headers)),Authorization:`Bearer ${c.secret}`},signal:AbortSignal.timeout(15000),cache:'no-store'});
}
async function forward(path:string,c:AccountConfig,init:RequestInit={},binary=false){
 try{const result=await service(path,c,init);if(result.status>=500)return unavailable();if(binary&&result.ok){const headers=new Headers({'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"sandbox; default-src 'none'"});for(const name of ['Content-Type','Content-Disposition','Content-Length'])if(result.headers.has(name))headers.set(name,result.headers.get(name)!);return new Response(result.body,{status:result.status,headers});}return accountReply(await result.json(),result.status);}catch{return unavailable();}
}
async function privateProxy(r:Request,path:string,c:AccountConfig,allowed:boolean,limit:number,binary=false,needsEntitlement=false,entitlementOptions?:EntitlementOptions){
 const user=await checkedAccount(r,c,entitlementOptions?.accountDeps);if(user instanceof Response)return user;if(!user)return accountReply({error:'Sign in to manage your content.'},401);if(!allowed)return accountReply({error:'Method not allowed.'},405);
 let body:string|undefined;if(r.method!=='GET'){if(!accountSameOrigin(r,c))return accountReply({error:'Open your account to update content.'},403);try{body=JSON.stringify(await readContentBody(r,limit));}catch{return accountReply({error:'Use valid JSON within the upload limits.'},400);}}
 let plan:string|undefined;if(needsEntitlement)try{plan=(await resolveEntitlement(user.id,entitlementOptions?.config||{...billingConfig(),account:c},entitlementOptions?.deps)).tier;}catch{return unavailable();}
 return forward(path,c,{method:r.method,headers:{'x-qr-user':user.id,'Content-Type':'application/json',...(plan?{'x-qr-plan':plan}:{})},body},binary);
}
export async function contentProxy(r:Request,id?:string,c:AccountConfig=accountConfig(),submissions=false,entitlementOptions?:EntitlementOptions){
 if(id&&!UUID.test(id))return accountReply({error:'Page not found.'},404);
 const allowed=submissions?!!id&&r.method==='GET':id?['GET','PUT','PATCH'].includes(r.method):['GET','POST'].includes(r.method);
 return privateProxy(r,`/content${id?`/${id}`:''}${submissions?'/submissions':''}`,c,allowed,32768,false,!id&&r.method==='POST',entitlementOptions);
}
export async function assetProxy(r:Request,id?:string,c:AccountConfig=accountConfig(),entitlementOptions?:EntitlementOptions){
 if(id&&!UUID.test(id))return accountReply({error:'File not found.'},404);
 return privateProxy(r,`/content-assets${id?`/${id}`:''}`,c,id?r.method==='GET':['GET','POST'].includes(r.method),3145728,!!id,!id&&r.method==='POST',entitlementOptions);
}
export async function getPublicContent(slug:string,c:AccountConfig=accountConfig()):Promise<PublicContentPage|null>{
 if(!SLUG.test(slug))return null;const result=await service(`/public-content/${slug}`,c);if(result.status===404)return null;if(!result.ok)throw new Error('Content is temporarily unavailable.');const data=await result.json();if(!data.page?.content||data.page.slug!==slug)throw new Error('Content is temporarily unavailable.');return data.page;
}
export async function publicContentAsset(r:Request,slug:string,assetId:string,c:AccountConfig=accountConfig()){
 if(!SLUG.test(slug)||!UUID.test(assetId))return accountReply({error:'File not found.'},404);if(r.method!=='GET')return accountReply({error:'Method not allowed.'},405);return forward(`/public-content/${slug}/assets/${assetId}`,c,{},true);
}
export async function publicSubmission(r:Request,slug:string,c:AccountConfig=accountConfig()){
 if(!SLUG.test(slug))return accountReply({error:'Form not found.'},404);if(r.method!=='POST')return accountReply({error:'Method not allowed.'},405);if(!accountSameOrigin(r,c))return accountReply({error:'Open the form to send a message.'},403);
 // Vercel overwrites this header. Never trust browser x-forwarded-for or x-qr-network.
 const trusted=r.headers.get('x-vercel-forwarded-for')?.trim();const ip=c.development?'local-development':trusted&&isIP(trusted)?trusted:null;
 if(!ip||!c.secret||c.secret.length<32)return unavailable();let body:string;try{body=JSON.stringify(await readContentBody(r,8192));}catch{return accountReply({error:'Use valid form details within 8 KB.'},400);}
 const network=createHmac('sha256',c.secret).update(`content-form:${new Date().toISOString().slice(0,10)}:${ip}`).digest('hex');
 return forward(`/public-content/${slug}/submissions`,c,{method:'POST',headers:{'Content-Type':'application/json','x-qr-network':network},body});
}

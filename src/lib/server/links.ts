import { serviceFetch, serviceAvailable } from '../../../cloudflare/service';
import {accountConfig,accountReply,accountSameOrigin,checkedAccount,type AccountConfig,type EntitlementOptions} from './account';
import {billingConfig,resolveEntitlement} from './billing';
import {readLinkBody,validateTarget} from '../../../workers/qr-service/links.mjs';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
export async function linksProxy(r:Request,id?:string,c:AccountConfig=accountConfig(),entitlementOptions?:EntitlementOptions) {
 const user=await checkedAccount(r,c,entitlementOptions?.accountDeps);if(user instanceof Response)return user;if(!user)return accountReply({error:'Sign in to manage your links.'},401);
 if(id&&!UUID.test(id))return accountReply({error:'Link not found.'},404);
 if(!['GET','POST','PATCH'].includes(r.method)||id&&r.method==='POST'||!id&&r.method==='PATCH')return accountReply({error:'Method not allowed.'},405);
 let body:string|undefined;
 if(r.method!=='GET'){if(!accountSameOrigin(r,c))return accountReply({error:'Open your account to update links.'},403);try{body=JSON.stringify(await readLinkBody(r));}catch{return accountReply({error:'Use valid JSON link details smaller than 16 KB.'},400);}}
 try{let plan:string|undefined;if(!id&&r.method==='POST')plan=(await resolveEntitlement(user.id,entitlementOptions?.config||{...billingConfig(),account:c},entitlementOptions?.deps)).tier;
 const response=await serviceFetch(c,`/links${id?`/${id}`:''}`,{method:r.method,headers:{Authorization:`Bearer ${c.secret}`,'x-qr-user':user.id,'x-qr-session-version':String(user.version),'Content-Type':'application/json',...(plan?{'x-qr-plan':plan}:{})},body,signal:AbortSignal.timeout(5000),cache:'no-store'});if(response.status>=500)throw new Error();return accountReply(await response.json(),response.status);}catch{return accountReply({error:'Link storage is temporarily unavailable.'},503);}
}
export async function linkRedirect(r:Request,slug:string,c:AccountConfig=accountConfig()) {
 const headers={'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'};
 const missing=(status=404)=>new Response(r.method==='HEAD'?null:'This link is not available.',{status,headers});
 if(!/^[A-Za-z0-9_-]{16}$/.test(slug))return missing();
 if(!serviceAvailable(c))return missing(503);
 try{const response=await serviceFetch(c,`/resolve/${slug}`,{headers:{Authorization:`Bearer ${c.secret}`,'x-qr-count':r.method==='HEAD'?'0':'1'},signal:AbortSignal.timeout(5000),cache:'no-store'});if(!response.ok)return missing(response.status>=500?503:404);const data=await response.json();return new Response(null,{status:307,headers:{...headers,Location:validateTarget(data.target)}});}catch{return missing(503);}
}

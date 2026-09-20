import { runtimeVariable } from '../../../cloudflare/runtime';
import { serviceFetch } from '../../../cloudflare/service';
import Stripe from 'stripe';
import {randomBytes} from 'node:crypto';
import {accountConfig,configured,accountOrigin,accountSameOrigin,accountReply,checkedAccount,type AccountConfig} from './account';
import {PLAN_LIMITS} from '../../../shared/plan-limits.mjs';
import type {BillingPlan,BillingStatus,BillingTier,Entitlement} from '../billing-types';
export type BillingConfig={account:AccountConfig;enabled:boolean;key?:string;webhookSecret?:string;pro?:string;brand?:string;portalConfiguration?:string};
export function billingConfig():BillingConfig{return {account:accountConfig(),enabled:runtimeVariable('BILLING_ENABLED')==='true',key:runtimeVariable('STRIPE_SECRET_KEY'),webhookSecret:runtimeVariable('STRIPE_WEBHOOK_SECRET'),pro:runtimeVariable('STRIPE_PRICE_PRO'),brand:runtimeVariable('STRIPE_PRICE_BRAND'),portalConfiguration:runtimeVariable('STRIPE_PORTAL_CONFIGURATION')};}
export function billingReady(c:BillingConfig){return c.enabled&&configured(c.account)&&/^(sk|rk)_(test|live)_[A-Za-z0-9]+$/.test(c.key||'')&&!!c.webhookSecret&&/^price_[A-Za-z0-9]+$/.test(c.pro||'')&&/^price_[A-Za-z0-9]+$/.test(c.brand||'')&&c.pro!==c.brand&&/^bpc_[A-Za-z0-9]+$/.test(c.portalConfiguration||'');}
export type BillingDeps={stripe?:Stripe;fetch?:typeof fetch};
type Binding={owner:string;customer_id:string;mode:'test'|'live';reservation:string|null;tier:BillingTier|null;reserved_at:number|null;session_id:string|null;lease_until:number};
const blocked=new Set(['active','trialing','past_due','unpaid','incomplete','paused']);
const eventTypes=new Set(['customer.subscription.created','customer.subscription.updated','customer.subscription.deleted','checkout.session.completed']);
const unavailable=()=>accountReply({error:'Billing is temporarily unavailable. Please try again.'},503);
const mode=(c:BillingConfig)=>/^(sk|rk)_live_/.test(c.key!)?'live':'test';
const id=(v:string|{id:string}|null)=>typeof v==='string'?v:v?.id||null;
function client(c:BillingConfig,d:BillingDeps){return d.stripe||new Stripe(c.key!,{httpClient:Stripe.createFetchHttpClient(),timeout:10000,maxNetworkRetries:1});}
export async function readBillingBody(r:Request,limit=1024){
 const reader=r.body?.getReader();if(!reader)throw new Error('Missing body');const chunks:Uint8Array[]=[];let length=0,timer:ReturnType<typeof setTimeout>|undefined;
 const timeout=new Promise<never>((_,reject)=>{timer=setTimeout(()=>{reject(new Error('Timeout'));void reader.cancel();},5000);});
 try{while(true){const item=await Promise.race([reader.read(),timeout]);if(item.done)break;length+=item.value.length;if(length>limit){void reader.cancel();throw new Error('Too large');}chunks.push(item.value);}return Buffer.concat(chunks);}finally{clearTimeout(timer);reader.releaseLock();}
}
async function service(c:BillingConfig,d:BillingDeps,path:string,owner?:string,body?:unknown,method?:string):Promise<{binding:Binding|null;customerPending?:boolean;customerCreation?:{mode:string;token:string;created_at:number}|null}>{
 const r=await serviceFetch(c.account,path,{method:method||(body?'POST':'GET'),headers:{Authorization:`Bearer ${c.account.secret}`,'Content-Type':'application/json',...(owner?{'x-qr-user':owner}:{}),...(body&&typeof body==='object'&&'version' in body?{'x-qr-session-version':String(body.version)}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(10000),cache:'no-store'},d.fetch);
 if(!r.ok)throw new Error('Service unavailable');return r.json();
}
async function plans(s:Stripe,c:BillingConfig):Promise<BillingPlan[]>{
 return Promise.all((['pro','brand'] as const).map(async tier=>{const p=await s.prices.retrieve(c[tier]!);
  if(p.id!==c[tier]||p.livemode!==(mode(c)==='live')||!p.active||p.type!=='recurring'||!p.recurring||!['month','year'].includes(p.recurring.interval)||!Number.isSafeInteger(p.recurring.interval_count)||p.recurring.interval_count<1||p.recurring.usage_type!=='licensed'||p.billing_scheme!=='per_unit'||!Number.isSafeInteger(p.unit_amount)||p.unit_amount!<=0||!/^[a-z]{3}$/.test(p.currency)||p.custom_unit_amount)throw new Error('Invalid price');
  return {id:tier,name:tier==='pro'?'Pro':'Brand',amount:p.unit_amount!,currency:p.currency,interval:p.recurring.interval as 'month'|'year',intervalCount:p.recurring.interval_count,limits:PLAN_LIMITS[tier]};
 }));
}
async function portalConfiguration(s:Stripe,c:BillingConfig){
 const portal=await s.billingPortal.configurations.retrieve(c.portalConfiguration!);
 if(portal.id!==c.portalConfiguration||portal.livemode!==(mode(c)==='live')||portal.active!==true||portal.features?.subscription_cancel?.enabled!==true||portal.features.subscription_cancel.mode!=='at_period_end'||portal.features.subscription_cancel.proration_behavior!=='none'||portal.features?.subscription_update?.enabled!==false)throw new Error('Invalid portal configuration');
 return portal.id;
}
function timestamp(value:unknown,nullable=false):number|null{
 if(nullable&&value===null)return null;
 if(typeof value!=='number'||!Number.isSafeInteger(value)||value<=0||!Number.isFinite(new Date(value*1000).getTime()))throw new Error('Invalid subscription timestamp');
 return value;
}
async function subscriptions(s:Stripe,c:BillingConfig,b:Binding,owner=b.owner){
 if(b.owner!==owner)throw new Error('Owner mismatch');
 if(b.mode!==mode(c))throw new Error('Mode mismatch');
 const customer=await s.customers.retrieve(b.customer_id);if(customer.deleted||customer.livemode!==(mode(c)==='live')||customer.metadata.owner!==owner)throw new Error('Customer mismatch');
 const list=await s.subscriptions.list({customer:b.customer_id,status:'all',limit:100});if(list.has_more)throw new Error('Subscription overflow');
 if(list.data.some(x=>id(x.customer)!==b.customer_id||x.livemode!==(mode(c)==='live')))throw new Error('Subscription mismatch');
 const current=list.data.filter(x=>blocked.has(x.status));
 if(current.some(x=>x.items.has_more||x.items.data.some(item=>[c.pro,c.brand].includes(item.price.id)&&item.quantity!==1)))throw new Error('Subscription item mismatch');
 const mapped=current.flatMap(sub=>sub.items.data.filter(item=>item.quantity===1&&[c.pro,c.brand].includes(item.price.id)).map(item=>{
  if(typeof sub.cancel_at_period_end!=='boolean')throw new Error('Invalid cancellation flag');
  const currentPeriodEnd=timestamp(item.current_period_end)!;
  const cancelAt=timestamp(sub.cancel_at,true);
  return {tier:(item.price.id===c.pro?'pro':'brand') as BillingTier,status:sub.status,cancelAtPeriodEnd:sub.cancel_at_period_end,scheduledCancellationAt:cancelAt??(sub.cancel_at_period_end?currentPeriodEnd:null),currentPeriodEnd};
 }));
 if(mapped.length>1)throw new Error('Ambiguous subscription');
 return {blocked:current.length>0,subscription:mapped[0]||null};
}
function entitlement(subscription:Awaited<ReturnType<typeof subscriptions>>['subscription']|null):Entitlement{
 const tier=subscription&&['active','trialing'].includes(subscription.status)?subscription.tier:'free';
 return {tier,limits:PLAN_LIMITS[tier]};
}
export async function resolveEntitlement(owner:string,c=billingConfig(),d:BillingDeps={}):Promise<Entitlement>{
 if(!/^[a-f0-9]{64}$/.test(owner))throw new Error('Billing entitlement unavailable');
 if(!c.enabled)return entitlement(null);
 if(!billingReady(c))throw new Error('Billing entitlement unavailable');
 try{
  const s=client(c,d);await plans(s,c);
  const b=(await service(c,d,'/billing',owner)).binding;
  if(!b)return entitlement(null);
  return entitlement((await subscriptions(s,c,b,owner)).subscription);
 }catch{throw new Error('Billing entitlement unavailable');}
}
function hosted(url:string|null,host:string){if(!url)throw new Error('Missing URL');const u=new URL(url);if(u.protocol!=='https:'||u.hostname!==host||u.port||u.username||u.password)throw new Error('Invalid URL');return url;}
export async function billingStatus(r:Request,c=billingConfig(),d:BillingDeps={}){
 const user=await checkedAccount(r,c.account,d);if(user instanceof Response)return user;
 if(!c.enabled)return accountReply({configured:false,signedIn:!!user,plans:[],subscription:null,canManage:false,entitlement:entitlement(null)} satisfies BillingStatus);
 if(!billingReady(c))return unavailable();
 try{const s=client(c,d),offers=await plans(s,c);const b=user?(await service(c,d,'/billing',user.id)).binding:null;
 if(b&&b.owner!==user?.id)throw new Error('Owner mismatch');
 const current=b?await subscriptions(s,c,b,user!.id):null;
 return accountReply({configured:true,signedIn:!!user,plans:offers,subscription:current?.subscription||null,canManage:!!b,entitlement:entitlement(current?.subscription||null)} satisfies BillingStatus);
 }catch{return unavailable();}
}
export async function billingAction(r:Request,action:'checkout'|'portal',c=billingConfig(),d:BillingDeps={}){
 const user=await checkedAccount(r,c.account,d);if(user instanceof Response)return user;if(!user)return accountReply({error:'Sign in to manage billing.'},401);
 if(!accountSameOrigin(r,c.account))return accountReply({error:'Open billing to continue.'},403);
 if(!billingReady(c))return unavailable();
 let tier:BillingTier|undefined;
 try{if(r.headers.get('content-type')?.split(';')[0]!=='application/json')throw new Error();const body=JSON.parse((await readBillingBody(r)).toString('utf8'));
 if(!body||typeof body!=='object'||Array.isArray(body))throw new Error();
 if(action==='checkout'){if(Object.keys(body).length!==1||!['pro','brand'].includes(body.tier))throw new Error();tier=body.tier;}else if(Object.keys(body).length)throw new Error();
 }catch{return accountReply({error:'Use a valid billing request.'},400);}
 try{
  const s=client(c,d);await plans(s,c);
  let b=(await service(c,d,'/billing',user.id)).binding;
  if(!b&&action==='portal')return accountReply({error:'No billing account yet.'},409);
  const portalConfigurationId=await portalConfiguration(s,c);
  if(!b){
   const reserved=await service(c,d,'/billing/customer-start',user.id,{mode:mode(c),token:randomBytes(16).toString('hex'),version:user.version});
   b=reserved.binding;
   if(!b){
    const pending=reserved.customerCreation;
    if(!pending||pending.mode!==mode(c)||! /^[a-f0-9]{32}$/.test(pending.token)||!Number.isSafeInteger(pending.created_at)||Date.now()/1000-pending.created_at>23*3600)throw new Error('Customer creation reconciliation required');
    let customer:Stripe.Customer;
    try{customer=await s.customers.create({metadata:{owner:user.id}},{idempotencyKey:`qr-customer-${mode(c)}-${user.id}`});}
    catch(error){
     // Only a definitive metadata validation rejection proves this exact create never executed.
     if(error instanceof Stripe.errors.StripeInvalidRequestError&&error.statusCode===400&&error.requestId&&['metadata','metadata[owner]'].includes(error.param||''))await service(c,d,'/billing/customer-abort',user.id,{token:pending.token,version:user.version});
     throw error;
    }
    b=(await service(c,d,'/billing/customer',user.id,{customerId:customer.id,mode:mode(c),version:user.version},'PUT')).binding;
   }
  }
  if(!b||b.owner!==user.id)throw new Error();
  const current=await subscriptions(s,c,b);
  if(action==='portal'||current.blocked){const portal=await s.billingPortal.sessions.create({customer:b.customer_id,return_url:`${accountOrigin(c.account)}/billing`,configuration:portalConfigurationId});return accountReply({url:hosted(portal.url,'billing.stripe.com')});}
  b=(await service(c,d,'/billing/checkout',user.id,{action:'reserve',tier,version:user.version,token:randomBytes(16).toString('hex')})).binding;if(!b?.reservation||!b.tier||!b.reserved_at)throw new Error();
  let session:Stripe.Checkout.Session;
  if(b.session_id)session=await s.checkout.sessions.retrieve(b.session_id);
  else{
   // Never discard an ambiguous create. Replay the exact request with its stored key.
   // After 23 hours Stripe may evict a key; require operator reconciliation instead.
   if(Date.now()/1000-b.reserved_at>23*3600)throw new Error('Reconciliation required');
   try {session=await s.checkout.sessions.create({mode:'subscription',customer:b.customer_id,line_items:[{price:c[b.tier]!,quantity:1}],metadata:{owner:user.id},subscription_data:{metadata:{owner:user.id}},success_url:`${accountOrigin(c.account)}/billing?checkout=returned`,cancel_url:`${accountOrigin(c.account)}/billing?checkout=cancelled`,expires_at:b.reserved_at+1860},{idempotencyKey:`qr-checkout-${mode(c)}-${user.id}-${b.reservation}`});
   }catch(error){
    // Only Stripe's definitive parameter rejection proves this replay did not execute.
    // Network errors, 5xx and idempotency conflicts remain uncertain and keep the key.
    if(error instanceof Stripe.errors.StripeInvalidRequestError&&error.statusCode===400&&error.param==='expires_at'&&error.requestId&&b.reserved_at+1860<Math.floor(Date.now()/1000)+1800){
     await service(c,d,'/billing/checkout',user.id,{action:'release',token:b.reservation,version:user.version});
     return accountReply({error:'Checkout could not start before its expiry window. Please try again.'},409);
    }
    throw error;
   }
  }
  if(id(session.customer)!==b.customer_id||session.livemode!==(mode(c)==='live')||session.mode!=='subscription')throw new Error('Session mismatch');
  if(session.status==='expired'){await service(c,d,'/billing/checkout',user.id,{action:'release',token:b.reservation,version:user.version});return accountReply({error:'The previous checkout expired. Please try again.'},409);}
  if(session.status==='complete'){
   const subscriptionId=id(session.subscription);
   if(subscriptionId){
    const associated=await s.subscriptions.retrieve(subscriptionId);
    if(associated.id!==subscriptionId||id(associated.customer)!==b.customer_id||associated.livemode!==(mode(c)==='live'))throw new Error('Subscription mismatch');
    if(['canceled','incomplete_expired'].includes(associated.status)){
     // Recheck all subscriptions after retrieving the completed session's subscription.
     // A terminal old subscription alone cannot justify a new checkout.
     if(!(await subscriptions(s,c,b)).blocked){
      await service(c,d,'/billing/checkout',user.id,{action:'release',token:b.reservation,version:user.version});
      return accountReply({error:'The previous subscription ended. Please try again to start a new checkout.'},409);
     }
    }
   }
  }
  if(session.status!=='open')return accountReply({error:'Checkout is processing. Refresh billing shortly.'},409);
  const url=hosted(session.url,'checkout.stripe.com');
  await service(c,d,'/billing/checkout',user.id,{action:'finalize',token:b.reservation,sessionId:session.id,version:user.version});return accountReply({url});
 }catch{return unavailable();}
}
export async function billingWebhook(r:Request,c=billingConfig(),d:BillingDeps={}){
 if(!billingReady(c))return unavailable();let event:Stripe.Event;
 try{const raw=await readBillingBody(r,256*1024);event=await client(c,d).webhooks.constructEventAsync(raw,r.headers.get('stripe-signature')||'',c.webhookSecret!,300);
 if(event.livemode!==(mode(c)==='live'))throw new Error();
 }catch{return accountReply({error:'Invalid webhook.'},400);}
 if(!eventTypes.has(event.type))return accountReply({received:true});
 const object=event.data.object as Stripe.Subscription|Stripe.Checkout.Session;
 const customerId=id(object.customer);const subscriptionId=object.object==='subscription'?object.id:id(object.subscription);
 if(!customerId)return accountReply({received:true});
 try{await service(c,d,'/billing/events',undefined,{id:event.id,type:event.type,created:event.created,customerId,subscriptionId,mode:mode(c)});return accountReply({received:true});}catch{return unavailable();}
}

export class ClosureBillingBlocked extends Error {}
export type ClosureBinding={customerId:string;mode:'test'|'live';revision:number}|null;
// Closure deliberately ignores BILLING_ENABLED and plan/portal feature switches.
export async function checkClosureBilling(owner:string,version:number,c=billingConfig(),d:BillingDeps={}):Promise<ClosureBinding>{
 const response=await service(c,d,'/billing',owner);
 if(!response||!Object.hasOwn(response,'binding'))throw new Error('Invalid billing response');
 if(response.customerPending)throw new ClosureBillingBlocked('A billing customer setup is still pending. Retry Billing to resolve it before closing your account; an uncertain provider operation may need operator reconciliation.');
 const b=response.binding as (Binding&{revision:number})|null;
 if(b===null)return null;
 if(!b||typeof b!=='object')throw new Error('Invalid billing response');
 const blockedMessage='Account closure is waiting for Billing. End any subscription through Billing and wait until it has actually ended. Open or uncertain checkouts must be resolved before trying again.';
 const block=()=>{throw new ClosureBillingBlocked(blockedMessage);};
 if(b.owner!==owner||!Number.isSafeInteger(b.revision)||b.revision<0||! /^(sk|rk)_(test|live)_[A-Za-z0-9]+$/.test(c.key||'')||b.mode!==mode(c))block();
 const s=client(c,d),customer=await s.customers.retrieve(b.customer_id);
 if(customer.deleted||customer.id!==b.customer_id||customer.livemode!==(b.mode==='live')||customer.metadata.owner!==owner)block();
 const terminal=new Set(['canceled','incomplete_expired']);
 async function noSubscriptions(){
  const list=await s.subscriptions.list({customer:b!.customer_id,status:'all',limit:100});
  if(list.has_more||list.data.some(sub=>id(sub.customer)!==b!.customer_id||sub.livemode!==(b!.mode==='live')||sub.metadata.owner!==owner||!terminal.has(sub.status)))block();
 }
 await noSubscriptions();
 if(!Number.isSafeInteger(b.lease_until)||b.lease_until>Math.floor(Date.now()/1000))block();
 const sessions=await s.checkout.sessions.list({customer:b.customer_id,limit:25});
 if(sessions.has_more)block();
 for(const session of sessions.data){
  if(id(session.customer)!==b.customer_id||session.livemode!==(b.mode==='live')||session.metadata?.owner!==owner||session.mode!=='subscription'||!['expired','complete'].includes(session.status||''))block();
  if(session.status==='complete'){
   const subscriptionId=id(session.subscription);if(!subscriptionId)block();
   const sub=await s.subscriptions.retrieve(subscriptionId!);
   if(sub.id!==subscriptionId||id(sub.customer)!==b.customer_id||sub.livemode!==(b.mode==='live')||sub.metadata.owner!==owner||!terminal.has(sub.status))block();
  }
 }
 if(b.reservation){
  if(!b.session_id)block(); // An unknown create is never discarded, even with an expired lease.
  const session=await s.checkout.sessions.retrieve(b.session_id!);
  if(session.id!==b.session_id||id(session.customer)!==b.customer_id||session.livemode!==(b.mode==='live')||session.metadata?.owner!==owner||session.mode!=='subscription')block();
  if(session.status==='complete'){
   const subscriptionId=id(session.subscription);if(!subscriptionId)block();
   const sub=await s.subscriptions.retrieve(subscriptionId!);
   if(sub.id!==subscriptionId||id(sub.customer)!==b.customer_id||sub.livemode!==(b.mode==='live')||sub.metadata.owner!==owner||!terminal.has(sub.status))block();
  }else if(session.status!=='expired')block();
  await noSubscriptions();
  const released=(await service(c,d,'/billing/checkout',owner,{action:'closure-release',token:b.reservation,sessionId:b.session_id,revision:b.revision,version})).binding as (Binding&{revision:number})|null;
  if(!released||released.owner!==owner||released.customer_id!==b.customer_id||released.mode!==b.mode||released.reservation!==null||released.session_id!==null||released.lease_until!==0)block();
  return {customerId:released!.customer_id,mode:released!.mode,revision:released!.revision};
 }
 if(b.session_id||b.reserved_at!==null||b.tier!==null)block();
 return {customerId:b.customer_id,mode:b.mode,revision:b.revision};
}

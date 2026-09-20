import Stripe from 'stripe';
import {randomBytes} from 'node:crypto';
import {accountConfig,configured,accountOrigin,accountSameOrigin,accountReply,getAccount,type AccountConfig} from './account';
import type {BillingPlan,BillingStatus,BillingTier} from '../billing-types';
export type BillingConfig={account:AccountConfig;enabled:boolean;key?:string;webhookSecret?:string;pro?:string;brand?:string};
export function billingConfig():BillingConfig{return {account:accountConfig(),enabled:process.env.BILLING_ENABLED==='true',key:process.env.STRIPE_SECRET_KEY,webhookSecret:process.env.STRIPE_WEBHOOK_SECRET,pro:process.env.STRIPE_PRICE_PRO,brand:process.env.STRIPE_PRICE_BRAND};}
export function billingReady(c:BillingConfig){return c.enabled&&configured(c.account)&&/^sk_(test|live)_[A-Za-z0-9]+$/.test(c.key||'')&&!!c.webhookSecret&&/^price_[A-Za-z0-9]+$/.test(c.pro||'')&&/^price_[A-Za-z0-9]+$/.test(c.brand||'')&&c.pro!==c.brand;}
export type BillingDeps={stripe?:Stripe;fetch?:typeof fetch};
type Binding={owner:string;customer_id:string;mode:'test'|'live';reservation:string|null;tier:BillingTier|null;reserved_at:number|null;session_id:string|null;lease_until:number};
const blocked=new Set(['active','trialing','past_due','unpaid','incomplete','paused']);
const eventTypes=new Set(['customer.subscription.created','customer.subscription.updated','customer.subscription.deleted','checkout.session.completed']);
const unavailable=()=>accountReply({error:'Billing is temporarily unavailable. Please try again.'},503);
const mode=(c:BillingConfig)=>c.key!.startsWith('sk_live_')?'live':'test';
const id=(v:string|{id:string}|null)=>typeof v==='string'?v:v?.id||null;
function client(c:BillingConfig,d:BillingDeps){return d.stripe||new Stripe(c.key!,{timeout:10000,maxNetworkRetries:1});}
export async function readBillingBody(r:Request,limit=1024){
 const reader=r.body?.getReader();if(!reader)throw new Error('Missing body');const chunks:Uint8Array[]=[];let length=0,timer:ReturnType<typeof setTimeout>|undefined;
 const timeout=new Promise<never>((_,reject)=>{timer=setTimeout(()=>{reject(new Error('Timeout'));void reader.cancel();},5000);});
 try{while(true){const item=await Promise.race([reader.read(),timeout]);if(item.done)break;length+=item.value.length;if(length>limit){void reader.cancel();throw new Error('Too large');}chunks.push(item.value);}return Buffer.concat(chunks);}finally{clearTimeout(timer);reader.releaseLock();}
}
async function service(c:BillingConfig,d:BillingDeps,path:string,owner?:string,body?:unknown,method?:string):Promise<{binding:Binding|null}>{
 const r=await (d.fetch||fetch)(`${c.account.serviceUrl!.replace(/\/$/,'')}${path}`,{method:method||(body?'POST':'GET'),headers:{Authorization:`Bearer ${c.account.secret}`,'Content-Type':'application/json',...(owner?{'x-qr-user':owner}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(10000),cache:'no-store'});
 if(!r.ok)throw new Error('Service unavailable');return r.json();
}
async function plans(s:Stripe,c:BillingConfig):Promise<BillingPlan[]>{
 return Promise.all((['pro','brand'] as const).map(async tier=>{const p=await s.prices.retrieve(c[tier]!);
  if(p.id!==c[tier]||p.livemode!==(mode(c)==='live')||!p.active||p.type!=='recurring'||!p.recurring||!['month','year'].includes(p.recurring.interval)||!Number.isSafeInteger(p.recurring.interval_count)||p.recurring.interval_count<1||p.recurring.usage_type!=='licensed'||p.billing_scheme!=='per_unit'||!Number.isSafeInteger(p.unit_amount)||p.unit_amount!<=0||!/^[a-z]{3}$/.test(p.currency)||p.custom_unit_amount)throw new Error('Invalid price');
  return {id:tier,name:tier==='pro'?'Pro':'Brand',amount:p.unit_amount!,currency:p.currency,interval:p.recurring.interval as 'month'|'year',intervalCount:p.recurring.interval_count};
 }));
}
async function subscriptions(s:Stripe,c:BillingConfig,b:Binding){
 if(b.mode!==mode(c))throw new Error('Mode mismatch');
 const customer=await s.customers.retrieve(b.customer_id);if(customer.deleted||customer.livemode!==(mode(c)==='live')||customer.metadata.owner!==b.owner)throw new Error('Customer mismatch');
 const list=await s.subscriptions.list({customer:b.customer_id,status:'all',limit:100});if(list.has_more)throw new Error('Subscription overflow');
 if(list.data.some(x=>id(x.customer)!==b.customer_id||x.livemode!==(mode(c)==='live')))throw new Error('Subscription mismatch');
 const current=list.data.filter(x=>blocked.has(x.status));
 const mapped=current.flatMap(sub=>sub.items.data.filter(item=>item.quantity===1&&[c.pro,c.brand].includes(item.price.id)).map(item=>({tier:(item.price.id===c.pro?'pro':'brand') as BillingTier,status:sub.status,cancelAtPeriodEnd:sub.cancel_at_period_end,currentPeriodEnd:item.current_period_end})));
 if(mapped.length>1)throw new Error('Ambiguous subscription');
 return {blocked:current.length>0,subscription:mapped[0]||null};
}
function hosted(url:string|null,host:string){if(!url)throw new Error('Missing URL');const u=new URL(url);if(u.protocol!=='https:'||u.hostname!==host||u.port||u.username||u.password)throw new Error('Invalid URL');return url;}
export async function billingStatus(r:Request,c=billingConfig(),d:BillingDeps={}){
 const user=await getAccount(r,c.account);
 if(!billingReady(c))return accountReply({configured:false,signedIn:!!user,plans:[],subscription:null,canManage:false} satisfies BillingStatus);
 try{const s=client(c,d),offers=await plans(s,c);const b=user?(await service(c,d,'/billing',user.id)).binding:null;
 const current=b?await subscriptions(s,c,b):null;
 return accountReply({configured:true,signedIn:!!user,plans:offers,subscription:current?.subscription||null,canManage:!!b} satisfies BillingStatus);
 }catch{return unavailable();}
}
export async function billingAction(r:Request,action:'checkout'|'portal',c=billingConfig(),d:BillingDeps={}){
 const user=await getAccount(r,c.account);if(!user)return accountReply({error:'Sign in to manage billing.'},401);
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
  if(!b){const customer=await s.customers.create({metadata:{owner:user.id}},{idempotencyKey:`qr-customer-${mode(c)}-${user.id}`});b=(await service(c,d,'/billing/customer',user.id,{customerId:customer.id,mode:mode(c)},'PUT')).binding;}
  if(!b||b.owner!==user.id)throw new Error();
  const current=await subscriptions(s,c,b);
  if(action==='portal'||current.blocked){const portal=await s.billingPortal.sessions.create({customer:b.customer_id,return_url:`${accountOrigin(c.account)}/billing`});return accountReply({url:hosted(portal.url,'billing.stripe.com')});}
  b=(await service(c,d,'/billing/checkout',user.id,{action:'reserve',tier,token:randomBytes(16).toString('hex')})).binding;if(!b?.reservation||!b.tier||!b.reserved_at)throw new Error();
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
     await service(c,d,'/billing/checkout',user.id,{action:'release',token:b.reservation});
     return accountReply({error:'Checkout could not start before its expiry window. Please try again.'},409);
    }
    throw error;
   }
  }
  if(id(session.customer)!==b.customer_id||session.livemode!==(mode(c)==='live')||session.mode!=='subscription')throw new Error('Session mismatch');
  if(session.status==='expired'){await service(c,d,'/billing/checkout',user.id,{action:'release',token:b.reservation});return accountReply({error:'The previous checkout expired. Please try again.'},409);}
  if(session.status==='complete'){
   const subscriptionId=id(session.subscription);
   if(subscriptionId){
    const associated=await s.subscriptions.retrieve(subscriptionId);
    if(associated.id!==subscriptionId||id(associated.customer)!==b.customer_id||associated.livemode!==(mode(c)==='live'))throw new Error('Subscription mismatch');
    if(['canceled','incomplete_expired'].includes(associated.status)){
     // Recheck all subscriptions after retrieving the completed session's subscription.
     // A terminal old subscription alone cannot justify a new checkout.
     if(!(await subscriptions(s,c,b)).blocked){
      await service(c,d,'/billing/checkout',user.id,{action:'release',token:b.reservation});
      return accountReply({error:'The previous subscription ended. Please try again to start a new checkout.'},409);
     }
    }
   }
  }
  if(session.status!=='open')return accountReply({error:'Checkout is processing. Refresh billing shortly.'},409);
  const url=hosted(session.url,'checkout.stripe.com');
  await service(c,d,'/billing/checkout',user.id,{action:'finalize',token:b.reservation,sessionId:session.id});return accountReply({url});
 }catch{return unavailable();}
}
export async function billingWebhook(r:Request,c=billingConfig(),d:BillingDeps={}){
 if(!billingReady(c))return unavailable();let event:Stripe.Event;
 try{const raw=await readBillingBody(r,256*1024);event=client(c,d).webhooks.constructEvent(raw,r.headers.get('stripe-signature')||'',c.webhookSecret!,300);
 if(event.livemode!==(mode(c)==='live'))throw new Error();
 }catch{return accountReply({error:'Invalid webhook.'},400);}
 if(!eventTypes.has(event.type))return accountReply({received:true});
 const object=event.data.object as Stripe.Subscription|Stripe.Checkout.Session;
 const customerId=id(object.customer);const subscriptionId=object.object==='subscription'?object.id:id(object.subscription);
 if(!customerId)return accountReply({received:true});
 try{await service(c,d,'/billing/events',undefined,{id:event.id,type:event.type,created:event.created,customerId,subscriptionId,mode:mode(c)});return accountReply({received:true});}catch{return unavailable();}
}

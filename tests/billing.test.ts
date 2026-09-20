import {migrate} from './fixtures/migrations';
import test from 'node:test';
import assert from 'node:assert/strict';
import Stripe from 'stripe';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {billingRequest} from '../workers/qr-service/billing.mjs';
import {billingAction,billingStatus,billingWebhook,billingReady,readBillingBody,resolveEntitlement,type BillingConfig} from '../src/lib/server/billing';
import {PLAN_LIMITS} from '../shared/plan-limits.mjs';
import {signAccountToken} from '../src/lib/server/account';
const owner='a'.repeat(64),other='b'.repeat(64);
const c:BillingConfig={enabled:true,key:'sk_test_fixture',webhookSecret:'whsec_fixture',pro:'price_pro',brand:'price_brand',portalConfiguration:'bpc_qrupgrade',account:{clientId:'test',clientSecret:'test',secret:'s'.repeat(64),serviceUrl:'https://service.example',development:true}};
function db(){const sqlite=new DatabaseSync(':memory:');migrate(sqlite);const wrap=(sql:string,values:any[]=[])=>({bind:(...v:any[])=>wrap(sql,v),first:async()=>sqlite.prepare(sql).get(...values)||null,run:async()=>sqlite.prepare(sql).run(...values)});return {sqlite,DB:{prepare:wrap}};}
function req(path='/billing',method='GET',body?:unknown,user=owner){return new Request('https://service.example'+path,{method,headers:{'x-qr-user':user,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});}
function fixture(){
 const env=db();let creates=0,portalReads=0;const sessions=new Map<string,any>(),portalSessions:any[]=[];const subs:any[]=[];
 const s={
  prices:{retrieve:async(id:string)=>({id,active:true,livemode:false,type:'recurring',recurring:{interval:'month',interval_count:1,usage_type:'licensed'},billing_scheme:'per_unit',unit_amount:1200,currency:'usd'})},
  customers:{create:async()=>({id:'cus_fixture'}),retrieve:async()=>({id:'cus_fixture',livemode:false,metadata:{owner}})},
  subscriptions:{list:async()=>({data:subs,has_more:false}),retrieve:async(id:string)=>{const sub=subs.find(x=>x.id===id);if(!sub)throw new Error('Not found');return sub;}},
  checkout:{sessions:{create:async(p:any,o:any)=>{creates++;assert.equal(p.customer,'cus_fixture');assert.equal(p.line_items[0].quantity,1);assert.equal(p.success_url,'http://localhost:3040/billing?checkout=returned');assert.equal(p.cancel_url,'http://localhost:3040/billing?checkout=cancelled');const session=sessions.get(o.idempotencyKey)||{id:`cs_test_fixture${sessions.size}`,customer:'cus_fixture',livemode:false,mode:'subscription',status:'open',url:'https://checkout.stripe.com/c/pay/fixture'};sessions.set(o.idempotencyKey,session);return session;},retrieve:async(id:string)=>[...sessions.values()].find(x=>x.id===id)}},
  billingPortal:{
   configurations:{retrieve:async(id:string)=>{portalReads++;return {id,active:true,livemode:false,features:{subscription_cancel:{enabled:true,mode:'at_period_end',proration_behavior:'none'},subscription_update:{enabled:false}}};}},
   sessions:{create:async(p:any)=>{portalSessions.push(p);assert.equal(p.return_url,'http://localhost:3040/billing');assert.equal(p.configuration,c.portalConfiguration);return {url:'https://billing.stripe.com/p/session/fixture'};}}
  },
  webhooks:new Stripe('sk_test_fixture').webhooks
 };
 const fetcher:typeof fetch=async(input,init)=>new URL(String(input)).pathname==='/account/session'?Response.json({owner,version:1}):billingRequest(new Request(input as string,init),env);
 return {env,s,subs,sessions,portalSessions,deps:{stripe:s as unknown as Stripe,fetch:fetcher},get creates(){return creates;},get portalReads(){return portalReads;}};
}
async function browser(body:unknown={tier:'pro'},origin='http://localhost:3040'){const token=await signAccountToken({sv:1,sub:owner,name:'Fixture',email:'fixture@example.com'},'session',c.account);return new Request('http://localhost:3040/api/billing/checkout',{method:'POST',headers:{origin,cookie:`qr-session=${token}`,'Content-Type':'application/json'},body:JSON.stringify(body)});}
test('disabled readiness and anonymous offers; bad configured prices and network fail closed',async()=>{const f=fixture();assert.equal(billingReady({...c,brand:c.pro}),false);const off=await billingStatus(req(),{...c,enabled:false},f.deps);assert.deepEqual(await off.json(),{configured:false,signedIn:false,plans:[],subscription:null,canManage:false,entitlement:{tier:'free',limits:PLAN_LIMITS.free}});const on=await(await billingStatus(req(),c,f.deps)).json();assert.equal(on.plans[0].amount,1200);assert.equal(on.signedIn,false);f.s.prices.retrieve=async()=>{throw new Error('private');};assert.equal((await billingStatus(req(),c,f.deps)).status,503);f.env.sqlite.close();});
test('billing readiness requires a dedicated portal configuration identifier',()=>{
 assert.equal(billingReady({...c,portalConfiguration:undefined}),false);
 assert.equal(billingReady({...c,portalConfiguration:'pc_qrupgrade'}),false);
 assert.equal(billingReady({...c,portalConfiguration:'bpc_qrupgrade'}),true);
});
test('auth, same-origin, exact payload and bounded body gates',async()=>{const f=fixture();assert.equal((await billingAction(req(),'checkout',c,f.deps)).status,401);assert.equal((await billingAction(await browser({},'https://evil.example'),'checkout',c,f.deps)).status,403);for(const b of [{tier:'pro',customer:'cus_other'},{tier:'unknown'},[],null,{tier:'pro',x:'x'.repeat(1100)}])assert.equal((await billingAction(await browser(b),'checkout',c,f.deps)).status,400);assert.equal((await billingAction(await browser({customer:'cus_other'}),'portal',c,f.deps)).status,400);await assert.rejects(()=>readBillingBody(new Request('https://example.com',{method:'POST',body:'x'.repeat(1025)})));f.env.sqlite.close();});
test('unique immutable customer bindings and cross-owner isolation in real SQLite',async()=>{const env=db();assert.equal((await billingRequest(req('/billing/customer','PUT',{customerId:'cus_fixture',mode:'test'}),env)).status,200);assert.equal((await billingRequest(req('/billing/customer','PUT',{customerId:'cus_other',mode:'test'}),env)).status,409);assert.equal((await billingRequest(req('/billing/customer','PUT',{customerId:'cus_fixture',mode:'test'},other),env)).status,409);assert.equal((await(await billingRequest(req('/billing','GET',undefined,other),env)).json()).binding,null);env.sqlite.close();});
test('checkout serializes concurrent tiers, reuses open session, and current subscription goes to portal',async()=>{const f=fixture();const responses=await Promise.all([billingAction(await browser(),'checkout',c,f.deps),billingAction(await browser({tier:'brand'}),'checkout',c,f.deps)]);assert.ok(responses.some(r=>r.status===200));assert.equal(f.creates,1);const next=await billingAction(await browser({tier:'brand'}),'checkout',c,f.deps);assert.equal(next.status,200);assert.equal(f.creates,1);f.subs.push({customer:'cus_fixture',livemode:false,status:'past_due',cancel_at:null,cancel_at_period_end:false,items:{data:[{quantity:1,price:{id:'price_pro'},current_period_end:123}]}});const portal=await(await billingAction(await browser(),'checkout',c,f.deps)).json();assert.match(portal.url,/billing.stripe.com/);assert.equal(f.portalSessions.at(-1)?.configuration,c.portalConfiguration);const status=await(await billingStatus(await browser(),c,f.deps)).json();assert.equal(status.subscription.status,'past_due');assert.equal(status.canManage,true);f.env.sqlite.close();});
test('ambiguous provider response preserves reservation and recovers same idempotency key',async()=>{const f=fixture(),original=f.s.checkout.sessions.create;let first=true;f.s.checkout.sessions.create=async(p,o)=>{const result=await original(p,o);if(first){first=false;throw new Error('Connection lost');}return result;};assert.equal((await billingAction(await browser(),'checkout',c,f.deps)).status,503);const before=f.env.sqlite.prepare('SELECT * FROM billing_customers').get()!;assert.ok(before.reservation);f.env.sqlite.prepare('UPDATE billing_customers SET lease_until=0').run();assert.equal((await billingAction(await browser({tier:'brand'}),'checkout',c,f.deps)).status,200);assert.equal(f.sessions.size,1);const after=f.env.sqlite.prepare('SELECT * FROM billing_customers').get()!;assert.equal(after.reservation,before.reservation);assert.equal(after.tier,'pro');f.env.sqlite.close();});
test('real SDK signatures reject tamper, expired replay, cross-mode and oversize; durable events deduplicate unordered delivery',async()=>{const f=fixture();await billingRequest(req('/billing/customer','PUT',{customerId:'cus_fixture',mode:'test'}),f.env);const sdk=new Stripe('sk_test_fixture');const make=(event:any,timestamp=Math.floor(Date.now()/1000),bad=false)=>{const payload=JSON.stringify(event);return new Request('https://qrupgrade.com/api/billing/webhook',{method:'POST',headers:{'stripe-signature':bad?'bad':sdk.webhooks.generateTestHeaderString({payload,secret:c.webhookSecret!,timestamp})},body:payload});};const event={id:'evt_fixture',type:'customer.subscription.updated',created:100,livemode:false,data:{object:{object:'subscription',id:'sub_fixture',customer:'cus_fixture'}}};assert.equal((await billingWebhook(make(event,1),c,f.deps)).status,400);assert.equal((await billingWebhook(make(event,undefined,true),c,f.deps)).status,400);assert.equal((await billingWebhook(make({...event,livemode:true}),c,f.deps)).status,400);assert.equal((await billingWebhook(make({...event,x:'a'.repeat(256*1024)}),c,f.deps)).status,400);for(const e of [event,event,{...event,id:'evt_older',created:50}])assert.equal((await billingWebhook(make(e),c,f.deps)).status,200);assert.equal(f.env.sqlite.prepare('SELECT COUNT(*) AS n FROM billing_events').get()!.n,2);assert.equal((await billingWebhook(make({...event,id:'evt_unknown',data:{object:{...event.data.object,customer:'cus_unknown'}}}),c,f.deps)).status,200);assert.equal(f.env.sqlite.prepare('SELECT COUNT(*) AS n FROM billing_events').get()!.n,2);const badDeps={...f.deps,fetch:async()=>{throw new Error('offline');}};assert.equal((await billingWebhook(make(event),c,badDeps)).status,503);f.env.sqlite.close();});
test('invalid configured prices, subscription overflow and untrusted hosted URLs fail unavailable',async()=>{const f=fixture();const price=f.s.prices.retrieve;for(const patch of [{active:false},{unit_amount:0},{currency:'USD!'},{livemode:true},{recurring:{interval:'week',interval_count:1,usage_type:'licensed'}},{billing_scheme:'tiered'}]){f.s.prices.retrieve=async(id)=>({...await price(id),...patch}) as any;assert.equal((await billingStatus(req(),c,f.deps)).status,503);}f.s.prices.retrieve=price;await billingAction(await browser(),'checkout',c,f.deps);const listing=f.s.subscriptions.list;f.s.subscriptions.list=async()=>({data:[],has_more:true});assert.equal((await billingStatus(await browser(),c,f.deps)).status,503);f.s.subscriptions.list=listing;f.s.billingPortal.sessions.create=async()=>({url:'https://billing.stripe.com.evil.example/pay'});assert.equal((await billingAction(await browser({}),'portal',c,f.deps)).status,503);f.env.sqlite.close();});
test('interactive billing validates the dedicated safe portal configuration before creating checkout',async()=>{
 const unsafe=[
  {id:'bpc_other'},
  {livemode:true},
  {active:false},
  {features:{subscription_cancel:{enabled:false,mode:'at_period_end',proration_behavior:'none'},subscription_update:{enabled:false}}},
  {features:{subscription_cancel:{enabled:true,mode:'immediately',proration_behavior:'none'},subscription_update:{enabled:false}}},
  {features:{subscription_cancel:{enabled:true,mode:'at_period_end',proration_behavior:'create_prorations'},subscription_update:{enabled:false}}},
  {features:{subscription_cancel:{enabled:true,mode:'at_period_end',proration_behavior:'none'},subscription_update:{enabled:true}}}
 ];
 for(const patch of unsafe){
  const f=fixture(),retrieve=f.s.billingPortal.configurations.retrieve;
  f.s.billingPortal.configurations.retrieve=async id=>({...await retrieve(id),...patch});
  assert.equal((await billingAction(await browser(),'checkout',c,f.deps)).status,503);
  assert.equal(f.creates,0);assert.equal(f.sessions.size,0);
  assert.equal((await (await billingRequest(req(),f.env)).json()).binding,null);
  f.env.sqlite.close();
 }
 const outage=fixture();outage.s.billingPortal.configurations.retrieve=async()=>{throw new Error('portal unavailable');};
 assert.equal((await billingAction(await browser(),'checkout',c,outage.deps)).status,503);assert.equal(outage.creates,0);outage.env.sqlite.close();
});
test('dedicated portal configuration is explicit for direct and blocking-subscription portal sessions',async()=>{
 const direct=fixture();await billingAction(await browser(),'checkout',c,direct.deps);
 assert.equal((await billingAction(await browser({}),'portal',c,direct.deps)).status,200);
 assert.equal(direct.portalSessions.at(-1)?.configuration,c.portalConfiguration);direct.env.sqlite.close();

 const blocking=fixture();await billingRequest(req('/billing/customer','PUT',{customerId:'cus_fixture',mode:'test'}),blocking.env);
 blocking.subs.push({id:'sub_active',customer:'cus_fixture',livemode:false,status:'active',cancel_at:null,cancel_at_period_end:false,items:{data:[{quantity:1,price:{id:'price_pro'},current_period_end:200}]}});
 assert.equal((await billingAction(await browser(),'checkout',c,blocking.deps)).status,200);
 assert.equal(blocking.creates,0);assert.equal(blocking.portalSessions.at(-1)?.configuration,c.portalConfiguration);blocking.env.sqlite.close();
});
test('reservation replay retains exact create payload; stale ambiguity requires reconciliation',async()=>{const f=fixture(),create=f.s.checkout.sessions.create;let original='';f.s.checkout.sessions.create=async(p,o)=>{if(original)assert.equal(JSON.stringify(p),original);else original=JSON.stringify(p);await create(p,o);throw new Error('ambiguous');};await billingAction(await browser(),'checkout',c,f.deps);f.env.sqlite.prepare('UPDATE billing_customers SET lease_until=0').run();await billingAction(await browser({tier:'brand'}),'checkout',c,f.deps);assert.equal(f.creates,2);f.env.sqlite.prepare('UPDATE billing_customers SET lease_until=0,reserved_at=?').run(Math.floor(Date.now()/1000)-24*3600);assert.equal((await billingAction(await browser(),'checkout',c,f.deps)).status,503);assert.equal(f.creates,2);f.env.sqlite.close();});

test('completed canceled or incomplete_expired subscriptions can start a fresh checkout',async()=>{
 for(const status of ['canceled','incomplete_expired']){
  const f=fixture();
  assert.equal((await billingAction(await browser(),'checkout',c,f.deps)).status,200);
  const session=[...f.sessions.values()][0];session.status='complete';session.subscription='sub_ended';
  f.subs.push({id:'sub_ended',customer:'cus_fixture',livemode:false,status,items:{data:[]}});
  const old=f.env.sqlite.prepare('SELECT reservation FROM billing_customers').get()!.reservation;
  const retired=await billingAction(await browser(),'checkout',c,f.deps);assert.equal(retired.status,409);
  assert.equal(f.env.sqlite.prepare('SELECT reservation FROM billing_customers').get()!.reservation,null);
  assert.equal((await billingAction(await browser({tier:'brand'}),'checkout',c,f.deps)).status,200);
  assert.equal(f.sessions.size,2);assert.equal(f.creates,2);
  assert.notEqual(f.env.sqlite.prepare('SELECT reservation FROM billing_customers').get()!.reservation,old);
  f.env.sqlite.close();
 }
});
test('completed checkout keeps its reservation while associated subscription is uncertain or another subscription blocks',async()=>{
 for(const reason of ['missing','processing','wrong-owner','wrong-mode','new-blocker']){
  const f=fixture();await billingAction(await browser(),'checkout',c,f.deps);
  const session=[...f.sessions.values()][0];session.status='complete';session.subscription='sub_ended';
  const reservation=f.env.sqlite.prepare('SELECT reservation FROM billing_customers').get()!.reservation;
  if(reason!=='missing')f.s.subscriptions.retrieve=async()=>({id:'sub_ended',customer:reason==='wrong-owner'?'cus_other':'cus_fixture',livemode:reason==='wrong-mode',status:reason==='processing'?'incomplete':'canceled'});
  if(reason==='new-blocker'){let reads=0;f.s.subscriptions.list=async()=>({data:++reads===1?[]:[{id:'sub_new',customer:'cus_fixture',livemode:false,status:'active',items:{data:[]}}],has_more:false});}
  const result=await billingAction(await browser(),'checkout',c,f.deps);
  assert.equal(result.status,['missing','wrong-owner','wrong-mode'].includes(reason)?503:409);
  assert.equal(f.env.sqlite.prepare('SELECT reservation FROM billing_customers').get()!.reservation,reservation);
  assert.equal(f.creates,1);f.env.sqlite.close();
 }
});
test('precreation outage recovers after actual lease expiry using definitive Stripe expiry rejection',async()=>{
 const f=fixture(),originalNow=Date.now,create=f.s.checkout.sessions.create;let now=originalNow(),calls=0,originalKey='',originalPayload='';
 Date.now=()=>now;
 try{
  f.s.checkout.sessions.create=async(p,o)=>{
   calls++;
   if(calls===1){originalKey=o.idempotencyKey;originalPayload=JSON.stringify(p);throw new Error('Connection failed before request reached Stripe');}
   if(calls===2){assert.equal(o.idempotencyKey,originalKey);assert.equal(JSON.stringify(p),originalPayload);assert.equal(p.expires_at-Math.floor(now/1000),1799);
    throw new Stripe.errors.StripeInvalidRequestError({message:'expires_at must be at least 30 minutes after creation',param:'expires_at',statusCode:400,requestId:'req_expiry'});
   }
   assert.notEqual(o.idempotencyKey,originalKey);assert.ok(p.expires_at>=Math.floor(now/1000)+1800);return create(p,o);
  };
  assert.equal((await billingAction(await browser(),'checkout',c,f.deps)).status,503);
  const reservation=f.env.sqlite.prepare('SELECT reservation FROM billing_customers').get()!.reservation;
  now+=59000;assert.equal((await billingAction(await browser(),'checkout',c,f.deps)).status,503);assert.equal(calls,1);
  now+=2000;assert.equal((await billingAction(await browser(),'checkout',c,f.deps)).status,409);
  assert.equal(f.env.sqlite.prepare('SELECT reservation FROM billing_customers').get()!.reservation,null);
  assert.equal((await billingAction(await browser(),'checkout',c,f.deps)).status,200);
  assert.notEqual(f.env.sqlite.prepare('SELECT reservation FROM billing_customers').get()!.reservation,reservation);
  assert.equal(f.sessions.size,1);assert.equal(f.creates,1);
 }finally{Date.now=originalNow;f.env.sqlite.close();}
});
test('ambiguous execution after lease expiry recovers cached session without replacing key or expiry',async()=>{
 const f=fixture(),originalNow=Date.now,create=f.s.checkout.sessions.create;let now=originalNow(),first=true,payload='',key='';Date.now=()=>now;
 try{
  f.s.checkout.sessions.create=async(p,o)=>{if(first){payload=JSON.stringify(p);key=o.idempotencyKey;first=false;await create(p,o);throw new Error('Response lost');}assert.equal(JSON.stringify(p),payload);assert.equal(o.idempotencyKey,key);return create(p,o);};
  assert.equal((await billingAction(await browser(),'checkout',c,f.deps)).status,503);now+=61000;
  assert.equal((await billingAction(await browser({tier:'brand'}),'checkout',c,f.deps)).status,200);assert.equal(f.sessions.size,1);
 }finally{Date.now=originalNow;f.env.sqlite.close();}
});
test('network, 5xx, idempotency and other parameter errors never retire an uncertain reservation',async()=>{
 for(const failure of [new Error('Connection lost'),new Stripe.errors.StripeAPIError({message:'Internal',statusCode:500,requestId:'req_500'}),new Stripe.errors.StripeIdempotencyError({message:'Conflict',statusCode:400,requestId:'req_conflict'}),new Stripe.errors.StripeInvalidRequestError({message:'Other',param:'customer',statusCode:400,requestId:'req_other'})]){
  const f=fixture(),originalNow=Date.now;let now=originalNow();Date.now=()=>now;
  try{
   f.s.checkout.sessions.create=async()=>{throw failure;};assert.equal((await billingAction(await browser(),'checkout',c,f.deps)).status,503);
   const reservation=f.env.sqlite.prepare('SELECT reservation FROM billing_customers').get()!.reservation;now+=61000;
   assert.equal((await billingAction(await browser(),'checkout',c,f.deps)).status,503);
   assert.equal(f.env.sqlite.prepare('SELECT reservation FROM billing_customers').get()!.reservation,reservation);assert.equal(f.sessions.size,0);
  }finally{Date.now=originalNow;f.env.sqlite.close();}
 }
});

test('entitlements use active or trialing mapped subscriptions and retain canceled-period access',async()=>{
 for(const [status,tier] of [['active','pro'],['trialing','brand']] as const){
  const f=fixture();await billingRequest(req('/billing/customer','PUT',{customerId:'cus_fixture',mode:'test'}),f.env);
  f.subs.push({id:`sub_${status}`,customer:'cus_fixture',livemode:false,status,cancel_at:null,cancel_at_period_end:true,items:{data:[{quantity:1,price:{id:tier==='pro'?'price_pro':'price_brand'},current_period_end:123}]}});
  assert.deepEqual(await resolveEntitlement(owner,c,f.deps),{tier,limits:PLAN_LIMITS[tier]});
  const shown=await (await billingStatus(await browser(),c,f.deps)).json();assert.equal(shown.entitlement.tier,tier);assert.equal(shown.subscription.cancelAtPeriodEnd,true);
  f.env.sqlite.close();
 }
});

test('modern cancellation timestamps preserve access and expose the actual scheduled end',async()=>{
 const f=fixture();await billingRequest(req('/billing/customer','PUT',{customerId:'cus_fixture',mode:'test'}),f.env);
 f.subs.push({id:'sub_modern',customer:'cus_fixture',livemode:false,status:'active',cancel_at:1792499613,cancel_at_period_end:false,items:{data:[{quantity:1,price:{id:'price_pro'},current_period_end:1792499613}]}});
 assert.deepEqual(await resolveEntitlement(owner,c,f.deps),{tier:'pro',limits:PLAN_LIMITS.pro});
 const shown=await (await billingStatus(await browser(),c,f.deps)).json();
 assert.equal(shown.subscription.cancelAtPeriodEnd,false);assert.equal(shown.subscription.scheduledCancellationAt,1792499613);assert.equal(shown.subscription.currentPeriodEnd,1792499613);assert.equal(shown.entitlement.tier,'pro');assert.equal(f.portalReads,0);
 f.env.sqlite.close();
});

test('scheduled cancellation prefers an earlier cancel_at and falls back to period end only for the flag',async()=>{
 for(const [cancelAt,flag,expected] of [[150,false,150],[null,true,200],[null,false,null]] as const){
  const f=fixture();await billingRequest(req('/billing/customer','PUT',{customerId:'cus_fixture',mode:'test'}),f.env);
  f.subs.push({id:'sub_schedule',customer:'cus_fixture',livemode:false,status:'trialing',cancel_at:cancelAt,cancel_at_period_end:flag,items:{data:[{quantity:1,price:{id:'price_brand'},current_period_end:200}]}});
  const shown=await (await billingStatus(await browser(),c,f.deps)).json();assert.equal(shown.subscription.scheduledCancellationAt,expected);assert.equal(shown.subscription.cancelAtPeriodEnd,flag);assert.equal(shown.entitlement.tier,'brand');f.env.sqlite.close();
 }
});

test('malformed provider cancellation fields fail closed without fabricating an end date',async()=>{
 const invalid=[
  {cancel_at:undefined,cancel_at_period_end:false,current_period_end:200},
  {cancel_at:-1,cancel_at_period_end:false,current_period_end:200},
  {cancel_at:1.5,cancel_at_period_end:false,current_period_end:200},
  {cancel_at:9_000_000_000_000,cancel_at_period_end:false,current_period_end:200},
  {cancel_at:null,cancel_at_period_end:'false',current_period_end:200},
  {cancel_at:null,cancel_at_period_end:true,current_period_end:0}
 ];
 for(const fields of invalid){
  const f=fixture();await billingRequest(req('/billing/customer','PUT',{customerId:'cus_fixture',mode:'test'}),f.env);
  f.subs.push({id:'sub_bad',customer:'cus_fixture',livemode:false,status:'active',cancel_at:fields.cancel_at,cancel_at_period_end:fields.cancel_at_period_end,items:{data:[{quantity:1,price:{id:'price_pro'},current_period_end:fields.current_period_end}]}});
  assert.equal((await billingStatus(await browser(),c,f.deps)).status,503);await assert.rejects(()=>resolveEntitlement(owner,c,f.deps));f.env.sqlite.close();
 }
});

test('non-paying subscription states receive free limits without losing billing management',async()=>{
 for(const status of ['past_due','unpaid','paused','incomplete','incomplete_expired','canceled']){
  const f=fixture();await billingRequest(req('/billing/customer','PUT',{customerId:'cus_fixture',mode:'test'}),f.env);
  f.subs.push({id:`sub_${status}`,customer:'cus_fixture',livemode:false,status,cancel_at:null,cancel_at_period_end:false,items:{data:[{quantity:1,price:{id:'price_pro'},current_period_end:123}]}});
  assert.deepEqual(await resolveEntitlement(owner,c,f.deps),{tier:'free',limits:PLAN_LIMITS.free});f.env.sqlite.close();
 }
});

test('a canceled subscription no longer grants paid access',async()=>{
 const f=fixture();await billingRequest(req('/billing/customer','PUT',{customerId:'cus_fixture',mode:'test'}),f.env);
 f.subs.push({id:'sub_canceled',customer:'cus_fixture',livemode:false,status:'canceled',cancel_at:null,cancel_at_period_end:false,items:{data:[{quantity:1,price:{id:'price_pro'},current_period_end:200}]}});
 assert.deepEqual(await resolveEntitlement(owner,c,f.deps),{tier:'free',limits:PLAN_LIMITS.free});
 const shown=await (await billingStatus(await browser(),c,f.deps)).json();assert.equal(shown.subscription,null);assert.equal(shown.entitlement.tier,'free');assert.equal(shown.canManage,true);f.env.sqlite.close();
});

test('entitlement reads fail closed on incomplete setup, owner, customer, mode, price, overflow and provider errors',async()=>{
 const f=fixture();
 await assert.rejects(()=>resolveEntitlement(owner,{...c,webhookSecret:undefined},f.deps));
 const binding={owner:other,customer_id:'cus_fixture',mode:'test' as const,reservation:null,tier:null,reserved_at:null,session_id:null,lease_until:0};
 await assert.rejects(()=>resolveEntitlement(owner,c,{stripe:f.s as unknown as Stripe,fetch:async()=>Response.json({binding})}));
 await billingRequest(req('/billing/customer','PUT',{customerId:'cus_fixture',mode:'test'}),f.env);
 f.s.customers.retrieve=async()=>({id:'cus_fixture',livemode:false,metadata:{owner:other}});await assert.rejects(()=>resolveEntitlement(owner,c,f.deps));
 f.s.customers.retrieve=async()=>({id:'cus_fixture',livemode:false,metadata:{owner}});
 const price=f.s.prices.retrieve;f.s.prices.retrieve=async id=>({...await price(id),id:'price_other'});await assert.rejects(()=>resolveEntitlement(owner,c,f.deps));f.s.prices.retrieve=price;
 f.s.subscriptions.list=async()=>({data:[],has_more:true});await assert.rejects(()=>resolveEntitlement(owner,c,f.deps));
 f.s.subscriptions.list=async()=>({data:[{customer:'cus_fixture',livemode:false,status:'active',items:{data:[{quantity:2,price:{id:'price_pro'},current_period_end:123}]}}],has_more:false});await assert.rejects(()=>resolveEntitlement(owner,c,f.deps));
 f.s.subscriptions.list=async()=>({data:[{customer:'cus_fixture',livemode:false,status:'active',items:{data:[],has_more:true}}],has_more:false});await assert.rejects(()=>resolveEntitlement(owner,c,f.deps));
 f.s.subscriptions.list=async()=>{throw new Error('offline');};await assert.rejects(()=>resolveEntitlement(owner,c,f.deps));f.env.sqlite.close();
});

test('restricted Stripe keys preserve their explicit test or live mode',async()=>{
 assert.equal(billingReady({...c,key:'rk_test_fixture'}),true);assert.equal(billingReady({...c,key:'rk_live_fixture'}),true);assert.equal(billingReady({...c,key:'rk_fixture'}),false);
 const f=fixture(),live={...c,key:'rk_live_fixture'};f.s.prices.retrieve=async id=>({id,active:true,livemode:true,type:'recurring',recurring:{interval:'month',interval_count:1,usage_type:'licensed'},billing_scheme:'per_unit',unit_amount:1200,currency:'usd'});
 const binding={owner,customer_id:'cus_fixture',mode:'test' as const,reservation:null,tier:null,reserved_at:null,session_id:null,lease_until:0};
 await assert.rejects(()=>resolveEntitlement(owner,live,{stripe:f.s as unknown as Stripe,fetch:async()=>Response.json({binding})}));f.env.sqlite.close();
});

test('deliberately disabled billing returns free without provider access',async()=>{
 const deps={stripe:new Proxy({} as Stripe,{get(){throw new Error('provider accessed');}}),fetch:async()=>{throw new Error('service accessed');}};
 assert.deepEqual(await resolveEntitlement(owner,{...c,enabled:false,key:undefined,webhookSecret:undefined},deps),{tier:'free',limits:PLAN_LIMITS.free});
});
test('customer creation uses durable reservation and retains exact idempotency across an uncertain response',async()=>{
 const f=fixture(),create=f.s.customers.create,keys:string[]=[];let failed=false;
 f.s.customers.create=(async(_input:unknown,options:{idempotencyKey:string})=>{keys.push(options.idempotencyKey);const row=f.env.sqlite.prepare('SELECT * FROM billing_customer_creations WHERE owner=?').get(owner);assert.ok(row?.token);if(!failed){failed=true;throw new Error('customer response lost');}return create();}) as typeof create;
 assert.equal((await billingAction(await browser(),'checkout',c,f.deps)).status,503);const pending=f.env.sqlite.prepare('SELECT * FROM billing_customer_creations').get()!;assert.ok(pending.token);assert.equal(f.env.sqlite.prepare('SELECT count(*) n FROM billing_customers').get()!.n,0);
 assert.equal((await billingAction(await browser(),'checkout',c,f.deps)).status,200);assert.equal(keys.length,2);assert.equal(keys[0],keys[1]);assert.equal(f.env.sqlite.prepare('SELECT count(*) n FROM billing_customer_creations').get()!.n,0);f.env.sqlite.close();
});
test('definitive customer metadata rejection releases its exact reservation; old uncertainty never starts a new provider create',async()=>{
 const known=fixture();known.s.customers.create=async()=>{throw new Stripe.errors.StripeInvalidRequestError({message:'Invalid metadata',type:'invalid_request_error',param:'metadata[owner]',statusCode:400,requestId:'req_fixture'});};
 assert.equal((await billingAction(await browser(),'checkout',c,known.deps)).status,503);assert.equal(known.env.sqlite.prepare('SELECT count(*) n FROM billing_customer_creations').get()!.n,0);known.env.sqlite.close();
 const stale=fixture();stale.env.sqlite.prepare('INSERT INTO billing_customer_creations VALUES(?,?,?,?)').run(owner,'test','d'.repeat(32),Math.floor(Date.now()/1000)-24*3600);stale.s.customers.create=async()=>{assert.fail('Old ambiguous customer creation must not be retried');};
 assert.equal((await billingAction(await browser(),'checkout',c,stale.deps)).status,503);assert.equal(stale.env.sqlite.prepare('SELECT count(*) n FROM billing_customer_creations').get()!.n,1);stale.env.sqlite.close();
});

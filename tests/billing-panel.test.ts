import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadBillingStatus,openBillingPage} from '../src/components/billing-panel';
import type {BillingStatus} from '../src/lib/billing-types';
import {ServiceEpochs,ServiceOperations} from '../src/lib/service-operations';

function deferred<T>(){let resolve!:(value:T)=>void;const promise=new Promise<T>(done=>{resolve=done;});return {promise,resolve};}
function mounted(){const epochs=new ServiceEpochs(),operations=new ServiceOperations();operations.mount();return {epochs,operations};}
const status:BillingStatus={configured:true,signedIn:true,plans:[],subscription:null,canManage:true};
const response=(url:string)=>new Response(JSON.stringify({url}),{status:200,headers:{'Content-Type':'application/json'}});

test('a delayed checkout response cannot navigate or update state after unmount',async()=>{
 const {epochs,operations}=mounted(),operation=operations.begin(epochs,'account'),reply=deferred<Response>();
 let requestSignal:AbortSignal|undefined;const navigations:string[]=[],errors:string[]=[],busy:boolean[]=[];
 const request=((_input:RequestInfo|URL,init?:RequestInit)=>{requestSignal=init?.signal as AbortSignal;return reply.promise;}) as typeof fetch;
 const pending=openBillingPage(operation,'checkout','pro',message=>errors.push(message),value=>busy.push(value),request,url=>navigations.push(url),new AbortController().signal);
 operations.unmount();
 assert.equal(requestSignal?.aborted,true);
 reply.resolve(response('https://checkout.stripe.com/c/pay_fixture'));
 await pending;
 assert.deepEqual(navigations,[]);assert.deepEqual(errors,[]);assert.deepEqual(busy,[]);
});

test('logout or account replacement invalidates a delayed portal redirect',async()=>{
 for(const transition of ['logout','account replacement']){
  const {epochs,operations}=mounted(),operation=operations.begin(epochs,'account'),reply=deferred<Response>();
  const navigations:string[]=[],errors:string[]=[],busy:boolean[]=[];
  const request=(()=>reply.promise) as typeof fetch;
  const pending=openBillingPage(operation,'portal',undefined,message=>errors.push(message),value=>busy.push(value),request,url=>navigations.push(url),new AbortController().signal);
  epochs.reconcile();
  reply.resolve(response('https://billing.stripe.com/p/session_fixture'));
  await pending;
  assert.deepEqual(navigations,[],transition);assert.deepEqual(errors,[],transition);assert.deepEqual(busy,[false],transition);
 }
});

test('a newer billing action supersedes the old request and its valid completion still navigates',async()=>{
 const {epochs,operations}=mounted(),first=operations.begin(epochs,'account'),oldReply=deferred<Response>();
 const navigations:string[]=[],errors:string[]=[],busy:boolean[]=[];let oldSignal:AbortSignal|undefined;
 const oldRequest=((_input:RequestInfo|URL,init?:RequestInit)=>{oldSignal=init?.signal as AbortSignal;return oldReply.promise;}) as typeof fetch;
 const oldPending=openBillingPage(first,'checkout','pro',message=>errors.push(message),value=>busy.push(value),oldRequest,url=>navigations.push(url),new AbortController().signal);
 const current=operations.begin(epochs,'account');
 await openBillingPage(current,'portal',undefined,message=>errors.push(message),value=>busy.push(value),(()=>Promise.resolve(response('https://billing.stripe.com/p/current'))) as typeof fetch,url=>navigations.push(url),new AbortController().signal);
 oldReply.resolve(response('https://checkout.stripe.com/c/old'));
 await oldPending;
 assert.equal(oldSignal?.aborted,true);
 assert.deepEqual(navigations,['https://billing.stripe.com/p/current']);assert.deepEqual(errors,[]);assert.deepEqual(busy,[false]);
});

test('billing status ignores account changes during body parsing and accepts a current result',async()=>{
 const staleScope=mounted(),staleOperation=staleScope.operations.begin(staleScope.epochs,'account'),body=deferred<BillingStatus>();
 let parsing=false;const applied:BillingStatus[]=[],errors:string[]=[];
 const request=(async()=>({ok:true,json:()=>{parsing=true;return body.promise;}} as Response)) as typeof fetch;
 const stale=loadBillingStatus(staleOperation,value=>applied.push(value),message=>errors.push(message),request);
 await Promise.resolve();assert.equal(parsing,true);
 staleScope.epochs.reconcile();body.resolve(status);await stale;
 assert.equal(applied.length,0);assert.equal(errors.length,0);

 const currentScope=mounted(),current=currentScope.operations.begin(currentScope.epochs,'account');
 await loadBillingStatus(current,value=>applied.push(value),message=>errors.push(message),(async()=>new Response(JSON.stringify(status),{status:200})) as typeof fetch);
 assert.deepEqual(applied,[status]);assert.deepEqual(errors,[]);
});

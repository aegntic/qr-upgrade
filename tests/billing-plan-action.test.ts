import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {BillingPlanAction} from '../src/components/billing-plan-action';
const render=(patch:Record<string,unknown>={})=>renderToStaticMarkup(createElement(BillingPlanAction,{signedIn:false,busy:false,subscribed:false,planName:'Pro',onChoose:()=>{},...patch}));
test('anonymous plan selection offers account sign-in, not a disabled checkout',()=>{const html=render();assert.match(html,/href="\/account"/);assert.match(html,/Sign in to choose Pro/);assert.doesNotMatch(html,/<button|disabled|api\/billing/);});
test('signed-in subscribers manage their plan rather than start another purchase',()=>{assert.match(render({signedIn:true,subscribed:true}),/Manage your plan/);assert.doesNotMatch(render({signedIn:true,subscribed:true}),/href=/);});
test('signed-in buyers can choose and in-flight requests remain disabled',()=>{assert.match(render({signedIn:true}),/Choose Pro/);assert.doesNotMatch(render({signedIn:true}),/disabled/);assert.match(render({signedIn:true,busy:true}),/disabled/);assert.match(render({signedIn:true,busy:true}),/Opening…/);});

test('rendered checkout and management buttons invoke callbacks, busy buttons do not',async()=>{
 const {JSDOM}=await import('jsdom');
 const {createRoot}=await import('react-dom/client');
 const {act}=await import('react');
 const dom=new JSDOM('<div id="root"></div>',{url:'https://qrupgrade.com/pricing'});
 const keys=['window','document','IS_REACT_ACT_ENVIRONMENT'] as const;
 const prior=new Map(keys.map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
 Object.defineProperty(globalThis,'window',{value:dom.window,configurable:true});
 Object.defineProperty(globalThis,'document',{value:dom.window.document,configurable:true});
 Object.defineProperty(globalThis,'IS_REACT_ACT_ENVIRONMENT',{value:true,configurable:true});
 const root=createRoot(dom.window.document.getElementById('root')!);
 try{
  for(const subscribed of [false,true]){
   let clicks=0;
   const props={signedIn:true,busy:false,subscribed,planName:'Pro',onChoose:()=>{clicks++;}};
   await act(async()=>root.render(createElement(BillingPlanAction,props)));
   await act(async()=>dom.window.document.querySelector('button')!.click());
   assert.equal(clicks,1,subscribed?'management callback':'checkout callback');
   await act(async()=>root.render(createElement(BillingPlanAction,{...props,busy:true})));
   await act(async()=>dom.window.document.querySelector('button')!.click());
   assert.equal(clicks,1,'busy click must not start another request');
  }
 }finally{
  await act(async()=>root.unmount());dom.window.close();
  for(const key of keys){const descriptor=prior.get(key);if(descriptor)Object.defineProperty(globalThis,key,descriptor);else Reflect.deleteProperty(globalThis,key);}
 }
});

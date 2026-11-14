import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {BillingPlanAction} from '../src/components/billing-plan-action';
const render=(patch:Record<string,unknown>={})=>renderToStaticMarkup(createElement(BillingPlanAction,{signedIn:false,busy:false,subscribed:false,planName:'Pro',onChoose:()=>{},...patch}));
test('anonymous plan selection offers account sign-in, not a disabled checkout',()=>{const html=render();assert.match(html,/href="\/account"/);assert.match(html,/Sign in to choose Pro/);assert.doesNotMatch(html,/<button|disabled|api\/billing/);});
test('signed-in subscribers manage their plan rather than start another purchase',()=>{assert.match(render({signedIn:true,subscribed:true}),/Manage your plan/);assert.doesNotMatch(render({signedIn:true,subscribed:true}),/href=/);});
test('signed-in buyers can choose and in-flight requests remain disabled',()=>{assert.match(render({signedIn:true}),/Choose Pro/);assert.doesNotMatch(render({signedIn:true}),/disabled/);assert.match(render({signedIn:true,busy:true}),/disabled/);assert.match(render({signedIn:true,busy:true}),/Opening…/);});

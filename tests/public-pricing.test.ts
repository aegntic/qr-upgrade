import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {AppRouterContext} from 'next/dist/shared/lib/app-router-context.shared-runtime';
import {WorkflowProvider} from '../src/components/workflow-provider';
import BillingPanel from '../src/components/billing-panel';
import type {BillingStatus} from '../src/lib/billing-types';
import {PLAN_LIMITS} from '../shared/plan-limits.mjs';
const status:BillingStatus={configured:true,signedIn:false,subscription:null,canManage:false,plans:[{id:'pro',name:'Pro',amount:1200,currency:'usd',interval:'month',intervalCount:1,limits:PLAN_LIMITS.pro},{id:'brand',name:'Brand',amount:2500,currency:'usd',interval:'month',intervalCount:1,limits:PLAN_LIMITS.brand}]};
const markup=(publicPricing:boolean)=>renderToStaticMarkup(createElement(AppRouterContext.Provider,{value:{} as never},createElement(WorkflowProvider,{children:createElement(BillingPanel,{initialStatus:status,publicPricing})})));
test('server HTML includes live public plan data and no misleading current Billing link',()=>{
 const html=markup(true);
 for(const text of ['PRO','BRAND','$12','$25','200 cloud designs','500 cloud designs','Sign in to choose Pro','Sign in to choose Brand'])assert.ok(html.includes(text),text);
 assert.doesNotMatch(html,/Opening billing|aria-label="Workspace"|aria-current="page"/);
 assert.match(html,/href="\/account"/);
});
test('account billing retains its workspace navigation',()=>{
 assert.match(markup(false),/<a(?=[^>]*href="\/billing")(?=[^>]*aria-current="page")[^>]*>/);
});

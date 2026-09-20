'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {ArrowUpRight,CreditCard,ShieldCheck} from 'lucide-react';
import type {BillingStatus} from '@/lib/billing-types';
import {formatBillingAmount} from '@/lib/billing-format';
import {useWorkflow} from './workflow-provider';
import {useServiceOperations} from './use-service-operations';

type BillingOperation={signal:AbortSignal;alive:()=>boolean;current:()=>boolean};
type BillingFetch=typeof fetch;

export async function loadBillingStatus(operation:BillingOperation,setStatus:(status:BillingStatus)=>void,setError:(message:string)=>void,request:BillingFetch=fetch){
 try{
  const response=await request('/api/billing',{cache:'no-store',signal:operation.signal});
  if(!operation.current())return;
  const data=await response.json();
  if(!operation.current())return;
  if(!response.ok)throw new Error(data.error||'Billing could not be loaded.');
  setStatus(data);
 }catch(e){if(operation.current())setError(e instanceof Error?e.message:'Please refresh to try again.');}
}

export async function openBillingPage(operation:BillingOperation,path:'checkout'|'portal',tier:string|undefined,setError:(message:string)=>void,setBusy:(busy:boolean)=>void,request:BillingFetch=fetch,navigate:(url:string)=>void=url=>window.location.assign(url),timeoutSignal:AbortSignal=AbortSignal.timeout(30000)){
 try{
  const response=await request(`/api/billing/${path}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(tier?{tier}:{}),signal:AbortSignal.any([operation.signal,timeoutSignal])});
  if(!operation.current())return;
  const data=await response.json();
  if(!operation.current())return;
  if(!response.ok)throw new Error(data.error||'Billing could not be opened.');
  const url=new URL(data.url);
  if(url.protocol!=='https:'||!['checkout.stripe.com','billing.stripe.com'].includes(url.hostname))throw new Error('The payment page could not be verified.');
  if(operation.current())navigate(url.href);
 }catch(e){if(operation.current())setError(timeoutSignal.aborted?'Billing took too long to respond. Refresh your account before trying again.':e instanceof Error?e.message:'Billing could not be opened.');}
 finally{if(operation.alive())setBusy(false);}
}

const capacity=(limits:{cloudDesigns:number;dynamicLinks:number;hostedPages:number;uploadedAssets:number})=>`${limits.cloudDesigns} cloud designs · ${limits.dynamicLinks} dynamic links · ${limits.hostedPages} hosted pages · ${limits.uploadedAssets} uploaded assets`;

export default function BillingPanel(){
 const workflow=useWorkflow(),operations=useServiceOperations(workflow.epochs),loadOperations=useServiceOperations(workflow.epochs);
 const [status,setStatus]=useState<BillingStatus|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[returned,setReturned]=useState(false);
 useEffect(()=>{const operation=loadOperations.begin(workflow.epochs,'account');setReturned(new URLSearchParams(window.location.search).get('checkout')==='returned');void loadBillingStatus(operation,setStatus,setError);},[]);
 async function open(path:'checkout'|'portal',tier?:'pro'|'brand'){
  if(busy)return;const operation=operations.begin(workflow.epochs,'account');setBusy(true);setError('');await openBillingPage(operation,path,tier,setError,setBusy);
 }
 return <section><nav className="service-nav" aria-label="Workspace"><Link href="/designs">My designs</Link><Link href="/links">Dynamic links</Link><Link href="/content">Hosted content</Link><Link href="/account">Your account</Link><Link href="/billing" aria-current="page">Billing</Link></nav>{error&&<p role="alert" className="generator-error">{error}</p>}{!status&&!error&&<p role="status">Opening billing…</p>}
 {returned&&status&&<p className="service-notice" role="status">{status.subscription?'Your current subscription is shown below.':'Your account has been refreshed. A checkout return alone does not confirm payment; no active subscription is showing yet.'}</p>}
 {status&&!status.configured&&<div className="billing-waiting"><CreditCard size={34}/><span className="billing-label">STUDIO ACCESS</span><h2>Keep creating.</h2><p>Paid plans are not available yet. You can use the studio and its current features while billing is being connected.</p><Link href="/generator" className="primary-button">Back to your studio <ArrowUpRight size={18}/></Link></div>}
 {status?.configured&&<>{!status.signedIn&&<div className="service-gate"><ShieldCheck size={24}/><div><strong>Your plan belongs to your account.</strong><p>Sign in before choosing or managing a subscription.</p></div><Link className="nav-cta" href="/account">Sign in <ArrowUpRight size={15}/></Link></div>}{status.entitlement&&!status.subscription&&<p className="service-notice">Current Free capacity: {capacity(status.entitlement.limits)}.</p>}{status.subscription&&<div className="billing-current"><div><span className="billing-label">YOUR SUBSCRIPTION</span><h2>{status.subscription.tier==='brand'?'Brand':'Pro'}</h2><p>{status.subscription.status.replaceAll('_',' ')}{status.subscription.cancelAtPeriodEnd?' · Scheduled to end':''}</p>{status.subscription.currentPeriodEnd&&<small>Current period ends {new Date(status.subscription.currentPeriodEnd*1000).toLocaleDateString(undefined,{year:'numeric',month:'long',day:'numeric'})}</small>}{status.entitlement&&<small>Current capacity: {capacity(status.entitlement.limits)}</small>}</div>{status.canManage&&<button className="nav-cta" disabled={busy} onClick={()=>void open('portal')}>Manage subscription <ArrowUpRight size={16}/></button>}</div>}
 {status.canManage&&!status.subscription&&<button className="nav-cta" disabled={busy} onClick={()=>void open('portal')}>Billing history and payment details <ArrowUpRight size={16}/></button>}<div className="billing-plans">{status.plans.map(plan=><article key={plan.id}><span className="billing-label">{plan.name.toUpperCase()}</span><h2>{formatBillingAmount(plan.amount,plan.currency)}<small> / {plan.intervalCount>1?`${plan.intervalCount} `:''}{plan.interval}{plan.intervalCount>1?'s':''}</small></h2><p><strong>{capacity(plan.limits)}.</strong><br/>Includes the existing editor, scan checks and exports. {plan.currency.toUpperCase()} recurring subscription; review the total and tax on Stripe before paying.</p><button className="primary-button" disabled={busy||!status.signedIn} onClick={()=>void open(status.subscription?'portal':'checkout',plan.id)}>{busy?'Opening…':status.subscription?'Manage your plan':`Choose ${plan.name}`}<ArrowUpRight size={17}/></button></article>)}</div><p className="billing-footnote"><ShieldCheck size={15}/>Cancel in the billing portal. Increased limits remain through the paid period and end when the subscription ends. If a downgrade leaves you above a limit, your existing items remain readable, editable, exportable, pausable and archivable; new items are blocked until you are below the new limit. Payment details are entered on Stripe’s hosted page.</p></>}
 </section>;
}

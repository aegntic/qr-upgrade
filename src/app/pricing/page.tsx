import type {Metadata} from 'next';
import Link from 'next/link';
import BillingPanel from '@/components/billing-panel';
import {publicBillingStatus} from '@/lib/server/billing';
import {PLAN_LIMITS} from '../../../shared/plan-limits.mjs';
import '../services.css';
export const dynamic='force-dynamic';

export const metadata:Metadata={title:'Pricing — free studio, room to grow',description:'Create and export QR artwork for free. Compare current Pro and Brand capacity for cloud designs, dynamic links and hosted pages.',alternates:{canonical:'/pricing'}};
export default async function Pricing(){const status=await publicBillingStatus();const free=PLAN_LIMITS.free;return <main id="main" className="foundation-page service-page"><div className="generator-hero"><span className="section-kicker">PRICING</span><h1>Start free.<br/>Grow when you need to.</h1><p>Create, check and export QR artwork in your browser without an account. Paid plans add capacity for your cloud designs, dynamic links and hosted pages.</p><Link href="/generator" className="primary-button">Try the free studio ↗</Link></div><section aria-label="Free plan" className="billing-plans"><article><span className="billing-label">FREE</span><h2>$0</h2><p>{free.cloudDesigns} cloud designs · {free.dynamicLinks} dynamic links · {free.hostedPages} hosted pages · {free.uploadedAssets} uploaded assets.</p><p>Create, check and export in the free studio. Sign in to use your cloud allowance.</p></article></section><BillingPanel initialStatus={status} publicPricing/></main>;}

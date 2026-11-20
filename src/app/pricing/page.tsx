import type {Metadata} from 'next';
import Link from 'next/link';
import BillingPanel from '@/components/billing-panel';
import {publicBillingStatus} from '@/lib/server/billing';
import {PLAN_LIMITS} from '../../../shared/plan-limits.mjs';
import '../services.css';
export const dynamic='force-dynamic';

const pricingTitle='QR Upgrade pricing';
const pricingDescription='Create and export QR artwork for free. Compare current Pro and Brand capacity for cloud designs, dynamic links and hosted pages.';
const pricingUrl='https://qrupgrade.com/pricing';
export const metadata:Metadata={title:{absolute:pricingTitle},description:pricingDescription,alternates:{canonical:pricingUrl},openGraph:{title:pricingTitle,description:pricingDescription,url:pricingUrl},twitter:{card:'summary_large_image',title:pricingTitle,description:pricingDescription}};
export default async function Pricing(){const status=await publicBillingStatus();const free=PLAN_LIMITS.free;return <main id="main" className="foundation-page service-page"><div className="generator-hero"><span className="section-kicker">PRICING</span><h1>QR Upgrade pricing</h1><p>Create, check and export QR artwork in your browser without an account. Paid plans add capacity for your cloud designs, dynamic links and hosted pages.</p><Link href="/generator" className="primary-button">Try the free studio ↗</Link></div><section aria-label="Free plan" className="billing-plans"><article><h2 className="billing-label">Free</h2><p className="billing-price">$0</p><p>{free.cloudDesigns} cloud designs · {free.dynamicLinks} dynamic links · {free.hostedPages} hosted pages · {free.uploadedAssets} uploaded assets.</p><p>Create, check and export in the free studio. Sign in to use your cloud allowance.</p></article></section><BillingPanel initialStatus={status} publicPricing/></main>;}

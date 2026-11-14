import type {Metadata} from 'next';
import Link from 'next/link';
import BillingPanel from '@/components/billing-panel';
import '../services.css';

export const metadata:Metadata={title:'Pricing — free studio, room to grow',description:'Create and export QR artwork for free. Compare current Pro and Brand capacity for cloud designs, dynamic links and hosted pages.',alternates:{canonical:'/pricing'}};
export default function Pricing(){return <main id="main" className="foundation-page service-page"><div className="generator-hero"><span className="section-kicker">PRICING</span><h1>Start free.<br/>Grow when you need to.</h1><p>Create, check and export QR artwork in your browser without an account. Paid plans add capacity for your cloud designs, dynamic links and hosted pages.</p><Link href="/generator" className="primary-button">Try the free studio ↗</Link></div><BillingPanel/></main>;}

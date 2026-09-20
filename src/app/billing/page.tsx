import BillingPanel from '@/components/billing-panel';
import '../services.css';
export const metadata={title:'Billing',robots:{index:false,follow:false}};
export default function Billing(){return <main id="main" className="foundation-page service-page"><div className="generator-hero"><span className="section-kicker">YOUR ACCOUNT</span><h1>Your studio.<br/>On your terms.</h1><p>View your plan, manage your subscription and keep your account in one place.</p></div><BillingPanel/></main>;}

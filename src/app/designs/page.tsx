import DesignLibrary from '@/components/design-library';
import Link from 'next/link';
import '../services.css';
export const metadata = { title: 'My designs', description: 'Your saved QR images, ready to edit and test.', robots: { index: false, follow: false } };
export default function Designs() { return <main id="main" className="foundation-page library-page"><div className="generator-hero"><span className="section-kicker">YOUR COLLECTION</span><h1>Made by you.<br/>Ready for what’s next.</h1><p>Revisit a design. Refine a detail. Make another impression.</p></div><nav className="service-nav" aria-label="Workspace"><Link href="/designs" aria-current="page">My designs</Link><Link href="/links">Dynamic links</Link><Link href="/content">Hosted content</Link><Link href="/account">Your account ↗</Link></nav><DesignLibrary/></main>; }

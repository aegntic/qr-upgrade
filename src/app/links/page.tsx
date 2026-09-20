import LinkWorkspace from '@/components/link-workspace';
import '../services.css';
export const metadata={title:'Dynamic links',robots:{index:false,follow:false}};
export default function LinksPage(){return <main id="main" className="foundation-page service-page"><div className="generator-hero"><span className="section-kicker">DYNAMIC DESTINATIONS</span><h1>One print.<br/>Every next chapter.</h1><p>Change where your QR takes people. Keep the artwork you already put into the world.</p></div><LinkWorkspace/></main>;}

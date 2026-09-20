import ContentWorkspace from '@/components/content-workspace';
import '../services.css';
export const metadata={title:'Hosted content',robots:{index:false,follow:false}};
export default function ContentPage(){return <main id="main" className="foundation-page service-page"><div className="generator-hero"><span className="section-kicker">BEYOND THE SCAN</span><h1>A great QR deserves<br/>a great destination.</h1><p>A menu, a collection, a document, a conversation. Build what comes next, right here.</p></div><ContentWorkspace/></main>;}

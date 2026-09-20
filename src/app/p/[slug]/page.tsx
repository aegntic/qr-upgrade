import {notFound} from 'next/navigation';
import HostedPageView from '@/components/hosted-page-view';
import {getPublicContent} from '@/lib/server/content';
import '../../services.css';
export const metadata={title:'A page by QR Upgrade',robots:{index:false,follow:false}};
export default async function PublicPage({params}:{params:Promise<{slug:string}>}){
 const {slug}=await params;let page;
 try{page=await getPublicContent(slug);}catch{return <main id="main" className="foundation-page"><div className="generator-hero"><span className="section-kicker">PLEASE TRY AGAIN</span><h1>This page is temporarily unavailable.</h1><p>The connection could not be completed. Please try your QR again in a moment.</p></div></main>;}
 if(!page)notFound();
 return <main id="main" className="public-content-main"><HostedPageView content={page.content} slug={slug}/></main>;
}

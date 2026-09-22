import Link from "next/link";
import { ArrowUpRight, ArrowRight, ScanLine, Layers3, Download } from "lucide-react";
import { DestinationIcon } from "./destination-icon";
import type { DestinationId } from "@/lib/generator-options";

const destinations: { id: DestinationId; name: string; detail: string }[] = [
  { id: "website", name: "Your website", detail: "One link. More presence." },
  { id: "instagram", name: "Instagram", detail: "Make your profile pop." },
  { id: "linkedin", name: "LinkedIn", detail: "An introduction that stays." },
  { id: "tiktok", name: "TikTok", detail: "Take them to your next hit." },
  { id: "snapchat", name: "Snapchat", detail: "Connect in a snap." },
  { id: "youtube", name: "YouTube", detail: "From a scan to your channel." },
  { id: "whatsapp", name: "WhatsApp", detail: "Start the conversation." },
  { id: "vcard", name: "Contact card", detail: "Leave a lasting impression." },
];
const studies = [
  { brand: "linkedin", title: "Built to connect.", material: "Cobalt / architectural glass" },
  { brand: "instagram", title: "Impossible to scroll past.", material: "Iridescent / folded glass" },
  { brand: "whatsapp", title: "A warmer hello.", material: "Glaze / sculpted porcelain" },
];

export default function LandingSections() {
  return <>
    <section className="landing-section landing-start" id="studio">
      <span id="qr-types" className="landing-anchor" />
      <div className="landing-section-heading" data-reveal><div><p className="landing-eyebrow">01 / The connection</p><h2>Where will your<br />QR take them?</h2></div><p>Your profile, your business, your next big thing.<br />Choose a destination to open the studio.</p></div>
      <div className="landing-destinations">{destinations.map(item => <Link key={item.id} href={`/generator?type=${item.id}`}><span className="landing-destination-icon"><DestinationIcon id={item.id} size={62} /></span><strong>{item.name}</strong><span>{item.detail}</span><ArrowUpRight className="landing-card-arrow" size={17} /></Link>)}</div>
      <Link className="landing-text-link landing-more" href="/generator">Explore all destinations <ArrowRight size={16} /></Link>
    </section>
    <section className="landing-section" id="examples">
      <div className="landing-section-heading" data-reveal><div><p className="landing-eyebrow">02 / The expression</p><h2>Give your link<br />a little substance.</h2></div><p>Glass that catches the light. Metal with weight.<br />Dimensional artwork, delivered as a flat image.</p></div>
      <div className="landing-studies">{studies.map(study => <Link href={`/generator?brand=${study.brand}`} key={study.brand}><div className="landing-study-image"><img src={`/brand-studies/${study.brand}.webp`} alt={`${study.brand} QR artwork in ${study.material}`} width={768} height={768} loading="lazy" /></div><p>{study.material}</p><h3>{study.title}<ArrowUpRight size={21} /></h3></Link>)}</div>
      <Link href="/brand-studies" className="landing-text-link landing-more">Find your signature style <ArrowRight size={16} /></Link>
    </section>
    <section className="landing-section landing-process" id="features">
      <div data-reveal><p className="landing-eyebrow">Beauty meets function</p><h2>More than<br />a pretty square.</h2><p className="landing-lead">A beautiful QR only earns its place when it connects. Build the image, check the destination, then put it to work.</p></div>
      <div className="landing-steps">{[{ Icon: Layers3, title: "Make it personal", copy: "Choose artwork, add your destination and shape the design around your brand." }, { Icon: ScanLine, title: "Check the connection", copy: "Use scan checks to verify the decoded content. Test on your phone and at your intended print size, too." }, { Icon: Download, title: "Take it everywhere", copy: "Download your QR or create a campaign kit with print and social layouts from your finished artwork." }].map(({ Icon, title, copy }, i) => <div key={title}><span className="landing-step-number">0{i + 1}</span><Icon size={24} /><div><h3>{title}</h3><p>{copy}</p></div></div>)}</div>
    </section>
    <section className="landing-section landing-kit">
      <div className="landing-kit-art" aria-label="Example campaign kit layouts"><img className="landing-kit-post" src="/campaign-preview/social-post.png" alt="Square social post with Studio Obsidian QR artwork" width={1080} height={1080} loading="lazy" /><img className="landing-kit-story" src="/campaign-preview/vertical-story.png" alt="Matching vertical story layout" width={1080} height={1920} loading="lazy" /></div>
      <div data-reveal><p className="landing-eyebrow">03 / Out in the world</p><h2>One artwork.<br />A whole campaign.</h2><p className="landing-lead">Go from a finished QR to a social post, a story and a counter card. A coordinated kit for your shop, your audience or your next client.</p><ul className="landing-kit-list"><li>Square & vertical social images</li><li>A6 counter card & print PDF</li><li>Scan report & sharing guide</li></ul><Link className="steel-button" href="/generator?brand=x">Create your first artwork <ArrowUpRight size={18} /></Link><p className="landing-fine">Then choose “Create campaign kit” in the studio.</p></div>
    </section>
    <section className="landing-section landing-faq" id="faq"><div><p className="landing-eyebrow">A few things to know</p><h2>Before you<br />make your mark.</h2></div><div>{[
      ["Are these actual 3D models?", "They’re images with a three-dimensional appearance: sculptural materials, lighting and depth. Share them like any other QR image; no 3D software required."],
      ["Will the artwork scan?", "Artistic treatments can affect scanning. Use the studio’s exact-content scan checks, then test the final image on phones and in its intended setting. A successful digital check is not a guarantee under every print or lighting condition."],
      ["Can I use my own link and brand?", "Yes. Start with a destination, personalise your design in the studio and check that it opens the correct content before downloading."],
      ["How do I create a campaign kit?", "Finish your QR in the studio and choose Create campaign kit. The kit prepares social and print layouts and checks the generated images before packaging the download."],
    ].map(([question, answer]) => <details key={question}><summary>{question}<span aria-hidden="true">+</span></summary><p>{answer}</p></details>)}</div></section>
    <section className="landing-final" data-reveal><p className="landing-eyebrow">Your next connection starts here</p><h2>Make it worth<br />the scan.</h2><Link className="steel-button" href="/generator?brand=x">Enter the studio <ArrowUpRight size={18} /></Link></section>
  </>;
}

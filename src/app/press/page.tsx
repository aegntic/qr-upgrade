import Link from 'next/link';

export const metadata = {
  title: 'QR Upgrade press and product guide',
  description: 'Explore QR Upgrade’s artistic QR editor, original brand assets and scan methodology. A factual guide for reviewers, creators and collaborators.',
  alternates: { canonical: '/press' },
};

export default function Press() {
  return <main id="main" className="document-page prose">
    <span className="section-kicker">FOR REVIEWERS & CREATORS</span>
    <h1>A little square.<br/>A story worth scanning.</h1>
    <p className="lead">QR Upgrade turns destinations into QR artwork, checks the finished image and prepares it for screens and print.</p>
    <p>Start with a custom pattern, your own image or an artwork direction. Adjust the composition, check the actual QR and export the result. The browser studio works without an account; connected account features are separate.</p>
    <Link className="primary-button" href="/generator?utm_source=press&utm_medium=referral&utm_campaign=scan-the-art">Try the studio ↗</Link>
    <h2>See the complete experience</h2>
    <ol><li>Choose an image direction and enter a public destination you control.</li><li>Adjust the artwork until all studio scan checks pass.</li><li>Export the image and scan it on a phone.</li><li>Make a campaign kit or opt into a separate sharing card.</li><li>Test any physical print at its final size and material.</li></ol>
    <h2>What makes the story</h2>
    <p>The artwork is the working code. The studio checks the complete rendered image, including reduced and simulated views, before enabling export. A campaign kit carries that design into a social post, vertical story and A6 counter card, with a scan report and print guide.</p>
    <p>Digital checks are reference tests, not a scan probability or a guarantee for every camera, lighting condition or printed material. Read the <Link href="/docs">methodology</Link> for the exact boundaries.</p>
    <h2>Brand assets</h2>
    <p><a href="/brand/qr-upgrade-logo-v3-256.png" download>Download the QR Upgrade mark · PNG</a></p>
    <p><a href="/opengraph-image.jpg" download>Download the product banner · JPG</a></p>
    <p>Use these assets to identify QR Upgrade in product coverage. Keep the name and mark legible. Brand-study examples are unofficial explorations and should not be described as customer endorsements.</p>
    <h2>Accurate product references</h2>
    <ul><li><Link href="/ai">Current capabilities and limitations</Link></li><li><Link href="/templates">Artwork examples</Link></li><li><Link href="/docs">Scan checks and print methodology</Link></li><li><Link href="/billing">Current paid-plan availability</Link></li></ul>
    <p>This guide covers the web studio. It does not announce availability in a native app store or an editorial award.</p>
  </main>;
}

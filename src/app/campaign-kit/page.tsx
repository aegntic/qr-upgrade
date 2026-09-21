import CampaignKit from '@/components/campaign-kit';
import './style.css';

export const metadata = {
  title: 'Campaign Kit',
  description: 'Turn your QR artwork into a social post, story and A6 counter card, with a scan report and print guide.',
  alternates: { canonical: '/campaign-kit' },
};

export default function CampaignKitPage() {
  return <main id="main" className="foundation-page campaign-page"><div className="generator-hero"><h1>One artwork. A whole campaign.</h1><p>From your studio to the places people find you.</p></div><CampaignKit/></main>;
}

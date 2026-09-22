import ArtworkExhibition from "@/components/artwork-exhibition";
import LandingSections from "@/components/landing-sections";
import "./landing.css";
import { Schema } from "@/components/schema";
import { site, description } from "@/lib/facts";
export const metadata = { alternates: { canonical: "/" } };
export default function Home() {
  return (
    <main id="main" className="foundation-page">
      <div className="landing-home">
      <Schema
        data={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Organization",
              "@id": site + "/#organization",
              name: "QR Upgrade",
              url: site,
            },
            {
              "@type": "WebSite",
              "@id": site + "/#website",
              name: "QR Upgrade",
              url: site,
            },
            {
              "@type": "SoftwareApplication",
              name: "QR Upgrade",
              url: site,
              applicationCategory: "DesignApplication",
              operatingSystem: "Web",
              description,
              softwareVersion: "0.1.0",
              featureList: [
                "Custom QR, Image QR and QR Art creation modes",
                "URL, Wi-Fi and contact QR codes",
                "Template, logo and style controls",
                "Exact-content scan checks",
                "PNG, SVG and RGB PDF downloads",
              ],
            },
          ],
        }}
      />
      <ArtworkExhibition />
      <LandingSections />
      </div>
    </main>
  );
}

import ArtworkExhibition from "@/components/artwork-exhibition";
import GeneratorStudio from "@/components/generator-studio";
import GeneratorSections from "@/components/generator-sections";
import { Schema } from "@/components/schema";
import { site, description } from "@/lib/facts";
export const metadata = { alternates: { canonical: "/" } };
export default function Home() {
  return (
    <main id="main" className="foundation-page">
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
      <div className="studio-introduction" data-reveal>
        <h2>Meet your new signature.</h2>
        <p>
          Choose a destination. Shape the image.
          <br /> Make every connection your own.
        </p>
      </div>
      <GeneratorStudio initialArtwork="vinyl" />
      <GeneratorSections />
    </main>
  );
}

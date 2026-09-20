import BrandStudies from "@/components/brand-studies";
import "./studies.css";

export const metadata = {
  title: "Brand QR image studies",
  description:
    "14 artistic QR studies for familiar sharing destinations, including LinkedIn, Amazon and Snapchat.",
  robots: { index: false, follow: false },
};

export default function BrandStudiesPage() {
  return (
    <main id="main" className="brand-studies-page">
      <header className="brand-study-intro">
        <span className="section-kicker">QR UPGRADE / BRAND STUDIES / 01</span>
        <h1>
          Familiar brands.
          <br />
          <span>Unmistakable QR images.</span>
        </h1>
        <p>
          For the profiles, products, playlists and places you share. Each brand
          becomes its own material world, with the destination woven into the
          image.
        </p>
        <div className="brand-study-note">
          <strong>Unofficial creative studies.</strong> These examples link to
          public platform homepages. Use your own profile or content URL in the
          studio. They are standard QR images, not native Snapcodes or Spotify
          Codes.
        </div>
      </header>
      <BrandStudies />
      <footer className="brand-study-footer">
        Each finished image passed exact-content decoding at 184, 256, 512 and
        768 pixels. Check a physical proof before print.
      </footer>
    </main>
  );
}

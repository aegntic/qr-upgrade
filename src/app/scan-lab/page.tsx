import ArtStudio from "@/components/art-studio";
export const metadata = {
  title: "Scan Lab",
  description:
    "Place your generated QR into a scene and check contrast, quiet zone, size, distance, and decoder results.",
  alternates: { canonical: "/scan-lab" },
};
export default function ScanLab() {
  return (
    <main id="main" className="app-main">
      <div className="app-intro">
        <span className="section-kicker">THE REAL-WORLD SCAN LAB</span>
        <h1>Know before you print.</h1>
        <p>
          Create a QR image, view it in context, and decode the actual artwork
          under selected print conditions.
        </p>
      </div>
      <ArtStudio />
    </main>
  );
}

import { artworkDesigns } from "@/lib/artwork-designs";
import studies from "@/lib/brand-studies.json";
import studyProofs from "@/lib/brand-study-proofs.json";
import GeneratorStudio from "@/components/generator-studio";
import { destinations } from "@/lib/generator-options";
export const metadata = {
  title: "QR Studio",
  description:
    "Create artistic QR images from brand imagery, validate the finished artwork, and export.",
  alternates: { canonical: "/generator" },
};
export default async function Generator({
  searchParams,
}: {
  searchParams: Promise<{
    resume?: string;
    new?: string;
    art?: string;
    brand?: string;
    portrait?: string;
    type?: string;
    mode?: string;
  }>;
}) {
  const { art, brand, portrait, type, mode, resume, new: fresh } = await searchParams;
  const study = studies.find((s) => s.id === brand);
  const proof =
    study && (studyProofs as Record<string, { strength: number }>)[study.id];
  const brandStudy =
    study && proof ? { ...study, strength: proof.strength } : undefined;
  const initialArtwork =
    artworkDesigns.find((d) => d.id === art)?.id ||
    (!brandStudy && !mode ? "vinyl" : undefined);
  return (
    <main id="main" className="foundation-page generator-page">
      <div className="generator-hero">
        <h1>Give your link a new dimension.</h1>
        <p>Sculptural QR artwork. Your destination. A campaign ready to share.</p>
      </div>
      <GeneratorStudio
        resume={resume === "1" || (!fresh && !art && !brand && !mode && !type && !portrait)}
        resumeRequested={resume === "1"}
        key={`${fresh ? "fresh" : resume || "current"}:${brandStudy?.id || initialArtwork || "custom"}:${portrait === "sample"}:${type || "website"}:${mode || ""}`}
        initialArtwork={initialArtwork}
        brandStudy={brandStudy}
        samplePortrait={portrait === "sample"}
        initialType={destinations.find((d) => d.id === (type || brand))?.id}
        initialMode={
          mode === "custom" || mode === "image" || mode === "art"
            ? mode
            : undefined
        }
      />
    </main>
  );
}

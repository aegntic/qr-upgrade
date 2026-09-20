import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { artworkDesigns } from "@/lib/artwork-designs";
export const metadata = {
  title: "QR image gallery",
  alternates: { canonical: "/templates" },
};
export default function Templates() {
  return (
    <main id="main" className="document-page">
      <span className="section-kicker">ART THAT CARRIES A DESTINATION</span>
      <h1>Find your image direction.</h1>
      <p className="lead">
        Choose an AI-created example, then weave in your destination. Or bring
        your own artwork to the studio.
      </p>
      <p>
        <Link href="/brand-studies" className="nav-cta">
          Explore the 14 brand studies <ArrowUpRight size={16} />
        </Link>
      </p>
      <div className="template-grid">
        {artworkDesigns.map((d) => (
          <Link
            className="template-card"
            key={d.id}
            href={`/generator?art=${d.id}`}
          >
            <img
              src={`/artwork/${d.id}.webp`}
              alt={`${d.name} QR artwork`}
              loading="lazy"
            />
            <span>{d.description}</span>
            <h2>
              {d.name}
              <ArrowUpRight size={20} />
            </h2>
          </Link>
        ))}
      </div>
    </main>
  );
}

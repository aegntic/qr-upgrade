"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Download, Check } from "lucide-react";
import studies from "@/lib/brand-studies.json";

export default function BrandStudies() {
  const [category, setCategory] = useState("All");
  const categories = ["All", ...new Set(studies.map((s) => s.category))];
  const visible = studies.filter(
    (s) => category === "All" || s.category === category,
  );
  return (
    <>
      <div
        className="brand-study-filter"
        role="group"
        aria-label="Filter brand studies"
      >
        {categories.map((c) => (
          <button
            type="button"
            key={c}
            aria-pressed={category === c}
            onClick={() => setCategory(c)}
          >
            {c}
            <span>
              {c === "All"
                ? studies.length
                : studies.filter((s) => s.category === c).length}
            </span>
          </button>
        ))}
      </div>
      <p className="brand-study-count" role="status">
        {visible.length} image{" "}
        {visible.length === 1 ? "direction" : "directions"} · full artwork
        included in every download
      </p>
      <div className="brand-study-grid">
        {visible.map((s) => (
          <article className="brand-study-card" key={s.id}>
            <a
              className="brand-study-art"
              href={`/brand-studies/${s.id}.png`}
              target="_blank"
              rel="noreferrer"
              aria-label={`View ${s.name} QR image at full size`}
            >
              <img
                src={`/brand-studies/${s.id}.webp`}
                alt={`${s.name} identity woven into sculptural QR artwork`}
                width={768}
                height={768}
                loading="lazy"
              />
            </a>
            <div className="brand-study-copy">
              <span className="section-kicker">{s.category}</span>
              <h2>{s.name}</h2>
              <p>{s.use}</p>
              <div className="brand-study-verified">
                <Check size={13} /> Exact destination decoded at 4 sizes
              </div>
              <p className="brand-study-destination">
                Example opens{" "}
                <a href={s.destination} target="_blank" rel="noreferrer">
                  {new URL(s.destination).hostname}
                </a>
              </p>
              <div className="brand-study-actions">
                <Link href={`/generator?brand=${s.id}`} className="nav-cta">
                  Try your own link <ArrowUpRight size={14} />
                </Link>
                <a
                  href={`/brand-studies/${s.id}.png`}
                  download={`${s.id}-qr-study.png`}
                  aria-label={`Download ${s.name} QR image`}
                >
                  <Download size={16} />
                  <span>PNG</span>
                </a>
              </div>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}

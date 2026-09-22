"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUpRight } from "lucide-react";

const pieces = [
  { name: "Sculpted steel", label: "Steel", image: "x-hero", brand: "x", tone: "steel" },
  { name: "Cobalt glass", label: "Glass", image: "linkedin", brand: "linkedin", tone: "glass" },
  { name: "Iridescent folds", label: "Iridescent", image: "instagram", brand: "instagram", tone: "iridescent" },
  { name: "Glazed ceramic", label: "Ceramic", image: "whatsapp", brand: "whatsapp", tone: "ceramic" },
];

export default function ArtworkExhibition() {
  const [index, setIndex] = useState(0);
  const piece = pieces[index];
  return (
    <section className="landing-hero" aria-label="QR artwork studio">
      <div className="landing-hero-copy">
        <p className="landing-eyebrow"><span /> A new dimension in QR</p>
        <h1>QR codes.<br />Worth a<br /><em>closer look.</em></h1>
        <p className="landing-lead">Turn your link into something people want to look at. Sculptural textures. Your identity. A connection in every image.</p>
        <div className="landing-actions">
          <Link className="steel-button" href={`/generator?brand=${piece.brand}`}>Make this yours <ArrowUpRight size={18} /></Link>
          <a className="landing-text-link" href="#studio">Start with your link <ArrowDown size={16} /></a>
        </div>
        <p className="landing-fine">Explore without an account · Check your QR before sharing</p>
      </div>
      <div className="landing-art" data-tone={piece.tone}>
        <div className="landing-art-light" aria-hidden="true" />
        <Link className="landing-art-link" href={`/generator?brand=${piece.brand}`} aria-label={`Personalise ${piece.name} QR artwork`}>
          <img key={piece.image} src={`/brand-studies/${piece.image}.webp`} alt={`${piece.name} QR artwork with sculptural depth`} width={1280} height={1280} fetchPriority="high" className="landing-art-image" />
        </Link>
        <div className="landing-art-caption"><span>0{index + 1} / 04 — Material studies</span><strong>{piece.name}</strong></div>
        <div className="landing-materials" aria-label="Choose a QR artwork material">
          {pieces.map((item, i) => <button key={item.brand} type="button" aria-pressed={index === i} onClick={() => setIndex(i)}><span className={`landing-swatch ${item.tone}`} />{item.label}</button>)}
        </div>
      </div>
      <div className="landing-hero-foot"><span>Looks three-dimensional. Shares as an image.</span><a href="#examples">Discover the collection <ArrowDown size={14} /></a></div>
    </section>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Pause, Play } from "lucide-react";
import { artworkDesigns as showcaseDesigns } from "@/lib/artwork-designs";

export default function QRShowcase() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(true);
  const [visible, setVisible] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);
  const root = useRef<HTMLDivElement>(null);
  const design = showcaseDesigns[index];
  const playing = !paused && !reducedMotion;

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncMotion = () => setReducedMotion(preference.matches);
    const syncVisibility = () =>
      setPageVisible(document.visibilityState === "visible");
    syncMotion();
    syncVisibility();
    preference.addEventListener("change", syncMotion);
    document.addEventListener("visibilitychange", syncVisibility);
    const observer = new IntersectionObserver(([entry]) =>
      setVisible(entry.isIntersecting),
    );
    if (root.current) observer.observe(root.current);
    return () => {
      preference.removeEventListener("change", syncMotion);
      document.removeEventListener("visibilitychange", syncVisibility);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!playing || !visible || !pageVisible) return;
    const timer = window.setInterval(
      () => setIndex((i) => (i + 1) % showcaseDesigns.length),
      3600,
    );
    return () => window.clearInterval(timer);
  }, [playing, visible, pageVisible]);

  function step(direction: number) {
    setPaused(true);
    setIndex(
      (i) => (i + direction + showcaseDesigns.length) % showcaseDesigns.length,
    );
  }

  return (
    <div
      ref={root}
      className="qr-showcase"
      role="region"
      aria-label="14 brand QR design examples"
      aria-roledescription="carousel"
    >
      <div className="showcase-stage art-showcase-stage">
        <figure
          key={design.id}
          className="art-showcase-figure"
          aria-label={`${index + 1} of ${showcaseDesigns.length}: ${design.name}`}
          aria-roledescription="slide"
        >
          <img
            src={`/artwork/${design.id}.webp`}
            width={768}
            height={768}
            alt={`${design.name}: artistic QR image linking to qrupgrade.com`}
            draggable={false}
            fetchPriority={index === 0 ? "high" : "auto"}
          />
          <figcaption>Your Brand Here.</figcaption>
        </figure>
      </div>
      <div className="showcase-console">
        <div
          className="showcase-readout"
          aria-live={playing ? "off" : "polite"}
          aria-atomic="true"
        >
          <span className="showcase-number">
            {String(index + 1).padStart(2, "0")} <span>/ 14</span>
          </span>
          <span>{design.name}</span>
        </div>
        <div className="showcase-switches">
          <button
            type="button"
            onClick={() => step(-1)}
            aria-label="Previous QR design"
          >
            <ArrowLeft size={13} />
          </button>
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            aria-label={playing ? "Pause QR animation" : "Play QR animation"}
            disabled={reducedMotion}
            title={
              reducedMotion
                ? "Animation paused for your reduced-motion preference. Use the arrows to browse."
                : undefined
            }
          >
            {playing ? <Pause size={12} /> : <Play size={12} />}
          </button>
          <button
            type="button"
            onClick={() => step(1)}
            aria-label="Next QR design"
          >
            <ArrowRight size={13} />
          </button>
        </div>
      </div>
      <p className="showcase-footnote">
        14 original QR images. The artwork carries the destination.
      </p>
    </div>
  );
}

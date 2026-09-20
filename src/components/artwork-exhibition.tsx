"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUpRight } from "lucide-react";
import { artworkDesigns } from "@/lib/artwork-designs";
import { useSceneMotion } from "./motion-system";

const pieces = [
  {
    id: "steel",
    name: "Sculpted steel",
    material: "Metal / marble",
    image: "/brand-studies/x-hero.webp",
    href: "/generator?brand=x",
  },
  ...artworkDesigns
    .filter((d) => d.id !== "dragon")
    .map((d) => ({
      id: d.id,
      name: d.name,
      material: "Art / QR",
      image: `/artwork/${d.id}.webp`,
      href: `/generator?art=${d.id}`,
    })),
];
export default function ArtworkExhibition() {
  const [index, setIndex] = useState(0);
  const [hasExplored, setHasExplored] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [onScreen, setOnScreen] = useState(true);
  const { playing } = useSceneMotion();
  const ref = useRef<HTMLDivElement>(null);
  const tiltRef = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    const target = ref.current;
    if (!target) return;
    const observer = new IntersectionObserver(([entry]) =>
      setOnScreen(entry.isIntersecting),
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!hasExplored || !playing || hovered || focused || !onScreen) return;
    const timer = setInterval(
      () => setIndex((i) => (i + 1) % pieces.length),
      6200,
    );
    return () => clearInterval(timer);
  }, [hasExplored, playing, hovered, focused, onScreen]);
  useEffect(() => {
    if (!playing) {
      tiltRef.current?.style.removeProperty("--tilt-x");
      tiltRef.current?.style.removeProperty("--tilt-y");
    }
  }, [playing]);
  const piece = pieces[index];
  function tilt(e: React.PointerEvent<HTMLAnchorElement>) {
    if (!playing || e.pointerType !== "mouse") return;
    const box = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty(
      "--tilt-x",
      `${((e.clientY - box.top - box.height / 2) / box.height) * -7}deg`,
    );
    e.currentTarget.style.setProperty(
      "--tilt-y",
      `${((e.clientX - box.left - box.width / 2) / box.width) * 9}deg`,
    );
  }
  return (
    <section className="exhibition-hero">
      <div className="exhibition-copy">
        <h1>
          <span>A little square.</span>
          <span>
            A different
            <br /> dimension.
          </span>
        </h1>
        <p>
          Turn your link into a piece of your world.
          <br />
          Custom QR images. Designed to be seen.
        </p>
        <div className="hero-actions">
          <a className="steel-button" href="#studio">
            Create your QR <ArrowUpRight size={18} />
          </a>
          <a className="quiet-link" href="#examples">
            Explore the artwork <ArrowDown size={15} />
          </a>
        </div>
        <div className="hero-assurance">
          <span className="signal-light" />
          No account needed. Your images stay yours.
        </div>
      </div>
      <div
        className="exhibition"
        ref={ref}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocusCapture={() => setFocused(true)}
        onBlurCapture={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) setFocused(false);
        }}
      >
        <div className="exhibition-orbit" aria-hidden="true" />
        <div className="exhibition-platform" aria-hidden="true" />
        <Link
          ref={tiltRef}
          className="exhibition-object"
          data-material={piece.id === "steel" ? "steel" : "art"}
          href={piece.href}
          aria-label={`Create with ${piece.name}`}
          onPointerMove={tilt}
          onPointerLeave={(e) => {
            e.currentTarget.style.removeProperty("--tilt-x");
            e.currentTarget.style.removeProperty("--tilt-y");
          }}
        >
          <span className="exhibition-backplate" aria-hidden="true" />
          <span className="exhibition-art-face">
            {pieces.map((item, i) => (
              <img
                key={item.id}
                className={
                  i === index ? "exhibit-image is-current" : "exhibit-image"
                }
                src={item.image}
                alt={i === index ? `${item.name} QR artwork` : ""}
                aria-hidden={i !== index}
                width={768}
                height={768}
                loading={i > 1 ? "lazy" : "eager"}
                fetchPriority={i === 0 ? "high" : "auto"}
              />
            ))}
            <span className="exhibition-reflection" aria-hidden="true" />
          </span>
          <span className="exhibition-signature">Your Brand Here.</span>
        </Link>
        <div className="exhibition-caption">
          <div>
            <span className="exhibition-count">
              {String(index + 1).padStart(2, "0")} / {pieces.length}
            </span>
            <Link
              className="exhibition-use"
              href={piece.href}
              aria-label={`Use ${piece.name} artwork`}
            >
              <strong>{piece.name}</strong>
              <span>
                Make this yours <ArrowUpRight size={12} />
              </span>
            </Link>
          </div>
          <div className="exhibition-controls">
            <button
              onClick={() => {
                setHasExplored(true);
                setIndex((i) => (i + pieces.length - 1) % pieces.length);
              }}
              aria-label="Previous artwork"
            >
              <ArrowLeft size={16} />
            </button>
            <button
              onClick={() => {
                setHasExplored(true);
                setIndex((i) => (i + 1) % pieces.length);
              }}
              aria-label="Next artwork"
            >
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
        <div className="exhibition-progress" aria-hidden="true">
          {pieces.map((p, i) => (
            <span
              key={p.id}
              className={i === index ? "current" : ""}
              style={{ "--piece-index": i } as CSSProperties}
            />
          ))}
        </div>
      </div>
      <div className="exhibition-bottom">
        <span>Artwork that opens a connection.</span>
        <a href="#studio">
          Enter the studio <ArrowDown size={14} />
        </a>
      </div>
    </section>
  );
}

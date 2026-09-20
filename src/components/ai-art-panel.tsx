"use client";

import { useEffect, useRef, useState } from "react";
import { Check, LoaderCircle, Sparkles } from "lucide-react";
import "../app/ai-art.css";

type Style = "steel" | "glass" | "botanical" | "illustrated";
type Service = { enabled: boolean; dailyLimit: number };
type Job = { id: string; status: "pending" | "ready" | "failed"; image?: string; error?: string };
type Variant = { id: string; image: string; prompt: string; style: Style };

const styles: { id: Style; label: string }[] = [
  { id: "steel", label: "Steel" },
  { id: "glass", label: "Glass" },
  { id: "botanical", label: "Botanical" },
  { id: "illustrated", label: "Illustrated" },
];

async function readError(response: Response, fallback: string) {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error || fallback;
  } catch {
    return fallback;
  }
}

export default function AiArtPanel({ onApply }: { onApply: (image: string) => void }) {
  const [service, setService] = useState<Service | null>(null);
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState<Style>("steel");
  const [status, setStatus] = useState<"idle" | "submitting" | "pending">("idle");
  const [error, setError] = useState("");
  const [variants, setVariants] = useState<Variant[]>([]);
  const [selected, setSelected] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/art", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(await readError(response, "AI artwork is unavailable right now."));
        return response.json() as Promise<Service>;
      })
      .then(setService)
      .catch((reason) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setService({ enabled: false, dailyLimit: 3 });
      });
    return () => controller.abort();
  }, []);

  useEffect(() => () => {
    abortRef.current?.abort();
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  async function poll(id: string, requestPrompt: string, requestStyle: Style, controller: AbortController) {
    const deadline = Date.now() + 45_000;
    while (!controller.signal.aborted && Date.now() < deadline) {
      const response = await fetch(`/api/art?id=${encodeURIComponent(id)}`, { signal: controller.signal });
      if (!response.ok) throw new Error(await readError(response, "Could not check the artwork."));
      const job = (await response.json()) as Job;
      if (job.status === "ready" && job.image) {
        const variant = { id, image: job.image, prompt: requestPrompt, style: requestStyle };
        setVariants((items) => [variant, ...items.filter((item) => item.id !== id)].slice(0, 3));
        setSelected(id);
        setStatus("idle");
        return;
      }
      if (job.status === "failed") throw new Error(job.error || "Artwork generation failed.");
      await new Promise<void>((resolve) => {
        timerRef.current = setTimeout(resolve, 1500);
      });
    }
    if (!controller.signal.aborted) throw new Error("Generation is taking longer than expected. Try again in a moment.");
  }

  async function generate() {
    const requestPrompt = prompt.trim();
    if (requestPrompt.length < 8 || requestPrompt.length > 800 || status !== "idle") return;
    abortRef.current?.abort();
    if (timerRef.current) clearTimeout(timerRef.current);
    const controller = new AbortController();
    abortRef.current = controller;
    const id = crypto.randomUUID();
    setError("");
    setStatus("submitting");
    try {
      let accepted = false;
      try {
        const response = await fetch("/api/art", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ requestId: id, prompt: requestPrompt, style }),
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(await readError(response, "Could not start generation."));
        accepted = true;
      } catch (reason) {
        if (controller.signal.aborted) return;
        const check = await fetch(`/api/art?id=${encodeURIComponent(id)}`, { signal: controller.signal });
        if (check.ok) accepted = true;
        else throw reason;
      }
      if (accepted) {
        setStatus("pending");
        await poll(id, requestPrompt, style, controller);
      }
    } catch (reason) {
      if (controller.signal.aborted) return;
      setStatus("idle");
      setError(reason instanceof Error ? reason.message : "Artwork generation failed.");
    }
  }

  const selectedVariant = variants.find((variant) => variant.id === selected);
  const validPrompt = prompt.trim().length >= 8 && prompt.trim().length <= 800;
  const busy = status !== "idle";

  return (
    <section className="ai-art-panel" aria-labelledby="ai-art-title">
      <div className="ai-art-heading">
        <div>
          <span className="section-kicker"><Sparkles size={12} /> Live AI artwork</span>
          <h3 id="ai-art-title">Describe a new visual direction</h3>
        </div>
        <span className="ai-art-limit">3 generations per day</span>
      </div>
      {service === null ? (
        <p className="ai-art-status" role="status">Checking generator availability…</p>
      ) : !service.enabled ? (
        <p className="ai-art-unavailable">Live generation is unavailable right now. The artwork library below is ready to use.</p>
      ) : (
        <>
          <label className="ai-art-prompt">
            <span>Artwork prompt</span>
            <textarea
              value={prompt}
              maxLength={800}
              rows={3}
              placeholder="A luminous glass koi circling through deep blue water…"
              onChange={(event) => setPrompt(event.target.value)}
              disabled={busy}
            />
            <small>{prompt.length}/800 · at least 8 characters</small>
          </label>
          <div className="ai-art-styles" role="group" aria-label="Artwork style">
            {styles.map((option) => (
              <button key={option.id} aria-pressed={style === option.id} onClick={() => setStyle(option.id)} disabled={busy}>
                {option.label}
              </button>
            ))}
          </div>
          <button className="ai-art-generate" onClick={generate} disabled={!validPrompt || busy}>
            {busy ? <LoaderCircle className="ai-art-spinner" size={15} /> : <Sparkles size={15} />}
            {status === "submitting" ? "Starting…" : status === "pending" ? "Creating artwork…" : variants.length ? "Generate another" : "Generate artwork"}
          </button>
          <p className="ai-art-privacy">Only this prompt and style are sent when you generate. Your QR destination and images stay here.</p>
          {error && <p className="ai-art-error" role="alert">{error} Generate again to retry; each new generation uses one daily attempt.</p>}
          {variants.length > 0 && (
            <div className="ai-art-results">
              <div className="ai-art-variants" role="group" aria-label="Generated artwork variants">
                {variants.map((variant) => (
                  <button key={variant.id} aria-pressed={selected === variant.id} onClick={() => setSelected(variant.id)}>
                    <img src={variant.image} alt={`Generated ${variant.style} artwork`} />
                    {selected === variant.id && <Check size={13} aria-hidden="true" />}
                  </button>
                ))}
              </div>
              <button className="ai-art-apply" disabled={!selectedVariant} onClick={() => selectedVariant && onApply(selectedVariant.image)}>
                Apply selected artwork
              </button>
              <p>Generated images expire after one hour. Apply one to keep working with it in this browser.</p>
            </div>
          )}
        </>
      )}
    </section>
  );
}

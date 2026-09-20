"use client";

import { useEffect, useRef, useState } from "react";
import { Check, LoaderCircle, Sparkles } from "lucide-react";
import "../app/ai-art.css";

type Style = "steel" | "glass" | "botanical" | "illustrated";
type Service = { enabled: boolean; dailyLimit: number };
type Job = { id: string; status: "pending" | "ready" | "failed"; image?: string; error?: string };
type Variant = { id: string; image: string; prompt: string; style: Style };
type Outstanding = { id: string; prompt: string; style: Style };

class ResponseError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

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
  const [outstanding, setOutstanding] = useState<Outstanding | null>(null);
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

  function pause(controller: AbortController) {
    return new Promise<void>((resolve) => {
      if (controller.signal.aborted) return resolve();
      const finish = () => {
        if (timerRef.current) clearTimeout(timerRef.current);
        controller.signal.removeEventListener("abort", finish);
        resolve();
      };
      timerRef.current = setTimeout(finish, 1500);
      controller.signal.addEventListener("abort", finish, { once: true });
    });
  }

  async function poll(request: Outstanding, controller: AbortController) {
    const deadline = Date.now() + 45_000;
    while (!controller.signal.aborted && Date.now() < deadline) {
      const response = await fetch(`/api/art?id=${encodeURIComponent(request.id)}`, { signal: controller.signal });
      if (!response.ok) throw new ResponseError(await readError(response, "Could not check the artwork."), response.status);
      const job = (await response.json()) as Job;
      if (job.status === "ready" && job.image) {
        const variant = { id: request.id, image: job.image, prompt: request.prompt, style: request.style };
        setVariants((items) => [variant, ...items.filter((item) => item.id !== request.id)].slice(0, 3));
        setSelected(request.id);
        setOutstanding(null);
        setStatus("idle");
        return;
      }
      if (job.status === "failed") {
        setOutstanding(null);
        throw new ResponseError(job.error || "Artwork generation failed. Generate another to retry.", 422);
      }
      await pause(controller);
    }
    if (!controller.signal.aborted) throw new Error("Generation is taking longer than expected. Try again in a moment.");
  }

  async function checkAgain(request = outstanding) {
    if (!request || status !== "idle") return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setError("");
    setStatus("pending");
    try {
      await poll(request, controller);
    } catch (reason) {
      if (controller.signal.aborted) return;
      setStatus("idle");
      if (reason instanceof ResponseError && [404, 410, 422].includes(reason.status)) setOutstanding(null);
      setError(reason instanceof Error ? reason.message : "Could not check the artwork.");
    }
  }

  async function generate() {
    const requestPrompt = prompt.trim();
    if (requestPrompt.length < 8 || requestPrompt.length > 800 || status !== "idle") return;
    abortRef.current?.abort();
    if (timerRef.current) clearTimeout(timerRef.current);
    const controller = new AbortController();
    abortRef.current = controller;
    const request = { id: crypto.randomUUID(), prompt: requestPrompt, style };
    setOutstanding(request);
    setError("");
    setStatus("submitting");
    try {
      // Refresh the acknowledged owner lease before spending an attempt.
      const bootstrap = await fetch("/api/art", { signal: controller.signal, cache: "no-store" });
      if (!bootstrap.ok) throw new Error("Could not prepare your session. Check your connection and try again.");
      const response = await fetch("/api/art", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: request.id, prompt: request.prompt, style: request.style }),
        signal: controller.signal,
      });
      if (!response.ok) throw new ResponseError(await readError(response, "Could not start generation."), response.status);
      setStatus("pending");
      await poll(request, controller);
    } catch (reason) {
      if (controller.signal.aborted) return;
      setStatus("idle");
      if (reason instanceof ResponseError && reason.status < 500) setOutstanding(null);
      setError(reason instanceof Error ? reason.message : "The request may still be processing. Check again before generating another.");
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
            {status === "submitting" ? "Starting…" : status === "pending" ? "Creating artwork…" : variants.length || outstanding ? "Generate another" : "Generate artwork"}
          </button>
          <p className="ai-art-privacy">Only this prompt and style are sent when you generate. Your QR destination and images stay here.</p>
          {error && <p className="ai-art-error" role="alert">{error}</p>}
          {outstanding && status === "idle" && (
            <div className="ai-art-recovery">
              <button onClick={() => checkAgain()}>Check this generation again</button>
              <p>This checks the same request and does not use another daily attempt. Generate another only when you want a new image.</p>
            </div>
          )}
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
              <p>Generated images are available to apply for one hour and are removed from the service within two hours. Apply one to keep working with it in this browser.</p>
            </div>
          )}
        </>
      )}
    </section>
  );
}

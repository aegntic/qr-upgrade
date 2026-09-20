"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useWorkflow } from "./workflow-provider";
import { DestinationFields } from "./destination-fields";
import { saveDesign } from "@/lib/design-store";
import { defaultImageAdjustments, defaultCaption, type EditorDraft } from "@/lib/editor-draft";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type Ref,
} from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowDownToLine,
  Check,
  ChevronDown,
  ImagePlus,
  LoaderCircle,
  RotateCcw,
  ShieldCheck,
  Shuffle,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import {
  createMatrix,
  payload,
  qrSvg,
  svgData,
  type Appearance,
  type Content,
} from "@/lib/qr";
import { createQrImage } from "@/lib/browser-art";
import { exportQR, readLocalImage, validateRendered } from "@/lib/browser-qr";
import { artworkDesigns } from "@/lib/artwork-designs";
import { DestinationIcon } from "./destination-icon";
import { QrPreviewDialog } from "./qr-preview-dialog";
import AiArtPanel from "./ai-art-panel";
import CloudSave from "./cloud-save";
import "../app/composition.css";
import artProofs from "@/lib/artwork-proofs.json";
import {
  destinations,
  contentTypeForDestination,
  featuredDestinations,
  templates,
  type DestinationId,
  type GeneratorMode,
} from "@/lib/generator-options";

const initialContent: Content = {
  type: "url",
  url: "https://qrupgrade.com/",
  ssid: "",
  password: "",
  name: "",
  email: "",
  phone: "",
};
const demoMatrix = createMatrix(initialContent.url);
type Rendered = Awaited<ReturnType<typeof createQrImage>> &
  Awaited<ReturnType<typeof validateRendered>> & { key: string };
type Study = {
  id: string;
  name: string;
  destination: string;
  strength: number;
};
const modes = [
  {
    id: "custom",
    name: "Custom QR",
    description: "Your colours. Your style.",
    image: svgData(qrSvg(demoMatrix, templates[14])),
  },
  {
    id: "image",
    name: "Image QR",
    description: "Start with your own image.",
    image: "/brand-studies/x-portrait.png",
  },
  {
    id: "art",
    name: "QR Art",
    description: "Artwork becomes the code.",
    image: "/artwork/tiger.webp",
  },
] as const;

export default function GeneratorStudio({
  initialArtwork,
  brandStudy: incomingBrandStudy,
  resume = true,
  resumeRequested = false,
  initialType = "website",
  initialMode,
  samplePortrait = false,
}: {
  initialArtwork?: (typeof artworkDesigns)[number]["id"];
  brandStudy?: Study;
  resume?: boolean;
  resumeRequested?: boolean;
  initialType?: DestinationId;
  initialMode?: GeneratorMode;
  samplePortrait?: boolean;
}) {
  const workflow = useWorkflow();
  const router = useRouter();
  const [seed] = useState(() => resume ? workflow.draft : null);
  const brandStudy = seed?.brandStudy ?? incomingBrandStudy;
  const [savedId, setSavedId] = useState(seed ? workflow.savedId : undefined);
  const [name, setName] = useState(seed?.name || 'Untitled QR');
  const [saving, setSaving] = useState(false);
  const [cloudSaving, setCloudSaving] = useState(false);
  const [cloudId, setCloudId] = useState(seed?.cloudId);
  const [destinationQuery, setDestinationQuery] = useState('');
  const [designQuery, setDesignQuery] = useState("");
  const [adjustments, setAdjustments] = useState(seed?.adjustments || defaultImageAdjustments);
  const [caption, setCaption] = useState(seed?.caption || defaultCaption);
  const [logoFrame, setLogoFrame] = useState<'plain' | 'metal'>(seed?.logoFrame || 'plain');
  const [kind, setKind] = useState<DestinationId>(seed?.kind || initialType);
  const [content, setContent] = useState<Content>(seed?.content || {
    ...initialContent,
    type: contentTypeForDestination(initialType),
    url:
      brandStudy?.destination ||
      (initialType === "website" ? initialContent.url : ""),
  });
  const [mode, setMode] = useState<GeneratorMode>(
    seed?.mode || initialMode || (initialArtwork || brandStudy ? "art" : "custom"),
  );
  const [tab, setTab] = useState("Designs");
  const [moreTypes, setMoreTypes] = useState(
    !featuredDestinations.includes(seed?.kind || initialType),
  );
  const [appearance, setAppearance] = useState<Appearance>(seed?.appearance || templates[0]);
  const [template, setTemplate] = useState(seed?.template || "Essential");
  const [art, setArt] = useState(seed?.art || initialArtwork || "dragon");
  const [studyActive, setStudyActive] = useState(seed?.studyActive ?? !!brandStudy);
  const [customImage, setCustomImage] = useState(seed?.customImage || "");
  const [logo, setLogo] = useState(
    seed?.logo || (samplePortrait ? "/brand-studies/sample-portrait.png" : ""),
  );
  const [logoSize, setLogoSize] = useState(seed?.logoSize ?? 20);
  const [strength, setStrength] = useState(
    seed?.strength ?? brandStudy?.strength ?? artProofs[initialArtwork || "dragon"].strength,
  );
  const [sizeMm, setSizeMm] = useState(seed?.sizeMm ?? 70);
  const [format, setFormat] = useState<"png" | "svg" | "pdf" | "jpg" | "webp">("png");
  const [showUtm, setShowUtm] = useState(seed?.showUtm ?? false);
  const [utm, setUtm] = useState(seed?.utm || { source: "", medium: "", campaign: "" });
  const [result, setResult] = useState<Rendered | null>(null);
  const [renderEpoch, setRenderEpoch] = useState(0);
  const [failure, setFailure] = useState<{
    key: string;
    message: string;
  } | null>(null);
  const [message, setMessage] = useState("");
  const [attemptedDestination, setAttemptedDestination] = useState(false);
  const [uploading, setUploading] = useState({ image: false, logo: false });
  const [previewOpen, setPreviewOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const uploadInput = useRef<HTMLInputElement>(null),
    logoInput = useRef<HTMLInputElement>(null);
  const uploads = useRef({ image: 0, logo: 0 });
  const stateEpoch = useRef(0);
  const destinationDrafts = useRef<Partial<Record<DestinationId, string>>>(seed?.destinationDrafts || {});
  const destinationFields = useRef<HTMLDivElement>(null);
  const designHeading = useRef<HTMLHeadingElement>(null);
  const previewHeading = useRef<HTMLHeadingElement>(null);
  const kindInfo = destinations.find((d) => d.id === kind)!;
  const uploadsBusy = uploading.image || uploading.logo;
  const previewSample =
    mode === "custom"
      ? modes[0].image
      : mode === "image" && customImage
        ? customImage
        : studyActive && brandStudy
          ? `/brand-studies/${brandStudy.id}.webp`
          : `/artwork/${art}.webp`;
  const encoded = useMemo(() => {
    try {
      let text = payload(content);
      if (content.type === "url" && showUtm) {
        const url = new URL(text);
        for (const key of ["source", "medium", "campaign"] as const) {
          if (utm[key].trim())
            url.searchParams.set(`utm_${key}`, utm[key].trim());
        }
        text = payload({ ...content, url: url.href });
      }
      return { text, matrix: createMatrix(text), error: "" };
    } catch (error) {
      return {
        text: "",
        matrix: null,
        error: error instanceof Error ? error.message : "Check your content.",
      };
    }
  }, [content, utm, showUtm]);
  const source =
    mode === "custom"
      ? encoded.matrix
        ? svgData(qrSvg(encoded.matrix, appearance))
        : ""
      : mode === "image" && customImage
        ? customImage
        : studyActive && brandStudy
          ? `/brand-studies/${brandStudy.id}-source.png`
          : `/artwork/${art}-source.png`;
  const key = JSON.stringify([
    renderEpoch,
    mode,
    source,
    encoded.text,
    strength,
    logo,
    logoSize,
    logoFrame,
    sizeMm,
    adjustments,
    caption,
  ]);
  const current = result?.key === key ? result : null;
  const renderError = failure?.key === key ? failure.message : "";
  const dimensionsPass =
    !!encoded.matrix &&
    sizeMm / (encoded.matrix.size + 8) >= 0.4 &&
    sizeMm >= 40;
  const ready =
    !!current?.pristine &&
    current.reduced &&
    current.simulated &&
    dimensionsPass;
  const checks = [
    current?.pristine,
    current?.reduced,
    current?.simulated,
    dimensionsPass,
  ];
  const passed = checks.filter(Boolean).length;
  useEffect(() => {
    let cancelled = false;
    if (!encoded.text || !source) return;
    const timeout = setTimeout(async () => {
      try {
        const rendered = await createQrImage(
          source,
          encoded.text,
          strength,
          logo
            ? { src: logo, sizePercent: logoSize, frame: logoFrame }
            : undefined,
          mode !== "custom",
          { adjustments, caption },
        );
        const identityAdjustments = JSON.stringify(adjustments) === JSON.stringify(defaultImageAdjustments);
        if (mode === "custom" && !logo && !caption.text.trim() && identityAdjustments && encoded.matrix)
          rendered.svg = qrSvg(encoded.matrix, appearance);
        const proof = await validateRendered(rendered.svg, encoded.text, {
          sizeMm,
          distanceCm: 40,
          blur: 0,
          rotation: 0,
        });
        if (!cancelled) {
          setResult({ ...rendered, ...proof, key });
          setFailure(null);
        }
      } catch (error) {
        if (!cancelled)
          setFailure({
            key,
            message:
              error instanceof Error
                ? error.message
                : "This image could not be created.",
          });
      }
    }, 160);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [
    key,
    encoded.text,
    encoded.matrix,
    source,
    strength,
    logo,
    logoSize,
    logoFrame,
    sizeMm,
    mode,
    appearance,
    adjustments,
    caption,
  ]);
  useEffect(
    () => () => {
      uploads.current.image++;
      uploads.current.logo++;
    },
    [],
  );

  const draft = useMemo<EditorDraft>(() => ({
    version: 1, cloudId, kind, content, mode, appearance, template, art, brandStudy, studyActive,
    customImage, logo, logoSize, logoFrame, strength, sizeMm, showUtm, utm, adjustments, caption, name,
    destinationDrafts: { ...destinationDrafts.current },
  }), [cloudId, kind, content, mode, appearance, template, art, brandStudy, studyActive, customImage, logo, logoSize, logoFrame, strength, sizeMm, showUtm, utm, adjustments, caption, name]);
  const artifact = useMemo(() => current && encoded.matrix && !uploadsBusy ? {
    png: current.png, svg: current.svg, text: encoded.text, sizeMm, modules: encoded.matrix.size,
    pristine: current.pristine, reduced: current.reduced, simulated: current.simulated, dimensionsPass,
  } : null, [current, encoded.matrix, encoded.text, sizeMm, dimensionsPass, uploadsBusy]);
  useEffect(() => { workflow.setDesign(draft, artifact, savedId); }, [draft, artifact, savedId, workflow.setDesign]);
  async function save() {
    if (!artifact || saving || uploadsBusy) return;
    const epoch = stateEpoch.current;
    const capturedName = draft.name;
    setSaving(true);
    try { const item = await saveDesign(draft, artifact, savedId); if (epoch === stateEpoch.current) { setSavedId(item.id); setName((value) => value === capturedName ? item.name : value); setMessage('Saved in this browser. Open My designs to revisit it.'); } }
    catch (e) { if (epoch === stateEpoch.current) setMessage(e instanceof Error ? e.message : 'Could not save the design.'); }
    finally { if (epoch === stateEpoch.current) setSaving(false); }
  }
  function testDesign() {
    if (!artifact || uploadsBusy) return;
    workflow.setDesign(draft, artifact, savedId);
    router.push('/scan-lab');
  }

  function chooseType(id: DestinationId) {
    if (id === kind) return;
    if (content.type === "url") destinationDrafts.current[kind] = content.url;
    setKind(id);
    setAttemptedDestination(false);
    setMessage("");
    setContent((c) => ({
      ...c,
      type: contentTypeForDestination(id),
      url: destinationDrafts.current[id] || "",
    }));
  }
  function goToHeading(heading: HTMLHeadingElement | null) {
    if (!heading) return;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    heading.focus({ preventScroll: true });
    heading.scrollIntoView({
      behavior:
        reduced || document.documentElement.dataset.motion === "paused"
          ? "instant"
          : "smooth",
      block: "start",
    });
  }
  function continueToDesign() {
    if (encoded.error) {
      setAttemptedDestination(true);
      destinationFields.current?.querySelector("input")?.focus();
      return;
    }
    goToHeading(designHeading.current);
  }
  function update(field: keyof Content, value: string) {
    setContent((c) => ({ ...c, [field]: value }));
    setMessage("");
  }
  function chooseArt(id: typeof art) {
    uploads.current.image++;
    setUploading((active) => ({ ...active, image: false }));
    setArt(id);
    setStudyActive(false);
    setStrength(artProofs[id].strength);
  }
  function applyGeneratedArt(image: string) {
    uploads.current.image++;
    setUploading((active) => ({ ...active, image: false }));
    setCustomImage(image);
    setMode("image");
    setStudyActive(false);
    setAdjustments(defaultImageAdjustments);
    setStrength(0.4);
    setTab("Style");
    setResult(null);
    setFailure(null);
    setRenderEpoch((value) => value + 1);
    setMessage("Generated artwork applied. Checking the complete QR image now.");
  }
  function chooseTemplate(index: number) {
    uploads.current.image++;
    setUploading((active) => ({ ...active, image: false }));
    setAppearance(templates[index]);
    setTemplate(templates[index].name);
  }
  async function selectFile(file: File | undefined, target: "image" | "logo") {
    if (!file) return;
    const request = ++uploads.current[target];
    setUploading((active) => ({ ...active, [target]: true }));
    setMessage("");
    try {
      const image = await readLocalImage(file);
      if (request !== uploads.current[target]) return;
      if (target === "logo") setLogo(image);
      else {
        setCustomImage(image);
        setMode("image");
        setStrength(0.35);
      }
    } catch (error) {
      if (request === uploads.current[target])
        setMessage(
          error instanceof Error
            ? error.message
            : "Please choose another image.",
        );
    } finally {
      if (request === uploads.current[target])
        setUploading((active) => ({ ...active, [target]: false }));
    }
  }
  function reset() {
    if (saving || cloudSaving) return;
    stateEpoch.current++;
    destinationDrafts.current = {};
    setAttemptedDestination(false);
    uploads.current.image++;
    uploads.current.logo++;
    setContent(initialContent);
    setSavedId(undefined);
    setCloudId(undefined);
    setName("Untitled QR");
    setAdjustments(defaultImageAdjustments);
    setCaption(defaultCaption);
    setLogoFrame("plain");
    setKind("website");
    setMode("custom");
    setTab("Designs");
    setAppearance(templates[0]);
    setTemplate("Essential");
    setArt("dragon");
    setStudyActive(false);
    setCustomImage("");
    setLogo("");
    setLogoSize(20);
    setStrength(artProofs.dragon.strength);
    setUtm({ source: "", medium: "", campaign: "" });
    setShowUtm(false);
    setMoreTypes(false);
    setSizeMm(70);
    setUploading({ image: false, logo: false });
    setResult(null);
    setRenderEpoch((value) => value + 1);
    setMessage("Draft cleared. Your downloaded files are unchanged.");
  }
  function repair() {
    setSizeMm((s) =>
      Math.ceil(Math.max(s, 40, ((encoded.matrix?.size || 21) + 8) * 0.5)),
    );
    if (mode === "custom") {
      setTemplate("");
      setAppearance((a) => ({
        ...a,
        foreground: "#202025",
        background: "#ffffff",
      }));
    } else setStrength((s) => Math.min(1, s + 0.2));
    if (logo) setLogoSize((s) => Math.max(10, s - 2));
    setMessage(
      "Adjusted contrast and size. Checking the complete QR image again.",
    );
  }
  async function download() {
    if (!ready || !current || uploadsBusy || exporting) return;
    setExporting(true);
    setMessage("");
    try {
      await exportQR(current.svg, format, sizeMm, name, encoded.text);
      setMessage(
        "Downloaded. Test your QR on a phone and a physical proof before printing a batch.",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Download failed.");
    } finally {
      setExporting(false);
    }
  }
  return (
    <section
      className="generator-shell"
      data-ready={ready ? "true" : "false"}
      id="studio"
      aria-label="QR code generator"
    >
      <div className="generator-topline">
        <span>
          <span className="status-dot" /> Your QR starts here
        </span>
        <span>
          <ShieldCheck size={12} /> Images and destinations are processed here · AI prompts are sent only when you generate
        </span>
      </div>
      <div className="generator-grid">
        <div className="generator-controls">
          <section className="generator-step">
            <Step number="1" title="Your destination" />
            {resumeRequested && !seed && <p className="workflow-notice">That unsaved session has ended. <Link href="/designs">Open a saved design</Link>, or create a new one below.</p>}
            <label className="workflow-search destination-search"><input aria-label="Search destinations" placeholder="Search destinations — Wi-Fi, contact, event…" value={destinationQuery} onChange={e=>{setDestinationQuery(e.target.value);if(e.target.value)setMoreTypes(true);}}/></label>
            <p className="destination-intro">What would you like to share?</p>
            <div
              className="destination-options"
              role="group"
              aria-label="QR destination"
            >
              {featuredDestinations
                .map((id) => destinations.find((d) => d.id === id)!)
                .map((d) => (
                  <button
                    key={d.id}
                    aria-pressed={kind === d.id}
                    onClick={() => chooseType(d.id)}
                    className="destination-option"
                    style={{ "--destination-color": d.color } as CSSProperties}
                  >
                    <span className="destination-symbol">
                      <DestinationIcon id={d.id} size={72} />
                    </span>
                    <span>{d.name}</span>
                    {kind === d.id && (
                      <Check
                        className="destination-selected"
                        size={11}
                        aria-hidden="true"
                      />
                    )}
                  </button>
                ))}
            </div>
            <button
              className="destination-more"
              aria-expanded={moreTypes}
              aria-controls="more-destinations"
              onClick={() => setMoreTypes((v) => !v)}
            >
              <span>{moreTypes ? "Show less" : "More ways to share"}</span>
              <span>{moreTypes ? "" : "Wi-Fi, PDFs, Spotify + more"}</span>
              <ChevronDown size={14} />
            </button>
            {moreTypes && (
              <div
                id="more-destinations"
                className="destination-extra"
                role="group"
                aria-label="More QR destinations"
              >
                {destinations
                  .filter((d) => !featuredDestinations.includes(d.id) && `${d.name} ${d.description}`.toLowerCase().includes(destinationQuery.toLowerCase()))
                  .map((d) => (
                    <button
                      key={d.id}
                      className="destination-extra-option"
                      aria-pressed={kind === d.id}
                      onClick={() => chooseType(d.id)}
                    >
                      <DestinationIcon id={d.id} size={18} />
                      <span>{d.name}</span>
                      {kind === d.id && <Check size={12} aria-hidden="true" />}
                    </button>
                  ))}
              </div>
            )}
            {destinationQuery && !destinations.some(d=>`${d.name} ${d.description}`.toLowerCase().includes(destinationQuery.toLowerCase())) && <p role="status" className="generator-note">No destinations match. Try website, Wi-Fi or contact.</p>}
            <div
              className="destination-entry"
              ref={destinationFields}
              style={{ "--destination-color": kindInfo.color } as CSSProperties}
              onKeyDown={(e) => {
                if (e.key === "Enter" && e.target instanceof HTMLInputElement) {
                  e.preventDefault();
                  continueToDesign();
                }
              }}
            >
              <p className="destination-context" key={kind}>
                {kindInfo.description}
              </p>
              <DestinationFields kind={kind} content={content} onChange={setContent} />
              {content.type === "url" && (
                <>
                  <div className="destination-tools">
                    <button
                      className="small-control"
                      aria-expanded={showUtm}
                      onClick={() => setShowUtm((v) => !v)}
                    >
                      UTM parameters <ChevronDown size={12} />
                    </button>
                    <span>Direct link · no expiry</span>
                  </div>
                  {showUtm && (
                    <div className="utm-fields">
                      {(["source", "medium", "campaign"] as const).map(
                        (field) => (
                          <Field
                            key={field}
                            label={
                              field === "campaign"
                                ? "Campaign name"
                                : `Campaign ${field}`
                            }
                            value={utm[field]}
                            maxLength={160}
                            onChange={(v) =>
                              setUtm((u) => ({ ...u, [field]: v }))
                            }
                          />
                        ),
                      )}
                      <p className="generator-note">
                        Adds campaign tags to the destination URL. View results
                        in your website’s analytics.
                      </p>
                    </div>
                  )}
                </>
              )}
              {encoded.error && attemptedDestination && (
                <p className="generator-error" role="alert">
                  {encoded.error}
                </p>
              )}
              <button
                className="destination-continue"
                onClick={continueToDesign}
              >
                Choose your look <ArrowRight size={16} />
              </button>
            </div>
          </section>
          <section className="generator-step">
            <Step
              number="2"
              title="Choose a starting point"
              headingRef={designHeading}
            />
            <div
              className="generator-modes"
              role="group"
              aria-label="Creation mode"
            >
              {modes.map((m) => (
                <button
                  key={m.id}
                  className="generator-mode"
                  aria-pressed={mode === m.id}
                  onClick={() => {
                    uploads.current.image++;
                    setUploading((active) => ({ ...active, image: false }));
                    setMode(m.id);
                    setTab("Designs");
                    setMessage("");
                  }}
                >
                  <div className="mode-art">
                    <img src={m.image} alt="" width={80} height={80} />
                    <span className="mode-check">
                      <Check size={12} />
                    </span>
                  </div>
                  <strong>{m.name}</strong>
                  <span>{m.description}</span>
                </button>
              ))}
            </div>
          </section>
          <section className="generator-step">
            <Step number="3" title="Make it your own" />
            <div
              className="generator-tabs"
              role="tablist"
              aria-label="Design controls"
            >
              {["Designs", "Logo", "Style"].map((t) => (
                <button
                  key={t}
                  id={`generator-tab-${t}`}
                  role="tab"
                  aria-controls={`generator-panel-${t}`}
                  aria-selected={tab === t}
                  onClick={() => setTab(t)}
                  onKeyDown={(e) => {
                    if (["ArrowRight", "ArrowLeft"].includes(e.key)) {
                      e.preventDefault();
                      const list = ["Designs", "Logo", "Style"];
                      const next =
                        list[
                          (list.indexOf(t) + (e.key === "ArrowRight" ? 1 : 2)) %
                            3
                        ];
                      setTab(next);
                      document.getElementById(`generator-tab-${next}`)?.focus();
                    }
                  }}
                  tabIndex={tab === t ? 0 : -1}
                >
                  {t}
                </button>
              ))}
            </div>
            <div
              className="generator-design-panel"
              role="tabpanel"
              key={`${mode}-${tab}`}
              id={`generator-panel-${tab}`}
              aria-labelledby={`generator-tab-${tab}`}
            >
              {tab === "Designs" && (
                <>
                  {mode === "art" && <AiArtPanel onApply={applyGeneratedArt} />}
                  <div className="design-panel-heading">
                    <span>
                      {mode === "custom"
                        ? "Templates"
                        : mode === "art"
                          ? "Artwork library"
                          : "Your image"}
                    </span>
                    {mode !== "image" && (
                      <button
                        className="small-control"
                        onClick={() => {
                          if (mode === "custom")
                            chooseTemplate(
                              (templates.findIndex((t) => t.name === template) +
                                1 +
                                Math.floor(Math.random() * 14)) %
                                templates.length,
                            );
                          else
                            chooseArt(
                              artworkDesigns[
                                (artworkDesigns.findIndex((d) => d.id === art) +
                                  1 +
                                  Math.floor(Math.random() * 13)) %
                                  artworkDesigns.length
                              ].id,
                            );
                        }}
                      >
                        <Shuffle size={11} /> Surprise me
                      </button>
                    )}
                  </div>
                  {mode !== "image" && (
                    <label className="composition-search">
                      <span className="sr-only">Search {mode === "custom" ? "templates" : "artwork"}</span>
                      <input value={designQuery} onChange={(event) => setDesignQuery(event.target.value)} placeholder={`Search ${mode === "custom" ? "templates" : "artwork"}…`} />
                    </label>
                  )}
                  {mode === "custom" ? (
                    <div className="qr-template-grid">
                      {templates.map((t, i) => ({ t, i })).filter(({ t }) => t.name.toLowerCase().includes(designQuery.trim().toLowerCase())).map(({ t, i }) => (
                        <button
                          key={t.name}
                          aria-label={`${t.name} template`}
                          aria-pressed={template === t.name}
                          onClick={() => chooseTemplate(i)}
                        >
                          <img
                            src={svgData(qrSvg(demoMatrix, t))}
                            alt=""
                            width={90}
                            height={90}
                          />
                          <span>{t.name}</span>
                        </button>
                      ))}
                      {templates.every((t) => !t.name.toLowerCase().includes(designQuery.trim().toLowerCase())) && <p className="composition-empty" role="status">No templates match “{designQuery}”.</p>}
                    </div>
                  ) : mode === "art" ? (
                    <>
                      <div className="qr-template-grid art-template-grid">
                        {artworkDesigns.filter((d) => `${d.name} ${d.description}`.toLowerCase().includes(designQuery.trim().toLowerCase())).map((d) => (
                          <button
                            key={d.id}
                            aria-label={`${d.name} artwork`}
                            aria-pressed={!studyActive && art === d.id}
                            onClick={() => chooseArt(d.id)}
                          >
                            <img
                              src={`/artwork/${d.id}.webp`}
                              alt=""
                              width={90}
                              height={90}
                              loading="lazy"
                            />
                            <span>{d.name}</span>
                          </button>
                        ))}
                        {artworkDesigns.every((d) => !`${d.name} ${d.description}`.toLowerCase().includes(designQuery.trim().toLowerCase())) && <p className="composition-empty" role="status">No artwork matches “{designQuery}”.</p>}
                      </div>
                      <p className="generator-note">
                        Choose an AI-created artwork and weave in your
                        destination.{" "}
                        <a href="/brand-studies">Explore brand studies ↗</a>
                      </p>
                      {studyActive && brandStudy && (
                        <p className="generator-note">
                          {brandStudy.name} study selected · unofficial creative
                          example.
                        </p>
                      )}
                    </>
                  ) : (
                    <>
                      <button
                        className="generator-upload"
                        disabled={uploading.image}
                        onClick={() => uploadInput.current?.click()}
                      >
                        {customImage ? (
                          <img
                            src={customImage}
                            alt="Selected source artwork"
                            width={90}
                            height={90}
                          />
                        ) : (
                          <ImagePlus size={30} />
                        )}
                        <strong>
                          {uploading.image
                            ? "Reading image…"
                            : customImage
                              ? "Replace your image"
                              : "Choose an image"}
                        </strong>
                        <span>PNG, JPEG or WebP · up to 8 MB</span>
                      </button>
                      <p className="generator-note">
                        Your image becomes the QR artwork. A library example is
                        shown until you choose your image.
                      </p>
                    </>
                  )}
                </>
              )}
              {tab === "Logo" && (
                <div className="logo-controls">
                  <button
                    className="generator-upload"
                    disabled={uploading.logo}
                    onClick={() => logoInput.current?.click()}
                  >
                    {logo ? (
                      <img
                        src={logo}
                        alt="Selected logo or profile photo"
                        width={80}
                        height={80}
                      />
                    ) : (
                      <ImagePlus size={28} />
                    )}
                    <strong>
                      {uploading.logo
                        ? "Reading image…"
                        : logo
                          ? "Replace logo or photo"
                          : "Add a logo or profile photo"}
                    </strong>
                    <span>Placed in the centre · stays on this device</span>
                  </button>
                  {logo && (
                    <>
                      <Range
                        label="Centre image size"
                        value={logoSize}
                        min={10}
                        max={24}
                        unit="%"
                        onChange={setLogoSize}
                      />
                      <div className="shape-options" role="group" aria-label="Centre image frame">
                        {(["plain", "metal"] as const).map((frame) => <button key={frame} aria-pressed={logoFrame === frame} onClick={() => setLogoFrame(frame)}>{frame === "plain" ? "Plain frame" : "Metal frame"}</button>)}
                      </div>
                      <button
                        className="small-control"
                        onClick={() => {
                          uploads.current.logo++;
                          setLogo("");
                          setUploading((active) => ({ ...active, logo: false }));
                        }}
                      >
                        Remove centre image
                      </button>
                    </>
                  )}
                  <p className="generator-note">
                    The finished image, including your logo, is checked before
                    download.
                  </p>
                </div>
              )}
              {tab === "Style" && (
                <div className="generator-style">
                  {mode === "custom" ? (
                    <>
                      <div className="generator-pair">
                        {(
                          [
                            ["foreground", "QR colour"],
                            ["background", "Background"],
                          ] as const
                        ).map(([field, label]) => (
                          <label className="generator-colour" key={field}>
                            <input
                              type="color"
                              aria-label={label}
                              value={appearance[field]}
                              onChange={(e) => {
                                setAppearance((a) => ({
                                  ...a,
                                  [field]: e.target.value,
                                }));
                                setTemplate("");
                              }}
                            />
                            <span>
                              {label}
                              <small>{appearance[field].toUpperCase()}</small>
                            </span>
                          </label>
                        ))}
                      </div>
                      <span className="generator-note">Pattern shape</span>
                      <div
                        className="shape-options"
                        role="group"
                        aria-label="Pattern shape"
                      >
                        {(
                          [
                            ["square", "Squares"],
                            ["soft", "Rounded"],
                            ["dot", "Dots"],
                          ] as const
                        ).map(([style, label]) => (
                          <button
                            key={style}
                            aria-pressed={appearance.style === style}
                            onClick={() => {
                              setAppearance((a) => ({ ...a, style }));
                              setTemplate("");
                            }}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </>
                  ) : (
                    <>
                      <Range
                        label="Scan strength"
                        value={Math.round(strength * 1000) / 10}
                        min={0}
                        max={100}
                        step={0.5}
                        unit="%"
                        onChange={(v) => setStrength(v / 100)}
                      />
                      <p className="generator-note">
                        Lower values preserve image detail. Increase protection
                        when a scan check fails.
                      </p>
                      <div className="composition-controls">
                        <Range label="Image zoom" value={adjustments.zoom} min={1} max={3} step={0.05} unit="×" onChange={(zoom) => setAdjustments((value) => ({ ...value, zoom }))} />
                        <Range label="Horizontal position" value={adjustments.x} min={0} max={100} unit="%" onChange={(x) => setAdjustments((value) => ({ ...value, x }))} />
                        <Range label="Vertical position" value={adjustments.y} min={0} max={100} unit="%" onChange={(y) => setAdjustments((value) => ({ ...value, y }))} />
                        <Range label="Image opacity" value={adjustments.opacity} min={20} max={100} unit="%" onChange={(opacity) => setAdjustments((value) => ({ ...value, opacity }))} />
                        <Range label="Image brightness" value={adjustments.brightness} min={50} max={150} unit="%" onChange={(brightness) => setAdjustments((value) => ({ ...value, brightness }))} />
                        <button className="small-control" onClick={() => setAdjustments(defaultImageAdjustments)}><RotateCcw size={11} /> Reset image</button>
                      </div>
                    </>
                  )}
                  <fieldset className="caption-controls">
                    <legend>Caption</legend>
                    <label className="generator-field"><span>Caption text</span><input value={caption.text} maxLength={60} placeholder="Optional caption" onChange={(event) => setCaption((value) => ({ ...value, text: event.target.value }))} /></label>
                    <div className="composition-row">
                      <label className="generator-colour"><input type="color" aria-label="Caption band colour" value={caption.color} onChange={(event) => setCaption((value) => ({ ...value, color: event.target.value }))} /><span>Band colour<small>{caption.color.toUpperCase()}</small></span></label>
                      <label className="generator-field"><span>Font</span><select value={caption.font} onChange={(event) => setCaption((value) => ({ ...value, font: event.target.value as typeof value.font }))}><option value="sans">Sans</option><option value="serif">Serif</option><option value="mono">Mono</option></select></label>
                    </div>
                    <div className="shape-options" role="group" aria-label="Caption position">{(["top", "bottom"] as const).map((position) => <button key={position} aria-pressed={caption.position === position} onClick={() => setCaption((value) => ({ ...value, position }))}>{position === "top" ? "Top" : "Bottom"}</button>)}</div>
                  </fieldset>
                  <Range
                    label="Print width"
                    value={sizeMm}
                    min={20}
                    max={160}
                    unit="mm"
                    onChange={setSizeMm}
                  />
                  <p className="generator-note">
                    Includes the clear border. Print a proof at the size you
                    intend to use.
                  </p>
                </div>
              )}
            </div>
            <button
              className="preview-jump"
              onClick={() => goToHeading(previewHeading.current)}
            >
              Preview &amp; download <ArrowDown size={15} />
            </button>
          </section>
          <input
            ref={uploadInput}
            hidden
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => {
              void selectFile(e.target.files?.[0], "image");
              e.target.value = "";
            }}
          />
          <input
            ref={logoInput}
            hidden
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => {
              void selectFile(e.target.files?.[0], "logo");
              e.target.value = "";
            }}
          />
        </div>
        <aside
          className="generator-preview"
          aria-label="QR preview and download"
        >
          <div className="preview-sticky">
            <Step
              number="4"
              title="Your QR image"
              headingRef={previewHeading}
            />
            <p className="preview-subtitle">
              Your design. Ready for the real world.
            </p>
            <div className="generator-preview-image">
              {current ? (
                <img
                  src={current.png}
                  alt="Your generated QR code"
                  width={768}
                  height={768}
                />
              ) : encoded.error ? (
                <div className="generator-style-preview">
                  <img
                    src={previewSample}
                    alt="Example of the selected QR style"
                    width={768}
                    height={768}
                  />
                  <span>Style preview · add your destination</span>
                </div>
              ) : (
                <div className="generator-preview-placeholder">
                  {renderError ? (
                    <SlidersHorizontal size={30} />
                  ) : (
                    <LoaderCircle size={30} className="spin" />
                  )}
                  <p>{renderError || "Creating your QR…"}</p>
                </div>
              )}
            </div>
            {current && <button className="preview-full-button" onClick={() => setPreviewOpen(true)}>Open full-size preview</button>}
            <div className="generator-scan-status" aria-live="polite">
              <span>
                {encoded.error
                  ? "Add your destination to personalise"
                  : renderError
                    ? "Check your inputs"
                    : !current
                      ? "Checking your QR…"
                      : ready
                        ? "Scan checks passed"
                        : "Needs an adjustment"}
              </span>
              <strong>{current ? `${passed}/4 checks` : "—"}</strong>
            </div>
            <div className="generator-scan-track" aria-hidden="true">
              <span
                style={{ transform: `scaleX(${current ? passed / 4 : 0})` }}
              />
            </div>
            <details className="generator-check-details">
              <summary>
                What we check <ChevronDown size={12} />
              </summary>
              <ul>
                {[
                  "Full-size image",
                  "Reduced to 256 px",
                  "Simulated scan at 40 cm",
                  "Print size and clear space",
                ].map((label, i) => (
                  <li key={label}>
                    <span>{label}</span>
                    <strong>
                      {checks[i] === undefined
                        ? "Checking"
                        : checks[i]
                          ? "Passed"
                          : "Adjust"}
                    </strong>
                  </li>
                ))}
              </ul>
              <p>
                Reference checks, not a guarantee for every phone or material.
                Always test a physical proof.
              </p>
            </details>
            {current && !ready && (
              <button className="generator-repair" onClick={repair}>
                <Sparkles size={14} /> Adjust for scanning
              </button>
            )}
            <div
              className="generator-formats"
              role="group"
              aria-label="Download format"
            >
              {(["png", "jpg", "webp", "svg", "pdf"] as const).map((f) => (
                <button
                  key={f}
                  aria-pressed={format === f}
                  onClick={() => setFormat(f)}
                >
                  {f.toUpperCase()}
                </button>
              ))}
            </div>
            <button
              className="generator-download"
              disabled={!ready || exporting || uploadsBusy}
              onClick={() => void download()}
            >
              {exporting ? (
                <LoaderCircle size={16} className="spin" />
              ) : (
                <ArrowDownToLine size={16} />
              )}
              {exporting
                ? "Preparing your file…"
                : `Download ${format.toUpperCase()}`}
            </button>
            <p className="generator-export-note">
              {format === "svg"
                ? mode === "custom" && !logo
                  ? "Vector SVG · crisp at any size."
                  : "SVG document with the complete raster QR image."
                : format === "pdf"
                  ? `RGB PDF · QR printed at ${sizeMm} mm.`
                  : format === "png"
                    ? "High-resolution PNG · complete design included."
                    : `${format.toUpperCase()} image · scan-checked after encoding.`}
            </p>
            <div className="workflow-save-panel">
              <label className="generator-field"><span>Design name &amp; file name</span><input value={name} maxLength={80} onChange={e=>setName(e.target.value)}/></label>
              <button className="workflow-wide" disabled={!artifact || uploadsBusy} onClick={testDesign}>Test this design <ArrowRight size={16}/></button>
              <button className="workflow-wide" disabled={!artifact || saving || uploadsBusy} onClick={()=>void save()}>{saving ? 'Saving…' : savedId ? 'Save new version' : 'Save design'}</button>
              <Link href="/designs">My designs ↗</Link>
              <CloudSave draft={draft} artifact={artifact} disabled={saving || uploadsBusy} onSaved={setCloudId} onBusy={setCloudSaving}/>
              <p className="generator-note">Save keeps the destination, images and any credentials in this browser. Clearing site data removes saved designs.</p>
            </div>
            <button className="generator-reset" disabled={saving || cloudSaving} onClick={reset}>
              <RotateCcw size={12} /> Reset design
            </button>
            {samplePortrait &&
              logo === "/brand-studies/sample-portrait.png" && (
                <p className="generator-note">Fictional sample portrait.</p>
              )}
            <div className="generator-private">
              <ShieldCheck size={14} />
              <span>Create without an account. Cloud saving is optional.</span>
            </div>
          </div>
        </aside>
      </div>
      {message && (
        <div className="generator-message" role="status">
          <p>{message}</p>
          <button aria-label="Dismiss message" onClick={() => setMessage("")}>
            ×
          </button>
        </div>
      )}
      <QrPreviewDialog open={previewOpen} src={current?.png || ""} onClose={() => setPreviewOpen(false)} />
    </section>
  );
}

function Step({
  number,
  title,
  headingRef,
}: {
  number: string;
  title: string;
  headingRef?: Ref<HTMLHeadingElement>;
}) {
  return (
    <div className="generator-step-title">
      <span>{number}</span>
      <h2 ref={headingRef} tabIndex={headingRef ? -1 : undefined}>
        {title}
      </h2>
    </div>
  );
}
function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  maxLength = 1200,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  maxLength?: number;
}) {
  return (
    <label className="generator-field">
      <span>{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        maxLength={maxLength}
        autoComplete="off"
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
function Range({
  label,
  value,
  min,
  max,
  step = 1,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="generator-range">
      <span>
        {label}
        <strong>
          {value} {unit}
        </strong>
      </span>
      <input
        type="range"
        aria-label={label}
        value={value}
        min={min}
        max={max}
        step={step}
        style={
          {
            "--range-progress": `${((value - min) / (max - min)) * 100}%`,
          } as CSSProperties
        }
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import Link from "next/link";
import {
  ArrowDownToLine,
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronDown,
  CornerUpRight,
  ImagePlus,
  Info,
  LoaderCircle,
  Maximize2,
  Move,
  RotateCcw,
  ScanLine,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Upload,
  Wifi,
  Link2,
  Contact,
  AlertCircle,
} from "lucide-react";
import { assessPrint, autoFix } from "@/lib/score";
import {
  createMatrix,
  payload,
  qrSvg,
  svgData,
  type Content,
  type Style,
} from "@/lib/qr";
import {
  exportQR,
  extractColor,
  readLocalImage,
  validateRendered,
} from "@/lib/browser-qr";

const initialContent: Content = {
  type: "url",
  url: "https://qrupgrade.com",
  ssid: "",
  password: "",
  name: "",
  email: "",
  phone: "",
};
const scenes = [
  {
    id: "packaging",
    name: "Packaging",
    label: "STUDIO GOODS",
    sub: "EVERYDAY, CONSIDERED.",
    file: "/scenes/packaging.svg",
  },
  {
    id: "poster",
    name: "Poster",
    label: "A SLOWER SUNDAY",
    sub: "GOOD COFFEE. GOOD COMPANY.",
    file: "/scenes/poster.svg",
  },
  {
    id: "card",
    name: "Business card",
    label: "MAKE A CONNECTION.",
    sub: "SOMETHING GOOD STARTS HERE.",
    file: "/scenes/card.svg",
  },
];
type Validation = {
  key: string;
  pristine: boolean;
  simulated: boolean;
  pixels: number;
  error?: string;
};
export default function Studio({
  compact = false,
  initialScene = "packaging",
}: {
  compact?: boolean;
  initialScene?: string;
}) {
  const [generation, setGeneration] = useState(0);
  const [content, setContent] = useState<Content>(initialContent);
  const [brandName, setBrandName] = useState("STUDIO GOODS");
  const [logo, setLogo] = useState("");
  const [foreground, setForeground] = useState("#214638");
  const [background, setBackground] = useState("#ffffff");
  const [style, setStyle] = useState<Style>("soft");
  const [quietZone, setQuietZone] = useState(4);
  const [sizeMm, setSizeMm] = useState(28);
  const [distanceCm, setDistanceCm] = useState(40);
  const [blur, setBlur] = useState(0);
  const [rotation, setRotation] = useState(0);
  const [scene, setScene] = useState(initialScene);
  const [photo, setPhoto] = useState("");
  const [position, setPosition] = useState({ x: 51, y: 64 });
  const [validation, setValidation] = useState<Validation | null>(null);
  const [notice, setNotice] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [busy, setBusy] = useState(false);
  const [format, setFormat] = useState<"svg" | "png" | "pdf">("svg");
  const [uploadBusy, setUploadBusy] = useState(false);
  const board = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const sceneInput = useRef<HTMLInputElement>(null),
    logoInput = useRef<HTMLInputElement>(null);
  const uploadSequence = useRef(0);
  const currentScene = scenes.find((s) => s.id === scene) || scenes[0];
  const generated = useMemo(() => {
    try {
      const text = payload(content);
      const matrix = createMatrix(text);
      const svg = qrSvg(matrix, { foreground, background, quietZone, style });
      return { text, matrix, svg, error: "" };
    } catch (error) {
      return {
        text: "",
        matrix: null,
        svg: "",
        error:
          error instanceof Error
            ? error.message
            : "Unable to create this code.",
      };
    }
  }, [content, foreground, background, quietZone, style]);
  const input = {
    foreground,
    background,
    quietZone,
    sizeMm,
    distanceCm,
    modules: generated.matrix?.size || 21,
  };
  const report = assessPrint(input);
  const validationKey = JSON.stringify([
    generation,
    generated.svg,
    generated.text,
    sizeMm,
    distanceCm,
    blur,
    rotation,
  ]);
  useEffect(() => {
    if (!generated.svg) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      validateRendered(generated.svg, generated.text, {
        sizeMm,
        distanceCm,
        blur,
        rotation,
      })
        .then((result) => {
          if (!cancelled) setValidation({ ...result, key: validationKey });
        })
        .catch((error) => {
          if (!cancelled)
            setValidation({
              key: validationKey,
              pristine: false,
              simulated: false,
              pixels: 0,
              error: error.message,
            });
        });
    }, 180);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    validationKey,
    generated.svg,
    generated.text,
    sizeMm,
    distanceCm,
    blur,
    rotation,
  ]);
  const currentValidation =
    validation?.key === validationKey ? validation : null;
  const ready =
    !!generated.svg &&
    report.score === 100 &&
    currentValidation?.pristine &&
    currentValidation.simulated;
  function clearDraft() {
    uploadSequence.current++;
    setUploadBusy(false);
    setUploadError("");
    setContent(initialContent);
    setBrandName("STUDIO GOODS");
    setLogo("");
    setPhoto("");
    setForeground("#214638");
    setBackground("#ffffff");
    setStyle("soft");
    setQuietZone(4);
    setSizeMm(28);
    setDistanceCm(40);
    setBlur(0);
    setRotation(0);
    setScene(initialScene);
    setPosition({ x: 51, y: 64 });
    setValidation(null);
    setGeneration((n) => n + 1);
    setNotice(
      "Draft cleared from this page. Files you previously exported are unchanged.",
    );
  }
  function updateContent(field: keyof Content, value: string) {
    setContent((c) => ({ ...c, [field]: value }));
    setNotice("");
  }
  function fix() {
    const fixed = autoFix(input);
    setForeground(fixed.foreground);
    setBackground(fixed.background);
    setQuietZone(fixed.quietZone);
    setSizeMm(fixed.sizeMm);
    setNotice(
      report.score === 100
        ? "Print settings already pass. Adjust placement or conditions if the simulated decode fails."
        : `Updated print settings: ${fixed.sizeMm} mm wide, ${fixed.quietZone}-module clear space, checked contrast. Viewing distance and blur stay as selected.`,
    );
  }
  async function upload(file: File | undefined, kind: "scene" | "logo") {
    if (!file) return;
    const seq = ++uploadSequence.current;
    setUploadBusy(true);
    setUploadError("");
    try {
      const data = await readLocalImage(file);
      const color = kind === "logo" ? await extractColor(data) : null;
      if (seq !== uploadSequence.current) return;
      if (kind === "scene") {
        setPhoto(data);
        setScene("custom");
      } else {
        setLogo(data);
        if (color) setForeground(color);
      }
      setNotice(
        kind === "scene"
          ? "Your scene is ready. Drag the QR into position. Set print size and viewing distance below; the photo is a placement preview."
          : "Brand color extracted. Your mark appears in the scene; QR modules remain unobstructed.",
      );
    } catch (error) {
      if (seq === uploadSequence.current)
        setUploadError(
          error instanceof Error ? error.message : "Upload failed.",
        );
    } finally {
      if (seq === uploadSequence.current) setUploadBusy(false);
    }
  }
  function move(event: PointerEvent<HTMLDivElement>) {
    if (!dragging.current || !board.current) return;
    const rect = board.current.getBoundingClientRect();
    setPosition({
      x: Math.max(
        20,
        Math.min(80, ((event.clientX - rect.left) / rect.width) * 100),
      ),
      y: Math.max(
        20,
        Math.min(80, ((event.clientY - rect.top) / rect.height) * 100),
      ),
    });
  }
  async function download() {
    if (!ready) return;
    setBusy(true);
    setNotice("");
    try {
      await exportQR(generated.svg, format, sizeMm);
      setNotice(
        `${format.toUpperCase()} downloaded. Print a physical proof at ${sizeMm} mm and test it with your phones. PDF uses RGB; ask your printer about color conversion.`,
      );
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Export failed. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  function chooseScene(id: string) {
    setScene(id);
    setPosition({ x: 51, y: id === "poster" ? 72 : 64 });
  }
  const scoreLabel =
    report.score === 100 ? "Print settings pass" : "A little room to improve";
  return (
    <section
      className={`studio ${compact ? "studio-compact" : ""}`}
      id="studio"
      aria-label="QR creation and Scan Lab"
    >
      <div className="studio-toolbar">
        <div>
          <span className="status-dot" />
          <strong>Your first upgrade</strong>
          <span className="toolbar-muted">Untitled campaign</span>
        </div>
        <span className="local-note">
          <ShieldCheck size={14} /> In your browser. Yours to keep.
        </span>
      </div>
      <div className="studio-grid">
        <aside className="controls-panel" aria-label="Brand and QR controls">
          <div className="panel-heading">
            <span className="step-index">01</span>
            <h2>Make it yours</h2>
            <SlidersHorizontal size={16} />
          </div>
          <div className="control-section">
            <div className="section-label">THE DESTINATION</div>
            <div
              className="content-tabs"
              role="group"
              aria-label="QR content type"
            >
              {[
                { id: "url", label: "Website", icon: Link2 },
                { id: "wifi", label: "Wi-Fi", icon: Wifi },
                { id: "vcard", label: "Contact", icon: Contact },
              ].map((t) => (
                <button
                  key={t.id}
                  aria-pressed={content.type === t.id}
                  className={content.type === t.id ? "active" : ""}
                  onClick={() => updateContent("type", t.id)}
                >
                  <t.icon size={13} />
                  {t.label}
                </button>
              ))}
            </div>
            {content.type === "url" ? (
              <label className="field-label">
                Website URL
                <input
                  type="url"
                  value={content.url}
                  onChange={(e) => updateContent("url", e.target.value)}
                  maxLength={1200}
                  spellCheck={false}
                />
              </label>
            ) : content.type === "wifi" ? (
              <>
                <label className="field-label">
                  Network name
                  <input
                    value={content.ssid}
                    onChange={(e) => updateContent("ssid", e.target.value)}
                    maxLength={128}
                  />
                </label>
                <label className="field-label">
                  Password
                  <input
                    type="password"
                    autoComplete="off"
                    value={content.password}
                    onChange={(e) => updateContent("password", e.target.value)}
                    maxLength={128}
                  />
                </label>
                <p className="microcopy">
                  The downloaded QR contains your Wi-Fi credentials.
                </p>
              </>
            ) : (
              <>
                <label className="field-label">
                  Full name
                  <input
                    value={content.name}
                    onChange={(e) => updateContent("name", e.target.value)}
                    maxLength={150}
                  />
                </label>
                <label className="field-label">
                  Email
                  <input
                    type="email"
                    value={content.email}
                    onChange={(e) => updateContent("email", e.target.value)}
                    maxLength={254}
                  />
                </label>
                <label className="field-label">
                  Phone
                  <input
                    type="tel"
                    value={content.phone}
                    onChange={(e) => updateContent("phone", e.target.value)}
                    maxLength={50}
                  />
                </label>
              </>
            )}
            {generated.error && (
              <p className="error-text" role="alert">
                {generated.error}
              </p>
            )}
          </div>
          <div className="control-section">
            <div className="section-label">YOUR BRAND DNA</div>
            <label className="field-label">
              Brand name
              <input
                value={brandName}
                maxLength={28}
                onChange={(e) => setBrandName(e.target.value)}
              />
            </label>
            <input
              ref={logoInput}
              hidden
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => {
                void upload(e.target.files?.[0], "logo");
                e.target.value = "";
              }}
            />
            <button
              className="upload-button"
              disabled={uploadBusy}
              onClick={() => logoInput.current?.click()}
            >
              {logo ? (
                <img src={logo} alt="Uploaded brand mark" />
              ) : (
                <Upload size={17} />
              )}
              <span>
                {logo ? "Replace brand logo" : "Upload your logo"}
                <small>Extract a color · PNG, JPG, WebP</small>
              </span>
              <span className="tiny-plus">+</span>
            </button>
            <div className="colors-row">
              <label className="color-control">
                <input
                  aria-label="QR ink color"
                  type="color"
                  value={foreground}
                  onChange={(e) => setForeground(e.target.value)}
                />
                <span>
                  Ink<small>{foreground.toUpperCase()}</small>
                </span>
              </label>
              <label className="color-control">
                <input
                  aria-label="QR paper color"
                  type="color"
                  value={background}
                  onChange={(e) => setBackground(e.target.value)}
                />
                <span>
                  Paper<small>{background.toUpperCase()}</small>
                </span>
              </label>
            </div>
          </div>
          <div className="control-section">
            <div className="section-label">FIND YOUR FORM</div>
            <div className="style-options">
              {(["square", "soft", "dot"] as const).map((s) => (
                <button
                  key={s}
                  aria-pressed={s === style}
                  className={s === style ? "selected" : ""}
                  onClick={() => setStyle(s)}
                >
                  <span className={`style-sample ${s}`}>
                    {Array.from({ length: 9 }, (_, i) => (
                      <i key={i} />
                    ))}
                  </span>
                  <span>
                    {s === "square"
                      ? "Classic"
                      : s === "soft"
                        ? "Soft edge"
                        : "Dotwork"}
                  </span>
                </button>
              ))}
            </div>
            <p className="microcopy">
              <ShieldCheck size={12} /> Encoded precisely. Styled carefully.
            </p>
          </div>
          <div className="brand-footer">
            <Sparkles size={17} />
            <span>
              Your identity, down to
              <br />
              the smallest square.
            </span>
          </div>
        </aside>
        <div className="scene-panel">
          <div className="panel-heading">
            <span className="step-index">02</span>
            <h2>Meet the real world</h2>
            <span className="preview-label">LIVE PREVIEW</span>
          </div>
          <div className="scene-tabs" role="group" aria-label="Choose a scene">
            {scenes.map((s) => (
              <button
                key={s.id}
                className={scene === s.id ? "active" : ""}
                aria-pressed={scene === s.id}
                onClick={() => chooseScene(s.id)}
              >
                {s.name}
              </button>
            ))}
            <button
              className={scene === "custom" ? "active" : ""}
              disabled={uploadBusy}
              onClick={() =>
                photo ? chooseScene("custom") : sceneInput.current?.click()
              }
            >
              <ImagePlus size={14} />
              {photo ? "Your scene" : "Upload scene"}
            </button>
          </div>
          <div
            className={`scene-board scene-${scene}`}
            ref={board}
            style={{
              backgroundImage: `url("${scene === "custom" ? photo : currentScene.file}")`,
            }}
          >
            {scene !== "custom" && (
              <div className="scene-brand">
                {logo && <img src={logo} alt="" />}
                <span>{brandName || currentScene.label}</span>
                <small>{currentScene.sub}</small>
              </div>
            )}
            <span className="scene-corner">
              <span /> {scene === "custom" ? "YOUR IMAGE" : "SAMPLE SCENE"}
            </span>
            {generated.svg ? (
              <div
                className="qr-placement"
                role="slider"
                tabIndex={0}
                aria-label="QR placement. Arrow keys move the QR; shift for larger steps."
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(position.x)}
                aria-valuetext={`${Math.round(position.x)} percent across, ${Math.round(position.y)} percent down`}
                style={{
                  left: `${position.x}%`,
                  top: `${position.y}%`,
                  width: `${Math.max(16, Math.min(35, sizeMm * 0.65))}%`,
                  transform: `translate(-50%,-50%) rotate(${rotation}deg)`,
                }}
                onPointerDown={(e) => {
                  dragging.current = true;
                  e.currentTarget.setPointerCapture(e.pointerId);
                }}
                onPointerMove={move}
                onPointerUp={() => {
                  dragging.current = false;
                }}
                onPointerCancel={() => {
                  dragging.current = false;
                }}
                onKeyDown={(e) => {
                  const delta = e.shiftKey ? 5 : 1;
                  if (
                    [
                      "ArrowLeft",
                      "ArrowRight",
                      "ArrowUp",
                      "ArrowDown",
                    ].includes(e.key)
                  ) {
                    e.preventDefault();
                    setPosition((p) => ({
                      x: Math.max(
                        20,
                        Math.min(
                          80,
                          p.x +
                            (e.key === "ArrowRight"
                              ? delta
                              : e.key === "ArrowLeft"
                                ? -delta
                                : 0),
                        ),
                      ),
                      y: Math.max(
                        20,
                        Math.min(
                          80,
                          p.y +
                            (e.key === "ArrowDown"
                              ? delta
                              : e.key === "ArrowUp"
                                ? -delta
                                : 0),
                        ),
                      ),
                    }));
                  }
                }}
              >
                <img
                  src={svgData(generated.svg)}
                  alt="Your generated QR code"
                  draggable={false}
                  style={{ filter: `blur(${blur * 0.6}px)` }}
                />
                <span className="handle tl" />
                <span className="handle tr" />
                <span className="handle bl" />
                <span className="handle br" />
                <span className="qr-size">
                  {sizeMm} × {sizeMm} mm
                </span>
              </div>
            ) : (
              <div className="scene-empty">
                Enter valid content to create your QR.
              </div>
            )}
            <div className="scene-bottom">
              <span>
                <Move size={13} /> Drag to place · arrow keys to nudge
              </span>
              <button
                aria-label="Reset QR placement"
                onClick={() => {
                  setPosition({ x: 51, y: 64 });
                  setRotation(0);
                }}
              >
                <RotateCcw size={14} />
              </button>
            </div>
          </div>
          <div className="simulation-controls">
            <Range
              label="Print width"
              value={sizeMm}
              min={10}
              max={Math.max(100, sizeMm)}
              unit="mm"
              onChange={setSizeMm}
            />
            <Range
              label="Viewing distance"
              value={distanceCm}
              min={10}
              max={200}
              unit="cm"
              onChange={setDistanceCm}
            />
            <Range
              label="Blur simulation"
              value={blur}
              min={0}
              max={3}
              step={0.25}
              unit="px"
              onChange={setBlur}
            />
            <Range
              label="Rotation"
              value={rotation}
              min={-45}
              max={45}
              unit="°"
              onChange={setRotation}
            />
          </div>
          <div className="scene-note">
            <Info size={13} />
            <p>
              Placement preview, not a calibrated photograph. Print size and
              distance drive the separate scan simulation.
            </p>
            <button
              onClick={() => sceneInput.current?.click()}
              disabled={uploadBusy}
            >
              {uploadBusy
                ? "Processing…"
                : photo
                  ? "Replace photo"
                  : "Use your photo"}{" "}
              <ArrowUpRight size={13} />
            </button>
          </div>
          <input
            ref={sceneInput}
            hidden
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => {
              void upload(e.target.files?.[0], "scene");
              e.target.value = "";
            }}
          />
          {uploadError && (
            <p role="alert" className="error-text upload-error">
              {uploadError}
            </p>
          )}
        </div>
        <aside
          className="results-panel"
          aria-label="Print checks and decoder results"
        >
          <div className="panel-heading">
            <span className="step-index">03</span>
            <h2>Know before you print</h2>
          </div>
          <div
            className={`score-card ${report.score === 100 ? "score-pass" : ""}`}
          >
            <div className="section-label">PRINT READINESS</div>
            <div className="score-number">
              {generated.error ? "—" : report.score}
              <span>/100</span>
            </div>
            <div className="score-track">
              <span
                style={{ width: `${generated.error ? 0 : report.score}%` }}
              />
            </div>
            <strong>
              {generated.error ? "Add your destination" : scoreLabel}
            </strong>
            <p>A checklist score, not a scan probability.</p>
          </div>
          <div className="check-list">
            {report.checks.map((check) => (
              <details key={check.id}>
                <summary>
                  {check.passed ? (
                    <CheckCircle2 size={16} />
                  ) : (
                    <AlertCircle size={16} className="warning-icon" />
                  )}
                  <span>{check.title}</span>
                  <ChevronDown size={12} />
                </summary>
                <p>{check.detail}</p>
              </details>
            ))}
          </div>
          <label className="quiet-control">
            Clear space{" "}
            <select
              aria-label="Quiet zone in modules"
              value={quietZone}
              onChange={(e) => setQuietZone(Number(e.target.value))}
            >
              {[0, 1, 2, 3, 4, 5, 6, 8].map((n) => (
                <option key={n} value={n}>
                  {n} modules
                </option>
              ))}
            </select>
          </label>
          <button
            className="autofix-button"
            onClick={fix}
            disabled={!!generated.error}
          >
            <Sparkles size={16} /> Auto-Fix print settings{" "}
            <CornerUpRight size={15} />
          </button>
          <div className="decode-box">
            <div className="section-label">
              <ScanLine size={13} /> ACTUAL DECODE CHECK
            </div>
            <DecodeRow
              label="Original code"
              pending={!currentValidation && !generated.error}
              pass={!!currentValidation?.pristine}
            />
            <DecodeRow
              label="Simulated view"
              pending={!currentValidation && !generated.error}
              pass={!!currentValidation?.simulated}
            />
            <p>
              {currentValidation?.error ||
                "Checked with jsQR. Physical phone testing is still essential."}
            </p>
          </div>
          <div className="export-box">
            <label className="field-label">
              Export format
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value as typeof format)}
              >
                <option value="svg">SVG · vector, sized in mm</option>
                <option value="png">PNG · high resolution</option>
                <option value="pdf">PDF · RGB, actual print size</option>
              </select>
            </label>
            <button
              className="export-button"
              disabled={!ready || busy}
              onClick={() => void download()}
            >
              {busy ? (
                <LoaderCircle size={16} className="spin" />
              ) : (
                <ArrowDownToLine size={16} />
              )}
              Download QR <span>{format.toUpperCase()}</span>
            </button>
            <p>
              {ready
                ? "Code only · sample artwork is not included"
                : "Resolve print checks and decode results to export."}
            </p>
          </div>
        </aside>
      </div>
      <div className="studio-foot">
        <span>
          <ShieldCheck size={13} /> No sign-up. No image uploads to a server.
        </span>
        <button className="clear-draft" onClick={clearDraft}>
          Clear draft
        </button>
        <Link href="/docs">
          How we test <ArrowUpRight size={13} />
        </Link>
      </div>
      {notice && (
        <div className="studio-notice" role="status">
          <Info size={16} />
          <p>{notice}</p>
          <button onClick={() => setNotice("")} aria-label="Dismiss message">
            ×
          </button>
        </div>
      )}
    </section>
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
  onChange: (n: number) => void;
}) {
  return (
    <label className="range-control">
      <span>
        {label}
        <strong>
          {value} {unit}
        </strong>
      </span>
      <input
        aria-label={label}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        style={{ "--range-progress": `${((value - min) / (max - min)) * 100}%` } as React.CSSProperties}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}
function DecodeRow({
  label,
  pending,
  pass,
}: {
  label: string;
  pending: boolean;
  pass: boolean;
}) {
  return (
    <div className="decode-row">
      <span>{label}</span>
      <strong className={pending ? "pending" : pass ? "passed" : "failed"}>
        {pending ? (
          <>
            <LoaderCircle size={12} className="spin" />
            Testing
          </>
        ) : pass ? (
          <>
            <Check size={12} />
            Decoded
          </>
        ) : (
          <>Needs attention</>
        )}
      </strong>
    </div>
  );
}

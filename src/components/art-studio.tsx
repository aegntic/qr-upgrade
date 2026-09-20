"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  ArrowDownToLine,
  ArrowUpRight,
  Check,
  CircleAlert,
  ImagePlus,
  LoaderCircle,
  RotateCcw,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import proofs from "@/lib/artwork-proofs.json";
import { artworkDesigns } from "@/lib/artwork-designs";
import { createQrImage } from "@/lib/browser-art";
import { exportQR, readLocalImage, validateRendered } from "@/lib/browser-qr";
import { createMatrix, payload, type Content } from "@/lib/qr";

type Artwork = Awaited<ReturnType<typeof createQrImage>> & { key: string };
type Proof = Awaited<ReturnType<typeof validateRendered>> & { key: string };
const initial: Content = {
  type: "url",
  url: "https://qrupgrade.com/",
  ssid: "",
  password: "",
  name: "",
  email: "",
  phone: "",
};

export default function ArtStudio({
  initialArtwork = "dragon",
  brandStudy,
  samplePortrait = false,
}: {
  initialArtwork?: (typeof artworkDesigns)[number]["id"];
  samplePortrait?: boolean;
  brandStudy?: {
    id: string;
    name: string;
    destination: string;
    use: string;
    strength: number;
  };
}) {
  const [content, setContent] = useState<Content>({
    ...initial,
    url: brandStudy?.destination || initial.url,
  });
  const [brand, setBrand] = useState(brandStudy?.name || "Your Brand Here.");
  const [choice, setChoice] = useState<string>(
    brandStudy ? `brand:${brandStudy.id}` : initialArtwork,
  );
  const [upload, setUpload] = useState("");
  const [portrait, setPortrait] = useState(
    samplePortrait ? "/brand-studies/sample-portrait.png" : "",
  );
  const [portraitSize, setPortraitSize] = useState(20);
  const [portraitLoading, setPortraitLoading] = useState(false);
  const [strength, setStrength] = useState(
    brandStudy?.strength ?? proofs[initialArtwork].strength,
  );
  const [sizeMm, setSizeMm] = useState(70);
  const [distanceCm, setDistanceCm] = useState(40);
  const [blur, setBlur] = useState(0);
  const [rotation, setRotation] = useState(0);
  const [format, setFormat] = useState<"png" | "pdf">("png");
  const [view, setView] = useState("artwork");
  const [scene, setScene] = useState("packaging");
  const [position, setPosition] = useState({ x: 51, y: 64 });
  const [artwork, setArtwork] = useState<Artwork | null>(null);
  const [proof, setProof] = useState<Proof | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [uploading, setUploading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [epoch, setEpoch] = useState(0);
  const uploadInput = useRef<HTMLInputElement>(null);
  const uploadSequence = useRef(0);
  const portraitInput = useRef<HTMLInputElement>(null);
  const portraitSequence = useRef(0);
  const dragging = useRef(false);
  const sceneBoard = useRef<HTMLDivElement>(null);
  const studySelected = brandStudy && choice === `brand:${brandStudy.id}`;
  const source =
    choice === "custom"
      ? upload
      : studySelected
        ? `/brand-studies/${brandStudy.id}-source.png`
        : `/artwork/${choice}-source.png`;
  const encoded = useMemo(() => {
    try {
      const text = payload(content);
      return { text, modules: createMatrix(text).size, error: "" };
    } catch (e) {
      return {
        text: "",
        modules: 29,
        error: e instanceof Error ? e.message : "Check your destination.",
      };
    }
  }, [content]);
  const artKey = JSON.stringify([
    source,
    encoded.text,
    strength,
    portrait,
    portraitSize,
    epoch,
  ]);
  const current = artwork?.key === artKey ? artwork : null;
  const proofKey = JSON.stringify([artKey, sizeMm, distanceCm, blur, rotation]);
  const currentProof = proof?.key === proofKey ? proof : null;
  const dimensionsPass =
    sizeMm / (encoded.modules + 8) >= 0.4 && sizeMm >= distanceCm;
  const ready =
    !!current?.pristine &&
    current.reduced &&
    !!currentProof?.pristine &&
    currentProof.simulated &&
    dimensionsPass;
  const selected = studySelected
    ? {
        name: brandStudy.name,
        description: `${brandStudy.use} · Unofficial brand study`,
      }
    : artworkDesigns.find((d) => d.id === choice);

  useEffect(() => {
    let cancelled = false;
    setError("");
    if (!encoded.text || !source) return;
    const timer = window.setTimeout(() => {
      createQrImage(
        source,
        encoded.text,
        strength,
        portrait ? { src: portrait, sizePercent: portraitSize } : undefined,
      )
        .then((result) => {
          if (!cancelled) setArtwork({ ...result, key: artKey });
        })
        .catch((e) => {
          if (!cancelled)
            setError(
              e instanceof Error
                ? e.message
                : "Unable to create this QR image.",
            );
        });
    }, 120);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [artKey, encoded.text, source, strength, portrait, portraitSize]);

  useEffect(
    () => () => {
      uploadSequence.current++;
      portraitSequence.current++;
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    if (!current) return;
    const timer = window.setTimeout(() => {
      validateRendered(current.svg, encoded.text, {
        sizeMm,
        distanceCm,
        blur,
        rotation,
      })
        .then((result) => {
          if (!cancelled) setProof({ ...result, key: proofKey });
        })
        .catch(() => {
          if (!cancelled)
            setProof({
              pristine: false,
              simulated: false,
              pixels: 0,
              key: proofKey,
            });
        });
    }, 150);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [current, encoded.text, proofKey, sizeMm, distanceCm, blur, rotation]);

  function update(field: keyof Content, value: string) {
    setContent((c) => ({ ...c, [field]: value }));
    setNotice("");
  }
  async function uploadImage(file?: File) {
    if (!file) return;
    const request = ++uploadSequence.current;
    setUploading(true);
    setError("");
    try {
      const image = await readLocalImage(file);
      if (request !== uploadSequence.current) return;
      setUpload(image);
      setChoice("custom");
      setNotice(
        "Your image now becomes the QR artwork. Increase scan strength if validation fails.",
      );
    } catch (e) {
      if (request === uploadSequence.current)
        setError(e instanceof Error ? e.message : "Image upload failed.");
    } finally {
      if (request === uploadSequence.current) setUploading(false);
    }
  }
  function clearDraft() {
    uploadSequence.current++;
    portraitSequence.current++;
    setPortrait("");
    setPortraitSize(20);
    setPortraitLoading(false);
    setUploading(false);
    setContent(initial);
    setBrand("Your Brand Here.");
    setChoice("dragon");
    setUpload("");
    setStrength(proofs.dragon.strength);
    setSizeMm(70);
    setDistanceCm(40);
    setBlur(0);
    setRotation(0);
    setPosition({ x: 51, y: 64 });
    setArtwork(null);
    setProof(null);
    setError("");
    setEpoch((e) => e + 1);
    setNotice("Draft cleared. Previously downloaded files are unchanged.");
  }
  function repair() {
    setStrength((s) => Math.min(1, Math.round((s + 0.2) * 100) / 100));
    if (portrait) setPortraitSize((s) => Math.max(10, s - 2));
    setSizeMm((s) =>
      Math.ceil(Math.max(s, distanceCm, (encoded.modules + 8) * 0.5)),
    );
    setNotice(
      portrait
        ? "Strengthened the QR and reduced the portrait where possible. The complete image is being checked again."
        : "Increased protection around the QR sampling points and checked the print width. The artwork is being decoded again. Distance and blur stay unchanged.",
    );
  }
  async function uploadPortrait(file?: File) {
    if (!file) return;
    const request = ++portraitSequence.current;
    setPortraitLoading(true);
    setError("");
    try {
      const image = await readLocalImage(file);
      if (request !== portraitSequence.current) return;
      setPortrait(image);
      setNotice(
        "Your portrait is included in the QR image. Checking the finished artwork now.",
      );
    } catch (e) {
      if (request === portraitSequence.current)
        setError(
          e instanceof Error ? e.message : "Portrait could not be read.",
        );
    } finally {
      if (request === portraitSequence.current) setPortraitLoading(false);
    }
  }
  async function download() {
    if (!ready || !current || uploading || portraitLoading) return;
    setExporting(true);
    try {
      await exportQR(current.svg, format, sizeMm);
      setNotice(
        "QR image downloaded. Test a physical proof on several phones before printing a batch.",
      );
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Export failed.");
    } finally {
      setExporting(false);
    }
  }
  return (
    <section
      id="studio"
      className="studio art-studio"
      aria-label="Artistic QR image studio"
    >
      <header className="studio-toolbar">
        <div>
          <span className="status-dot" />
          <strong>The image is the QR.</strong>
        </div>
        <span className="local-note">
          <ShieldCheck size={14} /> Your uploads stay in your browser.
        </span>
      </header>
      <div className="art-studio-grid">
        <aside className="art-inputs" aria-label="QR image inputs">
          <div className="panel-heading">
            <span className="step-index">01</span>
            <h2>Start with your vision</h2>
            <Sparkles size={15} />
          </div>
          <label className="field-label">
            Brand name
            <input
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              maxLength={50}
            />
          </label>
          <label className="field-label">
            QR destination type
            <select
              value={content.type}
              onChange={(e) => update("type", e.target.value)}
            >
              <option value="url">Website</option>
              <option value="wifi">Wi-Fi</option>
              <option value="vcard">Contact</option>
            </select>
          </label>
          {content.type === "url" ? (
            <label className="field-label">
              Destination URL
              <input
                type="url"
                value={content.url}
                onChange={(e) => update("url", e.target.value)}
                maxLength={1200}
              />
            </label>
          ) : content.type === "wifi" ? (
            <>
              <label className="field-label">
                Network name
                <input
                  value={content.ssid}
                  onChange={(e) => update("ssid", e.target.value)}
                  maxLength={1200}
                />
              </label>
              <label className="field-label">
                Wi-Fi password
                <input
                  type="password"
                  autoComplete="off"
                  value={content.password}
                  onChange={(e) => update("password", e.target.value)}
                  maxLength={1200}
                />
              </label>
              <p className="microcopy">
                Anyone scanning this image can read the network credentials.
              </p>
            </>
          ) : (
            <>
              {(
                [
                  ["name", "Contact name"],
                  ["email", "Email"],
                  ["phone", "Phone"],
                ] as const
              ).map(([key, label]) => (
                <label className="field-label" key={key}>
                  {label}
                  <input
                    value={content[key]}
                    onChange={(e) => update(key, e.target.value)}
                    maxLength={1200}
                  />
                </label>
              ))}
            </>
          )}
          {encoded.error && (
            <p className="error-text" role="alert">
              {encoded.error}
            </p>
          )}
          <div className="art-input-divider" />
          {studySelected && (
            <p className="microcopy">
              {brandStudy.name} study selected. Replace the homepage with your
              own public link, then repair and recheck the image.{" "}
              <a href="/brand-studies">Browse all brand studies →</a>
            </p>
          )}
          <div className="section-label">CHOOSE AN IMAGE DIRECTION</div>
          <div
            className="art-preset-grid"
            role="group"
            aria-label="Artwork directions"
          >
            {artworkDesigns.map((d) => (
              <button
                key={d.id}
                type="button"
                aria-label={d.name}
                aria-pressed={choice === d.id}
                onClick={() => {
                  uploadSequence.current++;
                  setUploading(false);
                  setChoice(d.id);
                  setStrength(proofs[d.id].strength);
                  setNotice("");
                }}
              >
                <img
                  src={`/artwork/${d.id}.webp`}
                  alt=""
                  width={48}
                  height={48}
                  loading="lazy"
                />
                <span>{d.name}</span>
              </button>
            ))}
          </div>
          <button
            type="button"
            className="upload-button"
            disabled={uploading}
            onClick={() => uploadInput.current?.click()}
          >
            <ImagePlus size={18} />
            <span>
              {uploading ? "Reading image…" : "Use your own image"}
              <small>The image becomes the QR artwork.</small>
            </span>
          </button>
          <input
            ref={uploadInput}
            type="file"
            hidden
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => {
              void uploadImage(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <p className="microcopy">
            AI-created examples, or your own image. Live text-to-image
            generation is not connected yet.
          </p>
          <div className="art-input-divider" />
          <div className="section-label">YOUR PROFILE, AT THE CENTRE</div>
          {portrait && (
            <img
              src={portrait}
              alt="Selected profile photo"
              width={64}
              height={64}
              style={{
                borderRadius: "50%",
                objectFit: "cover",
                margin: "12px 0",
              }}
            />
          )}
          <button
            type="button"
            className="upload-button"
            disabled={portraitLoading}
            onClick={() => portraitInput.current?.click()}
          >
            <ImagePlus size={18} />
            <span>
              {portraitLoading
                ? "Reading portrait…"
                : portrait
                  ? "Replace profile photo"
                  : "Add profile photo"}
              <small>Circular crop. Brushed-metal surround.</small>
            </span>
          </button>
          <input
            ref={portraitInput}
            type="file"
            hidden
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => {
              void uploadPortrait(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          {portrait ? (
            <>
              <Fader
                label="Portrait size"
                value={portraitSize}
                min={10}
                max={24}
                unit="%"
                onChange={setPortraitSize}
              />
              <button
                type="button"
                className="clear-draft"
                onClick={() => {
                  portraitSequence.current++;
                  setPortrait("");
                  setPortraitLoading(false);
                  setNotice("");
                }}
              >
                Remove profile photo
              </button>
            </>
          ) : (
            <button
              type="button"
              className="clear-draft"
              onClick={() => {
                portraitSequence.current++;
                setPortraitLoading(false);
                setPortrait("/brand-studies/sample-portrait.png");
                setNotice(
                  "Fictional AI-created sample portrait. Add your own photo to personalise the image.",
                );
              }}
            >
              Try a sample portrait
            </button>
          )}
          <p className="microcopy">
            Your photo stays on this device and is included in downloads. The
            complete image must pass its scan checks.
          </p>
          {portrait === "/brand-studies/sample-portrait.png" && (
            <p className="microcopy">
              Fictional AI-created sample portrait. Replace it with your own
              photo.
            </p>
          )}
        </aside>
        <div className="art-workspace">
          <div className="panel-heading">
            <span className="step-index">02</span>
            <h2>Your scannable artwork</h2>
            <span className="preview-label">IMAGE FIRST</span>
          </div>
          <div className="art-view-tabs" role="group" aria-label="Preview view">
            <button
              aria-pressed={view === "artwork"}
              onClick={() => setView("artwork")}
            >
              Artwork
            </button>
            <button
              aria-pressed={view === "scene"}
              onClick={() => setView("scene")}
            >
              In context
            </button>
            <span>{selected?.name || "Your image"}</span>
          </div>
          {view === "artwork" ? (
            <div className="art-preview">
              <div className="art-image-frame">
                {current ? (
                  <img
                    src={current.png}
                    alt={`${brand || "Your brand"} — custom QR artwork`}
                    width={768}
                    height={768}
                  />
                ) : (
                  <div className="art-loading" role="status">
                    {encoded.error || error ? (
                      <CircleAlert size={25} />
                    ) : (
                      <LoaderCircle size={25} className="spin" />
                    )}
                    <span>
                      {encoded.error ||
                        error ||
                        "Weaving your destination into the image…"}
                    </span>
                  </div>
                )}
              </div>
              <div className="art-caption">
                <strong>{brand || "Your Brand Here."}</strong>
                <span>
                  {selected?.description || "Your image. Your destination."}
                </span>
              </div>
            </div>
          ) : (
            <>
              <label className="field-label">
                Placement scene
                <select
                  value={scene}
                  onChange={(e) => setScene(e.target.value)}
                >
                  <option value="packaging">Packaging</option>
                  <option value="poster">Poster</option>
                  <option value="card">Business card</option>
                </select>
              </label>
              <div
                ref={sceneBoard}
                className="art-context"
                style={{ backgroundImage: `url(/scenes/${scene}.svg)` }}
              >
                <span className="scene-corner">PLACEMENT PREVIEW</span>
                {current && (
                  <div
                    className="art-context-image"
                    role="slider"
                    tabIndex={0}
                    aria-label="Artwork placement"
                    aria-valuemin={15}
                    aria-valuemax={85}
                    aria-valuenow={position.x}
                    aria-valuetext={`${Math.round(position.x)} percent across, ${Math.round(position.y)} percent down`}
                    style={{
                      left: `${position.x}%`,
                      top: `${position.y}%`,
                      transform: `translate(-50%,-50%) rotate(${rotation}deg)`,
                    }}
                    onPointerDown={(e) => {
                      dragging.current = true;
                      e.currentTarget.setPointerCapture(e.pointerId);
                    }}
                    onPointerMove={(e) => {
                      if (!dragging.current || !sceneBoard.current) return;
                      const r = sceneBoard.current.getBoundingClientRect();
                      setPosition({
                        x: Math.max(
                          15,
                          Math.min(85, ((e.clientX - r.left) / r.width) * 100),
                        ),
                        y: Math.max(
                          15,
                          Math.min(85, ((e.clientY - r.top) / r.height) * 100),
                        ),
                      });
                    }}
                    onPointerUp={() => {
                      dragging.current = false;
                    }}
                    onPointerCancel={() => {
                      dragging.current = false;
                    }}
                    onKeyDown={(e) => {
                      if (!e.key.startsWith("Arrow")) return;
                      e.preventDefault();
                      setPosition((p) => ({
                        x: Math.max(
                          15,
                          Math.min(
                            85,
                            p.x +
                              (e.key === "ArrowLeft"
                                ? -1
                                : e.key === "ArrowRight"
                                  ? 1
                                  : 0),
                          ),
                        ),
                        y: Math.max(
                          15,
                          Math.min(
                            85,
                            p.y +
                              (e.key === "ArrowUp"
                                ? -1
                                : e.key === "ArrowDown"
                                  ? 1
                                  : 0),
                          ),
                        ),
                      }));
                    }}
                  >
                    <img
                      src={current.png}
                      alt="Your QR artwork placed in the scene"
                      draggable={false}
                    />
                  </div>
                )}
                <button
                  className="art-reset"
                  aria-label="Reset artwork placement"
                  onClick={() => {
                    setPosition({ x: 51, y: 64 });
                    setRotation(0);
                  }}
                >
                  <RotateCcw size={15} />
                </button>
              </div>
              <p className="microcopy">
                Drag the artwork, or focus it and use arrow keys. This scene is
                not a calibrated scan test.
              </p>
            </>
          )}
          <div className="art-strength">
            <Fader
              label="Scan strength"
              value={Math.round(strength * 1000) / 10}
              min={0}
              max={100}
              unit="%"
              onChange={(v) => setStrength(v / 100)}
            />
            <div className="fader-legend">
              <span>More artwork detail</span>
              <span>More pattern protection</span>
            </div>
          </div>
          <div className="simulation-controls">
            <Fader
              label="Print width"
              value={sizeMm}
              min={30}
              max={Math.max(160, sizeMm)}
              unit="mm"
              onChange={setSizeMm}
            />
            <Fader
              label="Viewing distance"
              value={distanceCm}
              min={10}
              max={200}
              unit="cm"
              onChange={setDistanceCm}
            />
            <Fader
              label="Blur simulation"
              value={blur}
              min={0}
              max={2}
              step={0.25}
              unit="px"
              onChange={setBlur}
            />
            <Fader
              label="Rotation"
              value={rotation}
              min={-45}
              max={45}
              unit="°"
              onChange={setRotation}
            />
          </div>
        </div>
        <aside className="art-validation" aria-label="QR artwork validation">
          <div className="panel-heading">
            <span className="step-index">03</span>
            <h2>Prove it scans</h2>
            <SlidersHorizontal size={15} />
          </div>
          <div className={`art-verdict ${ready ? "is-ready" : ""}`}>
            <span className="section-label">IMAGE VALIDATION</span>
            <strong>
              {ready
                ? "Image decoded."
                : encoded.error || error
                  ? "Check your inputs."
                  : !current || !currentProof
                    ? "Checking…"
                    : "Needs a repair."}
            </strong>
            <p>
              {ready
                ? "The artwork reads back to your exact destination."
                : "A good-looking image still has to carry the right destination."}
            </p>
          </div>
          <div className="art-checks">
            <ProofRow label="Original artwork" pass={current?.pristine} />
            <ProofRow label="Reduced to 256px" pass={current?.reduced} />
            <ProofRow label="Simulated scan" pass={currentProof?.simulated} />
            <ProofRow label="Print size & distance" pass={dimensionsPass} />
          </div>
          <p className="microcopy">
            Real decoder checks on the image itself. These are not guarantees
            for every phone or print material.
          </p>
          <button
            className="autofix-button"
            onClick={repair}
            disabled={!encoded.text}
          >
            <Sparkles size={15} /> Repair scanability
          </button>
          <p className="microcopy">
            Repair protects sampling points while retaining image texture.
            Stronger protection can make the QR structure more visible.
          </p>
          <div className="art-input-divider" />
          <label className="field-label">
            Download image
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as "png" | "pdf")}
            >
              <option value="png">PNG · high resolution</option>
              <option value="pdf">PDF · RGB, actual print size</option>
            </select>
          </label>
          <button
            className="export-button"
            disabled={!ready || exporting || uploading || portraitLoading}
            onClick={() => void download()}
          >
            {exporting ? (
              <LoaderCircle size={15} className="spin" />
            ) : (
              <ArrowDownToLine size={15} />
            )}{" "}
            Download QR image
          </button>
          <p className="microcopy">
            Artwork included. Print a proof at {sizeMm} mm. Brand captions and
            placement scenes are outside the exported image.
          </p>
          <a className="art-methodology" href="/docs">
            How image validation works <ArrowUpRight size={12} />
          </a>
        </aside>
      </div>
      {(error || notice) && (
        <div className="studio-notice" role={error ? "alert" : "status"}>
          <p>{error || notice}</p>
          <button
            aria-label="Dismiss message"
            onClick={() => {
              setError("");
              setNotice("");
            }}
          >
            ×
          </button>
        </div>
      )}
      <footer className="studio-foot">
        <span>No account needed. No image uploads to a server.</span>
        <button className="clear-draft" onClick={clearDraft}>
          Clear draft
        </button>
      </footer>
    </section>
  );
}
function ProofRow({ label, pass }: { label: string; pass?: boolean }) {
  return (
    <div className="art-proof-row">
      <span>{label}</span>
      <strong
        className={pass === undefined ? "pending" : pass ? "passed" : "failed"}
      >
        {pass === undefined ? (
          <LoaderCircle size={13} className="spin" />
        ) : pass ? (
          <Check size={14} />
        ) : (
          <CircleAlert size={14} />
        )}
        {pass === undefined ? "Testing" : pass ? "Passed" : "Needs repair"}
      </strong>
    </div>
  );
}
function Fader({
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
    <label className="range-control">
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

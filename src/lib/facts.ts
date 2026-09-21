export const site = "https://qrupgrade.com";
export const description =
  "Create sculptural QR artwork with a 3D look. Check the finished image and turn it into social and print campaign assets.";
export const faqs = [
  {
    q: "Are these actual 3D models?",
    a: "No. QR Upgrade creates flat QR images with the appearance of sculpted depth, light and materials. Steel, glass, ceramic and embossed-paper AI directions are available when generation is connected. The browser adds and tests the QR pattern after generation; a generated artwork alone is not assumed scannable.",
  },
  {
    q: "What is in a campaign kit?",
    a: "The web studio can package the original artwork PNG, a 1080-square post, a 1080 by 1920 story, an A6 counter-card PNG and RGB PDF, a scan report and a print guide in one ZIP. Business, creator and agency message presets are editable. Four PNGs are decoded at full and half size against the intended content before downloading. The PDF embeds the checked counter-card image; it is not separately decoded. Native campaign-kit export is not yet available.",
  },
  {
    q: "What are the three creation modes?",
    a: "The web generator offers Custom QR with editable colours, module shapes and 15 templates; Image QR using your own picture; and QR Art with original prompt-based generation plus 14 library artworks. It includes centre portraits, image crop and composition controls, captions, 24 destination shortcuts, local design saving, and PNG, JPG, WebP, SVG and RGB PDF downloads.",
  },
  {
    q: "What is a QR image?",
    a: "An artistic image whose shapes, tones and details also encode a QR destination. QR Upgrade integrates a deterministic QR pattern into the artwork and tests the resulting image.",
  },
  {
    q: "Can I create a unique image from a prompt?",
    a: "Yes. Describe an artwork and choose a material direction in QR Art. Cloudflare Workers AI generates an image, then the browser integrates and validates your QR destination. The beta allows three generation attempts per network each UTC day, with a shared daily allowance. Library images and local uploads remain available without generation.",
  },
  {
    q: "What does image validation check?",
    a: "The web editor decodes the full artwork, a 256-pixel version and a controlled scan simulation back to the exact intended content. Export also requires suitable print width and viewing-distance settings. These checks are not a scan probability or an ISO grade.",
  },
  {
    q: "What does Repair scanability do?",
    a: "It increases contrast protection around the QR sampling points and adjusts print width. Stronger protection can make the QR structure more visible. It does not change your destination or reduce the selected test distance and blur.",
  },
  {
    q: "What is included in the download?",
    a: "The web generator offers PNG, JPG, WebP, SVG and RGB PDF with a custom filename. Uncomposed Custom QR uses vector SVG; artwork, portrait and caption compositions embed a raster. Captions and clear borders are included; placement scenes are excluded. Lossy exports are decoded after encoding. The native preview supports PNG and PDF.",
  },
  {
    q: "Where do my images and QR content go?",
    a: "Your selected images and QR destination are processed locally. Save design explicitly stores them in this browser, including any Wi-Fi or contact details; clearing site data removes local saves. Generating AI artwork sends only the prompt and style to Cloudflare. Results are available for one hour and removed by an hourly cleanup; hashed job and quota metadata is retained for up to three days. Anyone scanning a Wi-Fi QR can read its credentials.",
  },
  {
    q: "Will the finished QR work on every phone?",
    a: "No simulator can promise that. Test the exported artwork on several phones and a physical proof at its final size, lighting and material before a print run.",
  },
  {
    q: "Are dynamic links and team workspaces available?",
    a: "They are planned. Current exports encode your destination directly, so changing it requires a new QR image. Subscriptions, cloud brand kits and scan analytics are not active.",
  },
];
export const sources = [
  {
    label: "DENSO WAVE: QR code area and four-module quiet zone",
    url: "https://www.qrcode.com/en/howto/code.html",
  },
  {
    label: "Google Search: AI features and your website",
    url: "https://developers.google.com/search/docs/appearance/ai-features",
  },
  { label: "The llms.txt proposal", url: "https://llmstxt.org/" },
  {
    label: "node-qrcode: deterministic encoding",
    url: "https://github.com/soldair/node-qrcode",
  },
  { label: "jsQR: image decoding", url: "https://github.com/cozmo/jsQR" },
];
export const summary = `# QR Upgrade\n\n> ${description}\n\nStatus: working preview, not a launched subscription service.\n\n## Product\n- [QR Studio](${site}/generator): Create artistic QR images for links, Wi-Fi, contacts, messages, email, events and locations.\n- [Scan Lab](${site}/scan-lab): Preview placement and inspect print settings.\n- [Methodology](${site}/docs): Scoring, decoding, and limitations.\n- [Product facts](${site}/ai): Current capabilities and planned features.\n- [Full reference](${site}/llms-full.txt): Public first-party product information.\n\nNo private uploads, passwords, campaign data, or customer information is included here.\n`;
export const fullFacts =
  summary +
  "\n## Questions and answers\n" +
  faqs.map((f) => `\n### ${f.q}\n${f.a}\n`).join("") +
  `\n## Image creation and validation\nThe prepared library artworks were created during development with a QR structural reference. Original prompt-based artwork uses Cloudflare Workers AI (FLUX.1 Schnell); the generated image is not assumed scannable. The editor crops and adjusts the selected image, integrates an H-error-correction QR pattern with a four-module quiet zone, and protects reserved structures and adjustable sampling areas. On web the working artwork is 768 pixels square. Native uses a 512-pixel working image. Enlarging an export does not create new source detail.\n\nWeb decoding: one engine (jsQR), exact payload comparison on the original, a 256-pixel reduction, and a controlled blur/downsampling/rotation simulation. All must pass alongside print-size checks before download. The native app decodes the captured image before export; it does not provide the web stress simulation. Physical width includes the quiet zone. Conservative planning checks use minimum module width 0.40 mm and a 10:1 viewing-distance-to-width ratio. These are heuristics, not calibrated device performance or ISO verification.\n\nScene photos are placement references; their lighting, texture, perspective and physical scale are not inferred automatically. The generator offers PNG, JPG, WebP, SVG and RGB PDF exports including the complete composed QR design. Uncomposed Custom QR is vector SVG; artwork, portrait and caption SVG exports embed a raster. The baseline uses a fixed 40 cm reference scan distance; Scan Lab provides adjustable simulation settings. Studio captions are included; placement scenes are excluded. My designs stores explicit browser-local saves with five previous versions, rename, duplicate, archive and restore. Scan Lab receives the exact composed image and supports returning to its editable draft.\n\n## Roadmap\nModel-native QR structural conditioning, multi-engine validation, dynamic links, geographic routing, saved brand kits, billing, teams, analytics, AR and CMYK proofing remain planned. Proposed prices are not active offers.\n\n## Discovery\nPublic pages use semantic HTML, canonical links, metadata and relevant JSON-LD. llms.txt is an optional discovery convention, not a guarantee of crawling, indexing, ranking or AI citations.\n\n## Sources\n` +
  sources.map((s) => `- [${s.label}](${s.url})`).join("\n");

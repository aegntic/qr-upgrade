export const site = "https://qrupgrade.com";
export const description =
  "Create custom QR images where artwork carries your destination. Check the finished image, repair scanability, and export the artwork.";
export const faqs = [
  {
    q: "What are the three creation modes?",
    a: "The web generator offers Custom QR with editable colours, module shapes and 15 templates; Image QR using your own picture; and QR Art with 14 ready-made AI-created artworks. It includes logo/photo upload, 18 destination shortcuts, optional UTM tags for website links, and PNG, SVG and RGB PDF downloads.",
  },
  {
    q: "What is a QR image?",
    a: "An artistic image whose shapes, tones and details also encode a QR destination. QR Upgrade integrates a deterministic QR pattern into the artwork and tests the resulting image.",
  },
  {
    q: "Can I create a unique image from a prompt?",
    a: "Live text-to-image generation is not connected yet. This preview includes 14 AI-created artwork directions and supports your own uploaded image. You can encode a website, Wi-Fi network or contact into that image locally.",
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
    a: "The web generator offers PNG, SVG and RGB PDF. Custom QR without a centre image uses vector SVG; other SVG exports embed the raster image. Artwork and clear borders are included. Captions and scene previews are outside the downloaded image. The native preview supports PNG and PDF.",
  },
  {
    q: "Where do my images and QR content go?",
    a: "The current editor processes your image and destination locally without uploading either to a server. There is no account or campaign storage. Downloads remain under your control. Anyone scanning a Wi-Fi QR can read its credentials.",
  },
  {
    q: "Will the finished QR work on every phone?",
    a: "No simulator can promise that. Test the exported artwork on several phones and a physical proof at its final size, lighting and material before a print run.",
  },
  {
    q: "Are dynamic links and team workspaces available?",
    a: "They are planned. Current exports encode your destination directly, so changing it requires a new QR image. Subscriptions, cloud brand kits, analytics and live image generation are not active.",
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
export const summary = `# QR Upgrade\n\n> ${description}\n\nStatus: working preview, not a launched subscription service.\n\n## Product\n- [QR Studio](${site}/generator): Create URL, Wi-Fi, and vCard QR codes.\n- [Scan Lab](${site}/scan-lab): Preview placement and inspect print settings.\n- [Methodology](${site}/docs): Scoring, decoding, and limitations.\n- [Product facts](${site}/ai): Current capabilities and planned features.\n- [Full reference](${site}/llms-full.txt): Public first-party product information.\n\nNo private uploads, passwords, campaign data, or customer information is included here.\n`;
export const fullFacts =
  summary +
  "\n## Questions and answers\n" +
  faqs.map((f) => `\n### ${f.q}\n${f.a}\n`).join("") +
  `\n## Image creation and validation\nThe 14 example artworks were created during development with an image-generation tool using a QR structural reference. They are not generated on demand. The editor center-crops the selected image, integrates an H-error-correction QR pattern with a four-module quiet zone, and protects reserved structures and adjustable sampling areas. On web the working artwork is 768 pixels square. Native uses a 512-pixel working image. Enlarging an export does not create new source detail.\n\nWeb decoding: one engine (jsQR), exact payload comparison on the original, a 256-pixel reduction, and a controlled blur/downsampling/rotation simulation. All must pass alongside print-size checks before download. The native app decodes the captured image before export; it does not provide the web stress simulation. Physical width includes the quiet zone. Conservative planning checks use minimum module width 0.40 mm and a 10:1 viewing-distance-to-width ratio. These are heuristics, not calibrated device performance or ISO verification.\n\nScene photos are placement references; their lighting, texture, perspective and physical scale are not inferred automatically. The baseline generator offers PNG, SVG and RGB PDF exports, including the complete QR design. Custom QR without a centre image is vector SVG; SVG exports with artwork or a centre image embed a raster. The baseline uses a fixed 40 cm reference scan distance; Scan Lab provides adjustable simulation settings. Preview captions and scenes are excluded.\n\n## Roadmap\nLive prompt-to-image generation with QR structural conditioning, multi-engine validation, dynamic links, geographic routing, saved brand kits, billing, teams, analytics, AR and CMYK proofing remain planned. Proposed prices are not active offers.\n\n## Discovery\nPublic pages use semantic HTML, canonical links, metadata and relevant JSON-LD. llms.txt is an optional discovery convention, not a guarantee of crawling, indexing, ranking or AI citations.\n\n## Sources\n` +
  sources.map((s) => `- [${s.label}](${s.url})`).join("\n");

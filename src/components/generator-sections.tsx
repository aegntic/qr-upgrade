import Link from "next/link";
import {
  ArrowUpRight,
  Check,
  ImagePlus,
  Palette,
  ScanLine,
  ShieldCheck,
  Shapes,
  Download,
  Link2,
  Wifi,
  Sparkles,
} from "lucide-react";
import { DestinationIcon } from "./destination-icon";
import { artworkDesigns } from "@/lib/artwork-designs";
import { destinations, templates } from "@/lib/generator-options";
import { createMatrix, qrSvg, svgData } from "@/lib/qr";

const benefits = [
  {
    icon: Shapes,
    title: "Three ways to create",
    text: "Choose a custom pattern, use your own image, or start with an AI-created artwork.",
  },
  {
    icon: Palette,
    title: "Make it your brand",
    text: "Choose colours and module shapes. Add a logo or profile photo at the centre.",
  },
  {
    icon: Sparkles,
    title: "An artwork library",
    text: "Explore 14 image directions, from botanical illustrations to sculptural metal.",
  },
  {
    icon: Link2,
    title: "Links people share",
    text: "Start with a profile, playlist, menu, product, review page or another public link.",
  },
  {
    icon: Wifi,
    title: "Beyond the website",
    text: "Create a Wi-Fi QR for guests or a contact card for your next introduction.",
  },
  {
    icon: ScanLine,
    title: "Check the actual image",
    text: "Read back the final QR at full size, at a smaller size and in a reference scan simulation.",
  },
  {
    icon: ShieldCheck,
    title: "Your content stays local",
    text: "Your images and destination are processed on your device. No account is needed.",
  },
  {
    icon: Download,
    title: "Take the whole design",
    text: "Download PNG, an SVG image document or an RGB PDF at your chosen print width.",
  },
  {
    icon: ImagePlus,
    title: "Start with what you have",
    text: "Bring a PNG, JPEG or WebP. The image and QR structure become one composition.",
  },
];
const questions = [
  {
    title: "Understanding QR codes",
    items: [
      [
        "What can I share with a QR code?",
        "A website or public link, Wi-Fi network details, or a contact card. The destination shortcuts help you start with common links such as Instagram, LinkedIn, menus, PDFs and playlists.",
      ],
      [
        "Do these QR codes expire?",
        "These are static QRs and have no expiry set by QR Upgrade. A link still depends on its destination remaining available. Network credentials and contact details remain as originally encoded.",
      ],
      [
        "Are the social QR codes native platform codes?",
        "They are ordinary QR images that open your chosen public link. They do not create Snapchat Snapcodes or Spotify Codes, and are not endorsed by those platforms.",
      ],
      [
        "Can I change the destination after downloading?",
        "A static QR stores the destination inside the image. Change it in the generator and download a new QR. If you own the destination page, you can update the content on that page.",
      ],
    ],
  },
  {
    title: "Creating and customising",
    items: [
      [
        "What is the difference between the three modes?",
        "Custom QR gives you a clean pattern with editable colours and shapes. Image QR uses your uploaded picture. QR Art starts with one of our AI-created artwork examples. All three are checked before export.",
      ],
      [
        "Can I put a logo or photo in the centre?",
        "Yes. Open the Logo tab, choose an image and adjust its size. The complete QR is checked again. You may need a smaller centre image or stronger QR contrast to pass.",
      ],
      [
        "Can I generate a new artwork from a prompt?",
        "The current generator offers ready-made AI-created artwork and local image uploads. Live prompt-to-image generation is planned and is not available in this baseline.",
      ],
      [
        "Which download formats are included?",
        "PNG, SVG and RGB PDF. Custom QR exports without a centre image use vector SVG. Image, artwork and logo designs use an SVG document containing the complete raster image. The PDF uses your selected QR print width.",
      ],
      [
        "What should I do if the scan check fails?",
        "Use Adjust for scanning, reduce the centre image, increase scan strength, or choose a simpler design. Test a physical proof on the phones and materials you intend to use.",
      ],
    ],
  },
  {
    title: "Privacy and tracking",
    items: [
      [
        "Are my images uploaded to a server?",
        "No. The current generator processes your selected image and QR content locally in your browser. Reset clears the draft. Files you download or share remain under your control.",
      ],
      [
        "Can I track scans or add a password?",
        "Hosted dynamic links, scan analytics, passwords, expiry and A/B routing are planned services. They are not active in this baseline. A static QR can link to a page that already provides those features.",
      ],
      [
        "What do UTM parameters do?",
        "They add campaign labels to a website link. Your website’s analytics may use those labels when a visitor opens the link. QR Upgrade does not collect scan analytics in this baseline.",
      ],
      [
        "Does a passed check guarantee every scan?",
        "No. The checks confirm the exact encoded content under reference conditions. Paper, lighting, size, glare and the camera can affect a real scan. Always test the finished physical design.",
      ],
    ],
  },
];
export default function GeneratorSections() {
  return (
    <>
      <div className="generator-proof-strip">
        <span>
          <Check size={15} /> No account required
        </span>
        <span>
          <Shapes size={15} /> 3 creation modes
        </span>
        <span>
          <ShieldCheck size={15} /> Images stay on your device
        </span>
        <span>
          <Download size={15} /> PNG · SVG · PDF
        </span>
      </div>
      <section className="foundation-section" id="how-it-works">
        <div className="foundation-heading" data-reveal>
          <h2>From a link to a lasting impression.</h2>
          <p>
            A familiar flow, with room to make the result unmistakably yours.
          </p>
        </div>
        <div className="foundation-workflow">
          <article>
            <div className="workflow-visual workflow-destinations">
              {destinations.slice(0, 9).map((d) => (
                <span key={d.id} style={{ color: d.color }}>
                  <DestinationIcon id={d.id} size={23} />
                </span>
              ))}
            </div>
            <div>
              <span className="workflow-number">01 / CONTENT</span>
              <h3>Choose what you want to share.</h3>
              <p>
                Start with a website, social profile, review link, menu,
                playlist, Wi-Fi network or contact card. Add a destination once
                and see the QR update.
              </p>
            </div>
          </article>
          <article>
            <div className="workflow-visual workflow-art-stack">
              <img
                src="/artwork/tiger.webp"
                alt="Tiger QR artwork"
                loading="lazy"
              />
              <img
                src="/brand-studies/instagram.webp"
                alt="Instagram-inspired QR image study"
                loading="lazy"
              />
            </div>
            <div>
              <span className="workflow-number">02 / DESIGN</span>
              <h3>Make it look like you.</h3>
              <p>
                Choose a clean custom QR, build around your own image, or
                explore QR Art. Then customise the pattern, colour and centre
                image.
              </p>
            </div>
          </article>
          <article>
            <div className="workflow-visual workflow-export">
              <div>
                <ScanLine size={38} />
                <span>
                  <Check size={13} /> Scan checks passed
                </span>
                <strong>
                  PNG <i>SVG</i> PDF
                </strong>
              </div>
            </div>
            <div>
              <span className="workflow-number">03 / DOWNLOAD</span>
              <h3>Check it. Download it. Share it.</h3>
              <p>
                Preview the complete image, check that it opens the right
                destination, and choose your format. Print a proof before a
                larger run.
              </p>
            </div>
          </article>
        </div>
      </section>
      <section className="foundation-section mode-overview">
        <div className="foundation-heading" data-reveal>
          <h2>Custom QR. Image QR. QR Art.</h2>
          <p>
            From a simple introduction to a full visual identity, the choice is
            yours.
          </p>
        </div>
        <div className="mode-overview-images">
          <Link href="/generator?mode=custom">
            <img
              src={svgData(
                qrSvg(createMatrix("https://qrupgrade.com/"), templates[14]),
              )}
              alt="Custom QR with a graphite pattern"
              loading="lazy"
            />
            <span>Custom QR</span>
          </Link>
          <Link href="/generator?mode=image">
            <img
              src="/brand-studies/x-portrait.png"
              alt="An image QR with a centre portrait"
              loading="lazy"
            />
            <span>Image QR</span>
          </Link>
          <Link href="/generator?art=tiger">
            <img
              src="/artwork/tiger.webp"
              alt="A tiger integrated into QR artwork"
              loading="lazy"
            />
            <span>QR Art</span>
          </Link>
        </div>
        <Link href="#studio" className="foundation-cta">
          Create your QR code <ArrowUpRight size={15} />
        </Link>
      </section>
      <section className="foundation-section" id="examples">
        <div className="foundation-heading" data-reveal>
          <h2>Explore QR code examples.</h2>
          <p>
            Choose an image direction, add your destination, and make it your
            own.
          </p>
        </div>
        <div className="foundation-example-strip">
          {[
            artworkDesigns[0],
            artworkDesigns[4],
            artworkDesigns[2],
            artworkDesigns[5],
            artworkDesigns[7],
          ].map((d) => (
            <Link key={d.id} href={`/generator?art=${d.id}`}>
              <img
                src={`/artwork/${d.id}.webp`}
                alt={`${d.name} QR artwork`}
                loading="lazy"
                width={240}
                height={240}
              />
              <span>
                {d.name}
                <ArrowUpRight size={13} />
              </span>
            </Link>
          ))}
        </div>
        <Link href="/templates" className="foundation-cta">
          Discover more QR examples <ArrowUpRight size={15} />
        </Link>
      </section>
      <section className="foundation-section" id="features">
        <div className="foundation-heading" data-reveal>
          <h2>The details make the difference.</h2>
          <p>Choose, customise, check and download in one place.</p>
        </div>
        <div className="foundation-feature-grid">
          {benefits.map(({ icon: Icon, title, text }) => (
            <article key={title}>
              <div className="feature-illustration">
                <Icon size={32} strokeWidth={1.3} />
              </div>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="foundation-section" id="qr-types">
        <div className="foundation-heading" data-reveal>
          <h2>Choose your QR code type.</h2>
          <p>
            Popular destinations, Wi-Fi access and contact details. Start with
            the one you need.
          </p>
        </div>
        <div className="foundation-types-grid">
          {destinations.map((d) => (
            <Link key={d.id} href={`/generator?type=${d.id}`}>
              <div
                className="type-illustration"
                style={
                  { "--destination-color": d.color } as React.CSSProperties
                }
              >
                <span>
                  <DestinationIcon id={d.id} size={23} />
                </span>
              </div>
              <div>
                <h3>{d.name} QR</h3>
                <p>{d.description}</p>
                <span className="type-link">
                  Create QR code <ArrowUpRight size={12} />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>
      <section className="foundation-section foundation-faq" id="faq">
        <div className="foundation-heading" data-reveal>
          <h2>Before your next scan.</h2>
        </div>
        {questions.map((group) => (
          <div className="foundation-faq-group" key={group.title}>
            <h3>{group.title}</h3>
            {group.items.map(([q, a], i) => (
              <details key={q} open={i === 0}>
                <summary>
                  {q}
                  <span>+</span>
                </summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        ))}
      </section>
      <section className="foundation-closing">
        <h2>
          Your next connection
          <br />
          starts here.
        </h2>
        <p>Give your link a design worth sharing.</p>
        <Link href="#studio" className="foundation-cta">
          Create your QR code <ArrowUpRight size={15} />
        </Link>
      </section>
    </>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
const pages = {
  "brand-kits": {
    title: "A home for your brand.",
    label: "BRAND KITS / PLANNED",
    description: "Save QR designs in your browser and export a coordinated campaign kit. Learn what is available now and what is planned for reusable brand kits.",
    body: "Create QR artwork from your own imagery, then use Save design to keep an explicit copy in this browser. My designs lets you reopen, rename, duplicate and archive it. Cloud saving is a separate account action. Campaign kits turn a checked design into social and print layouts today; reusable brand presets and team workspaces remain planned. Clearing site data removes browser-local saves.",
  },
  blog: {
    title: "The space around the square.",
    label: "FIELD NOTES / PRINT BASICS",
    description: "Plan a clear QR quiet zone and test the final print size, viewing distance and material before producing posters, packaging or counter cards.",
    body: "A QR needs a clear border called a quiet zone. DENSO WAVE specifies four modules around a standard QR code. Keep that space free of text, imagery, and trim edges. Then check the code at its actual printed size, from the intended distance, on the final material. A beautiful screen preview cannot tell you how glare, a crease, or a curved bottle will affect a camera.",
  },
};
export const dynamic = "force-dynamic";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ info: string }>;
}) {
  const { info } = await params;
  if (!Object.hasOwn(pages, info)) notFound();
  const page = pages[info as keyof typeof pages];
  return { title: page.title, description: page.description, alternates: { canonical: "/" + info } };
}
export default async function InfoPage({
  params,
}: {
  params: Promise<{ info: string }>;
}) {
  const { info } = await params;
  if (!Object.hasOwn(pages, info)) notFound();
  const page = pages[info as keyof typeof pages];
  if (!page) notFound();
  return (
    <main id="main" className="document-page prose">
      <span className="section-kicker">{page.label}</span>
      <h1>{page.title}</h1>
      <p className="lead">{page.body}</p>
      {info === "blog" && (
        <p>
          Source:{" "}
          <a href="https://www.qrcode.com/en/howto/code.html">
            DENSO WAVE: determining the code area
          </a>
          .
        </p>
      )}
      <Link className="primary-button" href="/generator">
        Open studio ↗
      </Link>
      <p>
        <Link href="/docs">Read the current capabilities and methodology</Link>
      </p>
    </main>
  );
}

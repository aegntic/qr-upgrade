import Link from "next/link";
import { notFound } from "next/navigation";
const pages = {
  dynamic: {
    title: "One code. Room to change.",
    label: "DYNAMIC DESTINATIONS / PLANNED",
    body: "Dynamic redirects, geographic and language routing, and campaign analytics are planned. This preview creates static QR codes: your destination is encoded directly. Use a URL you control if you need to change its content later.",
  },
  "brand-kits": {
    title: "A home for your brand.",
    label: "BRAND KITS / PLANNED",
    body: "Saved artwork directions, team workspaces, and reusable brand kits are planned. In this preview you can turn your own image into QR artwork locally. Your draft is not stored after you leave.",
  },
  pricing: {
    title: "Start with the work.",
    label: "PRICING / PREVIEW",
    body: "The current browser preview is free to use without an account. The proposed Pro plan at US$12/month and Brand plan at US$25/month are planning targets, not active offers. Billing, paid subscriptions, teams, and API entitlements are not connected.",
  },
  blog: {
    title: "The space around the square.",
    label: "FIELD NOTES / PRINT BASICS",
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
  return { title: page?.title, alternates: { canonical: "/" + info } };
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

import Link from "next/link";
import { faqs, sources, site } from "@/lib/facts";
import { Schema } from "@/components/schema";
export const metadata = {
  title: "Print checks and methodology",
  description: "How QR Upgrade checks finished QR artwork, protects the quiet zone and prepares exports. Understand the scan tests and physical print limitations.",
  alternates: { canonical: "/docs" },
};
export default function Docs() {
  return (
    <main id="main" className="document-page prose">
      <Schema
        data={{
          "@context": "https://schema.org",
          "@type": "TechArticle",
          headline: "QR Upgrade print checks and methodology",
          url: site + "/docs",
          author: { "@type": "Organization", name: "QR Upgrade" },
        }}
      />
      <span className="section-kicker">FIELD NOTES / 001</span>
      <h1>Confidence needs context.</h1>
      <p className="lead">
        A useful test tells you what was checked, what failed, and what still
        needs a physical proof.
      </p>
      <h2>The artwork carries the destination</h2>
      <p>
        The baseline web generator starts with Custom QR, Image QR or QR Art. It
        includes destination shortcuts, design/logo/style tabs and download
        controls. Custom QR is rendered directly from the encoded pattern; Image
        QR and QR Art use the artwork integration described below.
      </p>
      <p>
        The 14 example artworks were generated during development with a QR
        structural reference. Select one or upload your own image. The editor lets you crop, position and adjust the image, encodes your destination with high error correction, and integrates the required contrast into its pixels. You can also generate a new image from a prompt with Cloudflare Workers AI, then apply it to your QR. Only the description and style are sent to the image model; your destination and uploaded images are not.
      </p>
      <h2>Testing the actual image</h2>
      <p>
        The baseline uses a fixed 40 cm reference scan distance, without extra
        blur or rotation. Choose Test this design to carry the exact studio image into <Link href="/scan-lab">Scan Lab</Link> and adjust its simulation controls. Returning to the studio retains the design.
      </p>
      <p>
        The web editor uses jsQR to read the finished artwork at its working
        size, reduced to 256 pixels, and in a controlled blur, downsampling and
        rotation simulation. Every result must match your exact destination. A
        stale or failed check blocks export.
      </p>
      <p>
        The scan simulation uses a reference width of 160 × print width in mm /
        distance in cm, clamped to 40–360 pixels. It is not calibrated to a
        particular phone. Native exports run an exact-content check on the
        captured image, without the web stress simulation.
      </p>
      <table>
        <thead>
          <tr>
            <th>Print check</th>
            <th>Requirement</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Quiet zone</td>
            <td>Four clear modules, preserved by the image encoder.</td>
          </tr>
          <tr>
            <td>Module width</td>
            <td>At least 0.40 mm; a conservative planning heuristic.</td>
          </tr>
          <tr>
            <td>Viewing distance</td>
            <td>
              No more than ten times the code width; an approximate planning
              rule.
            </td>
          </tr>
        </tbody>
      </table>
      <h2>Repairing scanability</h2>
      <p>
        Repair increases contrast protection around QR sampling points and
        adjusts print width. It retains image texture, but stronger protection
        makes the QR structure more visible. It does not reduce the selected
        distance or blur to improve a result. The image is decoded again after
        every change.
      </p>
      <h2>Print handoff</h2>
      <p>
        The baseline also offers SVG: a true vector QR for Custom QR without a
        centre image, caption or composition adjustments, or an SVG containing the complete raster image for image,
        art and logo designs.
      </p>
      <p>
        PNG, JPG, WebP and RGB PDF exports include the complete artwork, caption and quiet zone. Scene mockups are excluded. JPG and WebP files are decoded again after compression before download. The working image is 768 pixels
        square on web and 512 on native; larger exports resample those pixels. A
        PDF specifies your chosen physical dimensions but is not CMYK or PDF/X.
      </p>
      <p>
        Scene previews do not measure lighting, texture, perspective, glare or
        surface curvature. Digital checks are neither a scan probability nor an
        ISO grade. Test a physical proof at the intended size on the final
        material with several phones.
      </p>
      <h2>Keeping your work</h2>
      <p>Save design stores the current destination, images and any credentials in this browser, with up to five prior versions. My designs supports search, rename, duplicate, archive and restore. Clearing site data removes these local copies. Cloud saving is a separate, explicit action and requires Google sign-in; it stays unavailable until the account connection is configured.</p>
      <p>Generated images can be retrieved for one hour and are removed from the generation service within two hours. Applying or saving an image keeps a browser copy. Generation metadata without the prompt is retained for three days to enforce usage limits.</p>
      <h2>Parameter-check API</h2>
      <p>
        <code>POST /api/v1/scan</code> is disabled by default. When explicitly
        enabled, it requires a server-side bearer credential and a shared rate
        limiter. It accepts print parameters only and performs the four
        deterministic checks; it does not receive images or validate a decoded
        payload. Do not transmit URLs, passwords, or contact data to this
        endpoint.
      </p>
      <pre>
        {JSON.stringify(
          {
            foreground: "#214638",
            background: "#ffffff",
            quietZone: 4,
            sizeMm: 40,
            distanceCm: 40,
            modules: 29,
          },
          null,
          2,
        )}
      </pre>
      <h2>Common questions</h2>
      {faqs.map((f) => (
        <section key={f.q}>
          <h3>{f.q}</h3>
          <p>{f.a}</p>
        </section>
      ))}
      <h2>Sources and discovery files</h2>
      <ul>
        {sources.map((s) => (
          <li key={s.url}>
            <a href={s.url}>{s.label}</a>
          </li>
        ))}
      </ul>
      <p>
        <Link href="/llms.txt">Concise product facts</Link> ·{" "}
        <Link href="/llms-full.txt">Full product facts</Link> ·{" "}
        <Link href="/ai">Readable knowledge page</Link>
      </p>
    </main>
  );
}

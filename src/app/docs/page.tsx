import Link from "next/link";
import { faqs, sources, site } from "@/lib/facts";
import { Schema } from "@/components/schema";
export const metadata = {
  title: "Print checks and methodology",
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
        structural reference. Select one or upload your own image. The editor
        center-crops the image, encodes your destination with high error
        correction, and integrates the required contrast into its pixels. Live
        prompt-to-image generation is not connected yet.
      </p>
      <h2>Testing the actual image</h2>
      <p>
        The baseline uses a fixed 40 cm reference scan distance, without extra
        blur or rotation. The separate <Link href="/scan-lab">Scan Lab</Link>{" "}
        retains its adjustable simulation controls.
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
        centre image, or an SVG containing the complete raster image for image,
        art and logo designs.
      </p>
      <p>
        PNG and RGB PDF exports include the complete artwork and quiet zone.
        Captions and scene mockups are excluded. The working image is 768 pixels
        square on web and 512 on native; larger exports resample those pixels. A
        PDF specifies your chosen physical dimensions but is not CMYK or PDF/X.
      </p>
      <p>
        Scene previews do not measure lighting, texture, perspective, glare or
        surface curvature. Digital checks are neither a scan probability nor an
        ISO grade. Test a physical proof at the intended size on the final
        material with several phones.
      </p>
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

import Link from "next/link";
import { Schema } from "@/components/schema";
import {
  guideIndex,
  guideIndexMetadata,
  guideIndexStructuredData,
  guides,
  guidePath,
} from "@/lib/guides";

export const metadata = guideIndexMetadata();

export default function GuidesIndex() {
  return (
    <main id="main" className="document-page prose">
      <Schema data={guideIndexStructuredData()} />
      <span className="section-kicker">GUIDES</span>
      <h1>{guideIndex.h1}</h1>
      <p className="lead">
        Three notes on a decision the pricing page should not have to carry
        alone: what the free studio already does, when a changeable code needs
        a higher limit, and what a scan check can tell you before you print.
      </p>
      <h2>Free studio versus Pro and Brand</h2>
      <p>
        The free studio creates, checks and exports without an account. Pro and
        Brand raise four account limits: cloud designs, dynamic links, hosted
        pages and uploaded files. They do not replace the editor.
      </p>
      <p>
        <Link href={guidePath("compare")}>{guides.compare.h1}</Link>
      </p>
      <h2>When a dynamic QR is worth a paid plan</h2>
      <p>
        A static export keeps the destination you encoded. A dynamic link can
        change that destination after the QR is printed. The free plan already
        includes a link allowance. A paid plan matters when you will store more
        links, pages or files than that allowance.
      </p>
      <p>
        <Link href={guidePath("dynamic")}>{guides.dynamic.h1}</Link>
      </p>
      <h2>Check the QR before you print</h2>
      <p>
        Run the studio decode before a print run. A pass is evidence about the
        tested image. A digital decode is not a guarantee for every print. Paid
        plans add capacity, not a different scan check.
      </p>
      <p>
        <Link href={guidePath("print")}>{guides.print.h1}</Link>
      </p>
      <h2>Where the prices are</h2>
      <p>
        These guides name Free, Pro and Brand and the limits from the plan
        catalog. They do not copy a Pro or Brand price. The amount, currency
        and interval are loaded on the{" "}
        <Link href="/pricing">pricing page</Link>. That page lists Free at $0.
        If billing is not connected, it says paid plans are not available yet.
      </p>
    </main>
  );
}

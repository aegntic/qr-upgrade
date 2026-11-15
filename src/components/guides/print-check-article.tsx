import Link from "next/link";
import { guides } from "@/lib/guides";
import { PLAN_LIMITS } from "../../../shared/plan-limits.mjs";

export function PrintCheckArticle() {
  const free = PLAN_LIMITS.free;
  const pro = PLAN_LIMITS.pro;
  const brand = PLAN_LIMITS.brand;
  return (
    <>
      <span className="section-kicker">{guides.print.kicker}</span>
      <h1>{guides.print.h1}</h1>
      <p className="lead">
        Check the QR in the free studio before you print. A paid plan does not
        run a stricter check. A digital decode is not a guarantee for every
        print.
      </p>
      <h2>What the studio actually decodes</h2>
      <p>
        The web editor uses jsQR. It reads the finished artwork at its working
        size, again reduced to 256 pixels, and again through a controlled blur,
        downsampling and rotation. Every result has to match the exact
        destination. A stale or failed check blocks export. You do not get a
        file the studio itself cannot read back.
      </p>
      <p>
        The <Link href="/docs">methodology</Link> describes the simulation
        width as 160 times the print width in millimetres, divided by the
        distance in centimetres, clamped between 40 and 360 pixels. It is not
        calibrated to a particular phone. The baseline test uses a fixed 40 cm
        distance, without extra blur or rotation.{" "}
        <Link href="/scan-lab">Scan Lab</Link> is where you change those
        simulation controls, using the exact studio image. Returning to the
        studio keeps the design.
      </p>
      <p>
        The native apps are a narrower test. They run an exact-content check on
        the captured image. They do not run the web stress simulation. A pass
        in the app is not the same test as a pass in the browser.
      </p>
      <p>
        Repair is not a hidden paid mode. It increases contrast around the
        sampling points and can adjust print width. Stronger repair makes the
        QR structure easier to see. That is a visual cost. Repair does not
        lower the distance or the blur to manufacture a pass. The image is
        decoded again after the change.
      </p>
      <h2>Planning numbers, not a grade</h2>
      <p>
        The methodology lists three planning checks. The quiet zone is four
        clear modules, and the image encoder is built to keep them. Module
        width should be at least 0.40 mm. That is a conservative planning
        heuristic, not a reading of your printer. Viewing distance should be no
        more than ten times the code width. That is an approximate planning
        rule, not a promise about a doorway or a shop window.
      </p>
      <p>
        The working image is 768 pixels square on the web and 512 pixels square
        on the native apps. A larger export resamples those pixels. It does not
        invent detail. JPG and WebP are decoded again after compression, before
        the download. PNG, JPG, WebP and RGB PDF include the artwork, the
        caption and the quiet zone. Scene mockups are left out of the file. A
        PDF records the physical size you chose. It is not a CMYK file and it
        is not PDF/X.
      </p>
      <p>
        Scene previews do not measure lighting, texture, perspective, glare or
        surface curvature. Digital checks are not a scan probability and they
        are not an ISO grade. The product facts answer the phone question in
        one line: no simulator can promise the code will work on every phone.
        Test the exported artwork on several phones. Test a physical proof at
        the final size, lighting and material before a print run.
      </p>
      <p>
        A digital decode check is not a guarantee for every print. A pass means
        the tested image matched the destination under the tested conditions.
        It does not mean every camera, every lamp, every laminate or a later
        reprint will do the same.
      </p>
      <h2>Export, then look at the object</h2>
      <p>
        A campaign kit on the web checks four PNGs at full size and at half
        size against the intended content. The PDF embeds the checked
        counter-card image. The PDF file itself is not decoded again. Print it
        at actual size, not fit to page. The card artwork is about 81 mm wide,
        whatever print width you had set in the studio. Ask the printer about
        paper, colour conversion and bleed. Then scan a proof on the real
        stock.
      </p>
      <p>
        Social platforms resize and compress. Test the published image, not
        only the file you uploaded. A QR shown on a phone is an awkward thing
        to scan from another phone. Put the destination in a clickable link or
        a sticker as well. The kit does not publish the post for you.
      </p>
      <p>
        None of that kit is described as a Pro or Brand feature. Native
        campaign-kit export is not available yet. The{" "}
        <Link href="/generator">studio</Link> check, and the kit that follows
        it, are part of the free path.
      </p>
      <h2>The check is not the paid feature</h2>
      <p>
        Pro and Brand include the existing editor, scan checks and exports.
        That is the billing copy. The free studio already runs the check, with
        or without an account. Paying raises ceilings. It does not buy a better
        decode, a calibration certificate or a promise about paper.
      </p>
      <p>
        Free holds {free.cloudDesigns} cloud designs, {free.dynamicLinks}{" "}
        dynamic links, {free.hostedPages} hosted pages and {free.uploadedAssets}{" "}
        uploaded files. Pro raises those to {pro.cloudDesigns},{" "}
        {pro.dynamicLinks}, {pro.hostedPages} and {pro.uploadedAssets}. Brand
        raises them to {brand.cloudDesigns}, {brand.dynamicLinks},{" "}
        {brand.hostedPages} and {brand.uploadedAssets}. The{" "}
        <Link href="/guides/free-studio-versus-pro-and-brand">
          comparison guide
        </Link>{" "}
        puts those rows in context. The{" "}
        <Link href="/pricing">pricing page</Link> shows the current paid
        amount, currency and interval. This page leaves the figures there. If
        billing is not connected, pricing says paid plans are not available
        yet. The check remains available.
      </p>
      <h2>Decide after you know both answers</h2>
      <p>
        Do the check first. If it fails, change the artwork, the width or the
        repair, and test again. Do not cover a failed check with a
        subscription.
      </p>
      <p>
        If it passes, export and proof the physical piece anyway. A pass is
        permission to leave the studio. It is not permission to skip the
        printer.
      </p>
      <p>
        Then look at capacity. If you only needed a file, you are done, and the
        free studio was the whole product. If the printed code must take a new
        destination later, use a dynamic link. The free plan already includes{" "}
        {free.dynamicLinks} of them. The{" "}
        <Link href="/guides/when-a-dynamic-qr-is-worth-a-paid-plan">
          dynamic QR guide
        </Link>{" "}
        is the decision between editing one link and paying for a larger set.
        Move to Pro or Brand when the records you will store exceed the free
        row. Do not move because you want the scan check to try harder. It will
        not.
      </p>
    </>
  );
}

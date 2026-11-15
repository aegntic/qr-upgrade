import Link from "next/link";
import { PlanLimitTable } from "@/components/plan-limit-table";
import { guides } from "@/lib/guides";
import { PLAN_LIMITS } from "../../../shared/plan-limits.mjs";

export function FreeStudioArticle() {
  const free = PLAN_LIMITS.free;
  const pro = PLAN_LIMITS.pro;
  const brand = PLAN_LIMITS.brand;
  return (
    <>
      <span className="section-kicker">{guides.compare.kicker}</span>
      <h1>{guides.compare.h1}</h1>
      <p className="lead">
        Pay for room in the account. The studio that creates, checks and
        exports a QR is already free.
      </p>
      <h2>The free studio is the product</h2>
      <p>
        You can create a QR, check the finished image and export the file
        without an account. The <Link href="/pricing">pricing page</Link> says
        that, and it lists the free plan at $0. Sign in with Google when you
        want the cloud allowance. Until you do, you are not using the four
        limits below.
      </p>
      <p>
        A design kept in the browser is not a cloud design. The{" "}
        <Link href="/docs">methodology</Link> says Save design stores the
        destination, images and any credentials in this browser, with up to
        five prior versions. Clearing site data removes those local copies.
        Cloud saving is a separate action, and it runs only after you are
        signed in. If you export a file and keep it on your own computer, you
        are not spending the quota a paid plan increases.
      </p>
      <p>
        Pro and Brand include the existing editor, scan checks and exports.
        That sentence is on the plan cards. There is no second checker sold as
        an upgrade. If a scan check is what you came for, you already have it.
        The{" "}
        <Link href="/guides/check-the-qr-before-you-print">print guide</Link>{" "}
        explains the limit of that check. A digital decode is not a guarantee
        for every print.
      </p>
      <h2>The four limits</h2>
      <p>
        The capacity numbers live in the plan catalog the pricing page uses.
        Free, Pro and Brand are the plan names. Each column is a ceiling on
        records the account may hold.
      </p>
      <PlanLimitTable />
      <p>
        Read the row. Free holds {free.cloudDesigns} cloud
        designs, {free.dynamicLinks} dynamic links, {free.hostedPages} hosted
        pages and {free.uploadedAssets} uploaded files. Pro raises those to{" "}
        {pro.cloudDesigns}, {pro.dynamicLinks}, {pro.hostedPages} and{" "}
        {pro.uploadedAssets}. Brand raises them to {brand.cloudDesigns},{" "}
        {brand.dynamicLinks}, {brand.hostedPages} and {brand.uploadedAssets}.
        The paid difference is the size of the ceiling. The kind of thing being
        counted does not change.
      </p>
      <p>
        Archived cloud designs still count. The library refuses a new design
        once it holds the limit, and the refusal says archived designs are
        included. Hosted pages work the same way: the page limit includes
        archived pages. Dynamic links are counted as every link stored for the
        account. The create check does not ignore archived links, so archiving
        one does not free a place. Uploaded files count as stored uploads. A
        file has to be a PNG, JPEG, WebP or PDF of 2 MB or smaller. That size
        cap is the same on every plan. Paying does not buy a larger PDF.
      </p>
      <p>
        A link page, menu or gallery also stops at 12 items. That is a shape
        limit on one page, not a plan limit. Brand does not raise it.
      </p>
      <h2>What the paid plans do not add</h2>
      <p>
        Prompted artwork, when generation is available, has its own allowance:
        three generation attempts per network each UTC day, with a shared daily
        allowance. Library images and your own uploads stay available without
        generation. The plan catalog has no generation field. A higher cloud
        cap is not a higher generation cap.
      </p>
      <p>
        Team workspaces and geographic routing are described as planned. They
        are not the gap between Free and Brand.
      </p>
      <p>
        A campaign kit can package a checked design as a square post, a
        vertical story and an A6 card, with a scan report and a print guide.
        The product facts do not tie that kit to a paid tier. Native
        campaign-kit export is not available yet. That is a missing export on
        the apps, not a reason to pick Brand on the web.
      </p>
      <h2>Cancel, downgrade and the live price</h2>
      <p>
        Sign in before you choose or manage a subscription. If you are not
        signed in, Pro and Brand send you to sign in rather than to a disabled
        button. Payment details are entered on Stripe&apos;s hosted page. The
        card tells you to review the total and tax there before paying.
      </p>
      <p>
        This guide does not print a Pro or Brand price. Those figures are the
        current amount, currency and interval from the billing catalog, and the{" "}
        <Link href="/pricing">pricing page</Link> is where they are shown. If
        billing is not connected, that page says paid plans are not available
        yet. The free studio still creates, checks and exports.
      </p>
      <p>
        Cancel in the billing portal. Increased limits remain through the paid
        period and end when the subscription ends. If a downgrade leaves you
        above a limit, existing items stay readable, editable, exportable,
        pausable and archivable. New items are blocked until you are below the
        new limit. Your old work does not vanish. You also do not keep creating
        at the old volume.
      </p>
      <h2>A direct recommendation</h2>
      <p>
        Buy the ceiling you will actually fill. If your cloud designs, links,
        pages and files fit in the free numbers, stay on the free studio. Pro
        is the same product with a larger ceiling. Brand is a larger ceiling
        again, not a different set of tools. Pick the smallest row that covers
        the records you will hold, then read the live price before you
        subscribe.
      </p>
      <p>
        If the question is whether one printed code needs a changeable
        destination, read the{" "}
        <Link href="/guides/when-a-dynamic-qr-is-worth-a-paid-plan">
          dynamic QR guide
        </Link>{" "}
        before you pay. If the question is whether a paid plan checks the
        artwork more carefully, it does not. Run the free check in the{" "}
        <Link href="/generator">studio</Link>, then proof the physical piece.
      </p>
    </>
  );
}

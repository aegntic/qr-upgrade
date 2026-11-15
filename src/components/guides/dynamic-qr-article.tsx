import Link from "next/link";
import { guides } from "@/lib/guides";
import { PLAN_LIMITS } from "../../../shared/plan-limits.mjs";

export function DynamicQrArticle() {
  const free = PLAN_LIMITS.free;
  const pro = PLAN_LIMITS.pro;
  const brand = PLAN_LIMITS.brand;
  return (
    <>
      <span className="section-kicker">{guides.dynamic.kicker}</span>
      <h1>{guides.dynamic.h1}</h1>
      <p className="lead">
        A dynamic QR is worth a paid plan when you will store more changeable
        links than the free allowance. The ability to change a destination is
        already included once you sign in.
      </p>
      <h2>A fixed code stays fixed</h2>
      <p>
        An ordinary export encodes the destination you typed. The product facts
        say ordinary static QR exports keep their encoded destination. Change
        the offer, the season or the address, and that printed square still
        opens the old one. You then print again.
      </p>
      <p>
        You can avoid a reprint without a QR Upgrade link if the encoded URL is
        a page you control and you change that page. That option does not use
        the dynamic-link limit. It also means the code is only as changeable as
        the site you pointed it at. If you encoded a campaign URL you cannot
        edit, the print is stuck.
      </p>
      <h2>What a dynamic link changes</h2>
      <p>
        A dynamic link gives the QR a stable address at qrupgrade.com/r/ and a
        destination you can replace. In{" "}
        <Link href="/links">Dynamic links</Link>, the permanent QR address
        stays the same when you update the destination. You design the QR from
        that address, and only after the link is published. A draft does not
        redirect. Pausing the link stops the redirect. Archiving it makes the
        public link unavailable.
      </p>
      <p>
        The destination has to be a public HTTPS URL, up to 2048 characters. It
        cannot point at another QR Upgrade redirect. Sign in to create and
        publish the link. Open counts are daily aggregates. The product facts
        say those counts include repeats and bots. They are not a cleaned
        audience figure. Do not treat them as one.
      </p>
      <p>
        The free plan includes {free.dynamicLinks} dynamic links. Pro includes{" "}
        {pro.dynamicLinks}. Brand includes {brand.dynamicLinks}. Those numbers
        come from the same catalog as the{" "}
        <Link href="/pricing">pricing page</Link>. The create path counts every
        link stored on the account, and it does not ignore archived links.
        Archiving is not a way around the cap.
      </p>
      <h2>Hosted pages are a different slot</h2>
      <p>
        A hosted page is not a redirect.{" "}
        <Link href="/content">Hosted content</Link> serves a page at /p/, and
        you can design a QR from that address once the page is published.
        Drafts stay private. The page types are a link page, a menu, a gallery,
        a PDF document and a feedback form. A link page, menu or gallery holds
        up to 12 items. A document is a PDF of 2 MB or smaller. Updating the
        published page changes what the same QR opens. That spends the
        hosted-page limit, not the dynamic-link limit.
      </p>
      <p>
        Free includes {free.hostedPages} hosted pages and {free.uploadedAssets}{" "}
        uploaded files. Pro includes {pro.hostedPages} pages and{" "}
        {pro.uploadedAssets} files. Brand includes {brand.hostedPages} pages and{" "}
        {brand.uploadedAssets} files. A shop that publishes one dynamic link and
        also hosts a menu is using one link and one page. Both ceilings apply.
        Files are PNG, JPEG, WebP or PDF uploads of 2 MB or smaller, on every
        plan.
      </p>
      <p>
        If the page after the scan is a site you already run, a dynamic link is
        the piece that can move. If the page is a menu, a gallery or a PDF you
        want QR Upgrade to host, use a hosted page. A dynamic link can point at
        that page&apos;s public HTTPS address. It cannot point at another /r/
        redirect.
      </p>
      <h2>When the free allowance is enough</h2>
      <p>
        One counter card, one poster, one event, even a short run of campaigns:
        if the stored links stay inside {free.dynamicLinks}, the free plan
        already lets you change those destinations. Do not pay to make a single
        code changeable. The feature is not the paid part. The count is.
      </p>
      <p>
        The same is true of hosted pages inside the free page limit. Create,
        check and export the artwork in the{" "}
        <Link href="/generator">studio</Link> either way. That part does not ask
        for a subscription. The{" "}
        <Link href="/guides/free-studio-versus-pro-and-brand">
          comparison guide
        </Link>{" "}
        is the full account of what the money buys, which is the four ceilings
        and nothing else in the editor.
      </p>
      <h2>When a paid plan is the honest answer</h2>
      <p>
        Pay when the records you will keep exceed the free row. A counter that
        gets a new destination every week can still be one link, edited in
        place, and that stays inside the free allowance. A set of tables,
        cities or staff cards that each need their own link will climb. When
        the stored links, pages, files or cloud designs pass the free numbers,
        Pro or Brand is the plan that raises the ceiling. It does not add a
        different kind of QR.
      </p>
      <p>
        Cloud designs follow the same pattern: {free.cloudDesigns} on Free,{" "}
        {pro.cloudDesigns} on Pro, {brand.cloudDesigns} on Brand, and archived
        designs count. A large library of artwork can be the reason to pay even
        when the link count is still small. Look at the row you will actually
        fill.
      </p>
      <p>
        Read the current amount, currency and interval on the pricing page
        before you subscribe. This guide does not copy those figures. The
        pricing page loads them from the billing catalog. If billing is not
        connected, that page says paid plans are not available yet. The free
        allowance is still there.
      </p>
      <p>
        Cancel in the billing portal if you later shrink the set. Increased
        limits remain through the paid period and end when the subscription
        ends. If a downgrade leaves you above a limit, existing items stay
        readable, editable, exportable, pausable and archivable. New items are
        blocked until you are below the new limit.
      </p>
      <p>
        If you are still deciding whether the artwork should be printed, check
        it first. A paid plan will not make a weak print scan. The{" "}
        <Link href="/guides/check-the-qr-before-you-print">print guide</Link>{" "}
        says what the free check can and cannot tell you. A digital decode is
        not a guarantee for every print.
      </p>
    </>
  );
}

import { site } from "@/lib/facts";
import { Schema } from "@/components/schema";

export const metadata = {
  title: "Privacy Policy",
  description:
    "How QR Upgrade handles device-local studio work, Google sign-in, optional cloud saves, Stripe billing when enabled, and account export or closure.",
  alternates: { canonical: "/privacy" },
};

export default function Privacy() {
  return (
    <main id="main" className="document-page prose">
      <Schema
        data={{
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: "QR Upgrade Privacy Policy",
          url: site + "/privacy",
          datePublished: "2026-09-22",
          dateModified: "2026-09-22",
          isPartOf: {
            "@type": "WebSite",
            name: "QR Upgrade",
            url: site,
          },
          about: {
            "@type": "Person",
            name: "Mattae Cooper",
          },
        }}
      />
      <span className="section-kicker">PRIVACY / 22 SEP 2026</span>
      <h1>Privacy Policy</h1>
      <p className="lead">
        QR Upgrade helps you create custom QR images, test the rendered result,
        and optionally save designs or publish hosted destinations. The service
        is operated by Mattae Cooper, Australia. Contact Mattae Cooper,
        Australia about your data. When signed in, use Account export and
        closure. For other rights requests, contact the operator through the
        same public identity used for the service.
      </p>
      <p>
        Publication date: 22 September 2026 (Australia/Sydney). This notice
        describes current product behaviour. It does not invent a governing
        law, claim audit certifications, or assert that a particular privacy
        regime applies.
      </p>

      <h2>What stays on your device</h2>
      <p>
        The studio composes QR content and processes your selected images in
        your browser. A QR can contain a website address, Wi-Fi credentials,
        contact details or other information you enter. In the web studio,
        saving on this device stores the design in browser storage; clearing
        site data removes those local copies. The Android and iOS apps instead
        use an encrypted private device library. Each installation keeps its
        encryption key in platform-protected storage. This is not an app lock:
        someone using your unlocked app can open its saves. A transferred or
        restored backup may not have a usable key. The apps save normalized
        copies of selected images only when you explicitly save. Downloaded or
        shared QR images remain under your control, and anyone who scans them
        may read their encoded content. QR Upgrade cannot recall copies you
        have shared.
      </p>

      <h2>What reaches our services</h2>
      <p>
        Signing in with Google supplies your verified identity, name and email.
        We request only basic sign-in permissions. A server-only hash of the
        Google subject associates your private records with your account.
        Session cookies are required to keep you signed in; Google access
        tokens are not saved in browser storage.
      </p>
      <p>
        Choosing to save to cloud sends the selected design, including its QR
        destination and images, to private storage. Choosing to upload a
        hosted-page file sends that file to storage. Draft pages remain private
        until you publish. Publishing exposes the selected snapshot and its
        referenced files through your public link; pausing or archiving stops
        new retrieval but cannot remove copies already downloaded by someone
        else.
      </p>
      <p>
        An artwork-generation request sends the description and selected style
        to Cloudflare Workers AI. The generation route does not send your QR
        destination or selected portrait/logo. The application does not store
        the prompt. Avoid putting personal or confidential information into
        artwork descriptions. Provider handling remains subject to the
        provider&apos;s applicable terms and the operator&apos;s supplier
        review.
      </p>
      <p>
        Dynamic links keep the destination you choose and aggregate daily
        opens. Counts can include repeated visits and automated traffic; they
        do not identify unique people. Our counter does not store a visitor IP
        address, user agent or referrer.
      </p>
      <p>
        If you submit a hosted feedback form, its owner receives your message,
        the optional name/email you provide, and the submission time. Submit
        only information you want that owner to receive. Form owners must not
        request sensitive personal information through this generic form. A
        daily keyed network hash enforces abuse limits; the application does
        not persist the raw IP in a form message.
      </p>
      <p>
        Payment details are entered on Stripe-hosted pages when billing is
        enabled. QR Upgrade keeps the customer/subscription linkage and minimal
        event metadata needed to enforce your plan. Our application does not
        receive card numbers or security codes. Receipts and financial records
        held by Stripe are separate from a download of data held by QR Upgrade.
      </p>

      <h2>Security records and retention</h2>
      <p>
        Signed sessions expire after seven days and can be invalidated through
        &ldquo;Sign out everywhere.&rdquo; Recent account security history holds
        event type and timestamp with an account hash, with a maximum of 100
        events per account for 30 days. It does not include QR content,
        messages, name, email, IP address or user agent. A durable account
        security record supports session invalidation independently of the
        event history.
      </p>
      <p>
        Generated artwork stops being retrievable after one hour. Hourly
        cleanup removes its image bytes within two hours, and removes
        generation quota metadata after three days. Network hashes used for
        form quotas are pruned after approximately two days. These are
        application rules. Infrastructure access-log and backup retention is
        operator-configured separately and is not claimed here as a fixed
        legal period.
      </p>
      <p>
        The Account page provides downloads of retained account information in
        separate parts, with cloud design files and uploaded files downloaded
        separately. This includes feedback received through pages you own and
        billing references held by QR Upgrade. Save all parts you need. Data
        may change while an export is in progress; it is not a frozen backup.
        Local-only designs and financial records held separately by Stripe
        require their own exports.
      </p>
      <p>
        You can request permanent account closure after confirming the same
        identity with Google and completing the final confirmation in QR
        Upgrade. Google may use an existing Google session. Self-service
        closure is available only when subscriptions have fully ended and any
        pending billing setup or checkout has been resolved. Scheduling
        cancellation alone does not end the subscription. If self-service
        closure is unavailable, or you need another type of rights request,
        contact Mattae Cooper, Australia through the same public identity used
        for the service.
      </p>
      <p>
        After closure is accepted, the account cannot be reopened with that
        Google identity. Subsequent requests cannot retrieve its hosted pages,
        redirects or files through QR Upgrade. Background cleanup removes
        attributable content from active storage in batches. The status receipt
        distinguishes pending cleanup from completed active-storage cleanup.
        Storage failures, uncertain uploads or files shared with another owner
        may keep cleanup pending; closure is not a promise of immediate removal
        from every system.
      </p>
      <p>
        The application retains a minimal account hash, closure and
        session-revocation records, an independent private deletion receipt,
        and billing references to prevent account revival and support
        reconciliation. These minimal closure records currently have no
        automatic expiry. Uncertain upload and deletion work remains until
        resolved. Financial records held by Stripe, provider backups, local
        downloads, recipient copies and external caches are separate.
      </p>

      <h2>Service providers and your choices</h2>
      <p>
        The current service uses Vercel for web hosting, Cloudflare for
        DNS/backend/storage/AI, Google for sign-in and Stripe for billing when
        activated. Source/build services include GitHub and Expo. There is no
        active third-party visitor analytics integration. Some processing may
        occur outside your country. Observed storage placement is not an
        exclusive data-residency guarantee.
      </p>
      <p>
        You can use the local studio without signing in, choose whether to save
        to cloud or publish, pause hosted destinations, and sign out
        everywhere. For access, correction or deletion requests and complaints,
        contact Mattae Cooper, Australia through the same public identity used
        for the service, or use Account export and closure when signed in. We
        will verify identity in a proportionate way; do not email passwords or
        card details.
      </p>
    </main>
  );
}

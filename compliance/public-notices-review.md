# Public notices — operator review draft

Not published, effective, or approved. Fill the operator identity/contact facts before using these notices in Google branding or live billing. Reconcile account export/deletion wording with the final implementation before publication. Legal review must determine applicable markets and requirements; this document does not invent a governing law or an audit certification.

Required facts: legal operator name and country; published support/privacy/security contact; accountable security/privacy owner; distinct approver; intended customer markets; applicable tax registrations; refund handling; approved backup/log retention and rights-request procedure.

## Proposed privacy notice

QR Upgrade helps you create custom QR images, test the rendered result, and optionally save designs or publish hosted destinations. The service is operated by **[confirmed legal operator, country]**. Contact **[confirmed privacy contact]** about your data.

### What stays on your device

The studio composes QR content and processes your selected images in your browser. A QR can contain a website address, Wi-Fi credentials, contact details or other information you enter. In the web studio, saving on this device stores the design in browser storage; clearing site data removes those local copies. The Android and iOS apps instead use an encrypted private device library. Each installation keeps its encryption key in platform-protected storage. This is not an app lock: someone using your unlocked app can open its saves. A transferred or restored backup may not have a usable key. The apps save normalized copies of selected images only when you explicitly save. Downloaded or shared QR images remain under your control, and anyone who scans them may read their encoded content. QR Upgrade cannot recall copies you have shared.

### What reaches our services

Signing in with Google supplies your verified identity, name and email. We request only basic sign-in permissions. A server-only hash of the Google subject associates your private records with your account. Session cookies are required to keep you signed in; Google access tokens are not saved in browser storage.

Choosing to save to cloud sends the selected design, including its QR destination and images, to private storage. Choosing to upload a hosted-page file sends that file to storage. Draft pages remain private until you publish. Publishing exposes the selected snapshot and its referenced files through your public link; pausing or archiving stops new retrieval but cannot remove copies already downloaded by someone else.

An artwork-generation request sends the description and selected style to Cloudflare Workers AI. The generation route does not send your QR destination or selected portrait/logo. The application does not store the prompt. Avoid putting personal or confidential information into artwork descriptions. Provider handling remains subject to the provider's applicable terms and the operator's supplier review.

Dynamic links keep the destination you choose and aggregate daily opens. Counts can include repeated visits and automated traffic; they do not identify unique people. Our counter does not store a visitor IP address, user agent or referrer.

If you submit a hosted feedback form, its owner receives your message, the optional name/email you provide, and the submission time. Submit only information you want that owner to receive. Form owners must not request sensitive personal information through this generic form. A daily keyed network hash enforces abuse limits; the application does not persist the raw IP in a form message.

Payment details are entered on Stripe-hosted pages when billing is enabled. QR Upgrade keeps the customer/subscription linkage and minimal event metadata needed to enforce your plan. Our application does not receive card numbers or security codes. Receipts and financial records held by Stripe are separate from a download of data held by QR Upgrade.

### Security records and retention

Signed sessions expire after seven days and can be invalidated through “Sign out everywhere.” Recent account security history holds event type and timestamp with an account hash, with a maximum of 100 events per account for 30 days. It does not include QR content, messages, name, email, IP address or user agent. A durable account security record supports session invalidation independently of the event history.

Generated artwork stops being retrievable after one hour. Hourly cleanup removes its image bytes within two hours, and removes generation quota metadata after three days. Network hashes used for form quotas are pruned after approximately two days. These are application rules; infrastructure access-log and backup retention must be stated separately after the operator approves their actual configuration.

The Account page provides downloads of retained account information in separate parts, with cloud design files and uploaded files downloaded separately. This includes feedback received through pages you own and billing references held by QR Upgrade. Save all parts you need. Data may change while an export is in progress; it is not a frozen backup. Local-only designs and financial records held separately by Stripe require their own exports.

You can request permanent account closure after confirming the same identity with Google and completing the final confirmation in QR Upgrade. Google may use an existing Google session. Self-service closure is available only when subscriptions have fully ended and any pending billing setup or checkout has been resolved. Scheduling cancellation alone does not end the subscription. Contact the confirmed privacy address if self-service closure is unavailable or you need another type of rights request.

After closure is accepted, the account cannot be reopened with that Google identity. Subsequent requests cannot retrieve its hosted pages, redirects or files through QR Upgrade. Background cleanup removes attributable content from active storage in batches. The status receipt distinguishes pending cleanup from completed active-storage cleanup. Storage failures, uncertain uploads or files shared with another owner may keep cleanup pending; closure is not a promise of immediate removal from every system.

The application retains a minimal account hash, closure and session-revocation records, an independent private deletion receipt, and billing references to prevent account revival and support reconciliation. These minimal records currently have no automatic expiry. Uncertain upload and deletion work remains until resolved. Financial records held by Stripe, provider backups, local downloads, recipient copies and external caches are separate. **[Approve final retention periods, backup expiry and the manual rights process before publication. The current engineering defaults do not establish a legal reason for indefinite retention.]**

### Service providers and your choices

The current service uses Vercel for web hosting, Cloudflare for DNS/backend/storage/AI, Google for sign-in and Stripe for billing when activated. Source/build services include GitHub and Expo. There is no active third-party visitor analytics integration. Some processing occurs outside your country; observed storage placement does not constitute an exclusive data-residency guarantee. **[Insert the reviewed operator-specific processor, transfer and legal-basis disclosures where applicable.]**

You can use the local studio without signing in, choose whether to save to cloud or publish, pause hosted destinations, and sign out everywhere. Contact the confirmed privacy address for access, correction or deletion requests and complaints. We will verify identity in a proportionate way; do not email passwords or card details. **[Insert the verified self-service rights controls and applicable escalation authority.]**

## Proposed service terms

QR Upgrade is provided by **[confirmed legal operator, country]**. These terms take effect on **[approved publication date]**. Contact **[confirmed support contact]** for support or billing questions.

You may create QR images and hosted destinations using content you own or are authorized to use. Do not use the service for credential theft, malware delivery, impersonation, unlawful content, infringement or deceptive redirects. You remain responsible for your chosen destination and for the information you publish or encode. Platform logos and brand examples do not imply endorsement.

A successful decode is evidence about the tested image under its tested conditions. It is not a guarantee that every camera, print process, surface, lighting condition or future destination will work. Verify the finished design and a physical print at the intended size before distributing it. An exported code and any public content can be copied by other people.

Free accounts provide 50 cloud designs, 50 dynamic links, 50 hosted pages and 100 uploaded files. Pro provides 200/200/200/500; Brand provides 500/500/500/1,000. Archived records count toward these limits. Per-file and other abuse limits still apply. Paid plans do not currently include teams, enterprise SSO, SCIM, unlimited storage, dedicated API access or a compliance certification.

The monthly catalog prices are USD $12 for Pro and USD $25 for Brand. The checkout shows the applicable price, billing interval and taxes, if configured. Subscriptions renew until canceled. Use Billing to manage payment details, view invoices or cancel. Cancellation is scheduled for the end of the current paid period; after the plan ends, existing content remains accessible while additional creation is blocked if the Free limits are exceeded. The dedicated live Stripe portal is configured for end-of-period cancellation, invoice history and payment-method updates; plan changes are disabled. **[Confirm tax handling and refund policy before enabling sales.]**

Account deletion is separate from subscription cancellation. Self-service closure requires subscriptions to have fully ended and pending billing setup or checkout to be resolved. It permanently closes the account for that Google identity, stops subsequent access to its hosted content, and starts background cleanup of attributable active-storage content. Minimal closure, security and billing references remain as described in the privacy notice. Contact the confirmed support/privacy address for requests that cannot use this flow. Deleting an account cannot remove files that you or others already downloaded or revoke Google permissions outside QR Upgrade.

Service access may be limited to enforce capacity, prevent abuse, or investigate a security incident. **[Approve the notice, suspension, appeal and refund process; any jurisdiction-specific consumer rights and liability terms require appropriate review.]** These draft terms do not waive mandatory consumer rights, create an arbitration agreement, or promise availability/response-time commitments that have not been approved.

## Publication acceptance record

Keep the final exact notice content, publication date, accountable owner and distinct approval evidence. Link the published privacy/terms pages from account entry, billing and site navigation. Verify HTTP 200 at the same canonical URLs supplied to Google and Stripe. Do not approve a gate by merely hashing this draft.

## Rights-handling source checks (20 September 2026)

Applicability is still a legal/operator decision. For an APP entity, OAIC APP11 guidance requires reasonable technical and organisational protection and destruction or de-identification when information is no longer needed, subject to applicable retention exceptions; archived/back-up copies also need consideration. A delete button alone does not discharge those duties. Source: https://www.oaic.gov.au/privacy/australian-privacy-principles/australian-privacy-principles-guidelines/chapter-11-app-11-security-of-personal-information

Where GDPR applies, EDPB guidance calls for transparent rights handling and response within one month; a justified extension requires notice within that month. The app's export/deletion tools assist with requests but do not decide applicability, legal exceptions, identity disputes or processor/customer responsibilities. Source: https://www.edpb.europa.eu/sme/be-compliant/respect-individuals-rights_en

The operator must define a monitored route for manual rights requests, including requests from feedback submitters without an app account, correction/restriction/objection, subscription-related deletion, inaccessible accounts, backups and legally retained payment records. Do not make a general compliance promise based only on account self-service.

## Publication status (engineering)

`/privacy` was published on 22 September 2026 (Australia/Sydney) with operator Mattae Cooper / Australia. The draft sections above remain the working source text; placeholders were replaced on the live page with engineering-limited wording only.

# QR Upgrade launch review — owner decisions required

Engineering work continues. This document does not approve release, accept risk, sign agreements or certify compliance. Apple Developer enrollment/device distribution is deferred by the owner.

| Decision | Concrete state | Needed action |
|---|---|---|
| Operator and public contacts | Public notices drafted; Stripe identifies Mattae Cooper in Australia. QR Upgrade operator/public-contact confirmation is pending; no identity/contact placeholders published | Confirm legal individual/company and country; name security/privacy owner and public support/privacy/security contact |
| Stripe application access | Live merchant active; dedicated Pro USD12/month and Brand USD25/month catalog created; application billing remains disabled | Restricted key created, exact approved scope read back, and live app-specific portal configured; finish runtime connection, webhook and legal/tax/refund review |
| Hosting | Vercel Hobby cannot support commercial use | Owner chose migration to existing Cloudflare; runtime/security/domain verification required before cutover. Any new plan purchase needs its exact price/terms presented first |
| Cloudflare account security | Sole administrator; MFA reported inactive | Enroll authenticator/security key personally and secure recovery codes |
| Private source protection | Private GitHub repository and successful CI; provider rejects protected branches on present plan. Owner is signed in and the monthly Pro checkout is prepared | Review and complete the US$4/month purchase personally if approved; the checkout showed a −US$22.33 due-today adjustment. Pro supports private branch protection but not private environment required-reviewer gates. Choose the deployment approval design and distinct reviewer; no purchase made by the agent |
| Assurance and operations | Technical evidence and recovery rehearsal exist | Assign named owner and independent approver; conduct actual incident/contact exercise, approve risk/retention/vendor/access reviews and arrange scoped independent penetration testing |

## Technical evidence available

- API edge rate limiting verified live:120 allowed requests then429, with landing/webhook paths unaffected.
- Private D1/R2 backup restored into an isolated real Worker;32 runtime checks passed, production unchanged.
- Android release signature and binary settings inspected; physical-device behavior/store review remains separate.
- Workspace filesystem observed behind LUKS encryption; broader endpoint inventory and patch/malware/lock controls are not yet verified.
- Stripe sandbox success, card decline, portal cancellation and actual signature-verified subscription webhooks tested against isolated application storage. Duplicate webhook replay retained one record; ending the test subscription restored Free limits. No live payment made. The modern cancellation-display issue and dedicated-portal configuration have been corrected and reviewed; the updated handler opened the real dedicated sandbox portal successfully.
- Central session revocation, bounded private security history, account export and permanent account closure passed implementation review. Browser downloads and sign-out-everywhere were tested against isolated storage. A real Google confirmation through the approved localhost callback completed against isolated hosted staging storage; final closure was canceled. Hosted session-version checks rejected an older signed session after sign-out-everywhere and accepted the current version. Public production consent and final-origin sign-in remain pending.
- The alert sending subdomain is enabled with authenticated DNS; no incident/recovery message has been sent. The isolated Cloudflare preview is deployed; unsigned page/API requests redirect to Access and alternate Workers.dev addresses return404. Authenticated preview browser access is now verified, including the generator, the exact-design Scan Lab handoff and return to the editor. Staging source still needs the final release build.

Provider approvals, audit work and identity facts cannot be supplied by generated tests. Evidence gates remain closed until their real requirements are met.

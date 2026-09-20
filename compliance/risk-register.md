# Risk register — DRAFT, NOT APPROVED

Risk owner and acceptance authority are unassigned. No risk is accepted by this document. Severity is a planning assessment; residual risk requires owner review.

| ID | Scenario | Initial severity | Implemented treatment | Outstanding gate |
|---|---|---|---|---|
| R01 | The organization claims compliance based only on generated code/tests | High | Readiness status explicitly unassured; manual evidence defaults empty; release blocked | G01, G02, auditor engagement |
| R02 | An injected script reads Wi-Fi/contact drafts | High | Per-request script nonces, strict CSP, escaped JSON-LD, no inline script allowance, no external runtime scripts | G14 independent XSS assessment; inline CSS allowance documented |
| R03 | Public API abuse drains compute or bypasses serverless instance quotas | High | Disabled by default; bearer auth; atomic shared Redis quota; time/body limits; fail-closed outage behavior | G07 real WAF and central-service integration test |
| R04 | QR credentials or personal data leak via logs, screenshots or exports | High | Minimal application audit fields, clear draft, in-memory state, native privacy cover and explicit export disclosure; reviewed central revocation and private export queued for release | G08 host logs; G12 privacy review; G15 snapshots/device behavior |
| R05 | Mobile release uses debug signing, backup or cleartext configuration | High | No automatic debug signing for release; backups/cleartext disabled; unnecessary permissions removed; native config gate | Android APK signing/manifests inspected; G15 physical-device proof and G16 store disclosures remain; Apple device signing deferred |
| R06 | Vulnerable/malicious dependency or build action enters a release | High | Lockfiles, vulnerability scans, secret scan, SAST, npm SBOMs, pinned action commits and scanner versions | G06 protected CI; G17 license/patch review; signed provenance and native SBOM |
| R07 | A stolen admin account changes DNS, deploys code, reads logs or signs an app | High | Vercel operator TOTP verified; Cloudflare sole administrator MFA inactive; dedicated restricted Stripe key prepared | G04/G05 Cloudflare enrollment, remaining provider identity checks, least privilege, access review and recovery access |
| R08 | Recovery/incident handling exists only as a document | High | Private D1/R2 isolated restore with32runtime checks; draft runbooks and evidence requirements | G09 cadence/retention/targets and production rollback; G10 human tabletop and alert delivery |
| R09 | Oversized/malformed image or QR input exhausts client memory | Medium | Input byte caps and image size/dimension limits; restricted image types on web | G14 adversarial image tests; G15 low-memory native device tests |
| R10 | A QR passes digital checks but fails in print, or points to harmful content | Medium | Score is advisory; content matches are checked; no automatic navigation from scanner; physical-proof warning | Print proof testing and future dynamic-link abuse response |
| R11 | Evidence is edited, fabricated, stale or associated with a different release | High | Source/artifact hashes, bounded freshness, required approvals and nonzero release failure | G06 protected storage/reviewer identity/immutable signed CI provenance; hashes are not signatures |
| R12 | Account/cloud publishing/AI/billing changes privacy or owner-isolation boundaries | High | Owner-scoped SQL and public publication controls tested; private storage; source-specific launch gate; billing disabled pending setup | G19 actual scope approval, rights/retention, supplier/privacy review; no enterprise SSO/RBAC claim |

| R13 | A user closes an account while a subscription or uncertain checkout can still charge | High | Stripe-authoritative state, idempotent reservations and sandbox decline/success/cancellation/webhook proof | Closure must block active or uncertain billing; live merchant access/legal setup and final lifecycle review pending |

Security-relevant exceptions require a recorded risk, owner, independent approver, compensating control and expiry. There is no automatic severity waiver or accepted-risk list in the technical gate. Changing thresholds/rules requires independent security review, with the resulting source fingerprint re-evaluated.

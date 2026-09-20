# Risk register — DRAFT, NOT APPROVED

Risk owner and acceptance authority are unassigned. No risk is accepted by this document. Severity is a planning assessment; residual risk requires owner review.

| ID | Scenario | Initial severity | Implemented treatment | Outstanding gate |
|---|---|---|---|---|
| R01 | The organization claims compliance based only on generated code/tests | High | Readiness status explicitly unassured; manual evidence defaults empty; release blocked | G01, G02, auditor engagement |
| R02 | An injected script reads Wi-Fi/contact drafts | High | Per-request script nonces, strict CSP, escaped JSON-LD, no inline script allowance, no external runtime scripts | G14 independent XSS assessment; inline CSS allowance documented |
| R03 | Public API abuse drains compute or bypasses serverless instance quotas | High | Disabled by default; bearer auth; atomic shared Redis quota; time/body limits; fail-closed outage behavior | G07 real WAF and central-service integration test |
| R04 | QR credentials or personal data leak via logs, screenshots or exports | High | Minimal application audit fields, clear draft, in-memory state, native privacy cover and explicit export disclosure | G08 host logs; G12 privacy review; G15 snapshots/device behavior |
| R05 | Mobile release uses debug signing, backup or cleartext configuration | High | No automatic debug signing for release; backups/cleartext disabled; unnecessary permissions removed; native config gate | G16 actual signed binary inspection and store disclosures |
| R06 | Vulnerable/malicious dependency or build action enters a release | High | Lockfiles, vulnerability scans, secret scan, SAST, npm SBOMs, pinned action commits and scanner versions | G06 protected CI; G17 license/patch review; signed provenance and native SBOM |
| R07 | A stolen admin account changes DNS, deploys code, reads logs or signs an app | High | Release evidence requires identity/change controls | G04/G05 actual MFA, least privilege, access review and recovery access |
| R08 | Recovery/incident handling exists only as a document | High | Draft runbooks and evidence requirements | G09/G10 observed restore/rollback/tabletop and alert exercises |
| R09 | Oversized/malformed image or QR input exhausts client memory | Medium | Input byte caps and image size/dimension limits; restricted image types on web | G14 adversarial image tests; G15 low-memory native device tests |
| R10 | A QR passes digital checks but fails in print, or points to harmful content | Medium | Score is advisory; content matches are checked; no automatic navigation from scanner; physical-proof warning | Print proof testing and future dynamic-link abuse response |
| R11 | Evidence is edited, fabricated, stale or associated with a different release | High | Source/artifact hashes, bounded freshness, required approvals and nonzero release failure | G06 protected storage/reviewer identity/immutable signed CI provenance; hashes are not signatures |
| R12 | A later account/AI/GEO feature silently changes privacy/tenant boundaries | High | Separate feature launch control with source-specific approval | G19 implementation, tenant isolation tests, DPIA/vendor review and access controls before activation |

Security-relevant exceptions require a recorded risk, owner, independent approver, compensating control and expiry. There is no automatic severity waiver or accepted-risk list in the technical gate. Changing thresholds/rules requires independent security review, with the resulting source fingerprint re-evaluated.

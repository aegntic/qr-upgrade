# Public pricing SSR release

Released 15 November 2026 UTC. URL: https://qrupgrade.com/pricing

## Deployment
- Application source: `95ae31d685d577f28f2900c277e67a96845fa954`.
- Cloudflare Worker: `qr-upgrade-web`.
- Production version: `2c4453e6-9f39-4d0b-82db-a0836c78f84b`, 100% traffic.
- Prior version retained for rollback: `77493a30-291f-4325-a8f2-d9a699399f12`.
- Fresh isolated build passed T14 artifact scanning, dry-run and actual workerd boundary tests before upload.
- Uploaded with `versions upload --keep-vars`; deployed with `versions deploy`. No triggers deployment, secret changes, billing activation, database changes or service deployment. Existing bindings preserved. Non-versioned logpush remained false; observability and tail consumers skipped.
- Rollback: redeploy the retained prior web version at 100%. No database rollback needed; rollback not exercised on live traffic.

## Verification
- Enterprise security gates run 43682433048 passed at the deployed source commit.
- All 14 local evidence gates passed; 374 automated tests; both dependency audits reported zero vulnerabilities.
- All six PR review threads resolved after their fixes were verified.
- Live raw HTTP: 200, `Cache-Control: private, no-store`; initial server HTML contains Free, Pro USD $12/month and Brand USD $25/month. Incorrect Billing current-page announcement absent.
- Live Chrome: Free/Pro/Brand displayed, Pro sign-in link reached the account page with Continue with Google available. Full-page screenshot visually inspected.
- Public server snapshot uses validated current billing prices, no cookies or customer records. Account state refresh remains client-side. Failed price lookup does not invent paid prices.

## Limits
No purchase, completed OAuth login, native app release or provider/account configuration change was performed. Browser verification used the existing window size. Bundled third-party duplicate-case warning remains. PR remains open; production release does not imply merging into stale main or a general enterprise compliance approval.

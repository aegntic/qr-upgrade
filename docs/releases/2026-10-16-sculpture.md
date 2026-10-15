# Approved QR materials release — 16 October 2026

User inspected the isolated local candidate and explicitly approved publishing it to qrupgrade.com.

Source: preview/sculpture-2026-10-16, candidate commit 8771fa6. Recovered sculpture archive SHA256 37b9ab9ec33f153a3e88cbc93c09d850d436c4d6d8cc65d3bb6f2a44010862be, based on d33e61db4f3ebec0586c9a02713031b038e5ec4b.

Published with Wrangler 4.135.0 to qr-upgrade-web in aegntic.ecosystem. New version: ae19703a-74f4-4044-83e9-a2d206530d0d. Prior provider version read back before publication: c450d3f5-74f1-4eae-b8a0-ff364c2d6d2a. Existing routes, secrets and service data were preserved. No DNS change, Vercel promotion, billing activation or service/database deployment performed.

Checks run on recovered source:
- Typecheck passes with 4GB Node heap.
- 365/365 tests pass.
- Next/OpenNext Cloudflare build and production-config dry run succeed. Known generated duplicate-case warning remains.
- No project lint script. Approved Oxlint launcher checked explicit changed source/test paths; zero errors, six warnings. Existing control-regex/malformed-fetch test warnings were retained.
- Initial native dependency failures were resolved by reusing the existing mobile node_modules after verifying identical mobile lockfile SHA256, without changing source or lockfiles.

Public browser verification at https://qrupgrade.com/generator?new=1&mode=custom:
- Obsidian glass, Brushed titanium and Ruby crystal choices present.
- Default rendered QR reports Scan checks passed, 4/4 checks.
- No broken loaded images or captured console errors.
- Public HTML confirms new materials. Existing public security headers remain present.

These checks do not certify physical print/phone performance, every payload/material combination, native store releases, live paid billing or overall enterprise compliance. Supplied historical 150/150 decode evidence remains separate from the fresh 365-test run. A complete independently archived prior static-asset set and a live rollback rehearsal were not completed in this session; do not claim that they were.

Local preview remains at http://localhost:3041/generator?new=1&mode=custom in /home/ae/Projects/QR-Upgrade-Sculpture. Other worktrees were not overwritten.

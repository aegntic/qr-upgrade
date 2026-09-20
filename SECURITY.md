# Security status

QR Upgrade is an unreleased local-first prototype. It has no SOC 2 report or ISO 27001 certificate. Technical checks and release-readiness evidence do not establish legal compliance or independent assurance.

## Reporting a vulnerability

A monitored private reporting channel and accountable responder must be established before public release (control G18). No unverified security email address is advertised. Until that channel is configured, share findings privately with the project owner through the existing project communication channel. Do not include live credentials, customer QR contents or exploit details in a public issue.

## Supported scope

The current code generates static QR codes locally. The optional service API is disabled by default and, when activated, accepts only print parameters using a service credential and centralized quota. This credential is not a user or tenant authentication system. Cloud campaigns, authentication, dynamic routing, billing, teams, analytics and AI generation remain out of scope until separately reviewed.

## Development and release

Run `npm run security:evidence` and `npm run compliance:release`. The first runs the technical checks; the second requires fresh matching technical evidence and approved organizational controls. Missing tools, scan errors, stale records, altered evidence or outstanding controls block release.

See [compliance/README.md](compliance/README.md). Never disable a failing gate or label a draft policy as approved just to make a build green.

# Google accounts and private cloud storage

The account page and API fail closed until all four server environment variables exist: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `QR_SERVICE_URL`, and `QR_SERVICE_SECRET` (at least 32 characters). No fallback identity or browser tokens are used. On 20 September 2026 the owner approved registration of QR Upgrade Web in the selected Google Cloud project. Both callbacks below are registered; the owner's development email is an explicit test user. Client ID and secret are in sensitive Vercel production settings and mode-0600 local configuration. The application remains in Google external testing mode; public branding/policy review is pending. Genuine sign-in evidence is recorded separately from configuration.

## Google Cloud configuration

1. In the intended Google Cloud project, open Google Auth Platform. Configure Branding with the real application name, support email, homepage `https://qrupgrade.com`, privacy policy and terms URLs. Verify the `qrupgrade.com` authorized domain. Set Audience to the intended users; while in testing, explicitly add test users.
2. Request only OpenID Connect scopes `openid`, `email`, and `profile` in Data Access. No Drive or other Google data access is needed.
3. Create an OAuth client with application type **Web application**. Add exactly these authorized redirect URIs:
   - Production: `https://qrupgrade.com/api/account/callback`
   - Local development only: `http://localhost:3040/api/account/callback`
4. This is a server redirect flow. Authorized JavaScript origins and a browser Google SDK are not required. Do not use a wildcard callback, preview deployment callback, or client-side secret. Production sign-in on another host redirects to the canonical host so the host-only state cookie and callback share their origin.
5. Store the client ID as `GOOGLE_CLIENT_ID` and client secret as `GOOGLE_CLIENT_SECRET` in the deployment provider's server environment secret manager. On Vercel use the project's Settings → Environment Variables, or interactive `vercel env add GOOGLE_CLIENT_ID production` and `vercel env add GOOGLE_CLIENT_SECRET production`. Enter values only at the protected prompts; never put them in shell arguments, source files, PRs, screenshots, or logs. Mark secrets sensitive. Do not prefix with `NEXT_PUBLIC_`.
6. Keep the existing server `QR_SERVICE_URL` and `QR_SERVICE_SECRET`. The latter must equal the Worker secret `SERVICE_SECRET`. Set a missing Worker secret with interactive `npx wrangler secret put SERVICE_SECRET --config workers/qr-service/wrangler.jsonc`. Rotation invalidates account sessions. Redeploy the server after environment changes.
7. For local testing, put server variables in untracked `.env.local`, run Next with port 3040, and use `http://localhost:3040`. Only `NODE_ENV=development` enables that origin and cookies without `Secure`. Production uses `__Host-` cookies with `Secure`, `HttpOnly`, `SameSite=Lax`, `Path=/`, no Domain attribute, and a seven-day session lifetime. Logout clears both cookies. Already-issued copied session tokens expire after seven days; there is no per-token server revocation store.

## Worker resources and migration

The root Worker authenticates `Authorization: Bearer SERVICE_SECRET` before dispatching `/cloud` to `cloudRequest`. The caller supplies `x-qr-user` derived from a verified session; browser-provided owner fields are never accepted. D1 binding: `DB`. Private R2 binding: `ASSETS`, bucket `qr-upgrade-private`. Disable public bucket URLs and custom public domains. Apply `workers/qr-service/migrations/0002_accounts.sql` to the bound D1 database using the existing deployment workflow before activating accounts. Do not create a public image route to the bucket.

The migration creates metadata only. Private JSON objects use `accounts/<sha256-google-sub>/<design-uuid>/<revision-uuid>.json`. Requests are limited to 3 MiB before parsing, each account to 50 records including archives. Reservations use one conditional SQL insert, not a read-then-write quota check. Failed writes clean pending reservations when storage state can be confirmed. An ambiguous D1 result is read back before removing objects, preventing deletion of an object whose metadata committed. If both cleanup and recovery reads are unavailable, an unreferenced object or pending quota reservation can remain and needs operator reconciliation; never blindly delete referenced objects. There is no permanent user delete endpoint.

## API contract

All responses are `Cache-Control: no-store`. Errors contain user-safe messages only.

- `GET /api/account`: `{configured, signedIn, user: {name,email} | null}`.
- `GET /api/account/login`: OAuth redirect with PKCE S256, state and nonce, all bound to a ten-minute signed HttpOnly cookie.
- `GET /api/account/callback`: exchanges code server-side, verifies RS256 Google signature, issuer, audience, expiry, nonce, authorized-party claim when present, and verified email. Redirects to `/account`; failures use the fixed `?error=signin` message.
- `POST /api/account/logout`: requires canonical same origin; clears session/state.
- `GET /api/account/designs`: `{designs: [{id,name,archived,createdAt,updatedAt}]}` for the signed-in owner, including archives.
- `POST /api/account/designs`: accepts `{name,draft,artifact}`; returns 201 `{design: metadata}`. `draft` follows `EditorDraft`; optional `cloudId` must be a UUID and never determines storage ownership. `artifact` may contain the usual client fields, but only PNG bytes are persisted. SVG and scan/check flags are dropped.
- `GET /api/account/designs/:id`: `{design: {...metadata,draft,artifact:{png}}}`. Foreign or unknown records return identical 404 responses. Renamed metadata is reflected in `draft.name`.
- `PUT /api/account/designs/:id`: replaces `{name,draft,artifact}`, preserving archive status and creation date; returns `{design:metadata}`. Concurrent content changes may return 409; reopen before retrying.
- `PATCH /api/account/designs/:id`: `{name?:string,archived?:boolean}`; returns `{design:metadata}`. Archive and restore are reversible. No DELETE endpoint.

Mutations require `Origin` exactly matching the configured account origin and reject `Sec-Fetch-Site: cross-site`. The proxy overrides the user identity header and forwards the shared service secret only server-side. Embedded asset fields only accept bounded PNG/JPEG/WebP data URLs with matching magic bytes or an enumerated bundled local raster path. QR destination content can contain normal links but is not fetched by cloud storage. No SVG markup, public R2 URLs, or external avatars are rendered.

Reopening a cloud draft MUST regenerate the QR and run the normal scan checks. A stored thumbnail never proves scannability. The account page is account management only; cloud-library UI is integrated separately by the studio owner.

## Verification before activation

Run `npm run typecheck` and `npx tsx --test tests/account.test.ts`. After configuring actual credentials, verify a Google test-user login, refusal of denied consent, logout, save/reopen in another browser, archive/restore, owner isolation using two accounts, and lack of public R2 access. These live OAuth checks require an actual registered client and are not claimed by unit tests.

Primary references reviewed for implementation: [Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect), [Google OIDC reference](https://developers.google.com/identity/openid-connect/reference), [jose remote JWKS](https://github.com/panva/jose/blob/main/docs/jwks/remote/functions/createRemoteJWKSet.md), and [jose JWT verification](https://github.com/panva/jose/blob/main/src/jwt/verify.ts).

# Account data export

The signed-in Account page lets an owner request each section as consecutive JSON parts. Save all desired sections and separately save the cloud design JSON and uploaded files listed in each manifest part. A requested browser download is not proof that the browser or user saved the file. Pending metadata is included, with `unavailable_pending` and no file route. Ready metadata says `ready_to_request`; an object can still be missing or invalid at download time.

## Fixed section allowlist

| Section | Included data |
| --- | --- |
| `profile` | Name and email from the verified, centrally current signed session; no owner hash or session version |
| `designs` | ID, name, archived/ready flags, created/updated timestamps, file availability and local authenticated download route |
| `links` | ID, slug, name, target, publication/archive state, created/updated timestamps |
| `scans` | Every retained daily aggregate: owned link slug, day, count |
| `pages` | ID, slug, validated draft and published version, publication/archive state, created/updated timestamps |
| `assets` | ID, name, declared MIME/size, ready flag, created timestamp, file availability and local authenticated download route |
| `feedback` | Every retained received submission through an owned page: ID, page ID, sender name/email/message, created timestamp |
| `billing_customer` | App-held Stripe customer ID and test/live mode |
| `billing_events` | App-held event ID/type/time, customer/subscription IDs, test/live mode |
| `security` | Retained event ID/type/time; latest 100 for up to 30 days |

Archived and pending records count as owner-held records. No free/paid capacity limit stops traversal. Feedback is not limited to the management UI's latest 100. Child queries restrict owner in SQL by joining the owned link, page or billing customer.

No service credentials, session versions, cookies, OAuth tokens, R2 keys, checkout session/reservation/idempotency values, raw billing provider payloads or network quota hashes are exported. User-authored design content (including a saved Wi-Fi password) is part of the private design JSON. Anonymous artwork jobs use a separate browser identity and are not associated with this account export. Local-only designs require exports from [On this device](/designs). Stripe's separately held receipts are accessed through [Billing](/billing); no Stripe request is made to prepare an account export.

## Pagination and limits

`POST /api/account/export` accepts only `{ "section": "<allowlisted section>", "cursor": null }`, then the returned opaque `nextCursor` for later parts. The body is bounded to 1 KiB and must be JSON. Exact canonical Origin is mandatory and cross-site Fetch Metadata is rejected. All browser `x-qr-*` headers and query parameters are rejected.

Each response includes `formatVersion`, `section`, `generatedAt`, `records`, `counts.records` (this part only), `nextCursor` and `complete`. Parts contain at most 25 records and at most 1 MiB of UTF-8 JSON, including the envelope/cursor. The browser saves that exact JSON, without pretty-print expansion. A bounded SQL `LIMIT 26` provides one lookahead row. A part that fills its byte budget returns a cursor after its last included record. An individually oversized row fails explicitly with 413 on the part that would include it; no row is shortened and the section is not marked complete.

Keys are immutable record IDs, customer IDs for customer linkage, `(slug, day)` for aggregates, and `(created_at, id)` for security activity. Security activity is traversed oldest first so the export's own retention pruning removes events already passed by its cursor. Cursors are HMAC-authenticated with a domain separator and owner binding, contain a section-specific key tuple, and are strictly validated for shape, key type and section. Changing owner, section or cursor bytes is rejected. No offsets, arbitrary table names or caller-defined sort/row limits are supported. Cursors have no expiry but stop working if the service secret changes.

This is a **live paginated export, not an atomic database/R2 snapshot**. Edits, newly created data, deletion and retention cleanup during traversal may change which rows appear in later parts. Restart a section if needed. Each successfully prepared page records the fixed internal `data_export` event and applies existing security-event retention. Exporting security activity itself can therefore affect the retained event set. The response does not promise a total row count across an unstable snapshot.

## Original-file downloads

`GET /api/account/export/files/design/:uuid` and `/api/account/export/files/asset/:uuid` are authenticated application routes. The browser supplies only the fixed kind and UUID. The Worker resolves the storage key from an owner-scoped row, requires ready state, reads the private object and checks both the R2 actual size and the body byte count. Design JSON is limited to 3 MiB; uploaded assets to 2 MiB. Design JSON must satisfy the existing storage validator and is serialized from its allowlisted result. Assets use `application/octet-stream`, regardless of their uploaded MIME or filename.

The Worker and application proxy read streams into bounded buffers before returning successful attachments. This deliberately trades a small bounded buffer for truthful rejection of incomplete or oversized objects, rather than beginning a successful partial download. Reads have a 10-second deadline; application service requests have a 15-second timeout. The browser fetches one chosen file at a time. It never automatically starts all listed downloads.

Responses use server-generated kind/UUID filenames, attachment disposition, private/no-store, nosniff, no-referrer and a sandbox content policy. No uploaded filename is used as a response header. Pending records return 409, absent owner rows or missing objects 404, oversized size metadata 413, invalid/incomplete/actual-byte-over-limit files 422, and infrastructure failure 503. These are per-file outcomes; metadata export never claims all originals are available or saved.

## Account validation and failure behavior

The application uses the reviewed `currentSession` lookup before each page/file operation. Its service request contains a server-derived owner and signed session version. The Worker dispatcher verifies the service bearer; the export handler independently checks the owner/version in `account_security`. A valid bearer plus a revoked/missing account gets the exact owner-bound `409 account_session_invalid` denial. The application maps only that exact denial to browser 401. Bearer rejection, malformed denial, D1/R2 failures and unavailable account security return 503 without clearing cookies or claiming logout.

No new event HTTP endpoint, export storage bucket, public share link, CORS policy or provider integration is introduced. Export contains no billing entitlement lookup and remains available after downgrade or while Stripe is down. The UI keeps only bounded current manifest entries and per-section cursors/counts in component memory, aborts pending requests on unmount, and is remounted on account change and removed on sign-out. It writes no personal export contents to browser storage.

## Validation

`tests/account-export.test.ts` uses in-memory real SQLite with every production migration, two owners, the production Worker dispatcher and the production application proxy. It covers multipart traversal, >100 feedback, tied aggregate keys, archived/pending/empty sections, both row/UTF-8 byte boundaries, owner and cursor attacks, CSRF/header/body attacks, bearer/session failures, safe attachments, private object absence/size/malformed data, actual-byte validation and outages. The focused suite is run together with the reviewed account/session suites. No provider, production data or credentials are used.

# Recovery and reconciliation — engineering runbook

Status: draft, operator ownership and RTO/RPO approval pending. This is not a completed enterprise continuity control.

## Verified rehearsal, 20 September 2026

A remote Cloudflare D1 export was written privately to `compliance/evidence/recovery/pre-hosted-services.sql` before the hosted-services migrations. Its bytes were restored into an isolated in-memory SQLite database. `PRAGMA integrity_check` returned `ok`. The private receipt records the export hash, timestamp, byte count and table names in `compliance/evidence/recovery/d1-restore-check.json`. No production data was restored or overwritten. The directory is excluded from source control and deployment.

This verifies the SQL export and local restore path. It does not verify R2 object recovery, production D1 restoration, service RTO/RPO, signing-key recovery or owner-approved continuity. D1 export can briefly make the source unavailable; schedule subsequent exports in an approved maintenance window.

## Combined D1/R2 rehearsal, 20 September 2026

A fresh remote SQL export and every ready cloud-design/hosted-asset object were copied into private evidence storage. The export contained 11 tables and two referenced objects totaling 1,490,632 bytes. SQLite integrity and foreign-key checks passed. The original snapshot, checksums and download receipts are retained in `compliance/evidence/recovery/2026-09-20-launch/` with owner-only permissions.

The SQL and both objects were then restored into isolated local Wrangler D1/R2 storage in 5.19 seconds. The actual Worker was started on loopback with an unrelated nonproduction credential and remote bindings disabled. All 32 runtime checks passed: missing bearer rejection, correct owner retrieval, cross-owner denial, byte-identical file retrieval, private inbox recovery, archived public unavailability, and publication/asset/pause/redirect behavior in the isolated copy. The runtime assertions took 0.61 seconds. No production rows or objects were changed by the rehearsal.

These timings measure this small fixture's local restore and assertions, not an approved service RTO. This does not establish a remote production cutover, independent backup retention, scheduled RPO or recovery of provider accounts/signing keys. Runtime receipt: `runtime-verification.json`; content-bearing artifacts remain private and excluded from Git/deployment.

## Before a production restoration

1. Identify the incident, accountable owner and intended recovery point. Preserve a new private export and deployment identifiers before changes.
2. Confirm whether the problem requires code rollback, data repair or full restoration. Do not restore an old database merely to undo a code deployment.
3. Restore SQL into an isolated database first. Apply only migrations compatible with the recovery deployment. Verify integrity, schema and ownership constraints, plus unpublished/published state.
4. Recover R2 objects referenced by cloud-design metadata and hosted-asset rows. A SQL backup alone does not contain those objects. Keep the bucket private. Match object existence, size/type and ownership against the restored manifest.
5. Rehearse owner isolation, public snapshot/asset membership, paused/archive unavailability, redirect behavior and billing customer binding in the isolated environment. Do not replay financial mutations; reconcile subscriptions against Stripe's current state.
6. Record approval, recovery point, expected data loss and customer impact before changing the production binding. Preserve a rollback path. Verify the actual production service after cutover and record elapsed recovery time.

## Pending upload reconciliation

Cloud designs and hosted assets reserve rows before writing private R2 objects. An uncertain write or terminated request can leave an unready row or an orphaned object. This is deliberately safer than deleting an object whose database commit may have succeeded.

Start with a read-only inventory. Compare `cloud_designs.r2key`, ready flags and `content_assets.r2key` against a private R2 inventory. Never delete an object referenced by any current ready row or published snapshot. Verify that a pending reservation is older than the maximum operation lifetime, has no in-flight writer and cannot be a completed object with a delayed metadata response. Keep an evidence copy of the manifest. Any final deletion or quota repair requires a separate reviewed, owner-authorized action with exact row/object identifiers. No automatic customer-data deletion is installed.

## Billing reconciliation

See `billing-setup.md` for checkout reservation handling. Stripe's live subscription state is authoritative; success-query strings and event arrival order are not. Use provider records to resolve uncertain checkout creation. Never clear an uncertain reservation merely to make the button work, and never replay a charge as a recovery test.

## Still required for G09

A named recovery owner; approved backup cadence/retention and data regions; separately protected object backups; credential access/rotation evidence; an end-to-end D1 + R2 restoration rehearsal; measured and approved RTO/RPO; an authorized production rollback exercise. The isolated combined rehearsal satisfies the engineering restore test only; these operational approvals and production-cutover requirements remain outstanding.

## Account-deletion ledger gate before restoring older backups (Task2c)

Keep restored D1/R2 data isolated from public and private application traffic. The latest `account_deletions` and closed `account_security` state must be reconciled with the independent private `deletion-ledger/v1/` objects **before** any old backup can become an active backend. Read ledger objects with operator-only access in bounded pages; never expose them through a public asset route. Each receipt contains only format, owner hash, deletion ID, revoked-through version, acceptance time and closed=true. Preserve a copy of the latest ledger independently from the historical content snapshot being restored; restoring R2 to an older point must not roll the ledger back with it.

1. Compare the latest surviving D1 deletion jobs with independent receipts. Resolve every `ledger_ready=0` job by persisting its exact receipt and verify it before proceeding. Receipt creation and D1 acceptance cannot share a distributed transaction: if the latest D1 state is irrecoverably lost before its independent receipt is acknowledged, an older snapshot alone cannot establish the complete deletion set. Keep restoration private until that gap is resolved through available evidence; do not certify public recovery as safe.
2. Apply migrations through `0007_account_lifecycle.sql` to the isolated restore. Reapply every latest deletion receipt as a closed owner tombstone before enabling reads or writes. Session versions must be at least `revokedThroughVersion+1`, and may never decrease relative to newer surviving central security state. Reconstruct a pending deletion job for each restored owner, then use the bounded manifest/cleanup process to remove restored content and orphan versions. Never restore a closed owner to active or discard their billing binding. Revalidate any restored billing reservations against authoritative provider state under the separate billing process.
3. Verify public redirects/pages/assets/feedback/counts and private content routes reject closed owners even while restored cleanup is pending. Check row/object deletion completion separately from access denial. Preserve shared keys referenced by another owner and resolve inconsistencies privately, without deleting another owner's data.
4. Retain the latest deletion ledger outside content backup rotations until its retention period is formally approved. Do not delete local evidence or backup files as part of this application cleanup. Record only non-content reconciliation counts/status in operational evidence.

For an unsettled `account_uploads` key, first inspect its owner/version and confirm the owner remains closed. Determine the original operation's outcome from available provider/request evidence; a client timeout or one empty R2 read is insufficient. Once a responsible operator has established that no put can still complete, compare the exact journal row, delete any unreferenced object, and settle that exact journal entry for normal cleanup. If the outcome cannot be established, leave it pending and continue bounded prefix reconciliation. Do not clear uncertain journals solely to turn the UI green. This is a manual reconciliation procedure, not an automatic expiry or a newly implemented support endpoint.

For an unresolved `billing_customer_creations` reservation, retry the existing Billing action only within its 23-hour replay window using the persisted mode and original provider idempotency key. Outside that window, identify and validate the exact owner/mode/customer through authoritative provider evidence before persisting the binding and clearing the reservation. If authoritative evidence proves the customer-create did not execute, release only the exact owner/token reservation. Unknown outcomes remain blocked; do not delete the reservation or replay an evicted idempotency key just to enable closure. This flow neither cancels subscriptions nor creates a new automatic operator endpoint.

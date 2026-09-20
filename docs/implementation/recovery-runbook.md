# Recovery and reconciliation — engineering runbook

Status: draft, operator ownership and RTO/RPO approval pending. This is not a completed enterprise continuity control.

## Verified rehearsal, 20 September 2026

A remote Cloudflare D1 export was written privately to `compliance/evidence/recovery/pre-hosted-services.sql` before the hosted-services migrations. Its bytes were restored into an isolated in-memory SQLite database. `PRAGMA integrity_check` returned `ok`. The private receipt records the export hash, timestamp, byte count and table names in `compliance/evidence/recovery/d1-restore-check.json`. No production data was restored or overwritten. The directory is excluded from source control and deployment.

This verifies the SQL export and local restore path. It does not verify R2 object recovery, production D1 restoration, service RTO/RPO, signing-key recovery or owner-approved continuity. D1 export can briefly make the source unavailable; schedule subsequent exports in an approved maintenance window.

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

A named recovery owner; approved backup cadence/retention and data regions; separately protected object backups; credential access/rotation evidence; an end-to-end D1 + R2 restoration rehearsal; measured and approved RTO/RPO; an authorized production rollback exercise. The limited SQL rehearsal above does not satisfy these remaining requirements.

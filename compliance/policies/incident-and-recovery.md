# Incident response and recovery — DRAFT FOR APPROVAL

Incident commander, engineering responder, privacy/legal contact, communications owner and backup contacts: unassigned. Fill these in and test contactability before release.

1. Detect and record an incident identifier, time, affected service and initial facts. Minimize personal data in the incident record. Preserve relevant evidence in access-controlled storage.
2. Triage severity and appoint an incident commander. For credential compromise, revoke/rotate the affected credential, restrict access and assess unauthorized activity; record actions and time.
3. Contain the affected deployment or integration. Disable the optional API if its auth, limiter or logging controls fail. Do not delete evidence while containing the incident.
4. Investigate scope, affected data, tenants/users (when those features exist), exposure duration and supplier involvement. Separate verified facts from hypotheses.
5. The privacy/legal owner determines applicable contractual and statutory notification duties and deadlines; use the relevant regulator guidance and actual jurisdiction/data scope. Do not assume one notification window applies to every incident.
6. Recover from a trusted build/configuration, validate security controls, monitor for recurrence and approve restoration of service. Document who authorized each decision.
7. Hold a post-incident review, assign corrective actions with dates and test closure.

For recovery, record actual business RTO/RPO decisions. The current app has no server-side campaign database; test recovery of source, infrastructure configuration, secrets access, DNS and signed release artifacts. If storage is added, require encrypted backups, separate access, retention and a successful restore with integrity checks before launch.

Exercise plan: tabletop an exposed service key and a malicious dependency; send a real test alert to the responder; restore/rollback a non-production deployment; record results, timings, failures, corrective actions and independent approval. A successful command build does not substitute for these exercises.

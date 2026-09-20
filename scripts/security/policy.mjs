const DAY = 86400000;
const realPerson = (value) =>
  typeof value === "string" &&
  value.trim().length >= 3 &&
  !/^(tbd|unknown|unassigned|todo|placeholder)$/i.test(value.trim());
export async function evaluateRelease({
  catalog,
  report,
  attestations,
  digest,
  hashArtifact,
  now = Date.now(),
}) {
  const blockers = [];
  if (!report || report.schemaVersion !== 1 || report.status !== "passed")
    blockers.push("Automated evidence is missing, incomplete, or failing.");
  if (report?.sourceDigest !== digest)
    blockers.push("Automated evidence does not match the current source.");
  const completed = Date.parse(report?.finishedAt ?? "");
  if (
    !Number.isFinite(completed) ||
    completed > now + 60000 ||
    now - completed > DAY
  )
    blockers.push(
      "Automated evidence must be complete and less than 24 hours old.",
    );
  for (const control of catalog.automated) {
    const matches = report?.checks?.filter((c) => c.id === control.id) ?? [];
    if (matches.length !== 1 || matches[0].status !== "passed") {
      blockers.push(
        `${control.id}: ${control.title} has no unique passing result.`,
      );
      continue;
    }
    for (const artifact of matches[0].artifacts ?? []) {
      try {
        if ((await hashArtifact(artifact.path)) !== artifact.sha256)
          throw new Error();
      } catch {
        blockers.push(`${control.id}: evidence artifact missing or changed.`);
      }
    }
    if (!matches[0].artifacts?.length)
      blockers.push(`${control.id}: no evidence artifact recorded.`);
  }
  for (const control of catalog.manual) {
    const records =
      attestations?.controls?.filter((c) => c.id === control.id) ?? [];
    if (records.length !== 1) {
      blockers.push(`${control.id}: ${control.title} needs approved evidence.`);
      continue;
    }
    const item = records[0],
      reviewed = Date.parse(item.reviewedAt),
      expires = Date.parse(item.expiresAt);
    if (
      item.status !== "approved" ||
      !realPerson(item.owner) ||
      !realPerson(item.approvedBy) ||
      item.owner === item.approvedBy
    )
      blockers.push(
        `${control.id}: named owner and independent approver are required.`,
      );
    if (
      !Number.isFinite(reviewed) ||
      !Number.isFinite(expires) ||
      reviewed > now ||
      expires <= now ||
      expires <= reviewed ||
      now - reviewed > control.maxAgeDays * DAY ||
      expires - reviewed > control.maxAgeDays * DAY
    )
      blockers.push(
        `${control.id}: review is missing, future-dated, stale, or expired.`,
      );
    if (control.bindToSource && item.sourceDigest !== digest)
      blockers.push(`${control.id}: approval must bind to this source digest.`);
    try {
      if (
        !/^[a-f0-9]{64}$/.test(item.sha256) ||
        (await hashArtifact(item.artifact)) !== item.sha256
      )
        throw new Error();
    } catch {
      blockers.push(
        `${control.id}: approved evidence file is missing or changed.`,
      );
    }
  }
  return { allowed: blockers.length === 0, blockers };
}

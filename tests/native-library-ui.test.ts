import assert from "node:assert/strict";
import test from "node:test";
import { initialDraft, snapshotDraft, type Draft } from "../mobile/src/draft-model";
import type { DesignRecord } from "../mobile/src/local-library-model";
import { refreshAfterOperationFailure } from "../mobile/src/library-screen-lifecycle";
import {
  ImageSessionLifetime,
  acceptedVerification,
  captureEditableDraft,
  detachDeletedIdentity,
  editableDraftFingerprint,
  listWhenSupported,
  reconcileSavedIdentity,
  reopenedState,
  savedCompletion,
  stageAsyncReplacement,
  verificationIdentity,
  withImageSessionConsumer,
} from "../mobile/src/native-library-lifecycle";

const id = "123e4567-e89b-42d3-a456-426614174000";

function record(draft: Draft = initialDraft): DesignRecord {
  return {
    schemaVersion: 1,
    kind: "design",
    id,
    generation: 3,
    createdAt: "2026-09-21T00:00:00.000Z",
    updatedAt: "2026-09-21T00:01:00.000Z",
    title: "Launch card",
    draft: snapshotDraft(draft),
    assets: {},
  };
}

const nextTurn = () => new Promise((resolve) => setTimeout(resolve, 0));

test("save click captures nested editable values before asynchronous work", () => {
  const current = captureEditableDraft(initialDraft);
  const captured = captureEditableDraft(current);
  current.content.url = "https://edited.example";
  current.appearance.quietZone = 8;

  assert.equal(captured.content.url, "https://qrupgrade.com/");
  assert.equal(captured.appearance.quietZone, 4);
  const completion = savedCompletion(current, captured, record(captured));
  assert.equal(completion.dirty, true);
  assert.equal(
    completion.baseline,
    editableDraftFingerprint(captured),
  );
});

test("invalid incomplete edits remain visible to dirty tracking", () => {
  const baseline = editableDraftFingerprint(initialDraft);
  const invalid = captureEditableDraft(initialDraft);
  invalid.content.url = "";

  assert.throws(() => snapshotDraft(invalid));
  assert.notEqual(editableDraftFingerprint(invalid), baseline);
});

test("same-content reopen always increments epoch and clears verification", () => {
  const reopened = reopenedState(initialDraft, record(), 12, false);

  assert.equal(reopened.epoch, 13);
  assert.equal(reopened.verification, null);
  assert.deepEqual(reopened.identity, {
    id,
    generation: 3,
    title: "Launch card",
  });
});

test("late pre-reopen verification is rejected for identical regenerated SVG", () => {
  const svg = "<svg>stable output</svg>";
  const oldKey = verificationIdentity(svg, 12);
  const reopened = reopenedState(initialDraft, record(), 12, false);
  const currentKey = verificationIdentity(svg, reopened.epoch);
  const candidate = {
    key: oldKey,
    ok: true,
    message: "Export read-back passed.",
  };

  assert.notEqual(oldKey, currentKey);
  assert.equal(acceptedVerification(currentKey, candidate), undefined);
  assert.equal(acceptedVerification(currentKey, null), null);
});

test("recovered older generation is opened as an unsaved copy", () => {
  const reopened = reopenedState(initialDraft, record(), 1, true);

  assert.equal(reopened.identity, null);
  assert.equal(reopened.forceUnsaved, true);
});

test("failed materialization cannot alter the prior working draft", async () => {
  const prior = captureEditableDraft(initialDraft);
  prior.brand = "Working copy";
  let current = prior;

  await assert.rejects(
    stageAsyncReplacement(
      async () => {
        throw new Error("materialized asset is missing");
      },
      () => true,
      async () => {},
    ),
    /materialized asset is missing/,
  );

  assert.equal(current, prior);
  assert.equal(current.brand, "Working copy");
});

test("stale async replacement is discarded instead of replacing newer edits", async () => {
  const discarded: string[] = [];

  await assert.rejects(
    stageAsyncReplacement(
      async () => ({ sessionId: "stale-session" }),
      () => false,
      async (value) => {
        discarded.push(value.sessionId);
      },
    ),
    /draft changed/,
  );
  assert.deepEqual(discarded, ["stale-session"]);
});

test("deleting the open row detaches identity and keeps it unsaved", () => {
  const detached = detachDeletedIdentity(
    { id, generation: 3, title: "Launch card" },
    id,
  );

  assert.equal(detached.identity, null);
  assert.equal(detached.forceUnsaved, true);
});

test("committed tombstone cleanup failure and later list retry stay unsaved", () => {
  const identity = { id, generation: 3, title: "Launch card" };
  const pendingCleanup = reconcileSavedIdentity(identity, {
    rows: [
      {
        id,
        status: "deleting",
        message: "Deleted design still needs file cleanup. Retry deletion.",
      },
    ],
    issues: [],
    totalBytes: 120,
  });
  assert.equal(pendingCleanup.detached, true);
  assert.equal(pendingCleanup.identity, null);

  const afterSuccessfulRetry = reconcileSavedIdentity(
    pendingCleanup.identity,
    { rows: [], issues: [], totalBytes: 0 },
  );
  assert.equal(afterSuccessfulRetry.identity, null);
});

test("failed pre-commit delete retains an authoritative saved identity", () => {
  const identity = { id, generation: 3, title: "Launch card" };
  const result = reconcileSavedIdentity(identity, {
    rows: [
      {
        id,
        status: "saved",
        generation: 3,
        title: "Launch card",
        type: "url",
        updatedAt: "2026-09-21T00:01:00.000Z",
      },
    ],
    issues: [],
    totalBytes: 120,
  });
  assert.equal(result.detached, false);
  assert.equal(result.identity, identity);
});

test("post-record reset key cleanup failure leaves working draft unsaved", () => {
  const identity = { id, generation: 3, title: "Launch card" };
  const result = reconcileSavedIdentity(identity, {
    rows: [],
    issues: [],
    totalBytes: 0,
  });

  assert.equal(result.detached, true);
  assert.equal(result.identity, null);
});

test("delete failure remains visible after authoritative row refresh", async () => {
  const operationError = {
    code: "disk-full",
    message: "Free more device space and try again.",
  };
  const refreshed = {
    rows: [
      {
        id,
        status: "saved" as const,
        generation: 3,
        title: "Launch card",
        type: "url" as const,
        updatedAt: "2026-09-21T00:01:00.000Z",
      },
    ],
    issues: [],
    totalBytes: 120,
  };
  let listing: typeof refreshed | null = null;
  let visibleError: typeof operationError | null = null;

  await refreshAfterOperationFailure(
    operationError,
    async () => refreshed,
    () => true,
    (next) => {
      listing = next;
    },
    (error) => {
      visibleError = error;
    },
    () => ({ code: "storage", message: "Refresh failed." }),
  );

  assert.equal((listing as typeof refreshed | null)?.rows[0]?.status, "saved");
  assert.deepEqual(visibleError, operationError);
});

test("refresh failure supersedes stale delete guidance while screen is current", async () => {
  const operationError = { code: "disk-full", message: "Free space." };
  const refreshError = { code: "storage", message: "Library refresh failed." };
  let visibleError: typeof operationError | null = null;

  await refreshAfterOperationFailure(
    operationError,
    async () => {
      throw new Error("offline");
    },
    () => true,
    () => assert.fail("A failed refresh must not apply rows."),
    (error) => {
      visibleError = error;
    },
    () => refreshError,
  );

  assert.deepEqual(visibleError, refreshError);
});

test("delete refresh completion does not update an unfocused screen", async () => {
  let applied = false;
  let presented = false;
  let refreshes = 0;

  await refreshAfterOperationFailure(
    { code: "storage", message: "Delete failed." },
    async () => {
      refreshes += 1;
      return { rows: [], issues: [], totalBytes: 0 };
    },
    () => false,
    () => {
      applied = true;
    },
    () => {
      presented = true;
    },
    () => ({ code: "storage", message: "Refresh failed." }),
  );

  assert.equal(applied, false);
  assert.equal(presented, false);
  assert.equal(refreshes, 0);
});

test("owned image session releases only after consumer and UI lifetime", async () => {
  const released: string[] = [];
  const lifetime = new ImageSessionLifetime(async (sessionId) => {
    released.push(sessionId);
  });
  lifetime.activate("first");
  const releaseConsumer = lifetime.acquire("first");
  const retired = lifetime.activate("second");

  lifetime.settle(retired);
  await nextTurn();
  assert.deepEqual(released, []);

  releaseConsumer();
  await nextTurn();
  assert.deepEqual(released, ["first"]);
});

test("pending save normalization holds its image session through unmount", async () => {
  const released: string[] = [];
  const lifetime = new ImageSessionLifetime(async (sessionId) => {
    released.push(sessionId);
  });
  lifetime.activate("materialized");
  let finishNormalization: (() => void) | undefined;
  const normalization = new Promise<void>((resolve) => {
    finishNormalization = resolve;
  });

  const saving = withImageSessionConsumer(
    () => lifetime.acquire("materialized"),
    () => normalization,
  );
  lifetime.dispose();
  await nextTurn();
  assert.deepEqual(released, []);

  finishNormalization?.();
  await saving;
  await nextTurn();
  assert.deepEqual(released, ["materialized"]);
});

test("web unsupported path performs no persistence attempt", async () => {
  let attempts = 0;
  const result = await listWhenSupported(false, async () => {
    attempts += 1;
    return "library";
  });

  assert.equal(result, null);
  assert.equal(attempts, 0);
});

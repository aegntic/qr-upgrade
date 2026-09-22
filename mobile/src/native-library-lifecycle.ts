import type { DesignRecord } from "./local-library-model";
import type { Draft } from "./draft-model";
import type { LibraryListing } from "./local-library-core";
import { LibraryError } from "./local-library-model";

export type SavedDesignIdentity = {
  id: string;
  generation: number;
  title: string;
};

export type DraftLifecycleState = {
  draft: Draft;
  identity: SavedDesignIdentity | null;
  baseline: string;
  forceUnsaved: boolean;
  epoch: number;
  verification: null;
};

export type VerificationResult = {
  key: string;
  ok: boolean;
  message: string;
};

export function verificationIdentity(svg: string, epoch: number) {
  return svg ? JSON.stringify([epoch, svg]) : "";
}

export function acceptedVerification(
  currentIdentity: string,
  candidate: VerificationResult | null,
): VerificationResult | null | undefined {
  if (candidate === null) return null;
  return candidate.key === currentIdentity ? candidate : undefined;
}

/** Copy every editable value synchronously at the moment an action is pressed. */
export function captureEditableDraft(draft: Draft): Draft {
  return {
    ...draft,
    content: { ...draft.content },
    appearance: { ...draft.appearance },
  };
}

/**
 * Dirty tracking must work for incomplete drafts, so this deliberately performs
 * no persistence or payload validation.
 */
export function editableDraftFingerprint(draft: Draft): string {
  const copy = captureEditableDraft(draft);
  return JSON.stringify(copy);
}

export function savedCompletion(
  currentDraft: Draft,
  capturedDraft: Draft,
  record: DesignRecord,
) {
  const baseline = editableDraftFingerprint(capturedDraft);
  return {
    identity: {
      id: record.id,
      generation: record.generation,
      title: record.title,
    },
    baseline,
    dirty: editableDraftFingerprint(currentDraft) !== baseline,
  };
}

export function reopenedState(
  materializedDraft: Draft,
  record: DesignRecord,
  previousEpoch: number,
  recovered: boolean,
): DraftLifecycleState {
  const draft = captureEditableDraft(materializedDraft);
  return {
    draft,
    identity: recovered
      ? null
      : { id: record.id, generation: record.generation, title: record.title },
    baseline: editableDraftFingerprint(draft),
    forceUnsaved: recovered,
    epoch: previousEpoch + 1,
    verification: null,
  };
}

export function detachDeletedIdentity(
  identity: SavedDesignIdentity | null,
  deletedId: string,
) {
  return identity?.id === deletedId
    ? { identity: null, forceUnsaved: true }
    : { identity, forceUnsaved: false };
}

export function reconcileSavedIdentity(
  identity: SavedDesignIdentity | null,
  listing: LibraryListing | null,
) {
  if (!identity) return { identity, detached: false };
  const row = listing?.rows.find((candidate) => candidate.id === identity.id);
  if (
    row?.status === "saved" &&
    row.generation === identity.generation &&
    row.title === identity.title
  )
    return { identity, detached: false };
  return { identity: null, detached: true };
}

/** Build first, then verify that the request is still current before commit. */
export async function stageAsyncReplacement<T>(
  build: () => Promise<T>,
  isCurrent: () => boolean,
  discard: (value: T) => Promise<void>,
): Promise<T> {
  const value = await build();
  if (isCurrent()) return value;
  await discard(value);
  throw new LibraryError(
    "conflict",
    "The draft changed while this design was opening. Try again.",
  );
}

export async function listWhenSupported<T>(
  supported: boolean,
  list: () => Promise<T>,
): Promise<T | null> {
  return supported ? list() : null;
}

export async function withImageSessionConsumer<T>(
  acquire: () => () => void,
  work: () => Promise<T>,
): Promise<T> {
  const release = acquire();
  try {
    return await work();
  } finally {
    release();
  }
}

type RetiredSession = { consumers: number; uiSettled: boolean };

/**
 * Keeps an owned image session alive while an async render still reads it.
 * UI settlement is a separate signal because native image views can outlive the
 * React state update that replaced their URI.
 */
export class ImageSessionLifetime {
  private active: string | null = null;
  private readonly retired = new Map<string, RetiredSession>();

  constructor(
    private readonly release: (sessionId: string) => Promise<void>,
  ) {}

  activate(sessionId: string): string | null {
    const previous = this.active;
    this.active = sessionId;
    if (previous && previous !== sessionId) this.retire(previous);
    return previous;
  }

  acquire(sessionId: string | null): () => void {
    if (!sessionId) return () => {};
    const state = this.retired.get(sessionId) || {
      consumers: 0,
      uiSettled: false,
    };
    state.consumers += 1;
    this.retired.set(sessionId, state);
    let released = false;
    return () => {
      if (released) return;
      released = true;
      const current = this.retired.get(sessionId);
      if (!current) return;
      current.consumers = Math.max(0, current.consumers - 1);
      void this.flush(sessionId);
    };
  }

  retireActive(): string | null {
    const previous = this.active;
    this.active = null;
    if (previous) this.retire(previous);
    return previous;
  }

  settle(sessionId: string | null) {
    if (!sessionId) return;
    const state = this.retired.get(sessionId);
    if (!state) return;
    state.uiSettled = true;
    void this.flush(sessionId);
  }

  dispose(): string[] {
    const sessions = [...this.retired.keys()];
    const active = this.retireActive();
    if (active && !sessions.includes(active)) sessions.push(active);
    for (const session of sessions) this.settle(session);
    return sessions;
  }

  private retire(sessionId: string) {
    if (!this.retired.has(sessionId))
      this.retired.set(sessionId, { consumers: 0, uiSettled: false });
  }

  private async flush(sessionId: string) {
    const state = this.retired.get(sessionId);
    if (!state || !state.uiSettled || state.consumers > 0) return;
    this.retired.delete(sessionId);
    try {
      await this.release(sessionId);
    } catch {
      // Cache cleanup is best effort and never invalidates the working draft.
    }
  }
}

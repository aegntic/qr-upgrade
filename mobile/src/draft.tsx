import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { InteractionManager, View, useColorScheme } from "react-native";
import { Appearance, Content, createMatrix, payload } from "../../shared/qr";
import { createNativeArtwork } from "./artwork";
import { assessPrint, autoFix } from "../../shared/score";
import { Draft, initialDraft as initial } from "./draft-model";
import {
  captureLibraryAssets,
  materializeLibraryDesign,
  purgeStaleLibraryImageCache,
  releaseLibraryImageSession,
} from "./local-library-images";
import { localLibrary, localLibrarySupported } from "./local-library";
import type { LibraryListing } from "./local-library-core";
import { LibraryError } from "./local-library-model";
import {
  ImageSessionLifetime,
  SavedDesignIdentity,
  VerificationResult,
  acceptedVerification,
  captureEditableDraft,
  editableDraftFingerprint,
  listWhenSupported,
  reconcileSavedIdentity,
  reopenedState,
  savedCompletion,
  stageAsyncReplacement,
  verificationIdentity,
  withImageSessionConsumer,
} from "./native-library-lifecycle";

export type { Draft, Scene } from "./draft-model";

type Verification = VerificationResult | null;

function useDraftState() {
  const [draft, setDraft] = useState<Draft>(initial);
  const draftRef = useRef(draft);
  const [verification, setVerificationState] = useState<Verification>(null);
  const verificationIdentityRef = useRef("");
  const [epoch, setEpoch] = useState(0);
  const epochRef = useRef(0);
  const revision = useRef(0);
  const mounted = useRef(true);
  const [identity, setIdentity] = useState<SavedDesignIdentity | null>(null);
  const identityRef = useRef<SavedDesignIdentity | null>(null);
  const [baseline, setBaseline] = useState(() =>
    editableDraftFingerprint(initial),
  );
  const [forceUnsaved, setForceUnsaved] = useState(false);
  const [libraryBusy, setLibraryBusy] = useState<string | null>(null);
  const libraryBusyRef = useRef(false);
  const imageSession = useRef<string | null>(null);
  const sessions = useRef(
    new ImageSessionLifetime(releaseLibraryImageSession),
  );

  useEffect(
    () => () => {
      mounted.current = false;
      sessions.current.dispose();
    },
    [],
  );

  function assignDraft(next: Draft) {
    const copied = captureEditableDraft(next);
    draftRef.current = copied;
    revision.current += 1;
    setDraft(copied);
  }

  function assignIdentity(next: SavedDesignIdentity | null) {
    identityRef.current = next;
    setIdentity(next);
  }

  function settleAfterTransition(sessionId: string | null) {
    if (!sessionId) return;
    InteractionManager.runAfterInteractions(() => {
      sessions.current.settle(sessionId);
    });
  }

  async function withLibraryAction<T>(label: string, work: () => Promise<T>) {
    if (libraryBusyRef.current)
      throw new LibraryError(
        "conflict",
        "Another library action is still finishing.",
      );
    libraryBusyRef.current = true;
    if (mounted.current) setLibraryBusy(label);
    try {
      return await work();
    } finally {
      libraryBusyRef.current = false;
      if (mounted.current) setLibraryBusy(null);
    }
  }

  const encoded = useMemo(() => {
    try {
      const text = payload(draft.content);
      return { text, matrix: createMatrix(text), error: "" };
    } catch (e) {
      return {
        text: "",
        matrix: null,
        error: e instanceof Error ? e.message : "Check your content.",
      };
    }
  }, [draft.content]);
  const artworkKey = JSON.stringify([
    encoded.text,
    draft.artwork,
    draft.artworkUri,
    draft.strength,
    draft.portraitUri,
    draft.portraitSize,
    epoch,
  ]);
  const [art, setArt] = useState<{
    key: string;
    png: string;
    svg: string;
    error: string;
  } | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!encoded.text) return;
    const releaseConsumer = sessions.current.acquire(imageSession.current);
    let started = false;
    const timer = setTimeout(() => {
      started = true;
      createNativeArtwork(
        draft.artwork,
        draft.artworkUri,
        encoded.text,
        draft.strength,
        draft.portraitUri
          ? { uri: draft.portraitUri, sizePercent: draft.portraitSize }
          : undefined,
      )
        .then((result) => {
          if (!cancelled && mounted.current)
            setArt({ ...result, key: artworkKey, error: "" });
        })
        .catch((e) => {
          if (!cancelled && mounted.current)
            setArt({
              key: artworkKey,
              png: "",
              svg: "",
              error:
                e instanceof Error
                  ? e.message
                  : "Artwork could not be created.",
            });
        })
        .finally(releaseConsumer);
    }, 160);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (!started) releaseConsumer();
    };
  }, [
    artworkKey,
    encoded.text,
    draft.artwork,
    draft.artworkUri,
    draft.strength,
    draft.portraitUri,
    draft.portraitSize,
  ]);
  const activeArt = art?.key === artworkKey ? art : null;
  const generated = {
    ...encoded,
    png: activeArt?.png || "",
    svg: activeArt?.svg || "",
    error: encoded.error || activeArt?.error || "",
  };
  const input = {
    ...draft.appearance,
    sizeMm: draft.sizeMm,
    distanceCm: draft.distanceCm,
    modules: generated.matrix?.size ?? 21,
  };
  const screening = assessPrint(input);
  const checks = screening.checks.filter(
    (c) => c.id === "density" || c.id === "distance",
  );
  const report = {
    ...screening,
    checks,
    score: checks.filter((c) => c.passed).length * 50,
  };
  const key = verificationIdentity(generated.svg, epoch);
  verificationIdentityRef.current = key;
  const setVerification = (candidate: Verification) => {
    const accepted = acceptedVerification(
      verificationIdentityRef.current,
      candidate,
    );
    if (accepted === undefined || !mounted.current) return false;
    setVerificationState(accepted);
    return true;
  };
  const verified =
    !!generated.svg && verification?.key === key && verification.ok;
  const patch = (change: Partial<Draft>) =>
    assignDraft({ ...draftRef.current, ...change });
  const content = (change: Partial<Content>) =>
    assignDraft({
      ...draftRef.current,
      content: { ...draftRef.current.content, ...change },
    });
  const appearance = (change: Partial<Appearance>) =>
    assignDraft({
      ...draftRef.current,
      appearance: { ...draftRef.current.appearance, ...change },
    });
  const fix = () => {
    const current = draftRef.current;
    const fixed = autoFix({
      ...current.appearance,
      sizeMm: current.sizeMm,
      distanceCm: current.distanceCm,
      modules: generated.matrix?.size ?? 21,
    });
    assignDraft({
      ...current,
      sizeMm: fixed.sizeMm,
      strength: Math.min(1, current.strength + 0.2),
      portraitSize: current.portraitUri
        ? Math.max(10, current.portraitSize - 2)
        : current.portraitSize,
      appearance: {
        ...current.appearance,
        foreground: fixed.foreground,
        background: fixed.background,
        quietZone: fixed.quietZone,
      },
    });
  };
  const reset = () => {
    const retired = sessions.current.retireActive();
    imageSession.current = null;
    settleAfterTransition(retired);
    assignDraft(initial);
    assignIdentity(null);
    setBaseline(editableDraftFingerprint(initial));
    setForceUnsaved(false);
    setArt(null);
    epochRef.current += 1;
    setEpoch(epochRef.current);
    setVerificationState(null);
  };

  function detachWorkingCopy(id?: string) {
    const current = identityRef.current;
    if (!current || (id && current.id !== id)) return;
    assignIdentity(null);
    setForceUnsaved(true);
    setBaseline(editableDraftFingerprint(draftRef.current));
  }

  function reconcileWorkingIdentity(listing: LibraryListing | null) {
    const reconciled = reconcileSavedIdentity(identityRef.current, listing);
    if (reconciled.detached) detachWorkingCopy();
  }

  async function saveCurrent(title?: string) {
    const captured = captureEditableDraft(draftRef.current);
    const savedIdentity = identityRef.current;
    const saveTitle = title ?? savedIdentity?.title ?? "";
    const capturedSession = imageSession.current;
    return withImageSessionConsumer(
      () => sessions.current.acquire(capturedSession),
      () =>
        withLibraryAction("Saving on this device…", async () => {
          const assets = await captureLibraryAssets(captured);
          const record = await localLibrary.save({
            title: saveTitle,
            draft: captured,
            assets,
            id: savedIdentity?.id,
            expectedGeneration: savedIdentity?.generation,
          });
          if (mounted.current) {
            const completion = savedCompletion(
              draftRef.current,
              captured,
              record,
            );
            assignIdentity(completion.identity);
            setBaseline(completion.baseline);
            setForceUnsaved(false);
          }
          return record;
        }),
    );
  }

  async function listSaved(): Promise<LibraryListing | null> {
    return withLibraryAction("Loading library…", async () => {
      const listing = await listWhenSupported(localLibrarySupported, () =>
        localLibrary.list(),
      );
      if (listing) reconcileWorkingIdentity(listing);
      return listing;
    });
  }

  async function openSaved(
    id: string,
    recoverPrevious = false,
    requesterIsActive: () => boolean = () => true,
  ) {
    const startRevision = revision.current;
    return withLibraryAction("Opening design…", async () => {
      const record = await localLibrary.open(id, { recoverPrevious });
      const materialized = await stageAsyncReplacement(
        () => materializeLibraryDesign(record),
        () =>
          mounted.current &&
          requesterIsActive() &&
          revision.current === startRevision,
        (value) => releaseLibraryImageSession(value.sessionId),
      );
      const previousSession = sessions.current.activate(materialized.sessionId);
      imageSession.current = materialized.sessionId;
      const next = reopenedState(
        materialized.draft,
        record,
        epochRef.current,
        recoverPrevious,
      );
      draftRef.current = next.draft;
      revision.current += 1;
      setDraft(next.draft);
      assignIdentity(next.identity);
      setBaseline(next.baseline);
      setForceUnsaved(next.forceUnsaved);
      epochRef.current = next.epoch;
      setEpoch(next.epoch);
      setArt(null);
      setVerificationState(null);
      settleAfterTransition(previousSession);
      return record;
    });
  }

  async function renameSaved(
    id: string,
    title: string,
    expectedGeneration: number,
  ) {
    return withLibraryAction("Renaming design…", async () => {
      const record = await localLibrary.rename(id, title, expectedGeneration);
      if (identityRef.current?.id === id && mounted.current)
        assignIdentity({
          id,
          generation: record.generation,
          title: record.title,
        });
      return record;
    });
  }

  async function deleteSaved(id: string) {
    return withLibraryAction("Deleting design…", async () => {
      try {
        await localLibrary.delete(id);
        if (mounted.current) detachWorkingCopy(id);
      } catch (error) {
        let listing: LibraryListing | null = null;
        let listed = false;
        try {
          listing = await localLibrary.list();
          listed = true;
        } catch {
          // An uncertain destructive result must never remain labelled saved.
        }
        if (mounted.current) {
          if (listing) reconcileWorkingIdentity(listing);
          else detachWorkingCopy(id);
        }
        if (listed && !listing?.rows.some((row) => row.id === id)) return;
        throw error;
      }
    });
  }

  async function resetSavedLibrary() {
    return withLibraryAction("Deleting inaccessible saves…", async () => {
      try {
        await localLibrary.reset();
        if (mounted.current) detachWorkingCopy();
      } catch (error) {
        let listing: LibraryListing | null = null;
        try {
          listing = await localLibrary.list();
        } catch {
          // File removal may already have committed; treat the draft as unsaved.
        }
        if (mounted.current) reconcileWorkingIdentity(listing);
        throw error;
      }
    });
  }

  const hasUnsavedChanges =
    forceUnsaved || editableDraftFingerprint(draft) !== baseline;
  const retainLibraryImageSession = () =>
    sessions.current.acquire(imageSession.current);

  return {
    reset,
    draft,
    patch,
    content,
    appearance,
    generated,
    report,
    fix,
    verification,
    setVerification,
    key,
    verified,
    ready: verified && report.score === 100,
    savedIdentity: identity,
    hasUnsavedChanges,
    libraryBusy,
    localLibrarySupported,
    saveCurrent,
    listSaved,
    openSaved,
    renameSaved,
    deleteSaved,
    resetSavedLibrary,
    retainLibraryImageSession,
  };
}

const Context = createContext<ReturnType<typeof useDraftState> | null>(null);

function DraftStateProvider({ children }: { children: React.ReactNode }) {
  return (
    <Context.Provider value={useDraftState()}>{children}</Context.Provider>
  );
}

export function DraftProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const dark = useColorScheme() === "dark";
  useEffect(() => {
    let active = true;
    purgeStaleLibraryImageCache()
      .catch(() => {})
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);
  if (!ready)
    return (
      <View
        accessibilityLabel="Preparing private device storage"
        style={{ flex: 1, backgroundColor: dark ? "#080b10" : "#f1f4f7" }}
      />
    );
  return <DraftStateProvider>{children}</DraftStateProvider>;
}

export function useDraft() {
  const value = useContext(Context);
  if (!value) throw new Error("Missing draft provider.");
  return value;
}

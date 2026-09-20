import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Appearance, Content, createMatrix, payload } from "../../shared/qr";
import { createNativeArtwork } from "./artwork";
import { assessPrint, autoFix } from "../../shared/score";
import { Draft, initialDraft as initial } from "./draft-model";
export type { Draft, Scene } from "./draft-model";
function useDraftState() {
  const [draft, setDraft] = useState<Draft>(initial);
  const [verification, setVerification] = useState<{
    key: string;
    ok: boolean;
    message: string;
  } | null>(null);
  const [epoch, setEpoch] = useState(0);
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
    const timer = setTimeout(() => {
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
          if (!cancelled) setArt({ ...result, key: artworkKey, error: "" });
        })
        .catch((e) => {
          if (!cancelled)
            setArt({
              key: artworkKey,
              png: "",
              svg: "",
              error:
                e instanceof Error
                  ? e.message
                  : "Artwork could not be created.",
            });
        });
    }, 160);
    return () => {
      cancelled = true;
      clearTimeout(timer);
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
  const key = generated.svg;
  const verified =
    !!generated.svg && verification?.key === key && verification.ok;
  const patch = (change: Partial<Draft>) =>
    setDraft((d) => ({ ...d, ...change }));
  const content = (change: Partial<Content>) =>
    setDraft((d) => ({ ...d, content: { ...d.content, ...change } }));
  const appearance = (change: Partial<Appearance>) =>
    setDraft((d) => ({ ...d, appearance: { ...d.appearance, ...change } }));
  const fix = () => {
    const fixed = autoFix(input);
    setDraft((d) => ({
      ...d,
      sizeMm: fixed.sizeMm,
      strength: Math.min(1, d.strength + 0.2),
      portraitSize: d.portraitUri
        ? Math.max(10, d.portraitSize - 2)
        : d.portraitSize,
      appearance: {
        ...d.appearance,
        foreground: fixed.foreground,
        background: fixed.background,
        quietZone: fixed.quietZone,
      },
    }));
  };
  const reset = () => {
    setDraft(initial);
    setArt(null);
    setEpoch((e) => e + 1);
    setVerification(null);
  };
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
  };
}
const Context = createContext<ReturnType<typeof useDraftState> | null>(null);
export function DraftProvider({ children }: { children: React.ReactNode }) {
  return (
    <Context.Provider value={useDraftState()}>{children}</Context.Provider>
  );
}
export function useDraft() {
  const value = useContext(Context);
  if (!value) throw new Error("Missing draft provider.");
  return value;
}

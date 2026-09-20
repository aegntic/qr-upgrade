'use client';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { EditorDraft, DesignArtifact } from '@/lib/editor-draft';
type Workflow = { draft: EditorDraft | null; artifact: DesignArtifact | null; savedId?: string; setDesign: (draft: EditorDraft, artifact: DesignArtifact | null, savedId?: string) => void; clear: () => void };
const Context = createContext<Workflow | null>(null);
export function WorkflowProvider({ children }: { children: ReactNode }) {
  const [value, setValue] = useState<{ draft: EditorDraft | null; artifact: DesignArtifact | null; savedId?: string }>({ draft: null, artifact: null });
  const setDesign = useCallback((draft: EditorDraft, artifact: DesignArtifact | null, savedId?: string) => setValue({ draft, artifact, savedId }), []);
  const clear = useCallback(() => setValue({ draft: null, artifact: null }), []);
  const state = useMemo(() => ({ ...value, setDesign, clear }), [value, setDesign, clear]);
  return <Context.Provider value={state}>{children}</Context.Provider>;
}
export function useWorkflow() { const state = useContext(Context); if (!state) throw new Error('WorkflowProvider is required.'); return state; }

import type { Content, Appearance } from './qr';
import type { DestinationId, GeneratorMode } from './generator-options';
import type { artworkDesigns } from './artwork-designs';

export type ImageAdjustments = { zoom: number; x: number; y: number; opacity: number; brightness: number };
export const defaultImageAdjustments: ImageAdjustments = { zoom: 1, x: 50, y: 50, opacity: 100, brightness: 100 };
export type Caption = { text: string; color: string; font: 'sans' | 'serif' | 'mono'; position: 'top' | 'bottom' };
export const defaultCaption: Caption = { text: '', color: '#ffffff', font: 'sans', position: 'bottom' };
export type Study = { id: string; name: string; destination: string; strength: number };
export type EditorDraft = {
  version: 1;
  cloudId?: string;
  kind: DestinationId;
  content: Content;
  mode: GeneratorMode;
  appearance: Appearance;
  template: string;
  art: (typeof artworkDesigns)[number]['id'];
  brandStudy?: Study;
  studyActive: boolean;
  customImage: string;
  logo: string;
  logoSize: number;
  logoFrame: 'plain' | 'metal';
  strength: number;
  sizeMm: number;
  showUtm: boolean;
  utm: { source: string; medium: string; campaign: string };
  adjustments: ImageAdjustments;
  caption: Caption;
  name: string;
  destinationDrafts: Partial<Record<DestinationId, string>>;
};
export type DesignArtifact = { png: string; svg: string; text: string; sizeMm: number; modules: number; pristine: boolean; reduced: boolean; simulated: boolean; dimensionsPass: boolean };
export type SavedRevision = { id: string; savedAt: string; draft: EditorDraft; artifact: DesignArtifact };
export type SavedDesign = { id: string; name: string; createdAt: string; updatedAt: string; archived: boolean; draft: EditorDraft; artifact: DesignArtifact; history: SavedRevision[] };
export function designName(value: string) { return value.trim().slice(0, 80) || 'Untitled QR'; }
export function revisionOf(record: SavedDesign): SavedRevision { return { id: record.updatedAt, savedAt: record.updatedAt, draft: record.draft, artifact: record.artifact }; }
export function updateSavedDesign(previous: SavedDesign | undefined, draft: EditorDraft, artifact: DesignArtifact, id: string, now: string): SavedDesign {
  const name = designName(draft.name);
  return { id, name, createdAt: previous?.createdAt ?? now, updatedAt: now, archived: previous?.archived ?? false, draft: { ...draft, name }, artifact,
    history: previous ? [revisionOf(previous), ...previous.history].slice(0, 5) : [] };
}

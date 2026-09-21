export type ArtStyle = 'steel' | 'glass' | 'ceramic' | 'embossed' | 'botanical' | 'illustrated';
export const ART_STYLES: Readonly<Record<ArtStyle, { label: string; dimensional: boolean; prompt: string }>>;
export function artworkPrompt(style: ArtStyle, prompt: string): string;

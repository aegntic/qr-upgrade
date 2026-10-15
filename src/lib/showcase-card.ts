import { campaignLayouts, campaignSvg } from './campaign-kit';

// A fixed acquisition link: never serialize a user's destination or draft here.
export const showcaseLink = 'https://qrupgrade.com/generator?utm_source=showcase&utm_medium=share&utm_campaign=scan-the-art';
export const showcaseCaption = `Made something worth scanning. Create your own QR artwork: ${showcaseLink}`;
export function showcaseSvg(png: string) {
  return campaignSvg(campaignLayouts[0], png, {
    brand: 'MADE WITH QR UPGRADE', headline: 'Scan the art.',
    detail: 'Create yours at qrupgrade.com', theme: 'obsidian',
  });
}

export type GrowthEvent = 'export_requested' | 'showcase_prepared' | 'showcase_download_requested' | 'showcase_share_opened' | 'showcase_share_handoff' | 'showcase_share_cancelled' | 'showcase_link_copied';
// Local integration point only. No cookies, payloads, URLs or network collection.
export function emitGrowthEvent(name: GrowthEvent) {
  window.dispatchEvent(new CustomEvent('qrupgrade:growth', { detail: { name, version: 1 } }));
}

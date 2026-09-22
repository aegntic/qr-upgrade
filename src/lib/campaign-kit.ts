export type CampaignCopy = { brand: string; headline: string; detail: string; theme: 'obsidian' | 'paper' };
export const defaultCampaignCopy: CampaignCopy = {
  brand: 'Your brand', headline: 'Scan to discover', detail: 'Something worth exploring.', theme: 'obsidian',
};
export const campaignPresets = [
  { id: 'business', label: 'Business', brand: 'Your business', headline: 'Explore the collection', detail: 'Scan for the details. Find your next favourite.' },
  { id: 'creator', label: 'Creator', brand: 'Your name', headline: 'Meet your next inspiration', detail: 'Scan for my latest work, links and updates.' },
  { id: 'agency', label: 'Agency', brand: 'Your client', headline: 'Discover what comes next', detail: 'Scan to explore the campaign.' },
] as const;

export const campaignLayouts = [
  { id: 'square', name: 'Social post', width: 1080, height: 1080, description: '1080 × 1080 px', qr: { x: 220, y: 170, size: 640 }, brandY: 88, headlineY: 922, detailY: 980 },
  { id: 'story', name: 'Vertical story', width: 1080, height: 1920, description: '1080 × 1920 px', qr: { x: 150, y: 530, size: 780 }, brandY: 330, headlineY: 1460, detailY: 1525 },
  { id: 'counter', name: 'Counter card', width: 1240, height: 1748, description: 'A6 · 105 × 148 mm', qr: { x: 140, y: 410, size: 960 }, brandY: 198, headlineY: 1504, detailY: 1580 },
] as const;
export type CampaignLayout = typeof campaignLayouts[number];

const xml = (text: string) => text.replace(/[&<>"']/g, value => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[value]!);
const clean = (text: string, length: number) => Array.from(text.replace(/[\u0000-\u001f\u007f]/g, ' ').trim()).slice(0, length).join('');
function checkedPng(png: string) {
  if (!/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(png) || png.length > 16 * 1024 * 1024) throw new Error('A complete PNG artwork is needed for your kit.');
  return png;
}
export function campaignCopy(value: CampaignCopy): CampaignCopy {
  return { brand: clean(value.brand, 32), headline: clean(value.headline, 40), detail: clean(value.detail, 64), theme: value.theme === 'paper' ? 'paper' : 'obsidian' };
}
export function campaignFilename(name: string) {
  return name.replace(/[^\p{L}\p{N} _.-]/gu, '').replace(/^\.+/, '').trim().slice(0, 64) || 'qr-upgrade';
}

// PNG data only: destinations and user copy can never become active SVG content.
export function campaignSvg(layout: CampaignLayout, png: string, value: CampaignCopy): string {
  checkedPng(png);
  const copy = campaignCopy(value), paper = layout.id === 'counter' || copy.theme === 'paper';
  const bg = paper ? '#f7f6f2' : '#0b0d12', ink = paper ? '#171b24' : '#eff1f7', muted = paper ? '#545b69' : '#aab4c8';
  const { x, y, size } = layout.qr, center = layout.width / 2;
  const text = (content: string, top: number, fontSize: number, color: string, weight = 400) => {
    // Fit even wide glyphs without clipping, while keeping text selectable in previews.
    const estimate = Array.from(content).length * fontSize;
    const fit = estimate > layout.width - 160 ? ` textLength="${layout.width - 160}" lengthAdjust="spacingAndGlyphs"` : '';
    return `<text x="${center}" y="${top}" fill="${color}" font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="${weight}" text-anchor="middle"${fit}>${xml(content)}</text>`;
  };
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${layout.width}" height="${layout.height}" viewBox="0 0 ${layout.width} ${layout.height}">
    <rect width="100%" height="100%" fill="${bg}"/>
    <rect x="28" y="28" width="${layout.width - 56}" height="${layout.height - 56}" rx="18" fill="none" stroke="${paper ? '#d7d8d8' : '#343b4a'}"/>
    ${text(copy.brand, layout.brandY, 32, muted, 600)}
    <rect x="${x - 20}" y="${y - 20}" width="${size + 40}" height="${size + 40}" rx="16" fill="#ffffff"/>
    <image x="${x}" y="${y}" width="${size}" height="${size}" xlink:href="${png}"/>
    ${text(copy.headline, layout.headlineY, layout.id === 'counter' ? 64 : 54, ink, 700)}
    ${text(copy.detail, layout.detailY, 26, muted)}
  </svg>`;
}

export function campaignProofSvg(images: string[]): string {
  if (images.length !== campaignLayouts.length) throw new Error('All three campaign layouts are needed for the proof sheet.');
  const panels = campaignLayouts.map((layout, index) => {
    const width = Math.min(450, 630 * layout.width / layout.height), height = width * layout.height / layout.width;
    const center = 317 + index * 521;
    return `<text x="${center}" y="237" text-anchor="middle" font-size="25">${layout.name}</text><image x="${center - width / 2}" y="278" width="${width}" height="${height}" xlink:href="${checkedPng(images[index])}"/>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1684" height="1190" viewBox="0 0 1684 1190"><rect width="100%" height="100%" fill="#fff"/><g font-family="Arial, sans-serif" fill="#171b24"><text x="90" y="114" font-size="48" font-weight="700">Campaign proof</text><text x="90" y="164" font-size="24">Artwork, message and placement review</text>${panels}<g font-size="22" fill="#545b69"><text x="90" y="1010">All four exported PNGs matched the intended QR content at full size and 50% size.</text><text x="90" y="1050">Review the artwork and copy. Test the final print or published post before distributing.</text><text x="90" y="1090">Reference checks only. This sheet is for review, not printing at final size.</text></g></g></svg>`;
}

export const campaignGuide = `YOUR QR UPGRADE CAMPAIGN KIT

qr-artwork.png — your complete QR image, without a campaign layout.
social-post.png — square post, 1080 × 1080 pixels.
vertical-story.png — vertical story, 1080 × 1920 pixels.
counter-card.png — A6 layout, 1240 × 1748 pixels (approximately 300 ppi).
counter-card.pdf — one A6 RGB page, 105 × 148 mm, without bleed or crop marks.
campaign-proof.pdf — a contact sheet of the three layouts for client or team review.
scan-report.json — local decoder results and file fingerprints for these PNGs.

PRINT
Print the PDF at Actual size / 100%, not Fit to page. The QR artwork on the card is approximately 81 mm wide, regardless of the original studio print-width setting. The PDF embeds the checked counter-card PNG; the PDF file itself is not separately decoded. Ask your printer about paper, colour conversion and bleed. Print and scan a physical proof on the intended material before ordering a run.

SOCIAL
Upload the matching PNG. Platforms can resize or compress images: test the published post again. A QR shown on someone's phone can be awkward to scan; include your destination as a clickable link or link sticker as well. This kit does not publish posts or create platform-native Snapcodes or Spotify Codes.

WHAT THE CHECKS MEAN
The original PNG and all three layout PNGs are decoded locally at full size and 50% size. Both must match the selected destination exactly. This does not check whether a website is online, safe or owned by you, or guarantee a scan on every phone, material or lighting condition. The report omits plaintext destination data, but the images still encode it. Treat a Wi-Fi or contact kit as sensitive.

KEEP YOUR FILES
Downloaded image files have no expiry added by QR Upgrade and can be reused without signing in. Direct QR content stays fixed. A website must remain available; managed redirects and hosted pages still depend on the service hosting them. Changes to a destination require a new kit unless the encoded URL already supports updates. Enlarging these files does not create additional detail in the original artwork.
`;

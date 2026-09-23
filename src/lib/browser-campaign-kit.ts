import { rasterize, readCanvas } from './browser-qr';
import { svgData } from './qr';
import { campaignLayouts, campaignSvg, campaignProofSvg, campaignGuide, type CampaignCopy } from './campaign-kit';
import type { DesignArtifact } from './editor-draft';

export async function canvasFromImage(source: string, width: number, height: number) {
  const image = new Image();
  image.src = source;
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Your browser cannot prepare this kit.');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(image, 0, 0, width, height);
  return canvas;
}
export const pngBlob = (canvas: HTMLCanvasElement) => new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Could not prepare a PNG. Please try again.')), 'image/png'));
const sha256 = async (bytes: Uint8Array<ArrayBuffer>) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), byte => byte.toString(16).padStart(2, '0')).join('');

export async function buildCampaignKit(artifact: DesignArtifact, copy: CampaignCopy, signal: AbortSignal, progress: (label: string) => void) {
  signal.throwIfAborted();
  if (!artifact.text || !artifact.pristine || !artifact.reduced || !artifact.simulated || !artifact.dimensionsPass) throw new Error('Pass the studio scan checks before creating a campaign kit.');
  const files: Record<string, Uint8Array<ArrayBuffer>> = {};
  const checks: { file: string; width: number; height: number; fullSize: 'passed'; halfSize: 'passed'; sha256: string }[] = [];
  async function record(canvas: HTMLCanvasElement, filename: string) {
    signal.throwIfAborted();
    const blob = await pngBlob(canvas);
    const source = URL.createObjectURL(blob);
    try {
      // Verify the actual encoded download bytes, including the whole layout.
      const full = await canvasFromImage(source, canvas.width, canvas.height);
      const half = await canvasFromImage(source, Math.round(canvas.width / 2), Math.round(canvas.height / 2));
      signal.throwIfAborted();
      if (readCanvas(full) !== artifact.text || readCanvas(half) !== artifact.text) throw new Error(`${filename} needs an adjustment before sharing. Increase scan strength or simplify the artwork in the studio, then try again.`);
      const bytes = new Uint8Array(await blob.arrayBuffer());
      checks.push({ file: filename, width: canvas.width, height: canvas.height, fullSize: 'passed', halfSize: 'passed', sha256: await sha256(bytes) });
      files[filename] = bytes;
    } finally { URL.revokeObjectURL(source); }
  }
  progress('Checking your original artwork…');
  const original = await rasterize(artifact.svg, 1024);
  await record(original, 'qr-artwork.png');
  const png = original.toDataURL('image/png');
  const layouts: string[] = [];
  for (const layout of campaignLayouts) {
    signal.throwIfAborted();
    progress(`Checking ${layout.name.toLowerCase()}…`);
    // Yield between layouts so cancel and navigation stay responsive.
    await new Promise<void>(resolve => setTimeout(resolve, 0));
    signal.throwIfAborted();
    const canvas = await canvasFromImage(svgData(campaignSvg(layout, png, copy)), layout.width, layout.height);
    const filename = layout.id === 'square' ? 'social-post.png' : layout.id === 'story' ? 'vertical-story.png' : 'counter-card.png';
    await record(canvas, filename);
    layouts.push(canvas.toDataURL('image/png'));
  }
  signal.throwIfAborted();
  progress('Packing your campaign kit…');
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: [105, 148], orientation: 'portrait', compress: true });
  doc.addImage(layouts[2], 'PNG', 0, 0, 105, 148);
  files['counter-card.pdf'] = new Uint8Array(doc.output('arraybuffer'));
  const proof = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape', compress: true });
  // Flatten the review sheet so PDF viewers cannot substitute fonts and alter spacing.
  const proofImage = await canvasFromImage(svgData(campaignProofSvg(layouts)), 1684, 1190);
  signal.throwIfAborted();
  proof.addImage(proofImage.toDataURL('image/png'), 'PNG', 0, 0, 297, 210);
  files['campaign-proof.pdf'] = new Uint8Array(proof.output('arraybuffer'));
  const { zipSync, strToU8 } = await import('fflate');
  files['scan-report.json'] = strToU8(JSON.stringify({ version: 1, createdAt: new Date().toISOString(), decoder: 'jsQR', payloadSha256: await sha256(new TextEncoder().encode(artifact.text)), checks, pdf: { file: 'counter-card.pdf', widthMm: 105, heightMm: 148, embeds: 'counter-card.png', separatelyDecoded: false }, proof: { file: 'campaign-proof.pdf', purpose: 'Visual review only; not final print size', separatelyDecoded: false }, limitation: 'Reference image checks only. Test physical prints and published social images. Destination availability was not checked.' }, null, 2));
  files['READ-ME.txt'] = strToU8(campaignGuide);
  signal.throwIfAborted();
  // PNGs and the PDF are already compressed; storing avoids needless CPU work.
  const bytes = zipSync(files, { level: 0 });
  return new Blob([new Uint8Array(bytes)], { type: 'application/zip' });
}

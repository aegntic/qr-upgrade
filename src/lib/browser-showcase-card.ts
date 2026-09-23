import type { DesignArtifact } from './editor-draft';
import { rasterize, readCanvas } from './browser-qr';
import { canvasFromImage, pngBlob } from './browser-campaign-kit';
import { showcaseSvg } from './showcase-card';
import { svgData } from './qr';

export async function buildShowcaseCard(artifact: DesignArtifact, signal: AbortSignal): Promise<Blob> {
  signal.throwIfAborted();
  if (!artifact.text || !artifact.pristine || !artifact.reduced || !artifact.simulated || !artifact.dimensionsPass) {
    throw new Error('Pass the scan checks and export your design first.');
  }
  const original = await rasterize(artifact.svg, 1024);
  signal.throwIfAborted();
  if (readCanvas(original) !== artifact.text) throw new Error('The artwork needs another scan check. Return to your design.');
  const canvas = await canvasFromImage(svgData(showcaseSvg(original.toDataURL('image/png'))), 1080, 1080);
  const blob = await pngBlob(canvas);
  const url = URL.createObjectURL(blob);
  try {
    for (const size of [1080, 540]) {
      signal.throwIfAborted();
      const check = await canvasFromImage(url, size, size);
      signal.throwIfAborted();
      if (readCanvas(check) !== artifact.text) throw new Error('This card needs stronger QR contrast. Adjust your design and export again.');
    }
    return blob;
  } finally { URL.revokeObjectURL(url); }
}

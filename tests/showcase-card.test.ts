import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { showcaseSvg, showcaseLink, showcaseCaption } from '../src/lib/showcase-card';
import { buildShowcaseCard } from '../src/lib/browser-showcase-card';
import { qrSvg, createMatrix } from '../shared/qr';
import { decodePixels } from '../shared/decode';
import { templates } from '../src/lib/generator-options';
import type { DesignArtifact } from '../src/lib/editor-draft';

test('showcase preserves sensitive encoded content in the chosen image but never leaks it into the creation URL or caption', async () => {
  const payload = 'WIFI:T:WPA;S:Private studio;P:secret-for-this-test;;';
  const png = await sharp(Buffer.from(qrSvg(createMatrix(payload), templates[0]))).png().toBuffer();
  const svg = showcaseSvg(`data:image/png;base64,${png.toString('base64')}`);
  for (const width of [1080, 540]) {
    const pixels = await sharp(Buffer.from(svg)).resize(width, width).ensureAlpha().raw().toBuffer();
    assert.equal(decodePixels(new Uint8ClampedArray(pixels), width, width), payload);
  }
  assert.equal(new URL(showcaseLink).pathname, '/generator');
  assert.deepEqual([...new URL(showcaseLink).searchParams.keys()], ['utm_source', 'utm_medium', 'utm_campaign']);
  assert.equal(showcaseCaption.includes(payload), false);
  assert.equal(svg.includes(payload), false);
  assert.throws(() => showcaseSvg('https://example.com/tracker.png'));
});

test('unchecked or cancelled showcase operations cannot render', async () => {
  const artifact: DesignArtifact = { png: '', svg: '', text: 'https://example.com', sizeMm: 70, modules: 25, pristine: true, reduced: true, simulated: true, dimensionsPass: true };
  for (const check of ['pristine', 'reduced', 'simulated', 'dimensionsPass'] as const) {
    await assert.rejects(buildShowcaseCard({ ...artifact, [check]: false }, new AbortController().signal), /Pass the scan checks/);
  }
  const controller = new AbortController(); controller.abort();
  await assert.rejects(buildShowcaseCard(artifact, controller.signal), { name: 'AbortError' });
});

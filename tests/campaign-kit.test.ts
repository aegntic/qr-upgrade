import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { campaignLayouts, campaignSvg, campaignFilename, campaignCopy, defaultCampaignCopy } from '../src/lib/campaign-kit';
import { qrSvg, createMatrix } from '../shared/qr';
import { decodePixels } from '../shared/decode';
import { templates } from '../src/lib/generator-options';
import { readFile } from 'node:fs/promises';
import { buildCampaignKit } from '../src/lib/browser-campaign-kit';
import type { DesignArtifact } from '../src/lib/editor-draft';

test('unverified and cancelled kits cannot start rendering or produce downloads', async () => {
  const artifact: DesignArtifact = { png: '', svg: '', text: 'https://example.com', sizeMm: 70, modules: 25, pristine: true, reduced: true, simulated: true, dimensionsPass: true };
  for (const check of ['pristine', 'reduced', 'simulated', 'dimensionsPass'] as const) {
    await assert.rejects(buildCampaignKit({ ...artifact, [check]: false }, defaultCampaignCopy, new AbortController().signal, () => assert.fail('Cannot start rendering')), /Pass the studio/);
  }
  const controller = new AbortController(); controller.abort();
  await assert.rejects(buildCampaignKit(artifact, defaultCampaignCopy, controller.signal, () => assert.fail('Cannot start rendering')), { name: 'AbortError' });
});

test('campaign layouts preserve the exact URL and dimensional X artwork at full and half export sizes', async () => {
  const url = 'https://example.com/collection?utm_source=counter&utm_campaign=launch';
  const custom = await sharp(Buffer.from(qrSvg(createMatrix(url), templates[0]))).png().toBuffer();
  const sculptural = await readFile('public/brand-studies/x.png');
  for (const [png, expected] of [[custom, url], [sculptural, 'https://x.com/']] as const) {
    for (const theme of ['paper', 'obsidian'] as const) {
      for (const layout of campaignLayouts) {
        const svg = campaignSvg(layout, `data:image/png;base64,${png.toString('base64')}`, { ...defaultCampaignCopy, theme });
        for (const scale of [1, 0.5]) {
          const width = Math.round(layout.width * scale), height = Math.round(layout.height * scale);
          const pixels = await sharp(Buffer.from(svg)).resize(width, height).ensureAlpha().raw().toBuffer();
          assert.equal(decodePixels(new Uint8ClampedArray(pixels), width, height), expected, `${layout.id}, ${theme}, ${scale}`);
        }
      }
    }
  }
});

test('campaign copy cannot inject SVG markup or external image URLs', () => {
  const svg = campaignSvg(campaignLayouts[0], 'data:image/png;base64,AAAA', { ...defaultCampaignCopy, brand: '<script>bad</script>', headline: 'A&B "collection"', detail: '</text><image href="https://example.com"/>' });
  assert.ok(svg.includes('&lt;script&gt;'));
  assert.ok(svg.includes('A&amp;B &quot;collection&quot;'));
  assert.equal((svg.match(/<image /g) || []).length, 1);
  assert.throws(() => campaignSvg(campaignLayouts[0], 'https://example.com/track.png', defaultCampaignCopy));
  assert.throws(() => campaignSvg(campaignLayouts[0], 'data:image/svg+xml;base64,AAAA', defaultCampaignCopy));
  assert.throws(() => campaignSvg(campaignLayouts[0], 'data:image/png;base64,AAAA" onload="alert(1)', defaultCampaignCopy));
});

test('text and filenames stay bounded and safe, including unicode', () => {
  assert.equal(campaignFilename('../../'), 'qr-upgrade');
  assert.equal(campaignFilename('Launch/世界:2026'), 'Launch世界2026');
  const value = campaignCopy({ brand: 'x'.repeat(100), headline: 'y'.repeat(100), detail: 'z'.repeat(100), theme: 'obsidian' });
  assert.deepEqual([value.brand.length, value.headline.length, value.detail.length], [32, 40, 64]);
  assert.equal(campaignCopy({ ...defaultCampaignCopy, brand: 'A\nB\u0000C' }).brand, 'A B C');
});

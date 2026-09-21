import test from 'node:test';
import assert from 'node:assert/strict';
import { ART_STYLES, artworkPrompt, type ArtStyle } from '../shared/art-styles.mjs';
import { validateArtInput } from '../workers/qr-service/worker.mjs';
import { createArtHandler } from '../src/lib/server/art-service';
import { withWebEntry } from '../cloudflare/runtime';

test('every selectable material passes both API boundaries and keeps the front-facing generation constraint', async () => {
  for (const style of Object.keys(ART_STYLES) as ArtStyle[]) {
    const input = { id: '11111111-1111-4111-8111-111111111111', owner: 'a'.repeat(64), network: 'b'.repeat(64), prompt: 'Flowing shapes for a modern studio', style };
    assert.equal(validateArtInput(input).style, style);
    let sent: Record<string, unknown> = {};
    const handler = createArtHandler({ url: 'https://worker.example', secret: 's'.repeat(64), production: true, fetcher: async (_url, init) => { sent = JSON.parse(String(init?.body)); return Response.json({ status: 'pending' }, { status: 202 }); } });
    const request = new Request('https://qrupgrade.com/api/art', { method: 'POST', headers: { origin: 'https://qrupgrade.com', 'content-type': 'application/json', cookie: 'qr-art-session=' + 'c'.repeat(64) }, body: JSON.stringify({ requestId: input.id, prompt: input.prompt, style }) });
    const response = await withWebEntry({}, '192.0.2.1', () => handler(request));
    assert.equal(response.status, 202, style);
    assert.equal(sent.style, style);
    assert.match(artworkPrompt(style, input.prompt), /Front-facing orthographic/);
    assert.match(artworkPrompt(style, input.prompt), /No typography/);
  }
  assert.equal(Object.values(ART_STYLES).filter(value => value.dimensional).length, 4);
  assert.throws(() => artworkPrompt('toString' as ArtStyle, 'test'));
});

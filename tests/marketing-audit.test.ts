import test from 'node:test';
import assert from 'node:assert/strict';
import { auditSite, changes } from '../scripts/marketing/audit.mjs';

test('discovery flags sitemap redirects into excluded pages without treating intentional exclusions as missing metadata', async () => {
  const fetcher: typeof fetch = async input => {
    const url = new URL(input instanceof Request ? input.url : input);
    if (url.pathname === '/sitemap.xml') return new Response('<urlset><url><loc>https://qrupgrade.com/pricing</loc></url></urlset>');
    if (url.pathname === '/pricing') return new Response(null, { status: 307, headers: { location: '/billing' } });
    if (url.pathname === '/billing') return new Response('<meta name="robots" content="noindex, nofollow">');
    return new Response(`<title>${url.pathname}</title><meta name="description" content="About ${url.pathname}"><link rel="canonical" href="https://qrupgrade.com${url.pathname}">`);
  };
  const report = await auditSite({ fetcher });
  assert.deepEqual(report.issues.map((item: { id: string }) => item.id).sort(), ['/pricing:sitemap-noindex', '/pricing:sitemap-redirect']);
  const again = changes(report, report);
  assert.deepEqual(again.added, []); assert.deepEqual(again.resolved, []);
});

test('unavailable evidence never resolves an earlier finding and external redirects are not followed', async () => {
  let external = false;
  const report = await auditSite({ fetcher: async input => {
    const url = new URL(input instanceof Request ? input.url : input);
    if (url.origin !== 'https://qrupgrade.com') external = true;
    return new Response(null, { status: 302, headers: { location: 'https://example.net/' } });
  } });
  assert.equal(external, false); assert.equal(report.complete, false);
  assert.deepEqual(changes({ issues: [{ id: '/docs:http' }] }, report).resolved, []);
});

test('a failed sitemap cannot close findings on pages missing from the fallback inventory', async () => {
  const report = await auditSite({ fetcher: async input => {
    const url = new URL(input instanceof Request ? input.url : input);
    if (url.pathname === '/sitemap.xml') return new Response('Unavailable', { status: 503 });
    return new Response(`<title>${url.pathname}</title><meta name="description" content="About ${url.pathname}"><link rel="canonical" href="https://qrupgrade.com${url.pathname}">`);
  } });
  assert.equal(report.complete, false);
  assert.deepEqual(report.issues.map((item: { id: string }) => item.id), ['/sitemap.xml:http']);
  assert.deepEqual(changes({ issues: [{ id: '/blog:http' }] }, report).resolved, []);
});

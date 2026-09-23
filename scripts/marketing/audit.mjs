const requiredPaths = ['/', '/generator', '/docs', '/ai', '/templates', '/brand-kits', '/press'];
const MAX_BYTES = 2_000_000;
const plain = text => text.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const attribute = (tag, name) => tag.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, 'i'))?.[1] || '';
export function pageSignals(html) {
  const tags = html.match(/<meta\b[^>]*>/gi) || [];
  const meta = name => tags.find(tag => attribute(tag, 'name').toLowerCase() === name);
  return {
    title: plain(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || ''),
    description: attribute(meta('description') || '', 'content'),
    robots: attribute(meta('robots') || '', 'content'),
    canonical: attribute((html.match(/<link\b[^>]*>/gi) || []).find(tag => attribute(tag, 'rel').toLowerCase() === 'canonical') || '', 'href'),
  };
}
async function boundedText(response) {
  if (!response.body) return '';
  const reader = response.body.getReader(); const decoder = new TextDecoder(); let bytes = 0, text = '';
  try {
    for (;;) {
      const part = await reader.read(); if (part.done) return text + decoder.decode();
      bytes += part.value.byteLength;
      if (bytes > MAX_BYTES) throw new Error('Response exceeds the 2 MB audit limit.');
      text += decoder.decode(part.value, { stream: true });
    }
  } finally { await reader.cancel().catch(() => {}); }
}
export async function auditSite({ origin = 'https://qrupgrade.com', fetcher = fetch } = {}) {
  const base = new URL(origin);
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.pathname !== '/' || base.search || base.hash) throw new Error('Use a plain site origin.');
  const issues = [], pages = [], listed = new Set();
  const issue = (path, code, message) => {
    const id = `${path}:${code}`;
    if (!issues.some(item => item.id === id)) issues.push({ id, path, code, message });
  };
  async function read(path) {
    let url = new URL(path, base); let redirects = 0;
    const signal = AbortSignal.timeout(15_000);
    for (;;) {
      const response = await fetcher(url, { redirect: 'manual', signal, headers: { 'User-Agent': 'QRUpgrade-Discovery-Check/1.0' } });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        await response.body?.cancel();
        const location = response.headers.get('location');
        if (!location || ++redirects > 5) throw new Error('Missing location or too many redirects.');
        url = new URL(location, url);
        if (url.origin !== base.origin || url.username || url.password) throw new Error('Redirect leaves the audited origin.');
        continue;
      }
      return { status: response.status, url: url.href, redirects, text: await boundedText(response), headerRobots: response.headers.get('x-robots-tag') || '' };
    }
  }
  try {
    const sitemap = await read('/sitemap.xml');
    if (sitemap.status !== 200) issue('/sitemap.xml', 'http', `Sitemap returned ${sitemap.status}.`);
    else {
      for (const match of sitemap.text.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/g)) {
        try {
          const url = new URL(match[1].replace(/&amp;/g, '&'));
          const localMirror = ['localhost', '127.0.0.1'].includes(base.hostname) && url.origin === 'https://qrupgrade.com';
          if ((url.origin !== base.origin && !localMirror) || url.search || url.hash) { issue('/sitemap.xml', 'unexpected-url', 'Sitemap contains an external URL or a query/fragment.'); continue; }
          listed.add(url.pathname);
        } catch { issue('/sitemap.xml', 'invalid-url', 'Sitemap contains an invalid URL.'); }
      }
      if (!listed.size) issue('/sitemap.xml', 'empty', 'No same-origin page URLs found; sitemap indexes need a separate review.');
    }
  } catch { issue('/sitemap.xml', 'unavailable', 'Sitemap could not be read within the time and size limits.'); }
  const paths = [...new Set([...requiredPaths, ...listed])];
  if (paths.length > 30) issue('/sitemap.xml', 'capped', 'Audit capped at 30 pages. Remaining URLs need a separate review.');
  const descriptions = new Map();
  for (const path of paths.slice(0, 30)) {
    try {
      const result = await read(path), signals = pageSignals(result.text);
      const page = { path, status: result.status, finalUrl: result.url, inSitemap: listed.has(path), ...signals };
      pages.push(page);
      if (result.status !== 200) { issue(path, 'http', `Page returned ${result.status}.`); continue; }
      if (listed.has(path) && result.redirects) issue(path, 'sitemap-redirect', 'Sitemap points to a redirect rather than a canonical page.');
      const noindex = /\b(noindex|none)\b/i.test(signals.robots + ' ' + result.headerRobots);
      if (listed.has(path) && noindex) issue(path, 'sitemap-noindex', 'Sitemap leads to a page that asks search engines not to index it.');
      if (noindex) continue;
      if (!signals.title) issue(path, 'missing-title', 'No page title found.');
      if (!signals.description) issue(path, 'missing-description', 'No description found.');
      if (!signals.canonical) issue(path, 'missing-canonical', 'No canonical URL found.');
      else {
        try {
          const canonical = new URL(signals.canonical, result.url);
          // Local builds intentionally declare their production canonical.
          if (canonical.pathname !== new URL(result.url).pathname || ![base.origin, 'https://qrupgrade.com'].includes(canonical.origin)) issue(path, 'canonical-mismatch', 'Canonical points to a different page or unexpected origin.');
        } catch { issue(path, 'invalid-canonical', 'Canonical URL could not be parsed.'); }
      }
      if (signals.description) {
        const previous = descriptions.get(signals.description);
        if (previous) issue(path, 'duplicate-description', `Description is shared with ${previous}.`);
        else descriptions.set(signals.description, path);
      }
    } catch { pages.push({ path, status: null, inSitemap: listed.has(path) }); issue(path, 'unavailable', 'Page could not be read within the time and size limits.'); }
  }
  // Any sitemap failure can hide pages from this run, so it cannot close old findings.
  return { checkedAt: new Date().toISOString(), origin: base.origin, complete: !issues.some(item => item.path === '/sitemap.xml' || item.code === 'unavailable'), pages, issues };
}
export function changes(previous, current) {
  const before = new Map((previous?.issues || []).map(issue => [issue.id, issue]));
  const after = new Map(current.issues.map(issue => [issue.id, issue]));
  return { added: [...after.values()].filter(issue => !before.has(issue.id)), resolved: current.complete ? [...before.values()].filter(issue => !after.has(issue.id)) : [], baseline: !previous };
}

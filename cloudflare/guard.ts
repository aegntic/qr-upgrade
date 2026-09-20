import { createHash } from 'node:crypto';
import { securityHeaders } from '../src/lib/security/headers';
import { validProviderIp, withWebEntry, type WebEnvironment } from './runtime';
export async function guardRequest(request: Request, env: WebEnvironment, next: (request: Request) => Promise<Response>): Promise<Response> {
  const url = new URL(request.url);
  const local = env.LOCAL_TEST_IDENTITY === 'local-development' && ['localhost', '127.0.0.1'].includes(url.hostname);
  const ip = local ? 'local-development' : validProviderIp(request.headers.get('cf-connecting-ip'));
  const error = (status: number, message: string) => Response.json({ error: message }, {
    status,
    headers: { ...Object.fromEntries(securityHeaders(!local).map(({key, value}) => [key, value])),
      'Cache-Control': 'private, no-store', 'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
      ...(status === 429 ? { 'Retry-After': '60' } : {}) },
  });
  // Decode path variants before classification; the exemption uses the original
  // exact pathname, so encoding, duplicate slashes and other methods are limited.
  let path: string;
  try { path = decodeURIComponent(url.pathname).replace(/\\/g, '/').replace(/\/+/g, '/'); }
  catch { return error(400, 'Invalid request.'); }
  const api = path.toLowerCase() === '/api' || path.toLowerCase().startsWith('/api/');
  if (api && !(request.method === 'POST' && url.pathname === '/api/billing/webhook')) {
    if (!ip) return error(503, 'Request could not be verified.');
    try {
      const key = createHash('sha256').update(`qr-api:${new Date().toISOString().slice(0,10)}:${ip}`).digest('hex');
      if (!env.API_RATE_LIMITER) throw new Error('Missing limiter');
      if (!(await env.API_RATE_LIMITER.limit({ key })).success) return error(429, 'Too many requests. Try again shortly.');
    } catch { return error(503, 'Request control is temporarily unavailable.'); }
  }
  const response = await withWebEntry(env, ip, () => next(request));
  if (!api) return response;
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'private, no-store');
  return new Response(response.body, {status: response.status, statusText: response.statusText, headers});
}

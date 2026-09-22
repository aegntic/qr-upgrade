import { AsyncLocalStorage } from 'node:async_hooks';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { isIP } from 'node:net';

export type ServiceBinding = { fetch: typeof fetch };
export type WebEnvironment = Record<string, unknown> & {
  QR_SERVICE?: ServiceBinding;
  API_RATE_LIMITER?: { limit(input: { key: string }): Promise<{ success: boolean }> };
  LOCAL_TEST_IDENTITY?: string;
};
type Entry = { env: WebEnvironment; ip: string | null };
// OpenNext bundles the application separately from the wrapper. The symbol shares
// one request-scoped store across those bundles, never a mutable global request.
const key = Symbol.for('qr-upgrade.web-entry.v1');
const shared = globalThis as typeof globalThis & { [key]?: AsyncLocalStorage<Entry> };
const context = shared[key] ??= new AsyncLocalStorage<Entry>();
export function withWebEntry<T>(env: WebEnvironment, ip: string | null, action: () => T): T {
  return context.run({ env, ip }, action);
}
export function webEnvironment(): WebEnvironment | undefined { const entry = context.getStore();
  if (entry) return entry.env;
  try { return getCloudflareContext().env as unknown as WebEnvironment; } catch { return undefined; } }
export function runtimeVariable(name: string): string | undefined {
  const entry = context.getStore();
  const value = entry ? entry.env[name] : webEnvironment()?.[name] ?? process.env[name];
  return typeof value === 'string' ? value : undefined;
}
export function validProviderIp(value: string | null): string | null {
  return value && value === value.trim() && isIP(value) ? value : null;
}
export function trustedRequestIp(request: Request, development: boolean): string | null {
  const entry = context.getStore();
  if (entry) return entry.ip;
  if (development) return 'local-development';
  // Rollback path only: Vercel sets its deployment marker and replaces this header.
  // Cloudflare requests always use the entry context, even if VERCEL is configured.
  return process.env.VERCEL === '1' ? validProviderIp(request.headers.get('x-vercel-forwarded-for')) : null;
}

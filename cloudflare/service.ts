// Server-only transport: never import this module from a client component.
import { webEnvironment } from './runtime';
export type ServiceConfig = { serviceUrl?: string; secret?: string };
export function serviceAvailable(config: ServiceConfig): boolean {
  return !!(config.secret && config.secret.length >= 32 && (webEnvironment()?.QR_SERVICE || config.serviceUrl));
}
export async function serviceFetch(config: ServiceConfig, path: string, init: RequestInit = {}, injectedFetch?: typeof fetch): Promise<Response> {
  if (!serviceAvailable(config) || !path.startsWith('/') || path.startsWith('//')) throw new Error('Service unavailable');
  const binding = injectedFetch ? undefined : webEnvironment()?.QR_SERVICE;
  const url = `${(config.serviceUrl || 'https://qr-service.internal').replace(/\/$/, '')}${path}`;
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${config.secret}`);
  const options = { ...init, headers, cache: 'no-store' as const };
  const fetcher = injectedFetch || (binding ? binding.fetch.bind(binding) : fetch);
  const signal = init.signal;
  signal?.throwIfAborted();
  // Binding fetch does not promise Node's cancellation behavior. Preserve the
  // caller's deadline and cancel a response arriving after the caller has left.
  if (!signal) return fetcher(url, options);
  let abort: () => void = () => {};
  const cancelled = new Promise<never>((_, reject) => {
    abort = () => reject(signal.reason);
    signal.addEventListener('abort', abort, { once: true });
  });
  try {
    const response = await Promise.race([fetcher(url, options).then(response => {
      if (signal.aborted) { void response.body?.cancel(); signal.throwIfAborted(); }
      return response;
    }), cancelled]);
    return streamWithDeadline(response, signal);
  } finally { signal.removeEventListener('abort', abort); }
}

function streamWithDeadline(response: Response, signal: AbortSignal): Response {
  if (!response.body) return response;
  const reader = response.body.getReader();
  let abort: () => void = () => {};
  const cleanup = () => signal.removeEventListener('abort', abort);
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      abort = () => { cleanup(); controller.error(signal.reason); void reader.cancel(signal.reason).catch(() => {}); };
      signal.addEventListener('abort', abort, { once: true });
      if (signal.aborted) abort();
    },
    async pull(controller) {
      try {
        const part = await reader.read();
        if (signal.aborted) return;
        if (part.done) { cleanup(); controller.close(); } else controller.enqueue(part.value);
      } catch (error) { cleanup(); if (!signal.aborted) controller.error(error); }
    },
    cancel(reason) { cleanup(); return reader.cancel(reason); },
  });
  return new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers });
}

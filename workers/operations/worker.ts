// No dependencies, request entry point, raw trace storage, logging, or customer database binding.
export type Producer = 'web' | 'service';
export type Component = 'web_probe' | 'service_probe' | 'web_runtime' | 'service_runtime';
type Signal = 'none' | 'probe_http' | 'probe_timeout' | 'probe_shape' | 'runtime_5xx' | 'runtime_fatal';
type Outcome = 'ok' | 'exception' | 'cpu' | 'memory' | 'script' | 'other';
type Route = 'html' | 'api' | 'billing_webhook' | 'published' | 'redirect' | 'static' | 'other' | 'health' | 'private_api' | 'public_content' | 'scheduled';
type Result<T> = { results: T[] };
export interface Statement {
 bind(...values: (string | number | null)[]): Statement;
 first<T>(): Promise<T | null>;
 all<T>(): Promise<Result<T>>;
 run(): Promise<unknown>;
}
export interface Database { prepare(sql: string): Statement; batch(statements: Statement[]): Promise<unknown> }
interface Email { send(message: { from: string; to: string; subject: string; text: string }): Promise<{ messageId?: string }> }
export interface Env {
 OPERATIONS_DB: Database;
 QR_SERVICE: { fetch(input: string, init: RequestInit): Promise<Response> };
 SERVICE_SECRET: string;
 ALERTS_ENABLED?: string;
 INCIDENT_EMAIL?: Email;
}
export interface State {
 component: Component; phase: 'healthy' | 'suspect' | 'open' | 'recovering';
 failure_streak: number; success_streak: number; incident_seq: number; last_signal: Signal;
 opened_at: number | null; updated_at: number; last_bucket: number; revision: number;
}
export interface Rollup { bucket: number; producer: Producer; route: Route; status: '5xx' | 'none'; outcome: Outcome; count: number }
const BUCKET = 300;
// Next 15 can stream metadata after the rendered page. Bound inspection independently of body size.
export const PUBLIC_BODY_LIMIT = 256 * 1024;
export const PUBLIC_MARKER = '<link rel="canonical" href="https://qrupgrade.com"/>';
export const PUBLIC_PAGE_MARKER = '<main id="main" class="foundation-page">';
const publicCanonical = /<link rel="canonical" href="https:\/\/qrupgrade\.com\/?"\/?>/;
// Enough overlap for either complete fixed marker, including the optional canonical URL slash.
const publicOverlap = Math.max(PUBLIC_MARKER.length + 1, PUBLIC_PAGE_MARKER.length) - 1;
const production = { web: 'qr-upgrade-web', service: 'qr-upgrade-service', publicUrl: 'https://qrupgrade.com/' } as const;
// Only createOperations({isolated: true, ...}) in an isolated local/deployed test entry point.
// The exported production Worker never reads endpoint/producer overrides from environment or requests.
export interface IsolatedConfiguration { isolated: true; web: string; service: string; publicUrl: string }
function record(value: unknown): Record<string, unknown> | undefined { return value !== null && typeof value === 'object' ? value as Record<string, unknown> : undefined; }
function classify(producer: Producer, raw: unknown): Route {
 if (raw === undefined) return producer === 'service' ? 'scheduled' : 'other';
 if (typeof raw !== 'string' || raw.length > 8192) return 'other';
 let path: string; try { path = new URL(raw).pathname; } catch { return 'other'; }
 // Match only fixed routes. Dynamic slugs, filenames, IDs and unknown paths are always other.
 if (producer === 'web') {
  if (['/','/generate','/editor','/account','/billing','/privacy','/terms'].includes(path)) return 'html';
  if (path === '/api/billing/webhook') return 'billing_webhook';
  if (['/api/art','/api/v1/scan','/api/status','/api/account','/api/billing'].includes(path)) return 'api';
  if (['/robots.txt','/sitemap.xml','/llms.txt','/favicon.ico'].includes(path)) return 'static';
 } else {
  if (path === '/health') return 'health';
  if (['/art','/cloud/designs','/account/session','/links','/content','/content-assets','/billing','/billing/events'].includes(path)) return 'private_api';
 }
 return 'other';
}
export function sanitize(items: unknown, now: number, config: Pick<IsolatedConfiguration, 'web' | 'service'> = production): Rollup[] {
 if (!Array.isArray(items) || !Number.isSafeInteger(now) || now < 0) return [];
 const grouped = new Map<string, Rollup>();
 for (let index = 0; index < Math.min(8, items.length); index++) {
  try {
   const item = record(items[index]); if (!item) continue;
   const name = item.scriptName;
   const producer = name === config.web ? 'web' : name === config.service ? 'service' : null;
   if (!producer) continue;
   const rawOutcome = item.outcome;
   const outcome: Outcome = rawOutcome === 'ok' ? 'ok' : rawOutcome === 'exception' ? 'exception' : rawOutcome === 'exceededCpu' ? 'cpu' : rawOutcome === 'exceededMemory' ? 'memory' : rawOutcome === 'scriptNotFound' ? 'script' : 'other';
   const event = record(item.event);
   const code = record(event?.response)?.status;
   const status = typeof code === 'number' && Number.isInteger(code) && code >= 500 && code <= 599 ? '5xx' : 'none';
   if (status === 'none' && (outcome === 'ok' || outcome === 'other')) continue;
   const route = classify(producer, record(event?.request)?.url);
   const key = `${producer}:${route}:${status}:${outcome}`;
   const row = grouped.get(key);
   if (row) row.count = Math.min(1000000, row.count + 1);
   else grouped.set(key, { bucket: Math.floor(now / BUCKET) * BUCKET, producer, route, status, outcome, count: 1 });
  } catch { /* Malformed synthetic inputs cannot make ignored fields observable. */ }
 }
 return [...grouped.values()];
}
export async function persistTail(db: Database, rows: Rollup[]): Promise<void> {
 if (!rows.length) return;
 try {
  await db.batch(rows.slice(0, 8).map(row => db.prepare(`INSERT INTO error_rollups VALUES(?,?,?,?,?,?)
   ON CONFLICT(bucket_start,producer,route_class,status_class,outcome_class)
   DO UPDATE SET occurrences=MIN(1000000,occurrences+excluded.occurrences)`)
   .bind(row.bucket,row.producer,row.route,row.status,row.outcome,row.count)));
 } catch { /* Best effort: no retry of an uncertain count write, no raw exception inspection. */ }
}
export function advance(old: State, bucket: number, now: number, signal: Signal, errors: number, probeHealthy: boolean): State {
 if (bucket <= old.last_bucket) return old;
 const next = { ...old, updated_at: now, last_bucket: bucket, revision: old.revision + 1, last_signal: signal };
 const runtime = old.component.endsWith('_runtime');
 const consecutive = old.last_bucket === bucket - BUCKET;
 const failed = runtime ? errors > 0 : signal !== 'none';
 next.failure_streak = failed ? Math.min(2, (consecutive ? old.failure_streak : 0) + 1) : 0;
 next.success_streak = !failed && probeHealthy ? Math.min(runtime ? 3 : 2, (consecutive ? old.success_streak : 0) + 1) : 0;
 const active = old.phase === 'open' || old.phase === 'recovering';
 if (!active) {
  if ((runtime && errors >= 5) || next.failure_streak >= 2) {
   next.phase = 'open'; next.incident_seq++; next.opened_at = now;
  } else next.phase = failed ? 'suspect' : 'healthy';
 } else if (next.success_streak >= (runtime ? 3 : 2)) next.phase = 'healthy';
 else next.phase = !failed && probeHealthy ? 'recovering' : 'open';
 return next;
}
export async function transition(db: Database, old: State, next: State): Promise<void> {
 if (next === old) return;
 // D1 batch is a real transaction; notification triggers are within the conditional UPDATE.
 await db.batch([db.prepare(`UPDATE monitor_state SET phase=?,failure_streak=?,success_streak=?,incident_seq=?,
  last_signal=?,opened_at=?,updated_at=?,last_bucket=?,revision=? WHERE component=? AND revision=? AND last_bucket<?`)
  .bind(next.phase,next.failure_streak,next.success_streak,next.incident_seq,next.last_signal,next.opened_at,next.updated_at,next.last_bucket,next.revision,next.component,old.revision,next.last_bucket)]);
}
function webHeaders(headers: Headers): boolean {
 const cache = headers.get('cache-control')?.split(',').map(value => value.trim().toLowerCase());
 const csp = headers.get('content-security-policy') || '';
 const directives = csp.split(';').map(value => value.trim());
 const required = ["default-src 'none'", "style-src 'self' 'unsafe-inline'", "img-src 'self' data: blob:",
  "font-src 'self'", "connect-src 'self'", "worker-src 'self' blob:", "object-src 'none'", "base-uri 'none'",
  "form-action 'self'", "frame-ancestors 'none'", 'upgrade-insecure-requests'];
 return !!cache?.includes('private') && cache.includes('no-store') && directives.length === required.length + 1 &&
  required.every(value => directives.includes(value)) &&
  directives.some(value => /^script-src 'self' 'nonce-[A-Za-z0-9+/=_-]{16,}' 'strict-dynamic'$/.test(value));
}
export async function probe(fetcher: (init: RequestInit) => Promise<Response>, web: boolean, timeout = 5000): Promise<Signal> {
 const controller = new AbortController(); let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
 let timer: ReturnType<typeof setTimeout> | undefined;
 const work = async (): Promise<Signal> => {
  const response = await fetcher({ method: 'GET', redirect: 'manual', cache: 'no-store', signal: controller.signal });
  if (controller.signal.aborted) { void response.body?.cancel().catch(() => {}); return 'probe_timeout'; }
  reader = response.body?.getReader();
  if (response.status !== 200) return 'probe_http';
  if (web && !webHeaders(response.headers)) return 'probe_shape';
  if (!reader) return 'probe_shape';
  const decoder = new TextDecoder(); let body = '', size = 0, overlap = '', pageFound = false, canonicalFound = false;
  const limit = web ? PUBLIC_BODY_LIMIT : 16384;
  while (true) {
   const chunk = await reader.read();
   if (chunk.done) break;
   const remaining = limit - size;
   if (!web && chunk.value.byteLength > remaining) return 'probe_shape';
   const prefix = chunk.value.subarray(0, remaining);
   size += prefix.byteLength;
   const decoded = decoder.decode(prefix, { stream: true });
   if (web) {
    const window = overlap + decoded;
    pageFound ||= window.includes(PUBLIC_PAGE_MARKER);
    canonicalFound ||= publicCanonical.test(window);
    if (pageFound && canonicalFound) return 'none';
    overlap = window.slice(-publicOverlap);
    if (size === limit) return 'probe_shape';
   } else body += decoded;
  }
  if (web) return 'probe_shape';
  // Flush any trailing partial UTF-8 sequence before strict whole-body validation.
  body += decoder.decode();
  // The service owns a fixed response; accept no extra fields/content.
  return body.trim() === '{"ready":true}' ? 'none' : 'probe_shape';
 };
 try {
  return await Promise.race([work(), new Promise<Signal>(resolve => {
   timer = setTimeout(() => { controller.abort(); resolve('probe_timeout'); }, timeout);
  })]);
 } catch { return controller.signal.aborted ? 'probe_timeout' : 'probe_http'; }
 finally { clearTimeout(timer); controller.abort(); void reader?.cancel().catch(() => {}); }
}
export async function retention(db: Database, now: number): Promise<void> {
 await db.batch([
  db.prepare(`DELETE FROM error_rollups WHERE (bucket_start,producer,route_class,status_class,outcome_class) IN
   (SELECT bucket_start,producer,route_class,status_class,outcome_class FROM error_rollups WHERE bucket_start<? ORDER BY bucket_start LIMIT 250)`)
   .bind(now-30*86400),
  db.prepare(`DELETE FROM notifications WHERE (component,incident_seq,kind) IN
   (SELECT component,incident_seq,kind FROM notifications WHERE state IN ('accepted','abandoned') AND terminal_at<?
    ORDER BY terminal_at LIMIT MAX(0,250-changes()))`).bind(now-90*86400),
 ]);
}
interface Notification { component: Component; incident_seq: number; kind: 'incident' | 'recovery'; attempts: number; transition_at: number }
export function message(row: Notification) {
 const time = new Date(Math.floor(row.transition_at/60)*60000).toISOString();
 return { from: 'monitor@alerts.qrupgrade.com', to: 'aegntic.dev@gmail.com',
  subject: `QR Upgrade ${row.kind} · ${row.component} · ${row.incident_seq}`,
  text: `Component: ${row.component}\nIncident: ${row.incident_seq}\n${row.kind === 'incident' ? 'Opened' : 'Recovered'}: ${time}\nConsult the QR Upgrade monitoring runbook. Inspect operational state and verify public availability. Escalate through the approved operator process.` };
}
export async function sendOne(env: Env, now: number, deadline = 5000): Promise<void> {
 const db = env.OPERATIONS_DB;
 // Sweep even with sending disabled. Superseded leases never become retryable work.
 await db.prepare(`UPDATE notifications SET state='abandoned',terminal_at=?,lease_until=NULL
  WHERE (state='leased' AND lease_until<=? AND (attempts>=3 OR incident_seq<(SELECT incident_seq FROM monitor_state WHERE component=notifications.component)))
   OR (state='pending' AND kind='recovery' AND NOT EXISTS(SELECT 1 FROM notifications i WHERE i.component=notifications.component AND i.incident_seq=notifications.incident_seq AND i.kind='incident' AND i.state IN ('pending','leased','accepted')))`)
  .bind(now,now).run();
 if (env.ALERTS_ENABLED !== 'true' || !env.INCIDENT_EMAIL) return;
 const row = await db.prepare(`UPDATE notifications SET state='leased',attempts=attempts+1,lease_until=?
  WHERE (component,incident_seq,kind)=(SELECT n.component,n.incident_seq,n.kind FROM notifications n
   WHERE ((n.state='pending' AND n.next_attempt_at<=?) OR (n.state='leased' AND n.lease_until<=?)) AND n.attempts<3
   AND n.incident_seq=(SELECT incident_seq FROM monitor_state WHERE component=n.component)
   AND NOT EXISTS(SELECT 1 FROM notifications busy WHERE busy.component=n.component AND busy.state='leased' AND busy.lease_until>?)
   AND (n.kind='incident' OR EXISTS(SELECT 1 FROM notifications i WHERE i.component=n.component AND i.incident_seq=n.incident_seq AND i.kind='incident' AND i.state='accepted'))
   ORDER BY transition_at,component,incident_seq,CASE kind WHEN 'incident' THEN 0 ELSE 1 END LIMIT 1)
  RETURNING component,incident_seq,kind,attempts,transition_at`).bind(now+60,now,now,now).first<Notification>();
 if (!row) return;
 let accepted = false; let timer: ReturnType<typeof setTimeout> | undefined;
 try {
  const receipt = await Promise.race([env.INCIDENT_EMAIL.send(message(row)), new Promise<null>(resolve => { timer=setTimeout(()=>resolve(null),deadline); })]);
  accepted = typeof receipt?.messageId === 'string' && receipt.messageId.length > 0;
 } catch { /* All unknown acknowledgements use the same bounded retry policy; no error inspection. */ }
 finally { clearTimeout(timer); }
 const state = accepted ? 'accepted' : row.attempts >= 3 ? 'abandoned' : 'pending';
 await db.prepare(`UPDATE notifications SET
  state=CASE WHEN ?='pending' AND incident_seq<(SELECT incident_seq FROM monitor_state WHERE component=notifications.component) THEN 'abandoned' ELSE ? END,
  next_attempt_at=?,lease_until=NULL,
  terminal_at=CASE WHEN ?='pending' AND incident_seq=(SELECT incident_seq FROM monitor_state WHERE component=notifications.component) THEN NULL ELSE ? END
  WHERE component=? AND incident_seq=? AND kind=? AND state='leased' AND attempts=? AND lease_until=?`)
  .bind(state,state,now+(row.attempts===1?300:900),state,now,row.component,row.incident_seq,row.kind,row.attempts,now+60).run();
}
export function createOperations(isolated?: IsolatedConfiguration, fetcher: typeof fetch = fetch) {
 if (isolated && (isolated.isolated !== true || isolated.web === isolated.service || [isolated.web,isolated.service].includes('qr-upgrade-operations') || new URL(isolated.publicUrl).protocol !== 'https:')) throw new Error('Invalid isolated configuration');
 const config = isolated || production;
 return {
  tail(items: unknown, env: Env, ctx: { waitUntil(work: Promise<unknown>): void }) {
   ctx.waitUntil(persistTail(env.OPERATIONS_DB, sanitize(items,Math.floor(Date.now()/1000),config)));
  },
  async scheduled(controller: { scheduledTime: number }, env: Env) {
   const now = Math.floor(controller.scheduledTime/1000), bucket = Math.floor(now/300)*300;
   if (!Number.isSafeInteger(now) || now < 300) return;
   try {
    if (!env.OPERATIONS_DB || !env.QR_SERVICE || typeof env.SERVICE_SECRET !== 'string' || env.SERVICE_SECRET.length < 32) return;
    const [web, service] = await Promise.all([
     probe(init => fetcher(config.publicUrl,init),true),
     probe(init => env.QR_SERVICE.fetch('https://qr-service.internal/health',{...init,headers:{authorization:`Bearer ${env.SERVICE_SECRET}`}}),false),
    ]);
    for (const producer of ['web','service'] as const) {
     const signal = producer === 'web' ? web : service;
     const old = await env.OPERATIONS_DB.prepare('SELECT * FROM monitor_state WHERE component=?').bind(`${producer}_probe`).first<State>();
     if (!old) throw new Error('Missing fixed state');
     await transition(env.OPERATIONS_DB,old,advance(old,bucket,now,signal,0,signal==='none'));
     let runtime = await env.OPERATIONS_DB.prepare('SELECT * FROM monitor_state WHERE component=?').bind(`${producer}_runtime`).first<State>();
     if (!runtime) throw new Error('Missing fixed state');
     // Fresh installation starts at the latest completed bucket. Gaps catch up in chronological bounded batches.
     const start = runtime.last_bucket < 0 ? bucket-300 : runtime.last_bucket+300;
     for (let cursor=start, n=0; cursor<bucket && n<12; cursor+=300,n++) {
      const count = await env.OPERATIONS_DB.prepare(`SELECT COALESCE(SUM(occurrences),0) AS errors,
       COALESCE(SUM(CASE WHEN outcome_class IN ('exception','cpu','memory','script') THEN occurrences ELSE 0 END),0) AS fatal
       FROM error_rollups WHERE producer=? AND bucket_start=?`).bind(producer,cursor).first<{errors:number;fatal:number}>();
      if (!count) throw new Error('Missing count');
      const next = advance(runtime,cursor,now,count.errors ? count.fatal ? 'runtime_fatal' : 'runtime_5xx' : 'none',count.errors,signal==='none');
      await transition(env.OPERATIONS_DB,runtime,next);
      // Re-read after CAS to follow the winner if scheduled invocations overlap.
      runtime = await env.OPERATIONS_DB.prepare('SELECT * FROM monitor_state WHERE component=?').bind(`${producer}_runtime`).first<State>();
      if (!runtime) throw new Error('Missing fixed state');
     }
    }
    await retention(env.OPERATIONS_DB,now);
    await sendOne(env,now);
   } catch { /* Sink outage aborts without sending outside durable state, logging or retry loops. */ }
  },
 };
}
export default createOperations();

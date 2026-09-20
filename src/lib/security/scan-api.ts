import { createHash, timingSafeEqual, randomUUID } from "node:crypto";
import { assessPrint, validatePrintInput } from "../score";
export type RateLimit = () => Promise<{ allowed: boolean; retryAfter: number }>;
export type AuditEvent = {
  event: "scan_api";
  requestId: string;
  status: number;
  durationMs: number;
};
type Options = {
  enabled: boolean;
  secret?: string;
  limit?: RateLimit;
  audit?: (event: AuditEvent) => void;
  bodyTimeoutMs?: number;
};
class InputError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
async function readBody(request: Request, timeoutMs: number) {
  const reader = request.body?.getReader();
  if (!reader) throw new InputError(400, "Body required.");
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new InputError(408, "Request timed out."));
      void reader.cancel().catch(() => {});
    }, timeoutMs);
  });
  try {
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const part = await Promise.race([reader.read(), deadline]);
      if (part.done) break;
      size += part.value.length;
      if (size > 4096) {
        void reader.cancel().catch(() => {});
        throw new InputError(413, "Request too large.");
      }
      chunks.push(part.value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const part of chunks) {
      bytes.set(part, offset);
      offset += part.length;
    }
    try {
      return JSON.parse(
        new TextDecoder("utf-8", { fatal: true }).decode(bytes),
      );
    } catch {
      throw new InputError(400, "Invalid JSON.");
    }
  } finally {
    clearTimeout(timer);
    reader.releaseLock();
  }
}
export function createScanHandler(options: Options) {
  return async function scan(request: Request): Promise<Response> {
    const started = Date.now(),
      requestId = randomUUID();
    const respond = (
      status: number,
      body: unknown,
      extra: Record<string, string> = {},
    ) => {
      // Do not log authorization, payload, URL query, client IP, or QR contents.
      options.audit?.({
        event: "scan_api",
        requestId,
        status,
        durationMs: Date.now() - started,
      });
      return Response.json(body, {
        status,
        headers: {
          "Cache-Control": "no-store",
          "X-Request-ID": requestId,
          ...extra,
        },
      });
    };
    if (!options.enabled) return respond(404, { error: "Not found." });
    if (!options.secret || options.secret.length < 32 || !options.limit)
      return respond(503, { error: "Service unavailable." });
    const auth = request.headers.get("authorization") || "";
    const candidate = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (
      !candidate ||
      candidate.length > 512 ||
      !timingSafeEqual(
        createHash("sha256").update(candidate).digest(),
        createHash("sha256").update(options.secret).digest(),
      )
    )
      return respond(
        401,
        { error: "Unauthorized." },
        { "WWW-Authenticate": "Bearer" },
      );
    try {
      const result = await options.limit();
      if (!result.allowed)
        return respond(
          429,
          { error: "Rate limit exceeded." },
          { "Retry-After": String(Math.max(1, Math.ceil(result.retryAfter))) },
        );
    } catch {
      return respond(
        503,
        { error: "Service unavailable." },
        { "Retry-After": "60" },
      );
    }
    if (
      request.headers
        .get("content-type")
        ?.split(";")[0]
        .trim()
        .toLowerCase() !== "application/json"
    )
      return respond(415, { error: "Use application/json." });
    const length = request.headers.get("content-length");
    if (length && (!/^\d+$/.test(length) || Number(length) > 4096))
      return respond(413, { error: "Request too large." });
    try {
      const raw = await readBody(request, options.bodyTimeoutMs ?? 3000);
      if (
        !raw ||
        Array.isArray(raw) ||
        typeof raw !== "object" ||
        Object.keys(raw).some(
          (k) =>
            ![
              "foreground",
              "background",
              "quietZone",
              "sizeMm",
              "distanceCm",
              "modules",
            ].includes(k),
        )
      )
        throw new InputError(
          400,
          "Provide only the documented print parameters.",
        );
      let input;
      try {
        input = validatePrintInput(raw);
      } catch {
        throw new InputError(400, "Invalid print parameters.");
      }
      return respond(200, {
        ...assessPrint(input),
        method: "print-checklist-v1",
        decoderTested: false,
        disclaimer:
          "Advisory checks only; not a scan probability or print guarantee.",
      });
    } catch (error) {
      return error instanceof InputError
        ? respond(error.status, { error: error.message })
        : respond(400, { error: "Invalid request." });
    }
  };
}
// One atomic fixed-window quota shared by all instances using the service credential.
// Unauthenticated traffic must also be limited by the deployment WAF.
export function redisRateLimit(
  url: string | undefined,
  token: string | undefined,
): RateLimit | undefined {
  if (!url || !token) return;
  let endpoint: URL;
  try {
    endpoint = new URL(url);
    if (
      endpoint.protocol !== "https:" ||
      endpoint.username ||
      endpoint.password ||
      endpoint.search ||
      endpoint.hash
    )
      return;
  } catch {
    return;
  }
  return async () => {
    const window = Math.floor(Date.now() / 60000);
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        "EVAL",
        "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],120) end; return n",
        "1",
        `qrupgrade:scan:${window}`,
      ]),
      signal: AbortSignal.timeout(2500),
      cache: "no-store",
      redirect: "error",
    });
    if (!response.ok) throw new Error("Limiter unavailable.");
    const data = (await response.json()) as {
      result?: unknown;
      error?: unknown;
    };
    if (
      data.error ||
      typeof data.result !== "number" ||
      !Number.isSafeInteger(data.result) ||
      data.result < 1
    )
      throw new Error("Limiter unavailable.");
    return {
      allowed: data.result <= 60,
      retryAfter: 60 - ((Date.now() / 1000) % 60),
    };
  };
}

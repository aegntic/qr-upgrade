import { runtimeVariable } from '../../../../../cloudflare/runtime';
import { createScanHandler, redisRateLimit } from "@/lib/security/scan-api";
export const runtime = "nodejs";
export function POST(request: Request) { return createScanHandler({
  enabled: runtimeVariable('SCAN_API_ENABLED') === "true",
  secret: runtimeVariable('SCAN_API_KEY'),
  limit: redisRateLimit(
    runtimeVariable('UPSTASH_REDIS_REST_URL'),
    runtimeVariable('UPSTASH_REDIS_REST_TOKEN'),
  ),
  audit: (event) => console.info(JSON.stringify(event)),
})(request); }

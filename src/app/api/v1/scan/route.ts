import { createScanHandler, redisRateLimit } from "@/lib/security/scan-api";
export const runtime = "nodejs";
export const POST = createScanHandler({
  enabled: process.env.SCAN_API_ENABLED === "true",
  secret: process.env.SCAN_API_KEY,
  limit: redisRateLimit(
    process.env.UPSTASH_REDIS_REST_URL,
    process.env.UPSTASH_REDIS_REST_TOKEN,
  ),
  audit: (event) => console.info(JSON.stringify(event)),
});

import { NextRequest, NextResponse } from "next/server";
import { contentSecurityPolicy } from "./lib/security/headers";
export function middleware(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const policy = contentSecurityPolicy(
    nonce,
    process.env.NODE_ENV === "production",
  );
  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", policy);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", policy);
  // A response with a per-request nonce must never be reused by a shared cache.
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
export const config = {
  matcher: [
    "/((?!api/|_next/static|_next/image|icon.svg|scenes/|robots.txt|sitemap.xml|llms.txt|llms-full.txt|opengraph-image).*)",
  ],
};

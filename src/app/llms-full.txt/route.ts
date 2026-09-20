import { fullFacts } from "@/lib/facts";
export const dynamic = "force-static";
export function GET() {
  return new Response(fullFacts, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

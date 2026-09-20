import { summary } from "@/lib/facts";
export const dynamic = "force-static";
export function GET() {
  return new Response(summary, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

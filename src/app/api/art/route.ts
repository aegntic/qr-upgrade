import { createArtHandler } from '@/lib/server/art-service';
import { runtimeVariable } from '../../../../cloudflare/runtime';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
function handler(request:Request) {
 return createArtHandler({url:runtimeVariable('QR_SERVICE_URL'),secret:runtimeVariable('QR_SERVICE_SECRET'),production:process.env.NODE_ENV==='production'})(request);
}
export const GET=handler;
export const POST=handler;

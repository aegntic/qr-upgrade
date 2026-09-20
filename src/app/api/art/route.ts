import { createArtHandler } from '@/lib/server/art-service';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const handler = createArtHandler({ url:process.env.QR_SERVICE_URL,secret:process.env.QR_SERVICE_SECRET,production:process.env.NODE_ENV==='production',previewHost:process.env.VERCEL_URL });
export const GET=handler;
export const POST=handler;

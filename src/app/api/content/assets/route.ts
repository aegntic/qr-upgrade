import {assetProxy} from '@/lib/server/content';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(r:Request){return assetProxy(r);}
export async function POST(r:Request){return assetProxy(r);}

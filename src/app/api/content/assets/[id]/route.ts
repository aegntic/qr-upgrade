import {assetProxy} from '@/lib/server/content';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(r:Request,c:{params:Promise<{id:string}>}){return assetProxy(r,(await c.params).id);}

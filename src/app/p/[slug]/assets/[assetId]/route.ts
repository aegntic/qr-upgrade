import {publicContentAsset} from '@/lib/server/content';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(r:Request,c:{params:Promise<{slug:string;assetId:string}>}){const p=await c.params;return publicContentAsset(r,p.slug,p.assetId);}

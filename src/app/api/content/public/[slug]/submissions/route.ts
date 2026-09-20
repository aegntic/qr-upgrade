import {publicSubmission} from '@/lib/server/content';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(r:Request,c:{params:Promise<{slug:string}>}){return publicSubmission(r,(await c.params).slug);}

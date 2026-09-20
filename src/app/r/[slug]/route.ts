import {linkRedirect} from '@/lib/server/links';
export const runtime='nodejs';
export const dynamic='force-dynamic';
type Context={params:Promise<{slug:string}>};
export async function GET(r:Request,c:Context){return linkRedirect(r,(await c.params).slug);}
export async function HEAD(r:Request,c:Context){return linkRedirect(r,(await c.params).slug);}

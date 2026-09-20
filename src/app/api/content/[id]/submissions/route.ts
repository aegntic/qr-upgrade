import {contentProxy} from '@/lib/server/content';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(r:Request,c:{params:Promise<{id:string}>}){return contentProxy(r,(await c.params).id,undefined,true);}

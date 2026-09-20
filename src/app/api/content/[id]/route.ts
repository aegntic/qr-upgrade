import {contentProxy} from '@/lib/server/content';
export const runtime='nodejs';
export const dynamic='force-dynamic';
type Context={params:Promise<{id:string}>};
export async function GET(r:Request,c:Context){return contentProxy(r,(await c.params).id);}
export async function PUT(r:Request,c:Context){return contentProxy(r,(await c.params).id);}
export async function PATCH(r:Request,c:Context){return contentProxy(r,(await c.params).id);}

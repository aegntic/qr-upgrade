import { cloudProxy } from '@/lib/server/account';
export const runtime='nodejs';
type Context={params:Promise<{id:string}>};
export async function GET(request:Request,context:Context) {return cloudProxy(request,(await context.params).id);}
export const PUT=GET;
export const PATCH=GET;

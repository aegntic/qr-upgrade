import { cloudProxy } from '@/lib/server/account';
export const runtime='nodejs';
export async function GET(request:Request) {return cloudProxy(request);}
export async function POST(request:Request) {return cloudProxy(request);}

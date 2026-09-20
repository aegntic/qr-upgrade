import { accountStatus } from '@/lib/server/account';
export const runtime='nodejs';
export async function GET(request:Request) {return accountStatus(request);}

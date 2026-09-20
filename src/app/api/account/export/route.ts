import {accountExport} from '@/lib/server/account-export';
export const runtime='nodejs';
export async function POST(request:Request){return accountExport(request);}

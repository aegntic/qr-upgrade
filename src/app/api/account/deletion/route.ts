import {closeAccount,deletionStatus} from '@/lib/server/account-deletion';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:Request){return deletionStatus(request);}
export async function POST(request:Request){return closeAccount(request);}

import {beginDeletion} from '@/lib/server/account-deletion';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(request:Request){return beginDeletion(request);}

import { accountReply, configured, getAccount } from '@/lib/server/account';
export const runtime='nodejs';
export async function GET(request:Request) {const user=await getAccount(request);return accountReply({configured:configured(),signedIn:!!user,user:user?{name:user.name,email:user.email}:null});}

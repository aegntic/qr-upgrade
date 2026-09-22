import {accountExport} from '@/lib/server/account-export';
import {accountReply} from '@/lib/server/account';
export const runtime='nodejs';
export async function GET(request:Request,{params}:{params:Promise<{kind:string;id:string}>}){
 const {kind,id}=await params;
 if(kind!=='design'&&kind!=='asset')return accountReply({error:'Invalid export file kind.'},400);
 return accountExport(request,{kind,id});
}

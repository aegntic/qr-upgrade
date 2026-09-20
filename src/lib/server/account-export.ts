import {accountConfig,accountSameOrigin,accountReply,accountUnavailable,currentSession,type AccountConfig,type AccountDeps} from './account';
import {readAccountBody} from '../../../workers/qr-service/account.mjs';
import {EXPORT_PAGE_BYTES,EXPORT_FILE_LIMITS,EXPORT_UUID,exportFileHeaders,readExportBytes,validateExportInput} from '../../../workers/qr-service/account-export.mjs';

type FileRequest={kind:'design'|'asset';id:string};
const signedOut=()=>accountReply({error:'Sign in again to download your account data.'},401);
const invalid=()=>accountReply({error:'Invalid export request.'},400);
export async function accountExport(request:Request,file?:FileRequest,config:AccountConfig=accountConfig(),deps:AccountDeps={}){
 if(request.method!==(file?'GET':'POST'))return accountReply({error:'Method not allowed.'},405);
 if([...request.headers.keys()].some(name=>name.startsWith('x-qr-'))||new URL(request.url).search)return invalid();
 if(file){
  if(!['design','asset'].includes(file.kind)||!EXPORT_UUID.test(file.id))return invalid();
  if(request.headers.get('sec-fetch-site')==='cross-site')return accountReply({error:'Open your account to download this file.'},403);
 }else if(!accountSameOrigin(request,config))return accountReply({error:'Open your account to export data.'},403);
 let input:ReturnType<typeof validateExportInput>|undefined;
 if(!file)try{input=validateExportInput(await readAccountBody(request));}catch{return invalid();}
 try{
  const session=await currentSession(request,config,deps);if(!session)return signedOut();
  const path=file?`/account/export/files/${file.kind}/${file.id}`:'/account/export';
  const upstream=await(deps.fetch||fetch)(`${config.serviceUrl!.replace(/\/$/,'')}${path}`,{
   method:request.method,headers:{Authorization:`Bearer ${config.secret}`,'x-qr-user':session.id,'x-qr-session-version':String(session.version),'Content-Type':'application/json'},
   body:file?undefined:JSON.stringify(input),cache:'no-store',signal:AbortSignal.timeout(15000)
  });
  // A service bearer rejection or malformed denial must never masquerade as browser sign-out.
  if(upstream.status===401||upstream.status>=500)return accountUnavailable();
  if(!upstream.ok){
   const bytes=await readExportBytes(upstream.body,4096),body=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
   if(upstream.status===409&&body&&typeof body==='object'&&!Array.isArray(body)&&Object.keys(body).length===2&&body.code==='account_session_invalid'&&body.owner===session.id)return signedOut();
   if(upstream.status===409&&(!file||!body||typeof body!=='object'||Object.keys(body).length!==1||body.error!=='This file is pending and is not available to download.'))return accountUnavailable();
   if(upstream.status===400)return invalid();
   if(upstream.status===413)return accountReply({error:file?'The stored file exceeds its size limit. This file was not downloaded.':'A record exceeds the 1 MiB export part limit. This section was not completed.'},413);
   if(file&&[404,409,422].includes(upstream.status))return accountReply({error:upstream.status===404?'The file was not found in your account or its stored object is missing.':upstream.status===409?'The file is pending and unavailable.':'The stored file is oversized, incomplete or invalid. This file was not downloaded.'},upstream.status);
   return accountUnavailable();
  }
  if(file){
   const bytes=await readExportBytes(upstream.body,EXPORT_FILE_LIMITS[file.kind]);
   if(!bytes.byteLength)throw new Error('Empty file');
   return new Response(bytes,{headers:exportFileHeaders(file.kind,file.id,bytes.byteLength)});
  }
  const bytes=await readExportBytes(upstream.body,EXPORT_PAGE_BYTES),page=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
  if(page.section!==input!.section||!Array.isArray(page.records)||page.records.length>25||typeof page.complete!=='boolean'||(page.complete? page.nextCursor!==null:typeof page.nextCursor!=='string')||typeof page.generatedAt!=='string')throw new Error('Invalid export response');
  if(input!.section==='profile'){page.records=[{name:session.name,email:session.email}];page.counts={records:1};}
  const output=JSON.stringify(page);if(new TextEncoder().encode(output).byteLength>EXPORT_PAGE_BYTES)throw new Error('Export too large');
  return new Response(output,{headers:{'Content-Type':'application/json','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Disposition':`attachment; filename="qrupgrade-${input!.section}.json"`,'Referrer-Policy':'no-referrer'}});
 }catch{return accountUnavailable();}
}

import {readAccountBody,recordSecurityEvent,SECURITY_HISTORY_DAYS} from './account.mjs';
import {validateSnapshot} from './cloud.mjs';
import {validateDraft} from './content.mjs';

export const EXPORT_PAGE_ROWS=25;
export const EXPORT_PAGE_BYTES=1024*1024;
export const EXPORT_FILE_LIMITS={design:3*1024*1024,asset:2*1024*1024};
export const EXPORT_UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const safeHeaders={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"sandbox; default-src 'none'"};
const reply=(body,status=200)=>Response.json(body,{status,headers:safeHeaders});
const encoder=new TextEncoder();
const idKey=value=>typeof value==='string'&&EXPORT_UUID.test(value);
const providerKey=value=>typeof value==='string'&&/^[A-Za-z0-9_]{1,255}$/.test(value);
// Every query is a fixed projection. Child data is restricted through an owned parent in SQL.
const sections={
 profile:null,
 designs:{select:'d.id,d.name,d.archived,d.ready,d.created_at,d.updated_at',from:'cloud_designs d',owner:'d.owner',keys:['d.id'],valid:[idKey]},
 links:{select:'d.id,d.slug,d.name,d.target,d.status,d.archived,d.created_at,d.updated_at',from:'dynamic_links d',owner:'d.owner',keys:['d.id'],valid:[idKey]},
 scans:{select:'d.slug,d.day,d.count',from:'link_daily_counts d JOIN dynamic_links p ON p.slug=d.slug',owner:'p.owner',keys:['d.slug','d.day'],valid:[value=>typeof value==='string'&&/^[A-Za-z0-9_-]{16}$/.test(value),value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&new Date(value).toISOString().slice(0,10)===value]},
 pages:{select:'d.id,d.slug,d.draft,d.published,d.status,d.archived,d.created_at,d.updated_at',from:'content_pages d',owner:'d.owner',keys:['d.id'],valid:[idKey]},
 assets:{select:'d.id,d.name,d.mime,d.size,d.ready,d.created_at',from:'content_assets d',owner:'d.owner',keys:['d.id'],valid:[idKey]},
 feedback:{select:'d.id,d.page_id,d.name,d.email,d.message,d.created_at',from:'content_submissions d JOIN content_pages p ON p.id=d.page_id',owner:'p.owner',keys:['d.id'],valid:[idKey]},
 billing_customer:{select:'d.customer_id,d.mode',from:'billing_customers d',owner:'d.owner',keys:['d.customer_id'],valid:[providerKey]},
 billing_events:{select:'d.id,d.type,d.created,d.customer_id,d.subscription_id,d.mode',from:'billing_events d JOIN billing_customers p ON p.customer_id=d.customer_id',owner:'p.owner',keys:['d.id'],valid:[providerKey]},
 security:{select:'d.id,d.type,d.created_at',from:'account_security_events d',owner:'d.owner',keys:['d.created_at','d.id'],valid:[value=>Number.isSafeInteger(value)&&value>=0,idKey]}
};
export const EXPORT_SECTIONS=Object.keys(sections);
export function validateExportInput(body){
 if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(key=>!['section','cursor'].includes(key))||typeof body.section!=='string'||!Object.hasOwn(sections,body.section))throw new Error('Invalid section.');
 if(body.cursor!==undefined&&body.cursor!==null&&(typeof body.cursor!=='string'||body.cursor.length>800||! /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/.test(body.cursor)))throw new Error('Invalid cursor.');
 if(body.section==='profile'&&body.cursor!=null)throw new Error('Invalid cursor.');
 return {section:body.section,cursor:body.cursor??null};
}
const encode=bytes=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const decode=value=>Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')),char=>char.charCodeAt(0));
async function cursorKey(env){return crypto.subtle.importKey('raw',encoder.encode(env.SERVICE_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);}
async function nextCursor(env,owner,section,keys){
 const payload=encode(encoder.encode(JSON.stringify({section,keys})));
 const signature=await crypto.subtle.sign('HMAC',await cursorKey(env),encoder.encode(`account-export:v1:${owner}:${payload}`));
 return `${payload}.${encode(new Uint8Array(signature))}`;
}
async function cursorKeys(env,owner,section,cursor){
 if(cursor===null)return null;
 const [payload,signature]=cursor.split('.');
 if(encode(decode(payload))!==payload||encode(decode(signature))!==signature)throw new Error('Invalid cursor.');
 if(!await crypto.subtle.verify('HMAC',await cursorKey(env),decode(signature),encoder.encode(`account-export:v1:${owner}:${payload}`)))throw new Error('Invalid cursor.');
 const parsed=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(decode(payload))),spec=sections[section];
 if(!parsed||typeof parsed!=='object'||Array.isArray(parsed)||Object.keys(parsed).length!==2||parsed.section!==section||!spec||!Array.isArray(parsed.keys)||parsed.keys.length!==spec.keys.length||!spec.valid.every((valid,index)=>valid(parsed.keys[index])))throw new Error('Invalid cursor.');
 return parsed.keys;
}
function fileManifest(row,kind){
 return {status:row.ready===1?'ready_to_request':'unavailable_pending',download:row.ready===1?`/api/account/export/files/${kind}/${row.id}`:null};
}
function exportRow(row,section){
 if(section==='designs'||section==='assets')return {...row,file:fileManifest(row,section==='designs'?'design':'asset')};
 if(section==='pages')return {...row,draft:validateDraft(JSON.parse(row.draft)),published:row.published===null?null:validateDraft(JSON.parse(row.published))};
 return row;
}
function pageEnvelope(section,records,cursor,generatedAt){return {formatVersion:1,section,generatedAt,records,counts:{records:records.length},nextCursor:cursor,complete:cursor===null,consistency:'Live pages; changes during export may be missed or appear in different parts. This is not a transactional snapshot.'};}
async function preparePage(env,owner,input){
 const {section,cursor}=input,spec=sections[section];
 let keys;try{keys=await cursorKeys(env,owner,section,cursor);}catch{throw new Error('Invalid cursor.');}
 const generatedAt=new Date().toISOString();
 if(!spec)return pageEnvelope(section,[],null,generatedAt);
 const params=[owner];let where=`${spec.owner}=?`;
 if(section==='security'){where+=' AND d.created_at>=?';params.push(Date.now()-SECURITY_HISTORY_DAYS*86400000);}
 if(keys){where+=` AND (${spec.keys.join(',')}) > (${spec.keys.map(()=>'?').join(',')})`;params.push(...keys);}
 // One lookahead row tells the caller whether another part exists. No plan cap or OFFSET.
 const data=await env.DB.prepare(`SELECT ${spec.select} FROM ${spec.from} WHERE ${where} ORDER BY ${spec.keys.join(',')} LIMIT ?`).bind(...params,EXPORT_PAGE_ROWS+1).all();
 const records=[];let page=pageEnvelope(section,records,null,generatedAt);
 for(let i=0;i<Math.min(data.results.length,EXPORT_PAGE_ROWS);i++){
  const row=data.results[i],values=spec.keys.map(key=>row[key.split('.')[1]]);
  if(!spec.valid.every((valid,index)=>valid(values[index])))throw new Error('Invalid stored key');
  const record=exportRow(row,section);
  const next=i+1<data.results.length?await nextCursor(env,owner,section,values):null;
  const candidate=pageEnvelope(section,[...records,record],next,generatedAt);
  if(encoder.encode(JSON.stringify(candidate)).byteLength>EXPORT_PAGE_BYTES){
   if(!records.length)return reply({error:'A record exceeds the 1 MiB export part limit. This section was not completed.',code:'export_record_too_large'},413);
   break; // Previous page already holds a cursor after its last included row.
  }
  records.push(record);page=candidate;
 }
 return page;
}
// Read actual bytes, with both a total byte bound and deadline; never trust a Content-Length alone.
export async function readExportBytes(stream,limit){
 const reader=stream?.getReader();if(!reader)throw new Error('Missing body');
 const chunks=[];let size=0,timer;
 const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>{reject(new Error('Read timed out'));void reader.cancel().catch(()=>{});},10000);});
 try{
  while(true){const part=await Promise.race([reader.read(),timeout]);if(part.done)break;size+=part.value.byteLength;if(size>limit){void reader.cancel().catch(()=>{});throw new Error('Byte limit exceeded');}chunks.push(part.value);}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}return bytes;
 }finally{clearTimeout(timer);reader.releaseLock();}
}
export function exportFileHeaders(kind,id,size){return {...safeHeaders,'Content-Type':kind==='design'?'application/json':'application/octet-stream','Content-Length':String(size),'Content-Disposition':`attachment; filename="qrupgrade-${kind}-${id}.${kind==='design'?'json':'bin'}"`};}
async function prepareFile(env,owner,kind,id){
 const table=kind==='design'?'cloud_designs':'content_assets';
 const row=await env.DB.prepare(`SELECT ready,r2key FROM ${table} WHERE owner=? AND id=?`).bind(owner,id).first();
 if(!row)return reply({error:'This file is not in your account.'},404);
 if(row.ready!==1)return reply({error:'This file is pending and is not available to download.'},409);
 const object=await env.ASSETS.get(row.r2key);
 if(!object)return reply({error:'The stored file is missing. This file was not downloaded.'},404);
 const limit=EXPORT_FILE_LIMITS[kind];
 if(!Number.isSafeInteger(object.size)||object.size<1||object.size>limit){await object.body?.cancel();return reply({error:'The stored file exceeds its size limit or is invalid. This file was not downloaded.'},413);}
 let bytes;
 try{
  bytes=await readExportBytes(object.body,limit);
  if(bytes.byteLength!==object.size||!bytes.byteLength)throw new Error('Invalid size');
  if(kind==='design'){
   // Reapply the storage allowlist, so malformed private objects never become arbitrary JSON exports.
   bytes=encoder.encode(JSON.stringify(validateSnapshot(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)))));
   if(bytes.byteLength>limit)throw new Error('Byte limit exceeded');
  }
 }catch{return reply({error:'The stored file is oversized, incomplete or invalid. This file was not downloaded.'},422);}
 return new Response(bytes,{headers:exportFileHeaders(kind,id,bytes.byteLength)});
}
export async function accountExportRequest(request,env){
 // The production dispatcher authenticates SERVICE_SECRET before calling this handler.
 const owner=request.headers.get('x-qr-user'),versionText=request.headers.get('x-qr-session-version');
 if(!/^[a-f0-9]{64}$/.test(owner||'')||! /^[1-9][0-9]{0,15}$/.test(versionText||'')||!Number.isSafeInteger(Number(versionText)))return reply({error:'Invalid account request.'},400);
 const url=new URL(request.url);
 if(url.search)return reply({error:'Query parameters are not supported.'},400);
 const file=url.pathname.match(/^\/account\/export\/files\/(design|asset)\/([^/]+)$/);
 if(file&&!EXPORT_UUID.test(file[2]))return reply({error:'Invalid file.'},400);
 if(!(url.pathname==='/account/export'&&request.method==='POST')&&!(file&&request.method==='GET'))return reply({error:'Not found.'},404);
 let input;
 if(!file)try{input=validateExportInput(await readAccountBody(request));}catch{return reply({error:'Choose a supported export section and cursor.'},400);}
 const current=await env.DB.prepare('SELECT owner FROM account_security WHERE owner=? AND session_version=?').bind(owner,Number(versionText)).first();
 if(!current)return reply({code:'account_session_invalid',owner},409);
 if(file)return prepareFile(env,owner,file[1],file[2]);
 let page;
 try{page=await preparePage(env,owner,input);}catch(error){if(error.message==='Invalid cursor.')return reply({error:'Invalid export cursor. Restart this section.'},400);throw error;}
 if(page instanceof Response)return page;
 // Only a prepared page creates the fixed event. No generic browser event endpoint.
 await recordSecurityEvent(env,owner,'data_export');
 return reply(page);
}

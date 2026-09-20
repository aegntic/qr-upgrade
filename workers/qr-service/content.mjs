import {validateTarget} from './links.mjs';
import {limitsForPlan} from '../../shared/plan-limits.mjs';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const SLUG=/^[A-Za-z0-9_-]{16}$/;
const safeHeaders={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"sandbox; default-src 'none'"};
const reply=(v,status=200)=>Response.json(v,{status,headers:safeHeaders});
const fail=(message='Content is temporarily unavailable.',status=503)=>reply({error:message},status);
const ownerOf=r=>/^[a-f0-9]{64}$/.test(r.headers.get('x-qr-user')||'')?r.headers.get('x-qr-user'):null;
export async function readContentBody(r,limit=32768){
 if(r.headers.get('content-type')?.split(';')[0].trim()!=='application/json')throw new Error('Use JSON.');
 const reader=r.body?.getReader();if(!reader)throw new Error('Missing details.');let timer,length=0;const chunks=[];
 const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>{reject(new Error('Request timed out.'));void reader.cancel();},5000);});
 try{while(true){const p=await Promise.race([reader.read(),timeout]);if(p.done)break;length+=p.value.length;if(length>limit){void reader.cancel();throw new Error('Request is too large.');}chunks.push(p.value);}const bytes=new Uint8Array(length);let i=0;for(const part of chunks){bytes.set(part,i);i+=part.length;}return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}finally{clearTimeout(timer);reader.releaseLock();}
}
function exact(v,keys){if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).length!==keys.length||keys.some(k=>!Object.hasOwn(v,k)))throw new Error('Use the supported content fields.');}
function string(v,max,min=0){if(typeof v!=='string'||v.length>max||v.trim().length<min||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v))throw new Error('Check the text length and characters.');}
function reference(v){if(v!==''&&!UUID.test(v))throw new Error('Choose a valid uploaded file.');}
export function validateDraft(v,publish=false){
 exact(v,['kind','title','description','accent','items','fileId','formMessage']);if(!['links','menu','gallery','document','form'].includes(v.kind))throw new Error('Choose a supported page type.');
 string(v.title,80,1);string(v.description,1000);string(v.formMessage,300);if(typeof v.accent!=='string'||!/^#[a-fA-F0-9]{6}$/.test(v.accent))throw new Error('Choose a six-digit hex color.');string(v.fileId,36);reference(v.fileId);
 if(!Array.isArray(v.items)||v.items.length>12)throw new Error('Use up to 12 items.');
 for(const item of v.items){exact(item,['title','description','price','url','assetId']);string(item.title,80,1);string(item.description,300);string(item.price,30);string(item.url,2048);string(item.assetId,36);reference(item.assetId);if(item.url)validateTarget(item.url);if(publish&&v.kind==='links'&&!item.url)throw new Error('Each link needs a destination.');if(publish&&v.kind==='gallery'&&!item.assetId)throw new Error('Each gallery item needs an image.');}
 if(publish&&['links','gallery'].includes(v.kind)&&!v.items.length)throw new Error('Add at least one item before publishing.');if(publish&&v.kind==='document'&&!v.fileId)throw new Error('Upload a PDF before publishing.');
 return v;
}
const refs=v=>[...new Set([v.fileId,...v.items.map(i=>i.assetId)].filter(Boolean))];
async function validateAssets(env,owner,v){for(const id of refs(v)){const asset=await env.DB.prepare('SELECT mime FROM content_assets WHERE id=? AND owner=? AND ready=1').bind(id,owner).first();if(!asset)throw new Error('Choose a ready file from your own library.');if(id===v.fileId&&asset.mime!=='application/pdf'||v.kind==='gallery'&&v.items.some(i=>i.assetId===id)&&!asset.mime.startsWith('image/'))throw new Error('Choose the correct file type for this page.');}}
const page=row=>({id:row.id,slug:row.slug,url:`https://qrupgrade.com/p/${row.slug}`,draft:JSON.parse(row.draft),status:row.status,archived:!!row.archived,hasUnpublishedChanges:row.draft!==row.published,createdAt:row.created_at,updatedAt:row.updated_at});
export async function contentRequest(r,env){
 const owner=ownerOf(r);if(!owner)return fail('Sign in to manage pages.',401);const m=new URL(r.url).pathname.match(/^\/content(?:\/([^/]+)(\/submissions)?)?$/),id=m?.[1],sub=!!m?.[2];if(!m||id&&!UUID.test(id))return fail('Page not found.',404);
 const tier=r.headers.get('x-qr-plan'),limits=limitsForPlan(tier??'free');if(!limits)return fail('Invalid plan.',400);
 if(!['GET','POST','PUT','PATCH'].includes(r.method)||sub&&r.method!=='GET'||id&&r.method==='POST'||!id&&['PUT','PATCH'].includes(r.method))return fail('Method not allowed.',405);
 let input;if(r.method!=='GET')try{input=await readContentBody(r);if(r.method==='PATCH'){exact(input,['action']);if(!['publish','pause','archive','restore'].includes(input.action))throw new Error('Choose a valid action.');}else validateDraft(input);}catch(e){return fail(e instanceof SyntaxError?'Use valid JSON.':e.message,400);}
 try{
  if(r.method==='GET'&&!id){const rows=await env.DB.prepare('SELECT * FROM content_pages WHERE owner=? ORDER BY updated_at DESC').bind(owner).all();return reply({pages:rows.results.map(page),...(tier?{limit:limits.hostedPages}:{})});}
  if(r.method==='POST'){
   try{await validateAssets(env,owner,input);}catch(e){if(e.message.startsWith('Choose'))return fail(e.message,400);throw e;}
   const now=new Date().toISOString(),slug=btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(12)))).replace(/\+/g,'-').replace(/\//g,'_');
   const row=await env.DB.prepare("INSERT INTO content_pages(id,owner,slug,draft,created_at,updated_at) SELECT ?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM content_pages WHERE owner=?)<? RETURNING *").bind(crypto.randomUUID(),owner,slug,JSON.stringify(input),now,now,owner,limits.hostedPages).first();return row?reply({page:page(row)},201):fail(`Your account holds up to ${limits.hostedPages} pages, including archived pages.`,409);
  }
  const current=await env.DB.prepare('SELECT * FROM content_pages WHERE id=? AND owner=?').bind(id,owner).first();if(!current)return fail('Page not found.',404);
  if(sub){const results=await env.DB.batch([env.DB.prepare('SELECT s.id,s.name,s.email,s.message,s.created_at AS createdAt FROM content_submissions s JOIN content_pages p ON p.id=s.page_id WHERE p.id=? AND p.owner=? ORDER BY s.created_at DESC,s.id DESC LIMIT 100').bind(id,owner),env.DB.prepare('SELECT COUNT(*) AS total FROM content_submissions s JOIN content_pages p ON p.id=s.page_id WHERE p.id=? AND p.owner=?').bind(id,owner)]);return reply({submissions:results[0].results,total:results[1].results[0].total});}
  if(r.method==='GET')return reply({page:page(current)});
  let row;const now=new Date().toISOString();
  if(r.method==='PUT'){try{await validateAssets(env,owner,input);}catch(e){if(e.message.startsWith('Choose'))return fail(e.message,400);throw e;}row=await env.DB.prepare('UPDATE content_pages SET draft=?,updated_at=? WHERE id=? AND owner=? RETURNING *').bind(JSON.stringify(input),now,id,owner).first();}
  else if(input.action==='publish'){
   let draft;try{draft=validateDraft(JSON.parse(current.draft),true);}catch(e){return fail(e.message.startsWith('Choose')||e.message.startsWith('Each')||e.message.startsWith('Upload')||e.message.startsWith('Add')?e.message:'Check the page before publishing.',400);}try{await validateAssets(env,owner,draft);}catch(e){if(e.message.startsWith('Choose'))return fail(e.message,400);throw e;}
   row=await env.DB.prepare("UPDATE content_pages SET published=draft,status='published',updated_at=? WHERE id=? AND owner=? AND draft=? AND archived=0 RETURNING *").bind(now,id,owner,current.draft).first();if(!row)return fail('The page changed or is archived. Reopen it before publishing.',409);
  }else{const field=input.action==='pause'?"status='paused'":`archived=${input.action==='archive'?1:0}`;row=await env.DB.prepare(`UPDATE content_pages SET ${field},updated_at=? WHERE id=? AND owner=? RETURNING *`).bind(now,id,owner).first();}
  return row?reply({page:page(row)}):fail('Page not found.',404);
 }catch{return fail();}
}
function dimensions(bytes,mime){
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),ascii=(a,b)=>String.fromCharCode(...bytes.slice(a,b));
 if(mime==='image/png'){if(bytes.length<33||ascii(1,4)!=='PNG'||bytes[0]!==137||ascii(4,8)!=='\r\n\x1a\n'||ascii(12,16)!=='IHDR')throw new Error();return [view.getUint32(16),view.getUint32(20)];}
 if(mime==='image/jpeg'){if(bytes[0]!==255||bytes[1]!==216||bytes.at(-2)!==255||bytes.at(-1)!==217)throw new Error();let i=2;while(i+4<bytes.length){if(bytes[i++]!==255)throw new Error();while(bytes[i]===255)i++;const marker=bytes[i++];if(marker===217||marker===218)break;const length=view.getUint16(i);if(length<2||i+length>bytes.length)throw new Error();if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)){if(length<8)throw new Error();return [view.getUint16(i+5),view.getUint16(i+3)];}i+=length;}throw new Error();}
 if(mime==='image/webp'){if(bytes.length<30||ascii(0,4)!=='RIFF'||ascii(8,12)!=='WEBP'||view.getUint32(4,true)+8!==bytes.length)throw new Error();const type=ascii(12,16);if(type==='VP8X')return [1+bytes[24]+(bytes[25]<<8)+(bytes[26]<<16),1+bytes[27]+(bytes[28]<<8)+(bytes[29]<<16)];if(type==='VP8 '&&bytes[23]===157&&bytes[24]===1&&bytes[25]===42)return [view.getUint16(26,true)&16383,view.getUint16(28,true)&16383];if(type==='VP8L'&&bytes[20]===47)return [1+bytes[21]+((bytes[22]&63)<<8),1+(bytes[22]>>6)+(bytes[23]<<2)+((bytes[24]&15)<<10)];throw new Error();}
 throw new Error();
}
export function validateUpload(v){exact(v,['name','mime','data']);string(v.name,120,1);if(!['image/png','image/jpeg','image/webp','application/pdf'].includes(v.mime)||typeof v.data!=='string'||!v.data.length||v.data.length>2796204||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(v.data))throw new Error('Upload a PNG, JPEG, WebP or PDF up to 2 MB.');const bytes=Uint8Array.from(atob(v.data),c=>c.charCodeAt(0));if(bytes.length>2097152)throw new Error('Files must be 2 MB or smaller.');try{if(v.mime==='application/pdf'){const head=new TextDecoder().decode(bytes.slice(0,8)),tail=new TextDecoder().decode(bytes.slice(-1024));if(!/^%PDF-1\.[0-9]|^%PDF-2\.0/.test(head)||! /%%EOF\s*$/.test(tail))throw new Error();}else{const [w,h]=dimensions(bytes,v.mime);if(w<1||h<1||w>4096||h>4096||w*h>16000000)throw new Error();}}catch{throw new Error('The file format or image dimensions are not supported.');}return bytes;}
const assetMetadata=row=>({id:row.id,name:row.name,mime:row.mime,size:row.size,url:`/api/content/assets/${row.id}`});
async function deliverAsset(env,row){const file=await env.ASSETS.get(row.r2key);if(!file)return fail();const filename=row.name.replace(/[^A-Za-z0-9._-]/g,'_')||'download';return new Response(file.body,{headers:{...safeHeaders,'Content-Type':row.mime,'Content-Length':String(row.size),'Content-Disposition':`${row.mime==='application/pdf'?'attachment':'inline'}; filename="${filename}"`}});}
export async function assetRequest(r,env){
 const owner=ownerOf(r);if(!owner)return fail('Sign in to manage files.',401);const m=new URL(r.url).pathname.match(/^\/content-assets(?:\/([^/]+))?$/),id=m?.[1];if(!m||id&&!UUID.test(id))return fail('File not found.',404);if(!['GET','POST'].includes(r.method)||id&&r.method==='POST')return fail('Method not allowed.',405);
 const tier=r.headers.get('x-qr-plan'),limits=limitsForPlan(tier??'free');if(!limits)return fail('Invalid plan.',400);
 let input,bytes;if(r.method==='POST')try{input=await readContentBody(r,3145728);bytes=validateUpload(input);}catch(e){return fail(e instanceof SyntaxError?'Use valid JSON.':e.message,400);}
 try{if(r.method==='GET'){if(id){const row=await env.DB.prepare('SELECT * FROM content_assets WHERE id=? AND owner=? AND ready=1').bind(id,owner).first();return row?await deliverAsset(env,row):fail('File not found.',404);}const rows=await env.DB.prepare('SELECT * FROM content_assets WHERE owner=? AND ready=1 ORDER BY created_at DESC').bind(owner).all();return reply({assets:rows.results.map(assetMetadata),...(tier?{limit:limits.uploadedAssets}:{})});}
 const assetId=crypto.randomUUID(),key=`content/${crypto.randomUUID()}`,now=new Date().toISOString();const row=await env.DB.prepare('INSERT INTO content_assets(id,owner,name,mime,size,r2key,created_at) SELECT ?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM content_assets WHERE owner=?)<? RETURNING *').bind(assetId,owner,input.name,input.mime,bytes.length,key,now,owner,limits.uploadedAssets).first();if(!row)return fail(`Your account holds up to ${limits.uploadedAssets} files.`,409);
 try{await env.ASSETS.put(key,bytes,{httpMetadata:{contentType:input.mime}});const saved=await env.DB.prepare('UPDATE content_assets SET ready=1 WHERE id=? AND owner=? AND ready=0 RETURNING *').bind(assetId,owner).first();if(!saved)throw new Error();return reply({asset:assetMetadata(saved)},201);}catch{
 // An acknowledged failure can hide a committed write. Never delete a ready object.
 try{const persisted=await env.DB.prepare('SELECT * FROM content_assets WHERE id=? AND owner=?').bind(assetId,owner).first();if(persisted?.ready)return reply({asset:assetMetadata(persisted)},201);if(persisted){await env.ASSETS.delete(key);await env.DB.prepare('DELETE FROM content_assets WHERE id=? AND owner=? AND ready=0 RETURNING id').bind(assetId,owner).first();}}catch{}return fail('The file could not be saved. Please retry.');}
 }catch{return fail();}
}
function submission(v){exact(v,['name','email','message','consent','website']);string(v.name,80);string(v.email,254);string(v.message,2000,1);if(v.consent!==true||v.website!==''||v.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email))throw new Error('Check your details and consent.');return v;}
export async function publicContent(r,env){
 const m=new URL(r.url).pathname.match(/^\/public-content\/([A-Za-z0-9_-]{16})(?:\/assets\/([^/]+)|(\/submissions))?$/);if(!m)return fail('Page not found.',404);const [,slug,assetId,sub]=m;if(assetId&&!UUID.test(assetId))return fail('File not found.',404);if(sub?r.method!=='POST':r.method!=='GET')return fail('Method not allowed.',405);
 let input,network;if(sub){network=r.headers.get('x-qr-network');if(!/^[a-f0-9]{64}$/.test(network||''))return fail('Submissions are temporarily unavailable.',503);try{input=submission(await readContentBody(r,8192));}catch(e){return fail(e instanceof SyntaxError?'Use valid JSON.':e.message,400);}}
 try{const row=await env.DB.prepare("SELECT * FROM content_pages WHERE slug=? AND status='published' AND archived=0").bind(slug).first();if(!row)return fail('Page not found.',404);const content=JSON.parse(row.published);
 if(assetId){if(!refs(content).includes(assetId))return fail('File not found.',404);const asset=await env.DB.prepare("SELECT a.* FROM content_assets a JOIN content_pages p ON p.owner=a.owner WHERE a.id=? AND a.owner=? AND a.ready=1 AND p.slug=? AND p.status='published' AND p.archived=0 AND p.published=?").bind(assetId,row.owner,slug,row.published).first();return asset?await deliverAsset(env,asset):fail('File not found.',404);}
 if(sub){if(content.kind!=='form')return fail('Form not found.',404);const now=new Date().toISOString();const inserted=await env.DB.prepare("INSERT INTO content_submissions(id,page_id,name,email,message,created_at,network) SELECT ?,p.id,?,?,?,?,? FROM content_pages p WHERE p.slug=? AND p.status='published' AND p.archived=0 AND json_extract(p.published,'$.kind')='form' AND (SELECT COUNT(*) FROM content_submissions WHERE page_id=p.id)<1000 AND (SELECT COUNT(*) FROM content_submissions WHERE page_id=p.id AND created_at>=?)<100 AND COALESCE((SELECT count FROM content_network_quotas WHERE network=? AND hour=?),0)<5 RETURNING id").bind(crypto.randomUUID(),input.name,input.email,input.message,now,network,slug,now.slice(0,10),network,now.slice(0,13)).first();if(!inserted)return fail('This form cannot accept more messages right now. Try again later.',429);
 try{await env.DB.prepare('DELETE FROM content_network_quotas WHERE hour<? RETURNING network').bind(new Date(Date.now()-2*86400000).toISOString().slice(0,13)).all();}catch{}return reply({received:true},201);}
 return reply({page:{slug,url:`https://qrupgrade.com/p/${slug}`,content}});
 }catch{return fail();}
}

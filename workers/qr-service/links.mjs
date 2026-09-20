import {limitsForPlan} from '../../shared/plan-limits.mjs';

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const SLUG = /^[A-Za-z0-9_-]{16}$/;
const reply = (body, status = 200) => Response.json(body, {status, headers:{'Cache-Control':'no-store'}});
export function validateTarget(value) {
 if(typeof value!=='string'||value.length>2048||/[\u0000-\u0020\u007f\\]/.test(value))throw new Error('Use a public HTTPS destination up to 2048 characters.');
 let u;try{u=new URL(value);}catch{throw new Error('Use a public HTTPS destination.');}
 const host=u.hostname.toLowerCase();const raw=value.match(/^https:\/\/([^/?#]+)/i)?.[1];
 if(u.protocol!=='https:'||u.username||u.password||!raw||raw.includes('%')||host.endsWith('.')||!host.includes('.')&&!host.startsWith('[')||/(^|\.)(localhost|local|internal|test|invalid|example|onion)$/.test(host))throw new Error('Use a public HTTPS destination.');
 if(host.startsWith('[')) {if(!/^\[2[0-9a-f]{3}:/.test(host)||host.startsWith('[2001:')||host.startsWith('[2002:'))throw new Error('Use a public HTTPS destination.');}
 else if(/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
  const parts=host.split('.').map(Number),[a,b,c]=parts;const rawHost=raw.split(':')[0];
  if(rawHost!==host||a===0||a===10||a===127||a>=224||a===100&&b>=64&&b<=127||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&(b===168||b===0||b===2||b===88&&c===99)||a===198&&(b===18||b===19||b===51&&c===100)||a===203&&b===0&&c===113)throw new Error('Use a public HTTPS destination.');
 }
 let path;try{path=decodeURIComponent(u.pathname).replace(/\/{2,}/g,'/');}catch{throw new Error('Use a valid destination.');}
 if((host==='qrupgrade.com'||host.endsWith('.qrupgrade.com'))&&/^\/r(?:\/|$)/i.test(path))throw new Error('A redirect cannot point to another QR Upgrade redirect.');
 return u.href;
}
function validateInput(v,create) {
 if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).some(k=>!['name','target',...(create?[]:['status','archived'])].includes(k))||!Object.keys(v).length)throw new Error('Use valid link fields.');
 const out={};if(create||'name'in v){if(typeof v.name!=='string'||!v.name.trim()||v.name.trim().length>80||/[\u0000-\u001f\u007f]/.test(v.name))throw new Error('Name must contain 1–80 characters.');out.name=v.name.trim();}
 if(create||'target'in v)out.target=validateTarget(v.target);
 if('status'in v){if(!['draft','published','paused'].includes(v.status))throw new Error('Choose a valid publication status.');out.status=v.status;}
 if('archived'in v){if(typeof v.archived!=='boolean')throw new Error('Choose a valid archive state.');out.archived=v.archived?1:0;}
 return out;
}
export async function readLinkBody(r){
 if(r.headers.get('content-type')?.split(';')[0].trim()!=='application/json')throw new Error('Use JSON.');
 const reader=r.body?.getReader();if(!reader)throw new Error('Missing body.');let length=0;const chunks=[];let timer;
 const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>{reject(new Error('Request timed out.'));void reader.cancel();},5000);});
 try{while(true){const next=await Promise.race([reader.read(),deadline]);if(next.done)break;length+=next.value.byteLength;if(length>16384){void reader.cancel();throw new Error('Link details must be smaller than 16 KB.');}chunks.push(next.value);}const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}finally{clearTimeout(timer);reader.releaseLock();}
}
function publicLink(row,counts=[],total) {
 const since=new Date(Date.now()-29*86400000).toISOString().slice(0,10),daily=counts.filter(c=>c.day>=since).map(c=>({day:c.day,count:c.count}));
 return {id:row.id,slug:row.slug,name:row.name,target:row.target,status:row.status,archived:!!row.archived,createdAt:row.created_at,updatedAt:row.updated_at,url:`https://qrupgrade.com/r/${row.slug}`,analytics:{totalOpens:total??counts.reduce((n,c)=>n+c.count,0),opensLast30Days:daily.reduce((n,c)=>n+c.count,0),daily}};
}
async function withAnalytics(db,row){const since=new Date(Date.now()-29*86400000).toISOString().slice(0,10);const results=await db.batch([db.prepare('SELECT day, count FROM link_daily_counts WHERE slug=? AND day>=? ORDER BY day').bind(row.slug,since),db.prepare('SELECT COALESCE(SUM(count),0) AS total FROM link_daily_counts WHERE slug=?').bind(row.slug)]);return publicLink(row,results[0].results||[],results[1].results?.[0]?.total||0);}
export async function linksRequest(r,env){
 const owner=r.headers.get('x-qr-user');if(!owner||! /^[a-f0-9]{64}$/.test(owner))return reply({error:'Sign in to manage links.'},401);
 const tier=r.headers.get('x-qr-plan'),limits=limitsForPlan(tier??'free');if(!limits)return reply({error:'Invalid plan.'},400);
 const path=new URL(r.url).pathname,match=path.match(/^\/links(?:\/([^/]+))?$/),id=match?.[1];if(!match||id&&!UUID.test(id))return reply({error:'Link not found.'},404);
 if(!['GET','POST','PATCH'].includes(r.method)||id&&r.method==='POST'||!id&&r.method==='PATCH')return reply({error:'Method not allowed.'},405);
 let input;if(r.method!=='GET')try{input=validateInput(await readLinkBody(r),r.method==='POST');}catch(e){return reply({error:e.message||'Use valid link details.'},400);}
 try{
  if(r.method==='GET'&&!id){const rows=await env.DB.prepare('SELECT * FROM dynamic_links WHERE owner=? ORDER BY created_at DESC').bind(owner).all();return reply({links:await Promise.all((rows.results||[]).map(row=>withAnalytics(env.DB,row))),...(tier?{limit:limits.dynamicLinks}:{})});}
  if(r.method==='POST'){
   const id=crypto.randomUUID(),bytes=crypto.getRandomValues(new Uint8Array(12)),slug=btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_'),now=new Date().toISOString();
   const row=await env.DB.prepare("INSERT INTO dynamic_links (id,owner,slug,name,target,status,archived,created_at,updated_at) SELECT ?,?,?,?,?,'draft',0,?,? WHERE (SELECT COUNT(*) FROM dynamic_links WHERE owner=?) < ? RETURNING *").bind(id,owner,slug,input.name,input.target,now,now,owner,limits.dynamicLinks).first();
   return row?reply({link:publicLink(row)},201):reply({error:`Your account has reached its limit of ${limits.dynamicLinks} links.`},409);
  }
  if(r.method==='PATCH'){
   const fields=Object.keys(input),row=await env.DB.prepare(`UPDATE dynamic_links SET ${fields.map(k=>`${k}=?`).join(',')},updated_at=? WHERE id=? AND owner=? RETURNING *`).bind(...fields.map(k=>input[k]),new Date().toISOString(),id,owner).first();
   return row?reply({link:await withAnalytics(env.DB,row)}):reply({error:'Link not found.'},404);
  }
  const row=await env.DB.prepare('SELECT * FROM dynamic_links WHERE id=? AND owner=?').bind(id,owner).first();return row?reply({link:await withAnalytics(env.DB,row)}):reply({error:'Link not found.'},404);
 }catch{return reply({error:'Link storage is temporarily unavailable.'},503);}
}
export async function resolveLink(r,env){
 const slug=new URL(r.url).pathname.match(/^\/resolve\/([A-Za-z0-9_-]{16})$/)?.[1];if(!slug||!SLUG.test(slug))return reply({error:'Link not found.'},404);
 if(!['GET','HEAD'].includes(r.method))return reply({error:'Method not allowed.'},405);
 try{
  const query=env.DB.prepare("SELECT target FROM dynamic_links WHERE slug=? AND status='published' AND archived=0 AND NOT EXISTS(SELECT 1 FROM account_security a WHERE a.owner=dynamic_links.owner AND a.lifecycle='closed')").bind(slug);
  const statements=[query];if(r.method==='GET'&&r.headers.get('x-qr-count')!=='0')statements.push(env.DB.prepare("INSERT INTO link_daily_counts (slug,day,count) SELECT slug,?,1 FROM dynamic_links WHERE slug=? AND status='published' AND archived=0 AND NOT EXISTS(SELECT 1 FROM account_security a WHERE a.owner=dynamic_links.owner AND a.lifecycle='closed') ON CONFLICT(slug,day) DO UPDATE SET count=count+1").bind(new Date().toISOString().slice(0,10),slug));
  const result=await env.DB.batch(statements),row=result[0].results?.[0];if(!row)return reply({error:'Link not found.'},404);
  return reply({target:validateTarget(row.target)});
 }catch{return reply({error:'This link is temporarily unavailable.'},503);}
}

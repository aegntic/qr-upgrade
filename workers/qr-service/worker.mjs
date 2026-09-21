import { cloudRequest } from "./cloud.mjs";
import { linksRequest, resolveLink } from "./links.mjs";
import { contentRequest, assetRequest, publicContent } from "./content.mjs";
import { billingRequest } from "./billing.mjs";
import { ART_STYLES, artworkPrompt } from '../../shared/art-styles.mjs';
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const hash = /^[a-f0-9]{64}$/;
const reply = (body,status=200) => Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export function validateArtInput(body) {
 if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!['id','owner','network','prompt','style'].includes(k)))throw new Error('Invalid request.');
 if(!uuid.test(body.id)||!hash.test(body.owner)||!hash.test(body.network))throw new Error('Invalid request.');
 if(typeof body.prompt!=='string'||body.prompt.trim().length<8||body.prompt.length>800||/[\x00-\x08\x0b-\x1f\x7f]/.test(body.prompt))throw new Error('Describe your artwork in 8–800 characters.');
 if(!Object.hasOwn(ART_STYLES,body.style))throw new Error('Choose an artwork style.');
 return {...body,prompt:body.prompt.trim()};
}
async function authorised(request,secret) {
 if(!secret||secret.length<32)return false;
 const header=request.headers.get('authorization')||'';
 if(header.length>600)return false;
 const digest=async value=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)));
 const [a,b]=await Promise.all([digest(header),digest(`Bearer ${secret}`)]);
 let difference=0;for(let i=0;i<a.length;i++)difference|=a[i]^b[i];return difference===0;
}
async function generate(env,job) {
 let timer;
 try {
  const result=await Promise.race([
   env.AI.run(env.AI_MODEL,{prompt:artworkPrompt(job.style,job.prompt),steps:4}),
   new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('timeout')),24000);})
  ]);
  if(typeof result?.image!=='string'||result.image.length>1800000||!/^[A-Za-z0-9+/]+={0,2}$/.test(result.image))throw new Error('image');
  await env.DB.prepare("UPDATE art_jobs SET state='ready',image=? WHERE id=? AND owner=? AND state='pending'").bind(`data:image/jpeg;base64,${result.image}`,job.id,job.owner).run();
 }catch{
  await env.DB.prepare("UPDATE art_jobs SET state='failed',error=? WHERE id=? AND owner=? AND state='pending'").bind('The artwork could not be completed. Try a shorter description or generate another.',job.id,job.owner).run();
 }finally{clearTimeout(timer);}
}
function publicJob(job){return {id:job.id,status:job.state,...(job.state==='ready'?{image:job.image}:{}),...(job.error?{error:job.error}:{})};}
export default {
 async fetch(request,env,ctx) {
  if(!await authorised(request,env.SERVICE_SECRET))return reply({error:'Unauthorized.'},401);
  const url=new URL(request.url);
  if(url.pathname==='/health'&&request.method==='GET')return reply({ready:!!env.DB&&!!env.AI,model:env.AI_MODEL});
  try {
   if(url.pathname==='/links'||url.pathname.startsWith('/links/'))return await linksRequest(request,env);
   if(url.pathname.startsWith('/resolve/'))return await resolveLink(request,env);
   if(url.pathname==='/content'||url.pathname.startsWith('/content/'))return await contentRequest(request,env);
   if(url.pathname==='/content-assets'||url.pathname.startsWith('/content-assets/'))return await assetRequest(request,env);
   if(url.pathname.startsWith('/public-content/'))return await publicContent(request,env);
   if(url.pathname==='/billing'||url.pathname.startsWith('/billing/'))return await billingRequest(request,env);
   if(url.pathname.startsWith('/cloud/'))return await cloudRequest(request,env);
   if(url.pathname==='/art'&&request.method==='GET'){
    const id=url.searchParams.get('id'),owner=request.headers.get('x-qr-owner');
    if(!uuid.test(id||'')||!hash.test(owner||''))return reply({error:'Invalid job.'},400);
    const job=await env.DB.prepare('SELECT * FROM art_jobs WHERE id=? AND owner=?').bind(id,owner).first();
    if(!job)return reply({error:'Artwork not found in this browser session.'},404);
    if(Date.now()-job.created_at>3600000)return reply({error:'This generated artwork expired. Generate another or reopen a locally saved design.'},410);
    if(job.state==='pending'&&Date.now()-job.created_at>40000)return reply({id,status:'failed',error:'Generation timed out. You can try again.'});
    return reply(publicJob(job));
   }
   if(url.pathname!=='/art'||request.method!=='POST')return reply({error:'Not found.'},404);
   const content=await request.text();if(content.length>5000)return reply({error:'Request too large.'},413);
   let job;try{job=validateArtInput(JSON.parse(content));}catch(e){return reply({error:e.message},400);}
   const existing=await env.DB.prepare('SELECT * FROM art_jobs WHERE id=? AND owner=?').bind(job.id,job.owner).first();
   if(existing){
    if(Date.now()-existing.created_at>3600000)return reply({error:'This generated artwork expired. Generate another or reopen a locally saved design.'},410);
    return reply(publicJob(existing),existing.state==='pending'?202:200);
   }
   const day=new Date().toISOString().slice(0,10), now=Date.now();
   // One atomic SQLite statement reserves both the global and network allowance.
   const reservation=await env.DB.prepare(`INSERT OR IGNORE INTO art_jobs(id,owner,network,day,state,created_at)
     SELECT ?,?,?,?,'pending',? WHERE
     (SELECT COUNT(*) FROM art_jobs WHERE day=?) < ? AND
     (SELECT COUNT(*) FROM art_jobs WHERE day=? AND network=?) < ? RETURNING id`)
     .bind(job.id,job.owner,job.network,day,now,day,Number(env.DAILY_GLOBAL_LIMIT),day,job.network,Number(env.DAILY_NETWORK_LIMIT)).first();
   if(!reservation)return reply({error:'Today’s artwork allowance has been reached. You can still use the library or your own image. Please try again tomorrow.'},429);
   ctx.waitUntil(generate(env,job));
   return reply({id:job.id,status:'pending'},202);
  }catch{return reply({error:'Artwork service is temporarily unavailable. Please try again.'},503);}
 },
 async scheduled(_event,env,ctx){ctx.waitUntil(env.DB.batch([
  env.DB.prepare("UPDATE art_jobs SET image=NULL,state='expired' WHERE created_at<? AND state!='expired'").bind(Date.now()-3600000),
  env.DB.prepare('DELETE FROM art_jobs WHERE created_at<?').bind(Date.now()-3*86400000)
 ]));}
};

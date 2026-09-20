import { createHmac, randomBytes } from 'node:crypto';
const COOKIE = 'qr-art-session';
const requestIdPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const headers = { 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff' };
export type ArtConfig = { url?: string; secret?: string; production: boolean; previewHost?: string; fetcher?: typeof fetch };
export function sameOrigin(request: Request, config: ArtConfig) {
 const origin=request.headers.get('origin');
 const allowed=new Set(['https://qrupgrade.com','https://www.qrupgrade.com','https://qr-upgrade.vercel.app']);
 if(config.previewHost)allowed.add(`https://${config.previewHost}`);
 if(!config.production&&origin&&/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin))allowed.add(origin);
 return !!origin&&allowed.has(origin)&&request.headers.get('sec-fetch-site')!=='cross-site';
}
export async function boundedJson(request: Request) {
 if(request.headers.get('content-type')?.split(';')[0]!=='application/json')throw new Error('Use application/json.');
 const reader=request.body?.getReader();if(!reader)throw new Error('A description is required.');
 const chunks:Uint8Array[]=[];let count=0;let timer:ReturnType<typeof setTimeout>|undefined;
 const timeout=new Promise<never>((_,reject)=>{timer=setTimeout(()=>{reject(new Error('Request timed out.'));void reader.cancel();},3000);});
 try{while(true){const part=await Promise.race([reader.read(),timeout]);if(part.done)break;count+=part.value.length;if(count>4096){void reader.cancel();throw new Error('Request too large.');}chunks.push(part.value);}const data=new Uint8Array(count);let offset=0;for(const c of chunks){data.set(c,offset);offset+=c.length;}return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(data)) as Record<string,unknown>;}finally{clearTimeout(timer);reader.releaseLock();}
}
export function createArtHandler(config: ArtConfig) {
 return async (request:Request):Promise<Response>=>{
  const respond=(body:unknown,status=200,extra:Record<string,string>={})=>Response.json(body,{status,headers:{...headers,...extra}});
  const enabled=!!config.url&&!!config.secret&&config.secret.length>=32;
  const url=new URL(request.url);
  if(request.method==='GET'&&!url.searchParams.has('id'))return respond({enabled,dailyLimit:3,provider:'Cloudflare Workers AI',model:'FLUX.1 Schnell'});
  if(!enabled)return respond({error:'Live artwork generation is not configured.'},503);
  const cookie=request.headers.get('cookie')?.match(/(?:^|;\s*)qr-art-session=([a-f0-9]{64})(?:;|$)/)?.[1];
  const session=cookie||randomBytes(32).toString('hex');
  const owner=createHmac('sha256',config.secret!).update(`owner:${session}`).digest('hex');
  const upstreamHeaders:Record<string,string>={authorization:`Bearer ${config.secret}`,'Content-Type':'application/json','x-qr-owner':owner};
  let target=`${config.url!.replace(/\/$/,'')}/art`, body:string|undefined;
  if(request.method==='POST'){
   if(!sameOrigin(request,config))return respond({error:'Open the QR Upgrade studio to generate artwork.'},403);
   try{const input=await boundedJson(request);if(Object.keys(input).some(k=>!['requestId','prompt','style'].includes(k))||!requestIdPattern.test(String(input.requestId||''))||typeof input.prompt!=='string'||input.prompt.length>800||input.prompt.trim().length<8||!['steel','glass','botanical','illustrated'].includes(String(input.style)))throw new Error('Provide a description of 8–800 characters and choose a style.');
    // Vercel replaces this trusted header; do not use client-supplied x-forwarded-for.
    const network=config.production ? request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() : 'local-development';
    if(!network)return respond({error:'Artwork service could not verify this request. Try again.'},503);
    const networkHash=createHmac('sha256',config.secret!).update(`network:${new Date().toISOString().slice(0,10)}:${network}`).digest('hex');
    body=JSON.stringify({id:input.requestId,owner,network:networkHash,prompt:input.prompt,style:input.style});
   }catch(e){return respond({error:e instanceof Error?e.message:'Invalid description.'},400);}
  }else if(request.method==='GET'){
   if(!cookie)return respond({error:'Artwork not found in this browser session.'},404);
   const id=url.searchParams.get('id');if(!requestIdPattern.test(id||''))return respond({error:'Invalid artwork ID.'},400);target+=`?id=${id}`;
  }else return respond({error:'Method not allowed.'},405);
  try{
   const response=await (config.fetcher||fetch)(target,{method:request.method,headers:upstreamHeaders,body,cache:'no-store',signal:AbortSignal.timeout(12000)});
   const data=await response.json();
   return respond(data,response.status,request.method==='POST'?{'Set-Cookie':`${COOKIE}=${session}; HttpOnly; SameSite=Strict; Path=/api/art; Max-Age=3600${config.production?'; Secure':''}`}:{ });
  }catch{return respond({error:'The artwork service is taking longer than expected. Try again shortly.'},503);}
 };
}

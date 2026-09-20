import {limitsForPlan} from '../../shared/plan-limits.mjs';

const LOCAL_ASSETS=new Set(["/artwork/botanical-source.png", "/artwork/dragon-source.png", "/artwork/coffee-source.png", "/artwork/alpine-source.png", "/artwork/tiger-source.png", "/artwork/koi-source.png", "/artwork/orchid-source.png", "/artwork/ocean-source.png", "/artwork/city-source.png", "/artwork/citrus-source.png", "/artwork/astral-source.png", "/artwork/vinyl-source.png", "/artwork/fox-source.png", "/artwork/wave-source.png", "/artwork/dragon.webp", "/artwork/koi.webp", "/artwork/coffee.webp", "/artwork/alpine.webp", "/artwork/tiger.webp", "/artwork/orchid.webp", "/artwork/city.webp", "/artwork/ocean.webp", "/artwork/citrus.webp", "/artwork/astral.webp", "/artwork/vinyl.webp", "/artwork/fox.webp", "/artwork/wave.webp", "/artwork/botanical.webp", "/brand-studies/linkedin-source.png", "/brand-studies/tiktok-source.png", "/brand-studies/amazon-source.png", "/brand-studies/instagram-source.png", "/brand-studies/youtube-source.png", "/brand-studies/snapchat-source.png", "/brand-studies/whatsapp-source.png", "/brand-studies/telegram-source.png", "/brand-studies/spotify-source.png", "/brand-studies/pinterest-source.png", "/brand-studies/discord-source.png", "/brand-studies/x-source.png", "/brand-studies/maps-source.png", "/brand-studies/facebook-source.png", "/brand-studies/linkedin.png", "/brand-studies/linkedin.webp", "/brand-studies/amazon.png", "/brand-studies/amazon.webp", "/brand-studies/snapchat.png", "/brand-studies/snapchat.webp", "/brand-studies/instagram.png", "/brand-studies/instagram.webp", "/brand-studies/tiktok.png", "/brand-studies/tiktok.webp", "/brand-studies/youtube.png", "/brand-studies/youtube.webp", "/brand-studies/spotify.png", "/brand-studies/spotify.webp", "/brand-studies/whatsapp.png", "/brand-studies/whatsapp.webp", "/brand-studies/discord.png", "/brand-studies/discord.webp", "/brand-studies/telegram.png", "/brand-studies/telegram.webp", "/brand-studies/pinterest.png", "/brand-studies/pinterest.webp", "/brand-studies/x.png", "/brand-studies/x.webp", "/brand-studies/maps.png", "/brand-studies/maps.webp", "/brand-studies/facebook.png", "/brand-studies/facebook.webp", "/brand-studies/sample-portrait.png", "/brand-studies/x-portrait.png", "/brand-studies/x-hero.webp", "/destination-icons/instagram.webp", "/destination-icons/tiktok.webp", "/destination-icons/linkedin.webp", "/destination-icons/snapchat.webp", "/destination-icons/youtube.webp", "/destination-icons/whatsapp.webp", "/destination-icons/facebook.webp"]);
const LIMIT=3*1024*1024;
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const HASH=/^[a-f0-9]{64}$/;
const reply=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
function keys(v,allowed){if(!object(v)||Object.keys(v).some(k=>!allowed.includes(k)))throw new Error('Invalid design fields.');}
function str(v,max=2048){if(typeof v!=='string'||v.length>max||/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(v))throw new Error('Invalid design text.');}
function number(v,min,max){if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)throw new Error('Invalid design settings.');}
function choice(v,values){if(!values.includes(v))throw new Error('Invalid design choice.');}
function bool(v){if(typeof v!=='boolean')throw new Error('Invalid design setting.');}
const kinds='website instagram reviews wifi pdf tiktok linkedin snapchat youtube spotify whatsapp facebook amazon x maps vcard menu forms text phone sms email location event'.split(' ');
function color(v){if(typeof v!=='string'||!/^#[\da-f]{6}$/i.test(v))throw new Error('Invalid color.');}
function image(v,pngOnly=false){
 if(v===''&&!pngOnly)return;
 if(!pngOnly&&LOCAL_ASSETS.has(v))return;
 if(typeof v!=='string'||v.length>LIMIT)throw new Error('Invalid image.');
 const match=v.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/);
 if(!match||match[2].length%4!==0||(pngOnly&&match[1]!=='png'))throw new Error('Use a PNG, JPEG or WebP image.');
 const bytes=atob(match[2].slice(0,48));
 if(match[1]==='png'&&!bytes.startsWith('\x89PNG\r\n\x1a\n')||match[1]==='jpeg'&&!bytes.startsWith('\xff\xd8\xff')||match[1]==='webp'&&!(bytes.startsWith('RIFF')&&bytes.slice(8,12)==='WEBP'))throw new Error('Invalid image content.');
}
export function validateSnapshot(input){
 keys(input,['name','draft','artifact']);str(input.name,80);if(!input.name.trim())throw new Error('Name your design.');
 const d=input.draft;
 keys(d,['version','kind','content','mode','appearance','template','art','brandStudy','studyActive','customImage','logo','logoSize','logoFrame','strength','sizeMm','showUtm','utm','adjustments','caption','name','destinationDrafts','cloudId']);
 if(d.cloudId!==undefined&&(typeof d.cloudId!=='string'||!UUID.test(d.cloudId)))throw new Error('Invalid cloud design identity.');
 choice(d.version,[1]);choice(d.kind,kinds);choice(d.mode,['custom','image','art']);str(d.name,80);str(d.template,80);str(d.art,80);if(!LOCAL_ASSETS.has(`/artwork/${d.art}-source.png`))throw new Error('Unknown artwork.');
 keys(d.content,['type','url','ssid','password','name','email','phone','text','smsMessage','emailSubject','emailBody','whatsappMessage','latitude','longitude','eventTitle','eventStart','eventEnd','eventLocation','eventDescription','eventTimezone','wifiEncryption','wifiHidden','company','title','website','address']);
 choice(d.content.type,['url','text','phone','sms','email','whatsapp','location','event','wifi','vcard']);
 for(const [k,v] of Object.entries(d.content)){if(k==='wifiHidden')bool(v);else str(v,8192);}
 for(const k of ['url','ssid','password','name','email','phone'])str(d.content[k],8192);
 keys(d.appearance,['foreground','background','quietZone','style']);color(d.appearance.foreground);color(d.appearance.background);number(d.appearance.quietZone,0,20);choice(d.appearance.style,['square','soft','dot']);
 image(d.customImage);image(d.logo);number(d.logoSize,0,100);choice(d.logoFrame,['plain','metal']);number(d.strength,0,100);number(d.sizeMm,1,2000);bool(d.studyActive);bool(d.showUtm);
 keys(d.utm,['source','medium','campaign']);for(const k of ['source','medium','campaign'])str(d.utm[k],2048);
 keys(d.adjustments,['zoom','x','y','opacity','brightness']);number(d.adjustments.zoom,0.01,100);for(const k of ['x','y','opacity'])number(d.adjustments[k],0,100);number(d.adjustments.brightness,0,500);
 keys(d.caption,['text','color','font','position']);str(d.caption.text,500);color(d.caption.color);choice(d.caption.font,['sans','serif','mono']);choice(d.caption.position,['top','bottom']);
 keys(d.destinationDrafts,kinds);for(const v of Object.values(d.destinationDrafts))str(v,8192);
 if(d.brandStudy!==undefined){keys(d.brandStudy,['id','name','destination','strength']);str(d.brandStudy.id,80);if(!LOCAL_ASSETS.has(`/brand-studies/${d.brandStudy.id}-source.png`))throw new Error('Unknown brand study.');str(d.brandStudy.name,80);str(d.brandStudy.destination,2048);number(d.brandStudy.strength,0,100);}
 // Never persist SVG markup or passed scan assertions supplied by a browser.
 keys(input.artifact,['png','svg','text','sizeMm','modules','pristine','reduced','simulated','dimensionsPass']);image(input.artifact.png,true);
 return {name:input.name.trim(),draft:{...d,name:input.name.trim()},artifact:{png:input.artifact.png}};
}
async function readBody(request){
 if(request.headers.get('content-type')?.split(';')[0]!=='application/json')throw new Error('Use JSON.');
 const reader=request.body?.getReader();if(!reader)throw new Error('Missing design.');const chunks=[];let length=0,timer;
 const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>{reject(new Error('Request timed out.'));void reader.cancel();},5000);});
 try{while(true){const part=await Promise.race([reader.read(),timeout]);if(part.done)break;length+=part.value.length;if(length>LIMIT){void reader.cancel();throw new Error('Design exceeds 3 MB.');}chunks.push(part.value);}const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}finally{clearTimeout(timer);reader.releaseLock();}
}
const metadata=row=>({id:row.id,name:row.name,archived:!!row.archived,createdAt:row.created_at,updatedAt:row.updated_at});
export async function cloudRequest(request,env){
 // Caller MUST authenticate SERVICE_SECRET before entering this module.
 const owner=request.headers.get('x-qr-user');if(!HASH.test(owner||''))return reply({error:'Unauthorized.'},401);
 const tier=request.headers.get('x-qr-plan'),limits=limitsForPlan(tier??'free');if(!limits)return reply({error:'Invalid plan.'},400);
 if(!env.DB||!env.ASSETS)return reply({error:'Cloud storage is not configured.'},503);
 const path=new URL(request.url).pathname,match=path.match(/^\/cloud\/designs(?:\/([^/]+))?$/),id=match?.[1];
 if(!match||id&&!UUID.test(id))return reply({error:'Design not found.'},404);
 try{
  if(!id&&request.method==='GET'){const result=await env.DB.prepare('SELECT id,name,archived,created_at,updated_at FROM cloud_designs WHERE owner=? AND ready=1 ORDER BY updated_at DESC').bind(owner).all();return reply({designs:result.results.map(metadata),...(tier?{limit:limits.cloudDesigns}:{})});}
  const row=id?await env.DB.prepare('SELECT * FROM cloud_designs WHERE id=? AND owner=? AND ready=1').bind(id,owner).first():null;
  if(id&&!row)return reply({error:'Design not found.'},404);
  if(id&&request.method==='GET'){const stored=await env.ASSETS.get(row.r2key);if(!stored)return reply({error:'Design temporarily unavailable.'},503);const snapshot=await stored.json();return reply({design:{...metadata(row),draft:{...snapshot.draft,name:row.name},artifact:{png:snapshot.artifact.png}}});}
  if(id&&request.method==='PATCH'){
   let body;try{body=await readBody(request);keys(body,['name','archived']);if(!Object.keys(body).length)throw new Error('Choose an update.');if(body.name!==undefined){str(body.name,80);if(!body.name.trim())throw new Error('Name your design.');}if(body.archived!==undefined)bool(body.archived);}catch{return reply({error:'Provide a name or archive status.'},400);}
   const updated=await env.DB.prepare('UPDATE cloud_designs SET name=COALESCE(?,name),archived=COALESCE(?,archived),updated_at=? WHERE id=? AND owner=? AND ready=1 RETURNING *').bind(body.name?.trim()??null,body.archived===undefined?null:Number(body.archived),new Date().toISOString(),id,owner).first();
   return reply({design:metadata(updated)});
  }
  if(!(!id&&request.method==='POST'||id&&request.method==='PUT'))return reply({error:'Method not allowed.'},405);
  let snapshot;try{snapshot=validateSnapshot(await readBody(request));}catch{return reply({error:'Provide a valid design with embedded PNG, JPEG or WebP images, smaller than 3 MB.'},400);}
  const designId=id||crypto.randomUUID(),now=new Date().toISOString(),r2key=`accounts/${owner}/${designId}/${crypto.randomUUID()}.json`;
  if(!id){const reserved=await env.DB.prepare('INSERT INTO cloud_designs(id,owner,name,created_at,updated_at,r2key) SELECT ?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM cloud_designs WHERE owner=?) < 50 + (? - 50) RETURNING id').bind(designId,owner,snapshot.name,now,now,r2key,owner,limits.cloudDesigns).first();if(!reserved)return reply({error:`Your cloud library holds up to ${limits.cloudDesigns} designs, including archived designs.`},409);}
  try{
   await env.ASSETS.put(r2key,JSON.stringify(snapshot),{httpMetadata:{contentType:'application/json'}});
   const saved=await env.DB.prepare('UPDATE cloud_designs SET name=?,updated_at=?,r2key=?,ready=1 WHERE id=? AND owner=? AND r2key=? RETURNING *').bind(snapshot.name,now,r2key,designId,owner,row?.r2key??r2key).first();
   if(!saved){await env.ASSETS.delete(r2key);return reply({error:'The design changed in another window. Reopen it before saving.'},409);}
   // Losing an old object cleanup must not roll back a successful save.
   if(row)try{await env.ASSETS.delete(row.r2key);}catch{}
   return reply({design:metadata(saved)},id?200:201);
  }catch{
   // A timeout can occur after D1 commits. Never remove a possibly committed object.
   try{
    const persisted=await env.DB.prepare('SELECT * FROM cloud_designs WHERE id=? AND owner=?').bind(designId,owner).first();
    if(persisted?.ready&&persisted.r2key===r2key)return reply({design:metadata(persisted)},id?200:201);
    await env.ASSETS.delete(r2key);
    if(!id)await env.DB.prepare('DELETE FROM cloud_designs WHERE id=? AND owner=? AND ready=0').bind(designId,owner).run();
   }catch{}

   return reply({error:'Cloud save could not be completed. Your local design remains available.'},503);
  }
 }catch{return reply({error:'Cloud storage is temporarily unavailable.'},503);}
}

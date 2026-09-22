import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { access, cp, mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createHmac, randomBytes } from 'node:crypto';
import { root, sourceDigest } from './source.mjs';

const pinnedNode=(await readFile(path.join(root,'.nvmrc'),'utf8')).trim();
assert.equal(process.versions.node,pinnedNode,'Use the exact Node version from .nvmrc (CI uses node-version-file).');
const work = await mkdtemp(path.join(tmpdir(), 'qr-cloudflare-check-'));
const keep = process.argv.includes('--keep');
const children = [];
const privateName = /(^|\/)(\.env[^/]*|\.dev\.vars[^/]*|\.git|\.wrangler|\.next|\.open-next|node_modules|evidence|research|mobile|sources|credentials\.json)(\/|$)|\.(pem|key|p12|p8|jks|mobileprovision)$/;
const privateArtifactName = /(^|\/)(\.env[^/]*|\.dev\.vars[^/]*|evidence|research|mobile|sources|tests|credentials\.json)(\/|$)|\.(pem|key|p12|p8|jks|mobileprovision)$/;
const canaries = [randomBytes(32).toString('hex'), randomBytes(32).toString('hex')];
const env = { PATH: `${path.dirname(process.execPath)}:/usr/local/bin:/usr/bin:/bin`, HOME: path.join(work,'home'), CI:'1', NEXT_TELEMETRY_DISABLED:'1', WRANGLER_SEND_METRICS:'false', QR_SERVICE_SECRET:canaries[0], GOOGLE_CLIENT_SECRET:canaries[1] };
await mkdir(env.HOME);
const requestedScanner = process.env.GITLEAKS_BIN || 'gitleaks';
let scanner;
for(const candidate of path.isAbsolute(requestedScanner)?[requestedScanner]:(process.env.PATH||'').split(path.delimiter).map(dir=>path.resolve(dir,requestedScanner))) {
 try { await access(candidate,1); scanner=candidate; break; } catch {}
}
assert.ok(scanner,'Install Gitleaks or set GITLEAKS_BIN to its executable path.');
function run(command,args,extra={}) {
 console.log(`T14 command: ${path.basename(command)} ${args.join(' ')}`);
 const result=spawnSync(command,args,{cwd:work,env:{...env,...extra},encoding:'utf8',timeout:10*60*1000,maxBuffer:20*1024*1024});
 // This environment contains synthetic values only; never inherit provider keys.
 process.stdout.write(result.stdout||''); process.stderr.write(result.stderr||'');
 assert.equal(result.status,0,`Command failed: ${path.basename(command)}`);
 return result.stdout;
}
async function files(dir) {
 const output=[];
 for(const entry of await readdir(dir,{withFileTypes:true})) {
  assert.equal(entry.isSymbolicLink(),false,'Artifact symlink'); const full=path.join(dir,entry.name);
  if(entry.isDirectory()) output.push(...await files(full)); else output.push(full);
 }
 return output;
}
async function scanArtifacts() {
 const artifacts=[...await files(path.join(work,'.open-next')),...await files(path.join(work,'dry-run'))];
 for(const file of artifacts) {
  const rel=path.relative(work,file).replace(/^\.open-next\//,'').replace(/^dry-run\//,'');
  assert.equal(privateArtifactName.test(rel),false,`Private artifact path: ${rel}`);
  const data=await readFile(file);
  for(const canary of canaries) assert.equal(data.includes(Buffer.from(canary)),false,'Build serialized a runtime-secret canary');
 }
 // Next creates three server-only keys for every clean build. Allow only those
 // exact manifest values, never arbitrary fields, files or provider-key patterns.
 const references=JSON.parse(await readFile(path.join(work,'.next/server/server-reference-manifest.json'),'utf8'));
 const prerender=JSON.parse(await readFile(path.join(work,'.next/prerender-manifest.json'),'utf8'));
 const generated=[references.encryptionKey,prerender.preview.previewModeSigningKey,prerender.preview.previewModeEncryptionKey];
 for(const value of generated) assert.ok(typeof value==='string' && value.length>=32 && !canaries.includes(value));
 const assets=await files(path.join(work,'.open-next/assets'));
 for(const file of assets) {const data=await readFile(file);for(const value of generated) assert.equal(data.includes(Buffer.from(value)),false,'Server build key exposed in public assets');}
 const escape=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 const patterns=generated.map(value=>'(?:encryptionKey|NEXT_SERVER_ACTIONS_ENCRYPTION_KEY|__NEXT_PREVIEW_MODE_SIGNING_KEY|__NEXT_PREVIEW_MODE_ENCRYPTION_KEY|previewModeSigningKey|previewModeEncryptionKey)["\\s]*:["\\s]*'+escape(value)+'"');
 // React's key-path/implicit-slot variable assignment is code, not a credential.
 patterns.push('\\b[A-Za-z_$][A-Za-z0-9_$]*\\.keyPath,[A-Za-z_$][A-Za-z0-9_$]*=[A-Za-z_$][A-Za-z0-9_$]*\\.implicitSlot;');
 patterns.push('(?:[A-Za-z_$][A-Za-z0-9_$]*\\.)?idempotencyKey\\s*=\\s*[A-Za-z_$][A-Za-z0-9_$]*\\.idempotencyKey\\s');
 await writeFile(path.join(work,'artifact-gitleaks.toml'),'[extend]\nuseDefault = true\n[[allowlists]]\ndescription = "Exact clean-build Next keys and React property expression"\nregexTarget = "match"\nregexes = ['+patterns.map(value=>"'''"+value+"'''").join(',')+']\n');
 // No directory/file exclusions; both the complete adapter tree and actual
 // upload output must pass the default detector set plus the narrow rules above.
 run(scanner,['dir','--redact=100','--no-banner','--config','artifact-gitleaks.toml','--exit-code','1','.open-next']);
 run(scanner,['dir','--redact=100','--no-banner','--config','artifact-gitleaks.toml','--exit-code','1','dry-run']);
 const sizes=await Promise.all(assets.map(async file=>(await stat(file)).size));
 assert.ok(assets.length<100000);assert.ok(Math.max(...sizes)<25*1024*1024);
 const workerSize=(await files(path.join(work,'dry-run'))).filter(f=>!f.endsWith('.map'));
 let bytes=0;for(const file of workerSize)bytes+=(await stat(file)).size;
 assert.ok(bytes<64*1024*1024);
 console.log(JSON.stringify({assetCount:assets.length,largestAssetBytes:Math.max(...sizes),dryRunBytes:bytes,limits:{assets:100000,assetBytes:25*1024*1024,workerBytes:64*1024*1024}}));
}
function server(args) {
 const child=spawn(process.execPath,['node_modules/wrangler/bin/wrangler.js',...args],{cwd:work,env,stdio:['ignore','pipe','pipe'],detached:true});children.push(child);
 let output=''; child.stdout.on('data',chunk=>{output+=chunk;});child.stderr.on('data',chunk=>{output+=chunk;});
 return ()=>output;
}
async function ready(base,logs) {
 for(let i=0;i<180;i++) {
  try{const r=await fetch(base+'/robots.txt',{signal:AbortSignal.timeout(1000)});if(r.status===200)return;}catch{}
  await new Promise(resolve=>setTimeout(resolve,250));
 }
 throw new Error('Local workerd did not start: '+logs());
}
async function runtimeProof() {
 const config=JSON.parse(await readFile(path.join(work,'wrangler.jsonc'),'utf8'));
 const localSecret=randomBytes(32).toString('hex'), webhookSecret='whsec_'+randomBytes(24).toString('hex'),stripeKey='sk_test_'+randomBytes(24).toString('hex');
 config.name='qr-upgrade-web-isolated';
 config.services=[{binding:'QR_SERVICE',service:'qr-upgrade-fixture'}];
 config.ratelimits[0].namespace_id='2026092002';
 config.vars={LOCAL_TEST_IDENTITY:'local-development',QR_SERVICE_SECRET:localSecret,GOOGLE_CLIENT_ID:'fixture',GOOGLE_CLIENT_SECRET:randomBytes(24).toString('hex'),BILLING_ENABLED:'true',STRIPE_SECRET_KEY:stripeKey,STRIPE_WEBHOOK_SECRET:webhookSecret,STRIPE_PRICE_PRO:'price_pro',STRIPE_PRICE_BRAND:'price_brand',STRIPE_PORTAL_CONFIGURATION:'bpc_fixture'};
 await writeFile(path.join(work,'wrangler.local.json'),JSON.stringify(config));
 await writeFile(path.join(work,'fixture.json'),JSON.stringify({name:'qr-upgrade-fixture',main:'fixture.mjs',compatibility_date:'2026-09-20',workers_dev:false,preview_urls:false,observability:{enabled:false},vars:{SECRET:localSecret}}));
 await writeFile(path.join(work,'fixture.mjs'),`export default { async fetch(r,env) {
 if(r.headers.get('authorization')!=='Bearer '+env.SECRET)return new Response(null,{status:401});
 const p=new URL(r.url).pathname;
 if(p==='/billing/events'){const event=await r.json();return Response.json({stored:true},{status:event.id==='evt_retry'?503:200});}
 if(p.startsWith('/resolve/'))return Response.json({target:'https://example.com/fixture'});
 if(p==='/account/session')return Response.json({owner:r.headers.get('x-qr-user'),version:1});
 if(p.startsWith('/content-assets/'))return new Response(new Uint8Array([0,255,1]),{headers:{'content-type':'application/octet-stream'}});
 if(p==='/art'&&r.method==='POST'){const body=await r.json();return Response.json({valid:/^[a-f0-9]{64}$/.test(body.network)&&body.network!==body.owner},{status:202});}
 if(p.endsWith('/submissions'))return Response.json({received:/^[a-f0-9]{64}$/.test(r.headers.get('x-qr-network')||'')},{status:201});
 if(p==='/public-content/aaaaaaaaaaaaaaaa')return Response.json({page:{slug:'aaaaaaaaaaaaaaaa',url:'https://qrupgrade.com/p/aaaaaaaaaaaaaaaa',content:{kind:'links',title:'Published fixture',description:'Public snapshot',accent:'#123456',items:[],fileId:'',formMessage:''}}});
 if(p.startsWith('/public-content/'))return new Response(null,{status:404});
 return Response.json({error:'isolated fixture'},{status:503});
}};`);
 // Allocate an ephemeral loopback port; no production service can be reached by the fixture binding.
 const net=await import('node:net');const probe=net.createServer();await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
 const logs=server(['dev','--config','wrangler.local.json','--config','fixture.json','--local','--ip','127.0.0.1','--port',String(port),'--inspector-port','0']);
 const base=`http://127.0.0.1:${port}`;await ready(base,logs);
 const get=(route,init={})=>fetch(base+route,{...init,redirect:'manual',signal:AbortSignal.timeout(30000)});
 function security(response) {assert.equal(response.headers.get('x-content-type-options'),'nosniff');assert.equal(response.headers.get('referrer-policy'),'no-referrer');}
 let previous;
 for(const route of ['/','/','/generator','/p/aaaaaaaaaaaaaaaa','/account','/billing','/not-found-fixture']) {
  const r=await get(route);security(r);assert.equal(r.status,route==='/not-found-fixture'?404:200,route);assert.match(r.headers.get('cache-control')||'',/no-store/);
  const csp=r.headers.get('content-security-policy')||'',nonce=csp.match(/'nonce-([^']+)'/)?.[1];assert.ok(nonce,route+' CSP nonce');
  const html=await r.text(),scripts=[...html.matchAll(/<script\b([^>]*)>/g)];assert.ok(scripts.length>0,route+' scripts');
  for(const [,attrs] of scripts) {if(/type=["']application\/ld\+json/.test(attrs))continue;assert.equal(attrs.match(/\bnonce="([^"]+)"/)?.[1],nonce,route+' executable script nonce');}
  if(route==='/'){if(previous)assert.notEqual(nonce,previous);previous=nonce;}
 }
 for(const route of ['/robots.txt','/sitemap.xml','/llms.txt','/llms-full.txt','/icon.svg','/opengraph-image']) {const r=await get(route);assert.equal(r.status,200,route);security(r);await r.arrayBuffer();}
 const art=await get('/api/art');assert.equal(art.status,200);assert.equal((await art.json()).enabled,true);assert.match(art.headers.get('cache-control'),/no-store/);
 for(const route of ['/api/account','/api/billing','/api/account/designs','/api/unknown']) {const r=await get(route);assert.ok([200,401,404,503].includes(r.status),route);security(r);assert.match(r.headers.get('cache-control')||'',/no-store/);await r.arrayBuffer();}
 const fixtureId='0325ab19-ff7e-4e87-943a-6d99064b7700';
 const artwork=await get('/api/art',{method:'POST',headers:{origin:'https://qrupgrade.com','content-type':'application/json',cookie:art.headers.get('set-cookie').split(';')[0],'x-forwarded-for':'198.51.100.1','x-vercel-forwarded-for':'198.51.100.2'},body:JSON.stringify({requestId:fixtureId,prompt:'Isolated fixture artwork',style:'steel'})});assert.equal(artwork.status,202);assert.equal((await artwork.json()).valid,true);
 const form=await get('/api/content/public/aaaaaaaaaaaaaaaa/submissions',{method:'POST',headers:{origin:'https://qrupgrade.com','content-type':'application/json','x-qr-network':'caller-spoof'},body:JSON.stringify({name:'Fixture',email:'fixture@example.invalid',message:'Fixture message',consent:true,website:''})});assert.equal(form.status,201);assert.equal((await form.json()).received,true);assert.match(form.headers.get('cache-control'),/no-store/);
 const redirect=await get('/r/'+'a'.repeat(16));assert.equal(redirect.status,307);assert.equal(redirect.headers.get('location'),'https://example.com/fixture');assert.match(redirect.headers.get('cache-control'),/no-store/);
 const require=createRequire(path.join(work,'package.json'));const Stripe=require('stripe');const sdk=new Stripe(stripeKey);
 const {SignJWT}=require('jose');const session=await new SignJWT({sub:'a'.repeat(64),name:'Fixture',email:'fixture@example.invalid',sv:1}).setProtectedHeader({alg:'HS256'}).setIssuer('qrupgrade').setAudience('session').setIssuedAt().setExpirationTime('5m').sign(createHmac('sha256',localSecret).update('qr-upgrade:account:session:v1').digest());
 const cookie='__Host-qr-session='+session;
 const account=await get('/api/account',{headers:{cookie}});assert.equal((await account.json()).signedIn,true);assert.match(account.headers.get('cache-control'),/no-store/);
 const binary=await get('/api/content/assets/'+fixtureId,{headers:{cookie}});assert.equal(binary.status,200);assert.deepEqual([...new Uint8Array(await binary.arrayBuffer())],[0,255,1]);assert.match(binary.headers.get('cache-control'),/no-store/);

 const event={id:'evt_valid',type:'customer.subscription.updated',created:Math.floor(Date.now()/1000),livemode:false,data:{object:{object:'subscription',id:'sub_fixture',customer:'cus_fixture'}}};
 const post=async(event,expected,{timestamp=Math.floor(Date.now()/1000),tamper=false}={})=>{
  const payload=JSON.stringify(event),signature=sdk.webhooks.generateTestHeaderString({payload,secret:webhookSecret,timestamp});
  const r=await get('/api/billing/webhook',{method:'POST',headers:{'stripe-signature':signature},body:payload+(tamper?' ': '')});assert.equal(r.status,expected,'signed webhook');security(r);assert.match(r.headers.get('cache-control'),/no-store/);await r.text();
 };
 await post(event,200);await post(event,200);await post(event,400,{tamper:true});await post(event,400,{timestamp:1});await post({...event,livemode:true},400);await post({...event,padding:'x'.repeat(256*1024)},400);await post({...event,id:'evt_retry'},503);
 const assetFiles=await files(path.join(work,'.open-next/assets'));
 const hashed=assetFiles.find(file=>file.includes('/_next/static/chunks/')&&file.endsWith('.js'));assert.ok(hashed);
 const asset=await get('/'+path.relative(path.join(work,'.open-next/assets'),hashed));security(asset);assert.equal(asset.status,200);assert.equal(asset.headers.get('cache-control'),'public, max-age=31536000, immutable');await asset.arrayBuffer();
 const stable=await get('/icon.svg');assert.match(stable.headers.get('cache-control'),/must-revalidate/);assert.doesNotMatch(stable.headers.get('cache-control'),/immutable/);await stable.arrayBuffer();
 // A second isolated web process has no service or runtime secrets. It must
 // remain usable locally while authenticated/provider operations fail closed.
 const empty={...config,name:'qr-upgrade-web-unconfigured',services:[],vars:{LOCAL_TEST_IDENTITY:'local-development'}};
 await writeFile(path.join(work,'wrangler.empty.json'),JSON.stringify(empty));
 const probe2=net.createServer();await new Promise(resolve=>probe2.listen(0,'127.0.0.1',resolve));const port2=probe2.address().port;await new Promise(resolve=>probe2.close(resolve));
 const emptyLogs=server(['dev','--config','wrangler.empty.json','--local','--ip','127.0.0.1','--port',String(port2),'--inspector-port','0']);
 const emptyBase=`http://127.0.0.1:${port2}`;await ready(emptyBase,emptyLogs);
 const emptyArt=await fetch(emptyBase+'/api/art');assert.equal((await emptyArt.json()).enabled,false);
 const emptyAccount=await fetch(emptyBase+'/api/account');assert.equal((await emptyAccount.json()).configured,false);
 for(const [route,method] of [['/api/account/login','GET'],['/api/billing/webhook','POST']]) {const r=await fetch(emptyBase+route,{method,signal:AbortSignal.timeout(10000)});assert.equal(r.status,503);security(r);assert.match(r.headers.get('cache-control'),/no-store/);await r.text();}
 // Exercise adapter data aliases against the actual generated Worker with a
 // one-request local bucket. The temporary entry controls only provider metadata
 // so workerd can also prove the production missing/invalid-header paths.
 const boundary={...empty,name:'qr-upgrade-web-boundary',main:'boundary-probe.mjs',vars:{},ratelimits:[{...config.ratelimits[0],simple:{limit:1,period:60}}]};
 await writeFile(path.join(work,'wrangler.boundary.json'),JSON.stringify(boundary));
 await writeFile(path.join(work,'boundary-probe.mjs'),`import worker from './cloudflare/worker.ts';
 export default { fetch(request,env,ctx) {
  const headers=new Headers(request.headers), mode=new URL(request.url).searchParams.get('fixtureMetadata');
  if(mode==='absent') headers.delete('cf-connecting-ip');
  else headers.set('cf-connecting-ip',mode==='invalid'?'invalid':'192.0.2.10');
  return worker.fetch(new Request(request,{headers}),env,ctx);
 }};`);
 const probe3=net.createServer();await new Promise(resolve=>probe3.listen(0,'127.0.0.1',resolve));const port3=probe3.address().port;await new Promise(resolve=>probe3.close(resolve));
 const boundaryLogs=server(['dev','--config','wrangler.boundary.json','--local','--ip','127.0.0.1','--port',String(port3),'--inspector-port','0']);
 const boundaryBase=`http://127.0.0.1:${port3}`;await ready(boundaryBase,boundaryLogs);
 const boundaryGet=(route,method='GET')=>fetch(boundaryBase+route,{method,redirect:'manual',signal:AbortSignal.timeout(10000)});
 const buildId=(await readFile(path.join(work,'.next/BUILD_ID'),'utf8')).trim();
 const aliases=[`/_next/data/${buildId}/api/art.json`,`/_next/data/${buildId}/api/account.json`,`/_next/data/${buildId}/api/billing/webhook.json`];
 const allowance=await boundaryGet('/api/art');assert.equal(allowance.status,200);await allowance.text();
 const exhausted=await boundaryGet('/api/art');assert.equal(exhausted.status,429);await exhausted.text();
 for(const method of ['GET','POST','HEAD','OPTIONS']) {
  for(const alias of aliases) {
   const blocked=await boundaryGet(alias,method);assert.equal(blocked.status,429,method+' data alias after exhaustion');security(blocked);assert.match(blocked.headers.get('cache-control'),/no-store/);await blocked.text();
   for(const metadata of ['absent','invalid']) {
    const unverified=await boundaryGet(alias+'?fixtureMetadata='+metadata,method);assert.equal(unverified.status,503,method+' data alias '+metadata+' metadata');security(unverified);assert.match(unverified.headers.get('cache-control'),/no-store/);
    if(method==='HEAD') await unverified.text();else assert.deepEqual(await unverified.json(),{error:'Request could not be verified.'});
   }
  }
 }
 const exactWebhook=await boundaryGet('/api/billing/webhook?fixtureMetadata=absent','POST');assert.equal(exactWebhook.status,503);assert.deepEqual(await exactWebhook.json(),{error:'Billing is temporarily unavailable. Please try again.'});
 console.log('T14 API data alias boundary: exhausted canonical bucket blocks GET/POST/HEAD/OPTIONS aliases; absent/invalid metadata fail closed; only original exact POST webhook dispatches.');
 console.log('T14 actual workerd: nonce, SSR, APIs, metadata, OG, isolated service binding and async signed webhook checks passed.');
 console.log('Local workerd startup output: '+logs().split('\n').filter(line=>/Ready|startup|Total Upload/.test(line)).join('\n'));
}
try {
 for(const name of ['package.json','package-lock.json','tsconfig.json','next-env.d.ts','next.config.ts','open-next.config.ts','wrangler.jsonc','postcss.config.mjs','src','shared','workers','cloudflare','public']) {
  await cp(path.join(root,name),path.join(work,name),{recursive:true,filter:source=>!privateName.test(path.relative(root,source))});
 }
 const before=await sourceDigest(work);
 await mkdir(path.join(work,'.open-next'));await writeFile(path.join(work,'.open-next/boundary-canary'),canaries[0]);await writeFile(path.join(work,'.dev.vars'),`CANARY=${canaries[1]}`);
 assert.equal(await sourceDigest(work),before,'Generated/private runtime files changed source digest');await rm(path.join(work,'.dev.vars'));await rm(path.join(work,'.open-next'),{recursive:true});
 run('npm',['ci','--ignore-scripts','--no-audit','--no-fund']);
 run('npm',['run','cf:typegen']);
 run('npm',['run','cf:build']); // Invokes the unchanged `npm run build` / next build contract.
 run('npm',['run','cf:dry-run','--','--outdir','dry-run']);
 await scanArtifacts();
 run(process.execPath,['node_modules/wrangler/bin/wrangler.js','check','startup','--outfile','startup.cpuprofile']);
 // Runtime variables are provided solely by the isolated local config after artifact scanning.
 delete env.QR_SERVICE_SECRET;delete env.GOOGLE_CLIENT_SECRET;
 await runtimeProof();
 console.log('T14 PASS; local proof only, no deployment or provider calls.');
} finally {
 for(const child of children) {try{process.kill(-child.pid,'SIGTERM');}catch{}}
 await Promise.all(children.map(child=>child.exitCode!==null?Promise.resolve():new Promise(resolve=>{child.once('exit',resolve);setTimeout(()=>{try{process.kill(-child.pid,'SIGKILL');}catch{}resolve();},3000).unref();})));
 if(keep) console.log('Synthetic-only temporary artifacts retained: '+work); else await rm(work,{recursive:true,force:true});
}

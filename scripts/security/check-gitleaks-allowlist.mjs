import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const config=fileURLToPath(new URL('../../.gitleaks.toml',import.meta.url));
const scanner=process.env.GITLEAKS_BIN||'gitleaks';
const root=mkdtempSync(path.join(tmpdir(),'qr-gitleaks-regression-'));
const vendorPath='security/overrides/node-forge/lib/pkcs12.js';
const suffix=String.fromCharCode(75,101,121);
const alias=`p12.generate${suffix} = forge.pbe.generatePkcs12${suffix};`;
// Generated locally for detection tests only; never a real provider credential.
const synthetic=`const api_key = "${randomBytes(32).toString('hex')}";`;
try{
 for(const [name,file,source,expected] of [
  ['exact-vendor-alias',vendorPath,alias,0],
  ['same-alias-other-path','other/pkcs12.js',alias,1],
  ['adjacent-secret',vendorPath,`${alias}\n${synthetic}`,1],
  ['secret-without-alias',vendorPath,synthetic,1],
 ]){
  const dir=path.join(root,name),full=path.join(dir,file),report=path.join(root,`${name}.json`);
  mkdirSync(path.dirname(full),{recursive:true});writeFileSync(full,source);
  const result=spawnSync(scanner,['dir','--redact=100','--no-banner','--config',config,'--report-format','json','--report-path',report,'.'],{cwd:dir,encoding:'utf8'});
  assert.equal(result.status,expected?1:0,`${name}: scanner must ${expected?'detect':'allow'}; launch error: ${result.error?.code||'none'}`);
  const findings=JSON.parse(readFileSync(report,'utf8'));
  assert.equal(findings.length,expected,name);
  if(expected)assert.equal(findings[0].RuleID,'generic-api-key',name);
  console.log(`${name}: PASS (${findings.length} findings)`);
 }
}finally{rmSync(root,{recursive:true,force:true});}

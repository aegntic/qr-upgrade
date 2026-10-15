import {test} from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {createMatrix,qrSvg,materialForAppearance} from '../shared/qr';
import {decodePixels} from '../shared/decode';
import {templates} from '../src/lib/generator-options';
for(const template of templates.filter(t=>materialForAppearance(t))) test(`${template.name} preserves exact contents at display/print sizes and mild blur`,async()=>{
 for(const text of ['https://qrupgrade.com/','https://example.com/?utm_source=print&utm_medium=qr&utm_campaign=baseline','WIFI:T:WPA;S:Demo;P:Synthetic-only;;','BEGIN:VCARD\r\nVERSION:3.0\r\nFN:Sample Person\r\nEND:VCARD','https://example.com/'+'a'.repeat(180)]) {
  const matrix=createMatrix(text),before=Buffer.from(matrix.data),reserved=Buffer.from(matrix.reservedBit),svg=qrSvg(matrix,template);
  assert.deepEqual(Buffer.from(matrix.data),before);assert.deepEqual(Buffer.from(matrix.reservedBit),reserved);
  for(const size of [768,384,280,256,180])for(const blur of [0,.4]){
   let image=sharp(Buffer.from(svg)).resize(size);if(blur)image=image.blur(blur);
   const {data,info}=await image.ensureAlpha().raw().toBuffer({resolveWithObject:true});
   assert.equal(decodePixels(new Uint8ClampedArray(data),info.width,info.height),text,`${template.name} ${matrix.size} modules ${size}px blur ${blur}`);
  }
 }
});
test('material default replaces the old photographic starting point',()=>{assert.equal(templates[0].name,'Obsidian glass');});

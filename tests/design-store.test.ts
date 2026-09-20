import { test } from 'node:test';
import assert from 'node:assert/strict';
import { indexedDB } from 'fake-indexeddb';
import { changeDesign, listDesigns, saveDesign } from '../src/lib/design-store';
import { defaultCaption, defaultImageAdjustments, type EditorDraft, type DesignArtifact } from '../src/lib/editor-draft';
Object.defineProperty(globalThis, 'window', {value: {indexedDB},configurable:true});
Object.defineProperty(globalThis, 'indexedDB', {value:indexedDB,configurable:true});
const draft: EditorDraft={version:1,kind:'wifi',content:{type:'wifi',url:'',ssid:'Synthetic test',password:'test-only',name:'',email:'',phone:''},mode:'art',appearance:{foreground:'#000000',background:'#ffffff',quietZone:4,style:'square'},template:'',art:'tiger',studyActive:false,customImage:'data:image/png;base64,test',logo:'',logoSize:20,logoFrame:'plain',strength:.5,sizeMm:70,showUtm:false,utm:{source:'',medium:'',campaign:''},adjustments:defaultImageAdjustments,caption:defaultCaption,name:'Saved test',destinationDrafts:{}};
const artifact:DesignArtifact={png:'data:image/png;base64,exact-pixels',svg:'<svg>exact artifact</svg>',text:'WIFI:T:WPA;S:Synthetic test;P:test-only;;',sizeMm:70,modules:33,pristine:true,reduced:true,simulated:true,dimensionsPass:true};
test('explicit save preserves exact artifact and private editable content, revision history is bounded',async()=>{
  assert.equal((await listDesigns()).length,0);
  let saved=await saveDesign(draft,artifact);
  assert.deepEqual(saved.artifact,artifact);assert.equal(saved.draft.content.password,'test-only');
  for(let i=0;i<7;i++)saved=await saveDesign({...draft,name:`Revision ${i}`},{...artifact,png:`data:image/png;base64,${i}`},saved.id);
  const listed=(await listDesigns())[0];assert.equal(listed.history.length,5);assert.equal(listed.name,'Revision 6');assert.equal(listed.history[0].draft.name,'Revision 5');
  const renamed=await changeDesign(saved.id,'rename','Renamed');assert.equal(renamed.draft.name,'Renamed');
  const duplicate=await changeDesign(saved.id,'duplicate');assert.notEqual(duplicate.id,saved.id);assert.deepEqual(duplicate.artifact,renamed.artifact);assert.equal(duplicate.history.length,0);
  const archived=await changeDesign(saved.id,'archive');assert.equal(archived.archived,true);const restored=await changeDesign(saved.id,'restore');assert.equal(restored.archived,false);
});
test('concurrent saves to the same record retain each revision atomically',async()=>{
  const initial=await saveDesign(draft,artifact);
  await Promise.all([saveDesign({...draft,name:'A'},artifact,initial.id),saveDesign({...draft,name:'B'},artifact,initial.id)]);
  const latest=(await listDesigns()).find(d=>d.id===initial.id)!;
  assert.equal(latest.history.length,2);assert.equal(latest.history[1].draft.name,'Saved test');
});

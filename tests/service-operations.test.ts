import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ServiceEpochs,ServiceOperations,captureAccountConfirmation} from '../src/lib/service-operations';
function deferred<T>(){let resolve!:(value:T)=>void;const promise=new Promise<T>(done=>{resolve=done;});return {promise,resolve};}
// The same synchronous epoch/setter contract used by WorkflowProvider, with real deferred work.
function state(){
 const epochs=new ServiceEpochs();let content='A',link='A',owner:string|null='account-A';
 return {epochs,get content(){return content;},get link(){return link;},get owner(){return owner;},edit(kind:'content'|'link',value:string){epochs.edit(kind);if(kind==='content')content=value;else link=value;},reconcile(next:string|null){epochs.reconcile();owner=next;content='';link='';}};
}
for(const kind of ['content','link'] as const){
 test(`${kind} delayed save cannot overwrite B after unmount/remount`,async()=>{
  const store=state(),scope=new ServiceOperations();scope.mount();const operation=scope.begin(store.epochs,kind),response=deferred<string>();
  const save=(async()=>{const result=await response.promise;if(operation.current())store.edit(kind,result);})();
  scope.unmount();scope.mount();store.edit(kind,'B');response.resolve('saved A');await save;
  assert.equal(store[kind],'B');assert.equal(operation.signal.aborted,true);
 });
 test(`${kind} delayed save cannot restore old private state after logout or account switch`,async()=>{
  for(const next of [null,'account-B']){
   const store=state(),scope=new ServiceOperations();scope.mount();const operation=scope.begin(store.epochs,kind),response=deferred<string>();
   const save=(async()=>{const result=await response.promise;if(operation.current())store.edit(kind,result);})();
   store.reconcile(next);response.resolve('private A');await save;assert.equal(store[kind],'');assert.equal(store.owner,next);
  }
 });
}
test('pending image decode / FileReader does not start an upload after editor or account changes',async()=>{
 for(const invalidate of ['edit','logout','unmount'] as const){
  const store=state(),scope=new ServiceOperations();scope.mount();const operation=scope.begin(store.epochs,'content'),decode=deferred<string>();let requests=0;
  const upload=(async()=>{await decode.promise;if(!operation.current())return;requests++;})();
  if(invalidate==='edit')store.edit('content','B');else if(invalidate==='logout')store.reconcile(null);else scope.unmount();
  decode.resolve('file data');await upload;assert.equal(requests,0);
 }
});
test('upload response cannot attach an old asset to a remounted or edited page',async()=>{
 for(const remount of [true,false]){
  const store=state(),scope=new ServiceOperations();scope.mount();const operation=scope.begin(store.epochs,'content'),response=deferred<string>();
  const upload=(async()=>{const asset=await response.promise;if(operation.current())store.edit('content',asset);})();
  if(remount){scope.unmount();scope.mount();}store.edit('content','B');response.resolve('asset-for-A');await upload;assert.equal(store.content,'B');
 }
});
test('restoration cannot reset owner or editors after reconciliation or newer drafting',async()=>{
 for(const invalidate of ['logout','account-B','content','link'] as const){
  const store=state(),scope=new ServiceOperations();scope.mount();const operation=scope.begin(store.epochs,'both'),accountResponse=deferred<string>();
  const restore=(async()=>{const owner=await accountResponse.promise;if(!operation.current())return;store.reconcile(owner);store.edit('content','private A');store.edit('link','private A');})();
  if(invalidate==='content'||invalidate==='link')store.edit(invalidate,'new work');else store.reconcile(invalidate==='logout'?null:invalidate);
  const before={content:store.content,link:store.link,owner:store.owner};accountResponse.resolve('account-A');await restore;
  assert.deepEqual({content:store.content,link:store.link,owner:store.owner},before);
 }
});
test('new operation supersedes old one; current completion and unrelated editor edits remain valid',async()=>{
 const store=state(),scope=new ServiceOperations();scope.mount();const first=scope.begin(store.epochs,'content'),old=deferred<string>();
 const stale=(async()=>{const result=await old.promise;if(first.current())store.edit('content',result);})();
 const second=scope.begin(store.epochs,'content');store.edit('link','link B');assert.equal(second.current(),true);
 if(second.current())store.edit('content','saved current');assert.equal(second.alive(),true);assert.equal(second.current(),false);
 old.resolve('old result');await stale;assert.equal(store.content,'saved current');
});
test('initial collection load rechecks account epoch after its own reconciliation',()=>{
 const store=state(),scope=new ServiceOperations();scope.mount();const operation=scope.begin(store.epochs,'account');
 assert.equal(operation.current(),true);store.reconcile('account-A');operation.recapture();assert.equal(operation.current(),true);
 store.reconcile(null);assert.equal(operation.current(),false);
});
test('an authorized upload response cannot reintroduce an asset after logout or account switch',async()=>{
 for(const next of [null,'account-B']){
  const store=state(),scope=new ServiceOperations();scope.mount();const operation=scope.begin(store.epochs,'content'),response=deferred<string>();
  const upload=(async()=>{const asset=await response.promise;if(operation.current())store.edit('content',asset);})();
  store.reconcile(next);response.resolve('private-asset-A');await upload;assert.equal(store.content,'');assert.equal(store.owner,next);
 }
});
for(const first of ['workspace','restoration'] as const){
 test(`passive same-account responses keep both transfer and collection when ${first} finishes first`,async()=>{
  const epochs=new ServiceEpochs(),owner:{current:string|null|undefined}={current:undefined};
  let draft='',collection:string[]=[];let transfer=true,signedIn=false;
  const reconcile=(next:string|null)=>{epochs.reconcile();owner.current=next;draft='';transfer=false;};
  const workspace=new ServiceOperations(),restoration=new ServiceOperations();workspace.mount();restoration.mount();
  const load=workspace.begin(epochs,'account'),restore=restoration.begin(epochs,'both');
  const confirmLoad=captureAccountConfirmation(owner,epochs,reconcile),confirmRestore=captureAccountConfirmation(owner,epochs,reconcile);
  const loadResponse=deferred<string>(),restoreResponse=deferred<string>();
  const loadDone=(async()=>{const next=await loadResponse.promise;if(!load.current()||!confirmLoad(next))return;signedIn=true;load.recapture();if(load.current())collection=['existing page'];})();
  const restoreDone=(async()=>{const next=await restoreResponse.promise;if(!restore.current()||!transfer||!confirmRestore(next))return;epochs.edit('content');draft='opted-in draft';transfer=false;})();
  if(first==='workspace'){loadResponse.resolve('account-A');await loadDone;assert.equal(transfer,true);restoreResponse.resolve('account-A');}
  else{restoreResponse.resolve('account-A');await restoreDone;loadResponse.resolve('account-A');}
  await Promise.all([loadDone,restoreDone]);assert.equal(owner.current,'account-A');assert.equal(signedIn,true);assert.deepEqual(collection,['existing page']);assert.equal(draft,'opted-in draft');
 });
}
test('explicit logout wins over both concurrent passive account requests',async()=>{
 const epochs=new ServiceEpochs(),owner:{current:string|null|undefined}={current:undefined};
 let draft='';const reconcile=(next:string|null)=>{epochs.reconcile();owner.current=next;draft='';};
 const confirmLoad=captureAccountConfirmation(owner,epochs,reconcile),confirmRestore=captureAccountConfirmation(owner,epochs,reconcile);
 const response=deferred<string>();const pending=(async()=>{const next=await response.promise;assert.equal(confirmLoad(next),false);if(confirmRestore(next))draft='private A';})();
 reconcile(null);response.resolve('account-A');await pending;assert.equal(owner.current,null);assert.equal(draft,'');
});
test('conflicting concurrent identity responses cannot replace the first confirmed owner',()=>{
 const epochs=new ServiceEpochs(),owner:{current:string|null|undefined}={current:undefined};
 const reconcile=(next:string|null)=>{epochs.reconcile();owner.current=next;};
 const first=captureAccountConfirmation(owner,epochs,reconcile),late=captureAccountConfirmation(owner,epochs,reconcile);
 assert.equal(first('account-B'),true);assert.equal(late('account-A'),false);assert.equal(owner.current,'account-B');
});
test('a new passive check detecting an actual owner change invalidates pending private operations',()=>{
 const epochs=new ServiceEpochs(),owner:{current:string|null|undefined}={current:'account-A'};
 let draft='private A';const reconcile=(next:string|null)=>{epochs.reconcile();owner.current=next;draft='';};
 const valid=epochs.capture('content'),confirm=captureAccountConfirmation(owner,epochs,reconcile);
 assert.equal(confirm('account-B'),true);assert.equal(valid(),false);assert.equal(draft,'');assert.equal(owner.current,'account-B');
});

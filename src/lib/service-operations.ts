export type EditorScope='content'|'link'|'both'|'account';
/** Shared synchronous generations invalidate async work before React commits a render. */
export class ServiceEpochs {
 private account=0;
 private content=0;
 private link=0;
 edit(kind:'content'|'link'){this[kind]++;}
 reconcile(){this.account++;}
 capture(kind:EditorScope){
  const account=this.account,content=this.content,link=this.link;
  const checkContent=kind==='content'||kind==='both',checkLink=kind==='link'||kind==='both';
  return()=>account===this.account&&(!checkContent||content===this.content)&&(!checkLink||link===this.link);
 }
}
/** One mounted workspace operation; abort is best-effort, generations remain authoritative. */
export class ServiceOperations {
 private generation=0;
 private mounted=false;
 private controller:AbortController|null=null;
 mount(){this.mounted=true;this.generation++;}
 unmount(){this.mounted=false;this.generation++;this.controller?.abort();}
 begin(epochs:ServiceEpochs,kind:EditorScope){
  this.controller?.abort();const controller=new AbortController();this.controller=controller;
  const generation=++this.generation;let validEpoch=epochs.capture(kind);
  const alive=()=>this.mounted&&generation===this.generation&&!controller.signal.aborted;
  return {signal:controller.signal,alive,current:()=>alive()&&validEpoch(),recapture:()=>{validEpoch=epochs.capture(kind);}};
 }
}

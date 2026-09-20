'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
type Decision={discard:()=>void;keep?:()=>void};
export function useDiscardDialog(){
 const [pending,setPending]=useState<Decision|null>(null);
 const request=useCallback((dirty:boolean,action:()=>void,keep?:()=>void)=>{if(dirty)setPending({discard:action,keep});else action();},[]);
 const dialog=pending?<DiscardDialog onStay={()=>setPending(null)} onDiscard={()=>{setPending(null);pending.discard();}} onKeep={pending.keep}/>:null;
 return {request,dialog};
}
function DiscardDialog({onStay,onDiscard,onKeep}:{onStay:()=>void;onDiscard:()=>void;onKeep?:()=>void}){
 const ref=useRef<HTMLDialogElement>(null),[error,setError]=useState('');
 useEffect(()=>{const element=ref.current;const previous=document.activeElement as HTMLElement|null;element?.showModal();return()=>{element?.close();previous?.focus();};},[]);
 return <dialog ref={ref} className="service-discard-dialog" aria-labelledby="discard-title" aria-describedby="discard-description" onCancel={event=>{event.preventDefault();onStay();}}><h2 id="discard-title">Keep your unsaved changes?</h2><p id="discard-description">Drafts stay in memory while you browse this site. Discarding removes your unsaved page or link changes.</p>{onKeep&&<p>To keep your draft through sign-in, store its text and file references in this browser tab for up to 30 minutes. No uploaded files are stored. It is removed from temporary storage when you return and becomes available to the account you sign in to. Avoid this on a shared device.</p>}{error&&<p role="alert">{error}</p>}<div><button className="primary-button" autoFocus onClick={onStay}>Stay and keep editing</button>{onKeep&&<button className="primary-button" onClick={()=>{try{onKeep();}catch(e){setError(e instanceof Error?e.message:'Temporary storage is unavailable. Stay here to keep editing.');}}}>Keep draft in this tab and sign in</button>}<button className="small-control" onClick={onDiscard}>Discard and continue</button></div></dialog>;
}

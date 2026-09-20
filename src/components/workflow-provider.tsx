'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction, type ReactNode } from 'react';
import {useRouter} from 'next/navigation';
import type { EditorDraft, DesignArtifact } from '@/lib/editor-draft';
import {contentDirty,linkDirty,newContentEditor,newLinkEditor,type ContentEditor,type LinkEditor} from '@/lib/service-drafts';
import {SIGN_IN_DRAFT_KEY,encodeSignInDraft,decodeSignInDraft} from '@/lib/sign-in-drafts';
import {useDiscardDialog} from './discard-dialog';
type Workflow = { contentEditor: ContentEditor; setContentEditor: Dispatch<SetStateAction<ContentEditor>>; linkEditor: LinkEditor; setLinkEditor: Dispatch<SetStateAction<LinkEditor>>; reconcileAccount: (owner:string|null)=>void; draft: EditorDraft | null; artifact: DesignArtifact | null; savedId?: string; setDesign: (draft: EditorDraft, artifact: DesignArtifact | null, savedId?: string) => void; clear: () => void };
const Context = createContext<Workflow | null>(null);
export function WorkflowProvider({ children }: { children: ReactNode }) {
  const router=useRouter();
  const [value, setValue] = useState<{ draft: EditorDraft | null; artifact: DesignArtifact | null; savedId?: string }>({ draft: null, artifact: null });
  const [contentEditor,setContentEditor]=useState(newContentEditor),[linkEditor,setLinkEditor]=useState(newLinkEditor);
  const owner=useRef<string|null|undefined>(undefined);
  const transfer=useRef<{read:boolean;raw:string|null}>({read:false,raw:null});
  const [recovered,setRecovered]=useState(false);
  const discard=useDiscardDialog();
  const reconcileAccount=useCallback((nextOwner:string|null)=>{if(owner.current!==undefined&&owner.current!==nextOwner){setContentEditor(newContentEditor());setLinkEditor(newLinkEditor());try{sessionStorage.removeItem(SIGN_IN_DRAFT_KEY);}catch{}}owner.current=nextOwner;},[]);
  useEffect(()=>{
    if(!transfer.current.read){transfer.current.read=true;try{transfer.current.raw=sessionStorage.getItem(SIGN_IN_DRAFT_KEY);sessionStorage.removeItem(SIGN_IN_DRAFT_KEY);}catch{}}
    const raw=transfer.current.raw;if(!raw)return;
    let active=true;
    fetch('/api/account',{cache:'no-store'}).then(async response=>{if(!response.ok)throw new Error();return response.json();}).then(status=>{
      if(!active)return;const nextOwner=status.signedIn?status.user.email:null,restored=decodeSignInDraft(raw!,nextOwner);
      if(restored){owner.current=nextOwner;setContentEditor(restored.content);setLinkEditor(restored.link);setRecovered(true);transfer.current.raw=null;}
    }).catch(()=>{});
    return()=>{active=false;};
  },[]);
  const dirty=contentDirty(contentEditor)||linkDirty(linkEditor);
  useEffect(()=>{
    if(!dirty)return;
    const unload=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};
    const leave=(event:MouseEvent)=>{
      const anchor=(event.target as Element)?.closest?.('a');
      if(!anchor||event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||anchor.target==='_blank'||anchor.hasAttribute('download'))return;
      const url=new URL(anchor.href,window.location.href);
      if(url.origin===window.location.origin&&!url.pathname.startsWith('/api/'))return;
      event.preventDefault();event.stopPropagation();
      const proceed=()=>{window.removeEventListener('beforeunload',unload);setContentEditor(newContentEditor());setLinkEditor(newLinkEditor());window.location.assign(url.href);};
      discard.request(true,()=>{try{sessionStorage.removeItem(SIGN_IN_DRAFT_KEY);}catch{}proceed();},url.origin===window.location.origin&&url.pathname==='/api/account/login'?()=>{if(owner.current===undefined)throw new Error('Your account status could not be verified. Stay here and try again after refreshing your account status.');sessionStorage.setItem(SIGN_IN_DRAFT_KEY,encodeSignInDraft(owner.current??null,contentEditor,linkEditor));proceed();}:undefined);
    };
    window.addEventListener('beforeunload',unload);document.addEventListener('click',leave,true);
    return()=>{window.removeEventListener('beforeunload',unload);document.removeEventListener('click',leave,true);};
  },[dirty,discard.request,contentEditor,linkEditor]);
  const setDesign = useCallback((draft: EditorDraft, artifact: DesignArtifact | null, savedId?: string) => setValue({ draft, artifact, savedId }), []);
  const clear = useCallback(() => setValue({ draft: null, artifact: null }), []);
  const state = useMemo(() => ({ ...value, setDesign, clear,contentEditor,setContentEditor,linkEditor,setLinkEditor,reconcileAccount }), [value, setDesign, clear,contentEditor,linkEditor,reconcileAccount]);
  return <Context.Provider value={state}>{recovered&&<aside className="service-recovered" role="status">Your draft is back in this tab. Temporary sign-in storage has been cleared. <a href="/content" onClick={event=>{event.preventDefault();router.push('/content');}}>Open page draft</a> · <a href="/links" onClick={event=>{event.preventDefault();router.push('/links');}}>Open link draft</a> <button onClick={()=>setRecovered(false)} aria-label="Dismiss draft recovery message">Dismiss</button></aside>}{children}{discard.dialog}</Context.Provider>;
}
export function useWorkflow() { const state = useContext(Context); if (!state) throw new Error('WorkflowProvider is required.'); return state; }

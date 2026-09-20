'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { CloudUpload } from 'lucide-react';
import type { DesignArtifact, EditorDraft } from '@/lib/editor-draft';

export default function CloudSave({ draft, artifact, disabled, onSaved, onBusy }: {
  draft: EditorDraft; artifact: DesignArtifact | null; disabled: boolean;
  onSaved: (id: string) => void; onBusy: (value: boolean) => void;
}) {
  const [account, setAccount] = useState<{configured:boolean;signedIn:boolean}|null>(null);
  const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
  const inFlight=useRef(false);
  useEffect(()=>{const controller=new AbortController();fetch('/api/account',{cache:'no-store',signal:controller.signal}).then(r=>r.ok?r.json():null).then(setAccount).catch(()=>{});return()=>controller.abort();},[]);
  async function save(){
    if(!artifact||disabled||inFlight.current)return;
    inFlight.current=true;setBusy(true);onBusy(true);setMessage('');
    try{
      const body=JSON.stringify({name:draft.name.trim()||'Untitled QR',draft,artifact:{png:artifact.png}});
      if(new Blob([body]).size>3*1024*1024)throw new Error('This image is too large for cloud storage. Save a copy in this browser instead.');
      const response=await fetch(`/api/account/designs${draft.cloudId?`/${draft.cloudId}`:''}`,{method:draft.cloudId?'PUT':'POST',headers:{'Content-Type':'application/json'},body,signal:AbortSignal.timeout(20000)});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||'Cloud save could not be completed.');
      onSaved(data.design.id);setMessage('Saved privately to your account.');
    }catch(error){setMessage(error instanceof Error&&error.name!=='TimeoutError'?error.message:'The save may have completed. Check your cloud collection before trying again.');}
    finally{inFlight.current=false;setBusy(false);onBusy(false);}
  }
  if(!account)return null;
  if(!account.signedIn)return <Link className="cloud-account-link" href="/account">{account.configured?'Sign in for cloud saving':'Cloud accounts · setup in progress'} ↗</Link>;
  return <div className="cloud-save"><button className="workflow-wide" disabled={disabled||!artifact||busy} onClick={()=>void save()}><CloudUpload size={15}/>{busy?'Saving privately…':draft.cloudId?'Update cloud copy':'Save to cloud'}</button><p className="generator-note">Saves this design, images and destination to your private Cloudflare storage.</p>{message&&<p role="status" className="generator-note">{message}</p>}<Link href="/cloud-designs">Open cloud collection ↗</Link></div>;
}

'use client';
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';

const sections=[['profile','Account profile'],['designs','Cloud design metadata and file list'],['links','Dynamic links'],['scans','Daily scan totals'],['pages','Hosted page drafts and published versions'],['assets','Uploaded asset metadata and file list'],['feedback','Received feedback'],['billing_customer','App billing customer linkage'],['billing_events','App billing event metadata'],['security','Retained security activity']] as const;
type Section=typeof sections[number][0];
type Progress={parts:number;records:number;cursor:string|null;complete:boolean};
type FileEntry={id:string;name:string;file:{status:'ready_to_request'|'unavailable_pending';download:string|null}};
const initial:Progress={parts:0,records:0,cursor:null,complete:false};
function save(bytes:Blob,name:string){const url=URL.createObjectURL(bytes),link=document.createElement('a');link.href=url;link.download=name;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}

export default function AccountExportPanel({disabled=false}:{disabled?:boolean}){
 const [section,setSection]=useState<Section>('profile'),[progress,setProgress]=useState<Partial<Record<Section,Progress>>>({}),[files,setFiles]=useState<FileEntry[]>([]);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[requested,setRequested]=useState<string[]>([]),[retryPart,setRetryPart]=useState(false);
 const controller=useRef<AbortController|null>(null);
 useEffect(()=>()=>{controller.current?.abort();},[]);
 const state=progress[section]??initial;
 function clearExpiredState(){setProgress({});setFiles([]);setRequested([]);setNotice('');setRetryPart(false);}
 async function downloadPart(){
  controller.current?.abort();const request=new AbortController();controller.current=request;setBusy(true);setError('');setNotice('');
  try{
   const response=await fetch('/api/account/export',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({section,cursor:state.cursor}),cache:'no-store',signal:request.signal});
   const text=await response.text(),data=JSON.parse(text);if(response.status===401)clearExpiredState();if(!response.ok)throw new Error(data.error||'This part could not be prepared. Retry this part.');
   if(request.signal.aborted)return;
   save(new Blob([text],{type:'application/json'}),`qrupgrade-${section}-part-${state.parts+1}.json`);
   setProgress(previous=>({...previous,[section]:{parts:state.parts+1,records:state.records+data.records.length,cursor:data.nextCursor,complete:data.complete}}));
   setRetryPart(false);setFiles(section==='designs'||section==='assets'?data.records:[]);setRequested([]);
   setNotice(`Download requested for part ${state.parts+1}. Check your browser downloads and save it. ${data.complete?'This section has no further parts.':'Save any original files listed below before downloading the next part.'}`);
  }catch(cause){if(!request.signal.aborted){setRetryPart(true);setError(cause instanceof Error?cause.message:'Could not download this part. Retry this part.');}}
  finally{if(!request.signal.aborted)setBusy(false);}
 }
 async function downloadFile(file:FileEntry){
  if(!file.file.download)return;
  controller.current?.abort();const request=new AbortController();controller.current=request;setBusy(true);setError('');
  try{
   const response=await fetch(file.file.download,{cache:'no-store',signal:request.signal});
   if(response.status===401)clearExpiredState();if(!response.ok){const data=await response.json();throw new Error(data.error||'This file could not be downloaded. Try again.');}
   const blob=await response.blob();if(request.signal.aborted)return;
   save(blob,`qrupgrade-${section==='designs'?'design':'asset'}-${file.id}.${section==='designs'?'json':'bin'}`);
   setRequested(previous=>[...previous,file.id]);setNotice('File download requested. Check your browser downloads to confirm it was saved.');
  }catch(cause){if(!request.signal.aborted)setError(cause instanceof Error?cause.message:'This file could not be downloaded. Try again.');}
  finally{if(!request.signal.aborted)setBusy(false);}
 }
 return <section className="account-export" aria-labelledby="account-export-title"><h2 id="account-export-title">Download your account data</h2>
  <p>Save each section, one part at a time. Archived and pending records are included. Cloud design JSON and uploaded originals are separate downloads in their file lists; metadata does not mean those files have been saved.</p>
  <p>These are live pages of data, not an atomic snapshot. Edits, new activity or retention cleanup during export can change later parts. Security activity covers the latest 100 events for up to 30 days.</p>
  <p><Link href="/designs">On-device designs</Link> stay in this browser and need separate local exports. Anonymous artwork jobs use a separate browser identity and are not included. Independent Stripe receipts are separate; use <Link href="/billing">Billing</Link> to access your billing account. Account export remains available after downgrade and during billing outages.</p>
  <label htmlFor="export-section">Section</label><select id="export-section" value={section} disabled={busy||disabled} onChange={event=>{setSection(event.target.value as Section);setFiles([]);setRequested([]);setError('');setRetryPart(false);setNotice('');}}>{sections.map(([value,label])=><option key={value} value={value}>{label}{progress[value]?.complete?' — all parts requested':''}</option>)}</select>
  <p>{state.parts} part{state.parts===1?'':'s'} requested · {state.records} records in those parts. {state.complete?'No further parts in this section.':'More parts may be available.'}</p>
  <button disabled={busy||disabled||state.complete} onClick={downloadPart}>{busy?'Preparing download…':retryPart?'Retry this part':`Download part ${state.parts+1}`}</button>
  {state.parts>0&&<button disabled={busy||disabled} onClick={()=>{setProgress(previous=>({...previous,[section]:{...initial}}));setFiles([]);setRequested([]);setError('');setRetryPart(false);setNotice('Section restarted. Existing downloads stay on your device.');}}>Restart this section</button>}
  <div role="status" aria-live="polite">{notice}</div>{error&&<p className="account-error" role="alert">{error} {retryPart?'Retry this part to continue.':'Use the file download button to retry.'}</p>}
  {files.length>0&&<div><h3>Files from part {state.parts}</h3><p>Save the originals you want before moving to another section or part. Ready means a download can be requested; missing objects will show an error.</p><ul>{files.map(file=><li key={file.id}><span>{file.name}</span>{file.file.download?<button disabled={busy||disabled} onClick={()=>downloadFile(file)}>{requested.includes(file.id)?'Download again':'Download original'}</button>:<span>Pending — file unavailable</span>}{requested.includes(file.id)&&<small>Download requested; confirm it was saved.</small>}</li>)}</ul></div>}
  <details><summary>Section progress</summary><ul>{sections.map(([value,label])=><li key={value}>{label}: {progress[value]?.parts??0} parts requested{progress[value]?.complete?' (no further parts)':''}</li>)}</ul></details>
 </section>;
}

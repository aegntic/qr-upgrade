'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Archive, ArrowUpRight, Copy, FolderOpen, Plus, RotateCcw, Search } from 'lucide-react';
import { changeDesign, listDesigns } from '@/lib/design-store';
import type { SavedDesign, SavedRevision } from '@/lib/editor-draft';
import { useWorkflow } from './workflow-provider';
export default function DesignLibrary() {
  const [designs, setDesigns] = useState<SavedDesign[]>([]), [query, setQuery] = useState(''), [archived, setArchived] = useState(false), [loading, setLoading] = useState(true), [error, setError] = useState(''), [busy, setBusy] = useState('');
  const [renaming, setRenaming] = useState(''), [name, setName] = useState('');
  const workflow = useWorkflow(), router = useRouter();
  useEffect(() => { let active = true; listDesigns().then(v => { if(active) setDesigns(v); }).catch(e => { if(active) setError(e.message); }).finally(() => { if(active) setLoading(false); }); return () => { active = false; }; }, []);
  async function mutate(item: SavedDesign, action: 'archive' | 'restore' | 'rename' | 'duplicate') {
    setBusy(item.id); setError('');
    try { await changeDesign(item.id, action, name); setDesigns(await listDesigns()); setRenaming(''); }
    catch(e) { setError(e instanceof Error ? e.message : 'Try again.'); }
    finally { setBusy(''); }
  }
  function open(item: SavedDesign, revision?: SavedRevision) { workflow.setDesign({ ...(revision?.draft || item.draft), name: item.name, cloudId: undefined }, null, item.id); router.push('/generator?resume=1'); }
  const visible = designs.filter(d => d.archived === archived && `${d.name} ${d.draft.kind} ${d.draft.mode}`.toLowerCase().includes(query.trim().toLowerCase()));
  return <section className="design-library">
    <div className="workflow-toolbar"><label className="workflow-search"><Search size={17}/><input aria-label="Search saved designs" placeholder="Find a design…" value={query} onChange={e=>setQuery(e.target.value)}/></label><button aria-pressed={archived} onClick={()=>setArchived(v=>!v)}><Archive size={16}/>{archived ? 'Show active' : 'Archive'}</button><Link className="nav-cta" href="/generator?new=1"><Plus size={16}/>New design</Link></div>
    <p className="workflow-disclosure">Saved in this browser, on this device. Designs include your destination, images and any Wi-Fi or contact details you enter. Clearing site data removes them. <Link href="/cloud-designs">Open your private cloud collection ↗</Link></p>
    {error && <p role="alert" className="generator-error">{error}</p>}
    {loading ? <p role="status">Opening your collection…</p> : !visible.length ? <div className="workflow-empty"><FolderOpen size={36}/><h2>{query ? 'No matching designs' : archived ? 'Your archive is empty' : 'Your next signature starts here.'}</h2><p>{query ? 'Try another name or destination type.' : 'Create a QR image, then choose Save design in the studio.'}</p><Link className="primary-button" href="/generator?new=1">Open the studio <ArrowUpRight size={18}/></Link></div> : <div className="saved-design-grid">{visible.map(item=><article className="saved-design-card" key={item.id} aria-label={item.name}>
      <button className="saved-design-image" onClick={()=>open(item)} aria-label={`Edit ${item.name}`}><img src={item.artifact.png} alt={item.name} width={384} height={384}/><span>Open in studio ↗</span></button>
      <div className="saved-design-info"><span className="section-kicker">{item.draft.kind} · {item.draft.mode === 'art' ? 'QR Art' : item.draft.mode === 'image' ? 'Image QR' : 'Custom QR'}</span><h2>{item.name}</h2><p>Saved {new Date(item.updatedAt).toLocaleDateString()}</p>
      {renaming===item.id ? <form className="workflow-inline-form" onSubmit={e=>{e.preventDefault();void mutate(item,'rename');}}><input aria-label="Design name" value={name} maxLength={80} onChange={e=>setName(e.target.value)} autoFocus/><button disabled={!!busy} type="submit">Save name</button><button type="button" onClick={()=>setRenaming('')}>Cancel</button></form> : <div className="workflow-card-actions"><button onClick={()=>{setName(item.name);setRenaming(item.id);}}>Rename</button><button disabled={!!busy} onClick={()=>void mutate(item,'duplicate')}><Copy size={14}/>Duplicate</button><button disabled={!!busy} onClick={()=>void mutate(item,item.archived?'restore':'archive')}>{item.archived ? <RotateCcw size={14}/> : <Archive size={14}/>}{item.archived?'Restore':'Archive'}</button></div>}
      {item.history.length>0 && <details className="design-history"><summary>{item.history.length} earlier {item.history.length===1?'version':'versions'}</summary>{item.history.map((revision,i)=><button key={`${revision.id}-${i}`} onClick={()=>open(item,revision)}><RotateCcw size={14}/><span>{new Date(revision.savedAt).toLocaleString()}</span><span>Open version</span></button>)}<p>Opening a version does not overwrite your saved design. Save in the studio to keep it.</p></details>}
      </div></article>)}</div>}
  </section>;
}

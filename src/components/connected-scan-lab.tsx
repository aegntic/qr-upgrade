'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowDownToLine, Check, ImagePlus, LoaderCircle, Move, RotateCcw } from 'lucide-react';
import { validateRendered, exportQR, readLocalImage } from '@/lib/browser-qr';
import { useWorkflow } from './workflow-provider';
import ArtStudio from './art-studio';

export default function ConnectedScanLab() {
  const workflow = useWorkflow();
  if (!workflow.artifact || !workflow.draft) return <><div className="workflow-notice"><p>Start a new example below, or open a saved design in the studio and choose <strong>Test this design</strong>. Unsaved work stays available while navigating within this tab; a refresh starts a new session.</p><Link href="/designs">Open my designs ↗</Link></div><ArtStudio/></>;
  return <CurrentDesignLab key={workflow.artifact.png.slice(-80) + workflow.artifact.text} />;
}
function CurrentDesignLab() {
  const { draft, artifact, savedId, setDesign } = useWorkflow();
  const router = useRouter();
  const [sizeMm, setSizeMm] = useState(artifact!.sizeMm), [distanceCm, setDistance] = useState(40), [blur, setBlur] = useState(0), [rotation, setRotation] = useState(0), [scene, setScene] = useState('packaging'), [customScene, setCustomScene] = useState(''), [reading, setReading] = useState(false), [view, setView] = useState('scene');
  const [position, setPosition] = useState({x:50,y:62}), [proof, setProof] = useState<{key:string;pristine:boolean;simulated:boolean;pixels:number}|null>(null), [failure, setFailure] = useState<{key:string;message:string}|null>(null), [notice, setNotice] = useState(''), [exporting, setExporting] = useState(false);
  const board = useRef<HTMLDivElement>(null), upload = useRef<HTMLInputElement>(null), sequence = useRef(0);
  const key = JSON.stringify([artifact?.svg, artifact?.text, sizeMm, distanceCm, blur, rotation]);
  const current = proof?.key===key ? proof : null;
  const dimensionsPass = sizeMm/(artifact!.modules+8)>=0.4 && sizeMm>=distanceCm;
  const ready = !!current?.pristine && !!current.simulated && artifact!.reduced && dimensionsPass;
  useEffect(()=>{ let cancelled=false; const timer=setTimeout(()=>{validateRendered(artifact!.svg,artifact!.text,{sizeMm,distanceCm,blur,rotation}).then(p=>{if(!cancelled)setProof({...p,key});}).catch(e=>{if(!cancelled)setFailure({key,message:e.message});});},120);return()=>{cancelled=true;clearTimeout(timer);};},[artifact,sizeMm,distanceCm,blur,rotation,key]);
  useEffect(()=>()=>{sequence.current++;},[]);
  async function chooseScene(file?:File){ if(!file)return;const token=++sequence.current;setReading(true);try{const result=await readLocalImage(file);if(sequence.current===token){setCustomScene(result);setScene('custom');}}catch(e){if(sequence.current===token)setNotice(e instanceof Error?e.message:'Cannot read this scene.');}finally{if(sequence.current===token)setReading(false);}}
  function edit(){setDesign({...draft!,sizeMm},null,savedId);router.push('/generator?resume=1');}
  async function download(){if(!ready||exporting||reading)return;setExporting(true);try{await exportQR(artifact!.svg,'png',sizeMm,draft!.name);setNotice('Your QR image was downloaded. The placement scene is not included.');}catch(e){setNotice(e instanceof Error?e.message:'Export failed.');}finally{setExporting(false);}}
  const checks=[['Full-size image',current?.pristine],['256 px image',artifact!.reduced],['Selected conditions',current?.simulated],['Print size & distance',dimensionsPass]] as const;
  return <section className="connected-lab">
    <div className="workflow-toolbar"><button onClick={edit}><ArrowLeft size={16}/>Back to your design</button><span className="workflow-session"><span/>Testing <strong>{draft!.name || 'Untitled QR'}</strong> · exact studio image</span><Link href="/designs">My designs ↗</Link></div>
    <div className="lab-workspace"><div className="lab-preview-panel">
      <div className="workflow-toolbar"><div className="workflow-segmented"><button aria-pressed={view==='scene'} onClick={()=>setView('scene')}>In context</button><button aria-pressed={view==='image'} onClick={()=>setView('image')}>Original image</button></div>{view==='scene'&&<button disabled={reading} onClick={()=>upload.current?.click()}><ImagePlus size={16}/>{reading?'Reading…':'Your scene'}</button>}</div>
      {view==='scene' ? <><div className="lab-scene-selector">{[['packaging','Packaging'],['poster','Poster'],['card','Business card'],...(customScene?[['custom','Your scene']]:[])].map(([id,label])=><button key={id} aria-pressed={scene===id} onClick={()=>{sequence.current++;setReading(false);setScene(id);}}>{label}</button>)}</div><div ref={board} className="workflow-scene" style={{backgroundImage:`url(${scene==='custom'?customScene:`/scenes/${scene}.svg`})`}}>
      <span className="scene-corner">PLACEMENT PREVIEW · NOT TO SCALE</span><button className="workflow-placed-qr" aria-label="QR placement. Drag or use arrow keys to move" style={{left:`${position.x}%`,top:`${position.y}%`,width:`${Math.max(10,Math.min(44,sizeMm/3))}%`,transform:`translate(-50%, -50%) rotate(${rotation}deg)`}}
        onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);}} onPointerMove={e=>{if(!e.currentTarget.hasPointerCapture(e.pointerId)||!board.current)return;const r=board.current.getBoundingClientRect();setPosition({x:Math.max(20,Math.min(80,100*(e.clientX-r.left)/r.width)),y:Math.max(20,Math.min(80,100*(e.clientY-r.top)/r.height))});}}
        onPointerUp={e=>{if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);}} onKeyDown={e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();setPosition(p=>({x:Math.max(20,Math.min(80,p.x+(e.key==='ArrowLeft'?-1:e.key==='ArrowRight'?1:0))),y:Math.max(20,Math.min(80,p.y+(e.key==='ArrowUp'?-1:e.key==='ArrowDown'?1:0)))}));}}}><img src={artifact!.png} width={768} height={768} alt="Exact QR artwork from the studio" draggable={false}/></button><span className="workflow-scene-caption"><Move size={14}/>Drag to position · arrow keys to nudge</span></div></> : <div className="workflow-original"><img src={artifact!.png} width={768} height={768} alt="Exact QR artwork from the studio"/></div>}
      <p className="generator-note">The scene shows placement. The checks below simulate distance, blur and rotation on your actual image; they do not analyse the scene photo’s lighting or material.</p>
    </div><aside className="lab-control-panel"><span className="section-kicker">PRINT WITH CONTEXT</span><h2>Put it to the test.</h2><p>Adjust the conditions your QR will meet.</p>
      <Slider label="Print width" value={sizeMm} min={20} max={160} unit="mm" onChange={setSizeMm}/><Slider label="Viewing distance" value={distanceCm} min={10} max={180} unit="cm" onChange={setDistance}/><Slider label="Blur" value={blur} min={0} max={3} step={0.1} unit="px" onChange={setBlur}/><Slider label="Rotation" value={rotation} min={-45} max={45} unit="°" onChange={setRotation}/>
      <button onClick={()=>{setSizeMm(artifact!.sizeMm);setDistance(40);setBlur(0);setRotation(0);setPosition({x:50,y:62});}}><RotateCcw size={14}/>Reset conditions</button>
      <div className={`lab-verdict ${ready?'passed':''}`} role="status">{failure?.key===key?failure.message:!current?<><LoaderCircle className="spin" size={18}/>Testing your image…</>:ready?<><Check size={18}/>Checks passed</>:'Adjust the design or conditions'}<ul>{checks.map(([label,pass])=><li key={label}><span>{label}</span><strong>{pass===undefined?'Testing':pass?'Passed':'Adjust'}</strong></li>)}</ul></div>
      <button className="generator-download" disabled={!ready||exporting||reading} onClick={()=>void download()}><ArrowDownToLine size={17}/>{exporting?'Preparing…':'Download tested image'}</button><button className="workflow-wide" onClick={edit}>Refine in the studio <ArrowLeft size={15}/></button><p className="generator-note">Reference checks cannot guarantee every phone or printed material. Test a physical proof before a print run.</p>
    </aside></div><input ref={upload} type="file" hidden accept="image/png,image/jpeg,image/webp" onChange={e=>{void chooseScene(e.target.files?.[0]);e.target.value='';}}/>{notice&&<p role="status" className="workflow-notice">{notice}</p>}
  </section>;
}
function Slider({label,value,min,max,step=1,unit,onChange}:{label:string;value:number;min:number;max:number;step?:number;unit:string;onChange:(n:number)=>void}){return <label className="workflow-slider"><span>{label}<output>{value} {unit}</output></span><input type="range" min={min} max={max} step={step} value={value} onChange={e=>onChange(Number(e.target.value))}/></label>;}

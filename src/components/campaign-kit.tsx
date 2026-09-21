'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowUpRight, Check, Download, LoaderCircle, PackageOpen } from 'lucide-react';
import { useWorkflow } from './workflow-provider';
import { campaignLayouts, campaignPresets, campaignSvg, campaignFilename, defaultCampaignCopy, type CampaignCopy } from '@/lib/campaign-kit';
import { svgData } from '@/lib/qr';
import { downloadBlob } from '@/lib/browser-qr';
import type { DesignArtifact } from '@/lib/editor-draft';

export default function CampaignKit() {
  const { draft, artifact } = useWorkflow();
  if (!draft || !artifact) return <section className="workflow-empty"><PackageOpen size={32}/><h2>Start with your artwork.</h2><p>Create or reopen a design in the studio, then choose Create campaign kit.<br/>Your unsaved design stays in this tab until you refresh.</p><Link className="primary-button" href="/generator">Open the studio <ArrowUpRight size={16}/></Link></section>;
  return <KitEditor artifact={artifact} name={draft.name}/>;
}

function KitEditor({ artifact, name }: { artifact: DesignArtifact; name: string }) {
  const [copy, setCopy] = useState<CampaignCopy>(() => ({ ...defaultCampaignCopy, brand: name && name !== 'Untitled QR' ? name.slice(0, 32) : defaultCampaignCopy.brand }));
  const [layoutId, setLayoutId] = useState('square');
  const [busy, setBusy] = useState(false), [notice, setNotice] = useState(''), [error, setError] = useState('');
  const active = useRef<AbortController | null>(null);
  const layout = campaignLayouts.find(item => item.id === layoutId)!;
  const ready = artifact.pristine && artifact.reduced && artifact.simulated && artifact.dimensionsPass;
  useEffect(() => {
    setBusy(false); setNotice(''); setError('');
    return () => { active.current?.abort(); active.current = null; };
  }, [artifact]);
  function update<K extends keyof CampaignCopy>(key: K, value: CampaignCopy[K]) {
    setCopy(previous => ({ ...previous, [key]: value }));
    setNotice('');
    setError('');
  }
  async function download() {
    if (active.current || !ready) return;
    const operation = new AbortController();
    active.current = operation;
    setBusy(true); setError(''); setNotice('Preparing your artwork…');
    try {
      const { buildCampaignKit } = await import('@/lib/browser-campaign-kit');
      const blob = await buildCampaignKit(artifact, copy, operation.signal, label => { if (!operation.signal.aborted) setNotice(label); });
      operation.signal.throwIfAborted();
      downloadBlob(blob, `${campaignFilename(name)}-campaign-kit.zip`);
      setNotice('All four PNGs passed their full-size and half-size checks. Download requested — check your downloads for the ZIP.');
    } catch (cause) {
      if (!operation.signal.aborted) { setError(cause instanceof Error ? cause.message : 'Your kit could not be prepared. Please try again.'); setNotice(''); }
    } finally {
      if (!operation.signal.aborted) { active.current = null; setBusy(false); }
    }
  }
  function cancel() {
    active.current?.abort(); active.current = null; setBusy(false); setNotice('Kit preparation cancelled. Your design is unchanged.');
  }
  return <section className="campaign-kit" aria-label="Campaign kit">
    <div className="workflow-toolbar"><Link href="/generator?resume=1"><ArrowLeft size={16}/>Back to your design</Link><span className="workflow-session">Using <strong>{name}</strong></span></div>
    <div className="campaign-workspace">
      <div className="campaign-controls">
        <span className="section-kicker">ONE DESIGN. READY TO SHARE.</span>
        <h2>Give your QR <br/>somewhere to shine.</h2>
        <p>Your artwork, carried through a social post, a story and a counter card. Add your message once.</p>
        <fieldset disabled={busy}>
          <legend className="sr-only">Your campaign message</legend>
          <label className="generator-field"><span>Start with a message preset</span><select defaultValue="" onChange={event => { const preset = campaignPresets.find(item => item.id === event.target.value); if (preset) { setCopy(previous => ({ ...previous, headline: preset.headline, detail: preset.detail })); setNotice('Message preset applied. Your brand name is unchanged.'); setError(''); } }}><option value="" disabled>Choose a starting point</option>{campaignPresets.map(preset => <option key={preset.id} value={preset.id}>{preset.label}</option>)}</select></label>
          <label className="generator-field"><span>Brand or campaign</span><input value={copy.brand} maxLength={32} onChange={event => update('brand', event.target.value)}/></label>
          <label className="generator-field"><span>Call to action</span><input value={copy.headline} maxLength={40} placeholder="Scan to explore the collection" onChange={event => update('headline', event.target.value)}/></label>
          <label className="generator-field"><span>Supporting line</span><input value={copy.detail} maxLength={64} onChange={event => update('detail', event.target.value)}/></label>
          <div className="campaign-themes" role="group" aria-label="Social layout colour"><button type="button" aria-pressed={copy.theme === 'obsidian'} onClick={() => update('theme', 'obsidian')}><span className="campaign-swatch"/>Obsidian</button><button type="button" aria-pressed={copy.theme === 'paper'} onClick={() => update('theme', 'paper')}><span className="campaign-swatch paper"/>Paper</button></div>
        </fieldset>
        <p className="campaign-small">The print card uses Paper to keep ink coverage low.</p>
        <div className="campaign-included"><h3>Everything in one download</h3><ul><li><Check size={15}/>Original QR artwork</li><li><Check size={15}/>Square post + vertical story</li><li><Check size={15}/>A6 counter card · PNG + RGB PDF</li><li><Check size={15}/>Client proof sheet</li><li><Check size={15}/>Scan report + printing guide</li></ul></div>
        {!ready && <p className="campaign-error" role="alert">This design needs an adjustment. Return to the studio and pass all four scan checks first.</p>}
        <button className="generator-download" disabled={!ready || busy} onClick={() => void download()}>{busy ? <LoaderCircle className="spin" size={17}/> : <Download size={17}/>} {busy ? 'Checking and preparing…' : 'Download campaign kit'}</button>
        {busy && <button className="workflow-wide" onClick={cancel}>Cancel preparation</button>}
        <p className="campaign-small">Included with the studio. No account needed. Prepared on your device.</p>
        <p className="campaign-status" role="status" aria-live="polite">{notice}</p>
        {error && <p className="campaign-error" role="alert">{error}</p>}
      </div>
      <div className="campaign-preview">
        <div className="campaign-layouts" role="group" aria-label="Preview layout">{campaignLayouts.map(item => <button type="button" key={item.id} aria-pressed={layoutId === item.id} onClick={() => setLayoutId(item.id)}><span>{item.name}</span><small>{item.description}</small></button>)}</div>
        <div className={`campaign-stage campaign-stage-${layout.id}`}><img src={svgData(campaignSvg(layout, artifact.png, copy))} width={layout.width} height={layout.height} alt={`${layout.name} preview with your QR artwork and campaign message`}/></div>
        <div className="campaign-preview-note"><strong>Your finished artwork stays intact.</strong><p>We check the exported PNGs before packaging them. Test a physical proof and the published social image too; printing and platform compression can change a scan.</p><p>For social posts, add your destination as a clickable link or link sticker as well.</p></div>
      </div>
    </div>
  </section>;
}

'use client';

import { useEffect, useRef, useState } from 'react';
import type { DesignArtifact } from '@/lib/editor-draft';
import { downloadBlob } from '@/lib/browser-qr';
import { emitGrowthEvent, showcaseCaption, showcaseLink } from '@/lib/showcase-card';
import '../app/showcase-share.css';

export function ShowcaseShare({ artifact }: { artifact: DesignArtifact }) {
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [card, setCard] = useState<{ file: File; url: string; canShare: boolean } | null>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const operation = useRef<AbortController | null>(null);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; operation.current?.abort(); }; }, []);
  useEffect(() => () => { if (card) URL.revokeObjectURL(card.url); }, [card]);

  async function prepare() {
    if (!consent || operation.current) return;
    const controller = new AbortController(); operation.current = controller;
    setBusy(true); setNotice('Preparing and checking your card…'); setError('');
    try {
      const { buildShowcaseCard } = await import('@/lib/browser-showcase-card');
      const blob = await buildShowcaseCard(artifact, controller.signal);
      controller.signal.throwIfAborted();
      const file = new File([blob], 'qr-upgrade-showcase.png', { type: 'image/png' });
      let canShare = false;
      try { canShare = !!navigator.share && !!navigator.canShare?.({ files: [file], text: showcaseCaption }); } catch { /* Download remains available. */ }
      setCard({ file, url: URL.createObjectURL(blob), canShare });
      emitGrowthEvent('showcase_prepared');
      setNotice('Your card passed full-size and half-size scan checks. Review it before sharing.');
    } catch (cause) {
      if (!controller.signal.aborted) { setNotice(''); setError(cause instanceof Error ? cause.message : 'The card could not be prepared. Try again.'); }
    } finally {
      if (!controller.signal.aborted) { operation.current = null; setBusy(false); }
    }
  }
  async function share() {
    if (!card || !consent || busy) return;
    setBusy(true); setError('');
    try {
      // Invoke directly from the click: preparation happened earlier, preserving user activation.
      const pending = navigator.share({ files: [card.file], text: showcaseCaption });
      emitGrowthEvent('showcase_share_opened');
      await pending;
      if (alive.current) { emitGrowthEvent('showcase_share_handoff'); setNotice('Card handed to your chosen app. Check there to finish posting.'); }
    } catch (cause) {
      if (alive.current) {
        if (cause instanceof Error && cause.name === 'AbortError') { emitGrowthEvent('showcase_share_cancelled'); setNotice('Sharing cancelled. Your card is still here.'); }
        else setError('Sharing is unavailable here. Download the card and add it to your post.');
      }
    } finally { if (alive.current) setBusy(false); }
  }
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(showcaseLink);
      if (alive.current) { emitGrowthEvent('showcase_link_copied'); setNotice('Creation link copied.'); setError(''); }
    } catch { if (alive.current) setError('Copy the creation link shown below.'); }
  }
  return <section className="showcase-share" aria-label="Share your QR artwork">
    <span className="showcase-kicker">MADE SOMETHING WORTH SHARING?</span>
    <h3>Give your artwork a stage.</h3>
    <p>Make an optional social card with a link back to QR Upgrade. Your original export stays unchanged.</p>
    <label className="showcase-consent"><input type="checkbox" checked={consent} disabled={busy} onChange={event => { setConsent(event.target.checked); setNotice(''); setError(''); }}/><span>I want to share this artwork and the information its QR contains. Anyone who sees it can scan it.</span></label>
    {!card && <button className="workflow-wide" disabled={!consent || busy} onClick={() => void prepare()}>{busy ? 'Checking your card…' : 'Preview sharing card'}</button>}
    {card && <>
      <img src={card.url} width={1080} height={1080} alt="Your QR artwork on an optional QR Upgrade showcase card"/>
      <div className="showcase-actions">
        {card.canShare && <button className="workflow-wide" disabled={!consent || busy} onClick={() => void share()}>Share card</button>}
        <button className="workflow-wide" disabled={!consent || busy} onClick={() => { downloadBlob(card.file, card.file.name); emitGrowthEvent('showcase_download_requested'); setNotice('Card download requested. Check your downloads.'); }}>Download card</button>
        <button className="workflow-wide" disabled={busy} onClick={() => void copyLink()}>Copy creation link</button>
      </div>
      <a className="showcase-return-link" href={showcaseLink}>Create your own at qrupgrade.com</a>
      <p className="generator-note">Prepared on your device. Test the published image too: social apps may resize it.</p>
    </>}
    <p role="status" aria-live="polite">{notice}</p>
    {error && <p role="alert">{error}</p>}
  </section>;
}

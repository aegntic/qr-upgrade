import React from 'react';
import { AbsoluteFill, Composition, Img, interpolate, registerRoot, Sequence, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';

const scenes = [
  { title: 'Scan the art.', detail: 'Your destination. Your artwork.', image: 'tiger.png', kind: 'art' },
  { title: 'Make it yours.', detail: 'Choose a direction. Add your link.', image: 'studio.png', kind: 'studio' },
  { title: 'Check the image.', detail: 'Actual QR decoding before export.', image: 'vinyl.png', kind: 'checks' },
  { title: 'Give it a stage.', detail: 'A post. A story. A counter card.', image: 'social-post.png', kind: 'kit' },
  { title: 'A better connection.', detail: 'For the things you make.', image: 'coffee.png', kind: 'art' },
  { title: 'Create your own.', detail: 'qrupgrade.com', image: 'tiger.png', kind: 'end' },
];

function Scene({ scene, number }) {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const portrait = height > width;
  const enter = interpolate(frame, [0, 16], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const y = interpolate(frame, [0, 22], [28, 0], { extrapolateRight: 'clamp' });
  const shine = interpolate(frame, [0, 14], [-30, 130], { extrapolateRight: 'clamp' });
  const artSize = portrait ? 770 : 800;
  return <AbsoluteFill style={{ background: 'radial-gradient(ellipse at 70% 40%, #283442 0%, #10151d 36%, #080b10 75%)', color: '#edf2f8', fontFamily: 'Arial, sans-serif', overflow: 'hidden' }}>
    <div style={{ position: 'absolute', left: portrait ? 78 : 96, top: portrait ? 88 : 64, display: 'flex', alignItems: 'center', gap: 20 }}>
      <Img src={staticFile('logo.png')} style={{ width: 58, height: 58 }}/><span style={{ fontSize: 31, letterSpacing: -1 }}>QR upgrade</span>
    </div>
    <div style={{ position: 'absolute', left: portrait ? 78 : 96, top: portrait ? 236 : 320, width: portrait ? 924 : 820, opacity: enter, transform: `translateY(${y}px)` }}>
      <div style={{ color: '#91a9c5', fontSize: 21, letterSpacing: 5, marginBottom: 24 }}>{String(number + 1).padStart(2, '0')} / SCAN THE ART</div>
      <h1 style={{ fontSize: portrait ? 97 : 108, lineHeight: 1.02, letterSpacing: -5, fontWeight: 500, margin: 0, maxWidth: 860 }}>{scene.title}</h1>
      <p style={{ fontSize: portrait ? 36 : 34, color: '#b9c7d8', lineHeight: 1.45, marginTop: 30, maxWidth: 750 }}>{scene.detail}</p>
      {!portrait && <div style={{ width: 100, height: 2, marginTop: 54, background: 'linear-gradient(90deg,#dce7f7,transparent)' }}/>}
    </div>
    <div style={{ position: 'absolute', left: portrait ? (width - artSize) / 2 : 1010, top: portrait ? 740 : 145, width: artSize, height: artSize, opacity: enter, transform: scene.kind === 'studio' ? 'perspective(1800px) rotateY(-5deg)' : undefined }}>
      {scene.kind === 'kit' ? <div style={{ display: 'flex', gap: 20, alignItems: 'center', height: '100%' }}>
        {['social-post.png','vertical-story.png','counter-card.png'].map((file, index) => <Img key={file} src={staticFile(file)} style={{ width: index === 0 ? 280 : 228, height: 'auto', border: '1px solid #657489', boxShadow: '0 35px 90px #0009', transform: `translateY(${index === 1 ? -25 : 25}px)` }}/>) }
      </div> : <div style={{ borderRadius: 30, padding: 18, background: 'linear-gradient(140deg,#8d99a9,#242c37 24%,#101720 72%,#5d6d80)', boxShadow: '0 45px 120px #000a', height: scene.kind === 'studio' ? undefined : '100%' }}>
        <Img src={staticFile(scene.image)} style={{ width: '100%', height: scene.kind === 'studio' ? 'auto' : '100%', objectFit: 'contain', borderRadius: 15 }}/>
      </div>}
      {scene.kind === 'checks' && <div style={{ position: 'absolute', left: 32, right: 32, bottom: portrait ? -85 : -52, background: '#101922', border: '1px solid #526c81', borderRadius: 14, padding: '20px 24px', fontSize: 27, color: '#d2e6ee', textAlign: 'center' }}>Full image · Reduced image · Simulation</div>}
    </div>
    <div style={{ position: 'absolute', left: portrait ? 78 : 96, right: portrait ? 78 : 96, bottom: portrait ? 130 : 62, borderTop: '1px solid #445064', paddingTop: 24, display: 'flex', justifyContent: 'space-between', gap: 30, color: '#b6c4d6', fontSize: portrait ? 27 : 23 }}>
      <span>{scene.kind === 'checks' ? 'Reference checks. Test a physical proof.' : scene.kind === 'kit' ? 'Actual files from the web studio.' : 'Artistic QR creation · Web studio'}</span>
      {!portrait && <span>qrupgrade.com</span>}
    </div>
    {frame < 16 && <AbsoluteFill style={{ background: `linear-gradient(105deg, transparent ${shine-12}%, #c4def030 ${shine-5}%, #ffffff65 ${shine}%, #c4def030 ${shine+5}%, transparent ${shine+12}%)`, pointerEvents: 'none' }}/>} 
  </AbsoluteFill>;
}
function Film() {
  return <AbsoluteFill style={{ background: '#080b10' }}>{scenes.map((scene, index) => <Sequence key={scene.title} from={index * 150} durationInFrames={150}><Scene scene={scene} number={index}/></Sequence>)}</AbsoluteFill>;
}
function Root() {
  return <><Composition id="Scan-The-Art-Landscape" component={Film} durationInFrames={900} fps={30} width={1920} height={1080}/><Composition id="Scan-The-Art-Portrait" component={Film} durationInFrames={900} fps={30} width={1080} height={1920}/></>;
}
registerRoot(Root);

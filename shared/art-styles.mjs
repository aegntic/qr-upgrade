export const ART_STYLES = Object.freeze({
  steel: { label: 'Sculpted steel', dimensional: true, prompt: '3D-look product render, raised obsidian and polished brushed steel forms, bevelled edges, subtle metal grain, white studio backlighting, convincing shallow relief and soft contact shadows' },
  glass: { label: 'Optical glass', dimensional: true, prompt: '3D-look product render, thick luminous coloured optical glass, sculptural bevels, controlled refraction, solid dark cores and bright porcelain gaps, shallow relief with soft contact shadows' },
  ceramic: { label: 'Glazed ceramic', dimensional: true, prompt: '3D-look product render, sculpted glazed porcelain, glossy ceramic forms, smooth rounded bevels, deep charcoal glaze and ivory negative space, shallow raised relief, soft directional studio light' },
  embossed: { label: 'Embossed paper', dimensional: true, prompt: '3D-look product render, deeply embossed cotton paper, raised ink-black geometric forms and ivory paper channels, fine paper grain, softly bevelled relief, directional raking light and delicate contact shadows' },
  botanical: { label: 'Botanical', dimensional: false, prompt: 'intricate botanical leaves, delicate flowers, cream paper, forest tones' },
  illustrated: { label: 'Illustrated', dimensional: false, prompt: 'bold editorial illustration, strong geometric shapes, crisp composition' },
});

export function artworkPrompt(style, prompt) {
  if (!Object.hasOwn(ART_STYLES, style)) throw new Error('Choose an artwork style.');
  return `Square artwork designed to become an artistic QR image. ${ART_STYLES[style].prompt}. ${prompt}. Front-facing orthographic composition; material depth comes from shading, not a tilted or warped square. Balanced high contrast dark and light detail across the whole square, integrated angular blocks and flowing forms, three subtle square focal structures near top left, top right and bottom left. Keep highlights controlled, shadows shallow and light channels clear. No typography, no letters, no watermark.`;
}

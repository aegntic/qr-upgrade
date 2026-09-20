# QR Upgrade — Obsidian / Glass / Steel

Implemented web system, 18 September 2026. This supersedes the earlier cream-and-green visual direction. The user selected obsidian, glass, steel, backlighting and shaders; the baseline creation features and sections remain intact.

## Materials and hierarchy

- Obsidian canvas: `#050608`, with cool reflected light rather than a coloured UI accent.
- Smoked glass: translucent charcoal panels, a restrained blur, thin illuminated edges, and opaque input wells for legibility.
- Steel: silver primary controls and dark brushed secondary controls. A short press-in, inset shading, edge light and soft return imply the weight of physical equipment.
- Typography: Manrope for display headings; DM Sans for controls and reading. Large, close-set hero type gives way to compact, legible studio labels.
- Colour belongs to the QR artwork. Artwork backgrounds, quiet zones and user-selected colours remain part of the actual image, independent of the dark interface.

## Composition

The homepage starts with a 14-piece artwork exhibition. The user-approved metal sculpture leads the sequence; the hero labels the composition “Your Brand Here.” An angled glass-and-steel mount, reflected light and an open backdrop provide depth. The studio follows, then workflow, three creation modes, examples, features, destinations, FAQ and a closing action.

The generator keeps destination, starting point and design controls beside a stable image preview and export controls. At small widths these form a single reading column. The brand-studies gallery shares the same neutral shell.

## Motion and rendering

`motion-system.tsx` owns the motion preference and actual WebGL fragment shader. The shader draws slow caustic bands, a soft rim and fine surface grain; pointer movement alters the lighting. Rendering is capped around 30 frames per second with a maximum 1600-pixel canvas width and no device-pixel-ratio multiplier. This is a rendering budget, not a measured device-performance promise.

The X sculpture is the opening artwork and stays visible until the visitor uses previous/next. Once the visitor explores, the hero rotates artwork every 6.2 seconds, crossfades the images, and permits pointer tilt. Ambient lighting and the opening artwork's reflections remain animated before exploration. Hover, keyboard focus, an offscreen hero, the global pause control, a hidden document or reduced-motion preference suspend rotation. Manual previous/next controls remain available. Focus and hover are separate states so leaving with the pointer cannot restart a focused link's slideshow.

Only section headings receive a one-time entrance as they enter view. Control transitions stay short. Reduced-motion mode removes animated transitions and tilt. WebGL absence or context loss leaves a CSS-lit background; the canvas is decorative and excluded from accessibility output.

## Boundaries

The hero is a presentation surface. It does not claim the sculptural source image is the validated export. Opening a design creates and validates the destination-bearing QR in the studio. Preview/download gates, centre-image support, decoder checks and export content are unchanged by the material effects.

The original metal image remains intact. `public/brand-studies/x-hero.webp` is a compressed display copy (403 KB versus the 1.96 MB source), not a change to the generated QR pipeline. This visual update targets the web app; it does not imply a native design release or enterprise certification.

## Evidence and research

See `research/design/claude-design-2026-09-18.md` for current official Claude design guidance and the applied brief. Existing Appllama studies informed the baseline flow. Screenshots and a finish-review record live in `research/design/review/`.

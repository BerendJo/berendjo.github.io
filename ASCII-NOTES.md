# ASCII pieces: handoff notes

Context for a new Claude picking up the ASCII work on Berend Joosen's portfolio (the site root, static HTML/CSS/JS, no build step, no framework; it was moved from `CLAUDE WEBSITE BEJO/portfolio/` to `Portfolio site 2026/`, which is now its own git repo for GitHub Pages). Read `PRODUCT.md` first for the site's purpose and brand. Everything below was built in one session.

## The idea

Berend supplied photos and wanted them on the site as **live ASCII art**: real glyphs drawn on `<canvas>` (not pre-rendered images), so individual symbols can animate. Each piece is a photo sampled into a grid of characters (brightness picks the glyph), then animated by re-sampling a transformed copy of the photo each frame. Look: ink `#120f10` glyphs on the pale pink paper `#fff4f4`, bold monospace, about 3.7 css px per cell.

## Files

| File | Role |
|---|---|
| `js/ascii-lib.js` | Shared helpers, exposed as `window.AsciiLib`. **Must load before every other ascii script.** |
| `js/ascii-deck.js` | Home hero: 2x CDJ-3000 + Xone:92. Spinning platters, playing waveform, pointer scratch. |
| `js/ascii-speaker.js` | Home work overview: Funktion-One speaker. Pumps and emits ASCII notes while scrolling. |
| `js/ascii-cup.js` | `projects/douwe-egberts.html`: coffee cup with rising steam. |
| `js/ascii-lock.js` | `projects/edufort.html`: padlock that unlocks and locks with scroll position. |
| `js/ascii-figure.js` | Every project page, contact section: static figure lying in the bottom-right corner. |
| `js/ascii-morph.js` | Shared photo-to-ASCII hover transition: `AsciiLib.morph({hover, host, measure, paint, gamma, invert, cutout, touchToggle})`. Overlay canvas knocks out picture cells with paper-coloured rects and draws glyphs, spreading from where the pointer entered (2.4 s in, 1.5 s out; instant with reduced motion). Layout is lazy (first hover). |
| `js/ascii-portrait.js` | Home About headshot, via `morph` (`cutout: true`, dark = dense, `touchToggle`). |
| `js/ascii-cards.js` | Home work cards, via `morph`: recomposes each card's `<img>`s (object-fit, padding, opacity, background colour) into one picture, `gamma: 1.5` because photos are bright. Mouse/pen only. |
| `js/ascii-rain.js` | Easter egg on every page: typing `bejo` rains ASCII notes down the viewport (keyboard only, so not on phones; skipped with reduced motion). |
| `assets/img/` | Sources: `download.webp` (decks), `funktionone.png`, `cup.webp`, `lock.png`, `fall.webp` (cutout of Berend's photo `ik.jpeg`). `ik.jpeg` and Berend's own pre-rendered `ascii-*.webp` / `ascii-art (n).png` references were removed from the tree to keep the repo light; they are still in git history (commit `f612206`). Also `og.jpg` (link preview, a screenshot of the deck) and `assets/favicon.svg` (pixel B). |
| `css/styles.css` | Sections: `.hero-deck`, `.speaker`, `.cup`, `.lock`, `.p-contact*`, `.corner-figure`. |

Script order on every page that uses them: `ascii-lib.js` first, then the piece script. (A bug where `ascii-figure.js` loaded before the lib on the Douwe Egberts and Edufort pages was found and fixed at the end of the session.)

## Shared library (`AsciiLib`)

- `RAMP = " .:-=+*#%@"` (light to dark), `DARK` = last index, `CELL_ASPECT = 1.78` (cell height / width), `INK`.
- `make(w, h)`: new canvas.
- `glyphsFromData(px, w, h, out, gamma = 0.65, invert = false)` and `toGlyphs(ctx, ...)`: RGBA pixels (already scaled to one pixel per cell) to glyph indices, 0 = blank (alpha < 0.08 is blank). Default maps **dark pixels to dense glyphs**; higher `gamma` makes the result denser. `invert = true` maps **bright pixels to dense glyphs** (used for the figure, matching Berend's reference render).
- `buildAtlas(cw, ch, chars = RAMP)`: one canvas strip with a pre-rendered glyph per character; drawing a cell is a single `drawImage`. Steam and speed lines pass their own char sets.
- `colsFor(cssW, min, max)`: columns for an element width (about `cssW / 3.7`).
- `NOTE_SPRITES`: the three chunky music-note sprites as glyph-index grids, shared by the speaker and the rain easter egg.

Common pattern in every piece: pick `cols` from the element width, derive `rows = H / (cw * CELL_ASPECT)`, draw the source into a `cols x rows` offscreen canvas, convert to glyphs, blit via the atlas. A **static layer** (drawn once) plus a **live layer** (redrawn per frame) keeps animation cheap. Pieces "claim" cells (owner map) for the live layer by cell centre so the two layers never double-draw.

## The pieces

### Deck (`ascii-deck.js`, hero)
- Layout note: the portrait no longer overlays the decks; it lives in the About section (right below the hero). The decks are tilted (`rotate(-9deg)`) and sit low (`top: 66dvh`) so they hang below the fold to invite scrolling; `.hero` uses `overflow-x: clip` plus a bottom margin so the rest of the decks scroll into view. Because of the tilt, pointer hit-testing in `onMove` first undoes the element's rotation (read from its computed transform) before mapping to source px.
- Markup: `.hero-deck[data-ascii-deck][data-src]` with `canvas.deck-static` + `canvas.deck-live`. Replaced the old `dj-set.svg` (now unused). Keeps the `ascii-in` intro via the existing CSS. The hero pointer parallax (floating on hover) was removed on request.
- Source crop `{x:188,y:120,w:524,h:232}` of the 900x471 `download.webp`. Jog wheels measured at (274.4, 279.05) and (626.4, 279.05), radius 56.
- Each deck is a small physics model: `ang`, `vel`, `hover`. Normal speed is 33.33 rpm (`W0`). Platter cells are re-sampled from the photo rotated by `ang`.
- **Waveform** on each screen is procedural, not sampled (the real strip is only about 13 px tall): scrolls past a fixed playhead, position = `ang * PX_PER_RAD`, so it follows the platter. 174 bpm kick/hat amplitude function (`amp`).
- **Scratch:** while the pointer is inside a wheel the record is held and moves only with the pointer's angular movement; stationary pointer = stopped. On leave, velocity eases back to `W0`. Cursor becomes `grab` via `.hero.is-scratch`. Mouse/pen only (touch disabled so it doesn't fight scrolling).
- 30 fps idle, 60 while interacting. Pauses off-screen and when the tab is hidden. `prefers-reduced-motion`: still frame.

### Speaker (`ascii-speaker.js`, work overview)
- Markup: `.speaker.t-speaker.reveal[data-ascii-speaker]` with three canvases (`spk-static`, `spk-live`, `spk-notes`), placed in the work grid at `grid-column: 1 / 4; grid-row: 4` (left of MEZZ). `.spk-notes` overhangs the speaker (`left:-20%; width:140%; top:-20%; height:120%`); `BLEED` in the JS must match.
- Always plays while on screen (30 fps idle): every `60/174` s beat the horn cells (an ellipse) bulge outward with a glyph-lookup displacement (`PUMP` 0.11 bulge plus `FLASH` 1.5, the horn glyphs darken by about 1 to 2 levels on the beat; strength 0.7 idle, 1.15 when scrolling), and a chunky ASCII music note (3 sprites from `AsciiLib.NOTE_SPRITES`, drawn 2x2 cells each) floats up from the horn every other beat. Scrolling (speed above about 40 px/s) turns it up: full pump every beat and 1 to 3 notes per beat depending on speed. Notes get a paper-coloured halo box so they read over the dark cabinet and dissolve into lighter glyphs. Loop pauses off-screen / hidden tab; reduced motion = still.

### Cup (`ascii-cup.js`, Douwe Egberts)
- Markup: `.cup[data-ascii-cup]` inside a `.p-block` (`--c: 8 / 13`) placed before the closing-text block, so the grid puts it beside the street-ad photo and pushes the text below it.
- World box has headroom above the cup for steam. Steam is about 100 particles (spawn about 34/s) splatted into a density field and drawn with `" .:~*"`, with flicker. Pre-warmed so steam is already in the air on load.

### Lock (`ascii-lock.js`, Edufort)
- Markup: `.lock[data-ascii-lock]` in a `.p-block` (`--c: 8 / 13`), same placement trick as the cup.
- Body and keyhole drawn once. The shackle is a separate sprite (legs extended downward so it stays attached when lifted), lifted `LIFT` px and foreshortened with `cos(turn)` about the right leg (max `SWING` of 78 degrees). Only rows above the body are live.
- Scroll-scrubbed, not time-based: `openness()` is 0 as the lock enters, 1 around mid-screen, 0 as it leaves (`smooth((t-0.1)/0.25) * (1 - smooth((t-0.5)/0.25))`). Eased toward the target each frame. Reduced motion: still, closed.

### Rain easter egg (`ascii-rain.js`)
- Global `keydown` listener keeps the last 4 letters; `bejo` (not while typing in a field, no modifiers) opens a fixed full-viewport canvas (`z-index: 90`, `pointer-events: none`) and spawns about 30 notes/s for 3.8 s. Big notes fall fast in front with a paper-coloured outline (so they read over dark images); small ones are slower and drawn with lighter glyphs. Canvas removes itself when the last note has fallen. Typing it again extends the rain. A `console.log` hint is printed.

### Figure (`ascii-figure.js`, all five project pages)
- Markup: inside `.p-contact` > `.p-contact-stage`: `.corner-figure[data-ascii-figure][data-src="../assets/img/fall.webp"]` plus `.p-contact-copy` (the "Interested?" heading and email).
- Static. The cutout is rotated 90 degrees clockwise and fills its box exactly (`aspect-ratio: 1006 / 823`), anchored `right:0; bottom:0` of the full-width `.p-contact`, so it is flush with the page corner. Bright pixels are dense (`invert`).
- The left edge (the feet, where the photo ends in a hard cut) dissolves: over the left 40% (`FADE`) glyphs thin out via a smoothstep plus random drop-out.
- Mobile (<900 px): the stage gets bottom padding equal to the figure height so the figure sits below the copy instead of overlapping it.
- History: this was first a scroll-driven falling figure with an echo trail inside a pinned 240vh runway. Berend scrapped the fall; that code (`ascii-fall.js`) is deleted.

## Making `fall.webp`

No segmentation libraries were available (only numpy, Pillow, torch). The cutout was made by masking out green grass in HSV, opening the mask, flood-filling the connected body from a seed on the shirt, upscaling the mask with a blur and threshold, and cropping to the bounding box. The pole, bottle and cat-less background are gone; the cat stays (it is on the trousers). The edge is slightly rough around the face.

## Lessons and gotchas

- Source photos were often low-res (the deck art is only about 520 px wide); do not expect fine detail.
- Cells are not square: always size the grid with `CELL_ASPECT` and map non-uniformly (`setTransform(sx, 0, 0, sy, ...)`) so shapes keep their proportions.
- Dark photos need a gamma and stretch or they go grey; light-on-dark art (the figure) reads better with `invert`.
- Pointer handling for the deck uses a window-level `pointermove` plus `getBoundingClientRect()` because the hero art has `pointer-events: none` and is tilted.
- Everything respects `prefers-reduced-motion`, pauses when off-screen, and has an `aria-hidden` wrapper with a `<noscript>` plain-image fallback.
- Projects pages share `css/styles.css` and `js/main.js` (NL/EN toggle, scroll-reveal). `main.js` is untouched by this work.

## Testing without the Playwright MCP

The Playwright browser was locked by another process, so testing used headless Edge:

- Static shots: `msedge.exe --headless=new --disable-gpu --user-data-dir=<fresh dir> --window-size=1440,900 --virtual-time-budget=4000 --screenshot=<absolute path> <url>`. Add `--force-prefers-reduced-motion` to get the final still state (otherwise intro animations are caught mid-fade). Use an absolute Windows path for the screenshot and a fresh profile dir.
- Interaction (scrolling, mouse moves): launch Edge with `--remote-debugging-port=<unique port>` and a unique profile dir, then drive the Chrome DevTools Protocol from a Node script (`Input.dispatchMouseEvent` for `mouseMoved` / `mouseWheel`, `Page.captureScreenshot`). Node 24 has a global `WebSocket`. Reusing a port or profile makes the script hang, so kill stray `msedge` processes whose command line contains your scratch profile.
- Serve the site with `python -m http.server 8123` from the site root.

## Open items

- Home page now has an About section (text from slide 2 of the PDF) and a contact section with the corner figure. Site extras added later: favicon, Open Graph tags (image `assets/img/og.jpg`, URLs assume `https://berendjo.github.io/`), and `404.html` with root-relative paths.
- The deck/speaker/cup/lock/figure were checked in screenshots and scripted interaction on desktop; phone-width checks were only done for the contact figure.
- Possible extras Berend has not asked for: steam that reacts to the pointer, a lock/unlock sound (opt-in only), VU meters and the overview waveform on the decks, a bigger cup in the home work tile.

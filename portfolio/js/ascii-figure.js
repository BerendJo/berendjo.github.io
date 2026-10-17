/* ASCII figure that lies in the bottom-right corner of the contact section,
   flush with the bottom and right edges of the page. The photo cutout is
   turned 90deg clockwise and sampled into glyphs (bright = dense). Static.
   Needs ascii-lib.js. */
(() => {
  "use strict";

  const host = document.querySelector("[data-ascii-figure]");
  if (!host || !window.AsciiLib) return;

  const { glyphsFromData, make, buildAtlas, colsFor, CELL_ASPECT } = window.AsciiLib;
  const canvas = host.querySelector("canvas");
  const ctx = canvas.getContext("2d");
  let img;
  const hash = (n) => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };

  function render() {
    const cssW = host.clientWidth, cssH = host.clientHeight;
    if (!img || !cssW || !cssH) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cols = colsFor(cssW, 70, 240);
    const W = Math.round(cssW * dpr), H = Math.round(cssH * dpr);
    const rows = Math.max(20, Math.round(H / ((W / cols) * CELL_ASPECT)));
    const cw = W / cols, ch = H / rows, gw = Math.ceil(cw);
    canvas.width = W; canvas.height = H;

    // the box is exactly the turned picture, so the figure fills it edge to edge
    const small = make(cols, rows);
    const g = small.getContext("2d", { willReadFrequently: true });
    g.imageSmoothingQuality = "high";
    g.translate(cols / 2, rows / 2);
    g.rotate(Math.PI / 2);
    g.drawImage(img, -rows / 2, -cols / 2, rows, cols);
    const glyphs = glyphsFromData(g.getImageData(0, 0, cols, rows).data, cols, rows,
      new Uint8Array(cols * rows), 0.65, true);

    // the feet end in a hard photo edge on the left: dissolve it, glyphs thin out and drop away
    const FADE = 0.4;                                          // share of the width the fade covers
    for (let i = 0; i < glyphs.length; i++) {
      if (!glyphs[i]) continue;
      const t = Math.min(1, (i % cols) / (cols * FADE));
      const f = t * t * (3 - 2 * t);
      const keep = f + 0.12 > hash(i * 0.731) ? 1 : 0;         // ragged, not a clean gradient band
      glyphs[i] = keep ? Math.round(glyphs[i] * f) : 0;
    }

    const atlas = buildAtlas(cw, ch);
    ctx.clearRect(0, 0, W, H);
    for (let i = 0; i < glyphs.length; i++) {
      const gi = glyphs[i];
      if (gi) ctx.drawImage(atlas, gi * gw, 0, gw, atlas.height, (i % cols) * cw, ((i / cols) | 0) * ch, gw, atlas.height);
    }
  }

  const src = new Image();
  src.onload = () => { img = src; render(); host.classList.add("is-ready"); };
  src.src = host.dataset.src;

  let timer = 0;
  new ResizeObserver(() => { clearTimeout(timer); timer = setTimeout(render, 120); }).observe(host);
})();

/* Photo -> ASCII hover transition, shared by the headshot and the work cards.
   AsciiLib.morph({ hover, host, measure, paint, ... }) adds a canvas over `host`.
   Hovering `hover` slowly swaps the picture for ASCII art, spreading outward from
   where the pointer came in; leaving turns it back. Needs ascii-lib.js.

   measure()                 -> { cssW, cssH } of the picture, or null if not ready yet
   paint(g, cols, rows, w, h) draws the picture into a cols x rows canvas (one pixel per cell)
   cutout   true: only cells where the picture has alpha get replaced (transparent PNG/WebP)
            false: the whole box is replaced (full-bleed photos)
   gamma / invert            tone mapping, see AsciiLib.glyphsFromData
   touchToggle               tapping toggles it on touch screens (otherwise touch is ignored) */
(() => {
  "use strict";

  const lib = window.AsciiLib;
  if (!lib) return;
  const { make, glyphsFromData, buildAtlas, colsFor, CELL_ASPECT } = lib;

  const IN = 2.4, OUT = 1.5;                 // seconds for the full change, there and back
  const calm = window.matchMedia("(prefers-reduced-motion: reduce)");
  const paper = getComputedStyle(document.documentElement).getPropertyValue("--paper").trim() || "#fff4f4";
  const hash = (n) => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };

  lib.morph = function morph(opts) {
    const { hover, host, measure, paint, gamma = 1.1, invert = false, cutout = false,
      touchToggle = false, minCols = 60, maxCols = 240 } = opts;

    let canvas = opts.canvas;
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.setAttribute("aria-hidden", "true");
      canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none";
      host.appendChild(canvas);
    }
    const ctx = canvas.getContext("2d");

    let grid, atlas, glyphs, alpha, noise, thr;
    let t = 0, target = 0, raf = 0, prev = 0, drawn = -1;
    let origin = { x: 0.5, y: 0.4 };         // where the change starts, share of the picture

    function layout() {
      const m = measure();
      if (!m || !m.cssW || !m.cssH) return false;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const cols = colsFor(m.cssW, minCols, maxCols);
      const W = Math.round(m.cssW * dpr), H = Math.round(m.cssH * dpr);
      const rows = Math.max(12, Math.round(H / ((W / cols) * CELL_ASPECT)));
      const cw = W / cols, ch = H / rows;
      canvas.width = W; canvas.height = H;
      grid = { cols, rows, cw, ch, W, H, gw: Math.ceil(cw), cssW: m.cssW, cssH: m.cssH };
      atlas = buildAtlas(cw, ch);

      const small = make(cols, rows);
      const g = small.getContext("2d", { willReadFrequently: true });
      g.imageSmoothingQuality = "high";
      paint(g, cols, rows, m.cssW, m.cssH);
      const px = g.getImageData(0, 0, cols, rows).data;
      glyphs = glyphsFromData(px, cols, rows, new Uint8Array(cols * rows), gamma, invert);
      alpha = new Uint8Array(cols * rows);
      noise = new Float32Array(cols * rows);
      for (let i = 0; i < alpha.length; i++) { alpha[i] = cutout ? px[i * 4 + 3] : 255; noise[i] = hash(i * 0.37); }
      setOrigin(origin.x, origin.y);
      drawn = -1;
      draw();
      return true;
    }

    /* when each cell flips: nearer the entry point = earlier, with noise so it spreads raggedly */
    function setOrigin(ox, oy) {
      origin = { x: ox, y: oy };
      const { cols, rows, cssW, cssH } = grid;
      thr = new Float32Array(cols * rows);
      const far = Math.hypot(Math.max(ox, 1 - ox) * cssW, Math.max(oy, 1 - oy) * cssH) || 1;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const d = Math.hypot(((c + 0.5) / cols - ox) * cssW, ((r + 0.5) / rows - oy) * cssH) / far;
          thr[r * cols + c] = d * 0.8 + noise[r * cols + c] * 0.2;
        }
      }
    }

    function draw() {
      if (!grid || t === drawn) return;
      drawn = t;
      const { cols, cw, ch, gw } = grid;
      ctx.clearRect(0, 0, grid.W, grid.H);
      if (t <= 0) return;
      for (let i = 0; i < glyphs.length; i++) {
        if (alpha[i] < 24) continue;                            // outside the cut-out
        const s = Math.max(0, Math.min(1, (t * 1.35 - thr[i]) * 4));
        if (s <= 0) continue;
        const x = (i % cols) * cw, y = ((i / cols) | 0) * ch;
        ctx.globalAlpha = s;
        ctx.fillStyle = paper;                                  // covers the picture under this cell
        ctx.fillRect(x - 0.5, y - 0.5, cw + 1, ch + 1);
        if (glyphs[i]) ctx.drawImage(atlas, glyphs[i] * gw, 0, gw, atlas.height, x, y, gw, atlas.height);
      }
      ctx.globalAlpha = 1;
    }

    function tick(now) {
      raf = 0;
      const dt = Math.min(0.1, Math.max(0.001, (now - (prev || now)) / 1000));
      prev = now;
      if (calm.matches) t = target;
      else t = target > t ? Math.min(target, t + dt / IN) : Math.max(target, t - dt / OUT);
      draw();
      if (t !== target) raf = requestAnimationFrame(tick); else prev = 0;
    }

    function go(to) {
      if (!grid && !layout()) return;                           // layout on first use, once the picture is ready
      target = to;
      if (!raf) raf = requestAnimationFrame(tick);
    }

    hover.addEventListener("pointerenter", (e) => {
      if (e.pointerType === "touch") return;
      if (!grid && !layout()) return;
      if (t === 0) {                                            // new origin only when fully back to the picture
        const r = host.getBoundingClientRect();
        setOrigin(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)));
      }
      go(1);
    });
    hover.addEventListener("pointerleave", (e) => { if (e.pointerType !== "touch") go(0); });
    if (touchToggle) hover.addEventListener("pointerup", (e) => { if (e.pointerType === "touch") go(target ? 0 : 1); });

    let timer = 0;
    new ResizeObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(() => { if (!grid) return; grid = null; if (t > 0 || target > 0) layout(); }, 150);
    }).observe(host);

    return { prepare: layout };
  };
})();

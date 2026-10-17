/* About-section headshot: hover it and the photo slowly turns into ASCII art,
   spreading outward from where the pointer came in. Move away and it turns
   back. Touch: tap toggles. Reduced motion: switches instantly. Needs ascii-lib.js. */
(() => {
  "use strict";

  const fig = document.querySelector("[data-ascii-portrait]");
  if (!fig || !window.AsciiLib) return;

  const { make, glyphsFromData, buildAtlas, colsFor, CELL_ASPECT } = window.AsciiLib;
  const photo = fig.querySelector("img");
  const canvas = fig.querySelector("canvas");
  const ctx = canvas.getContext("2d");
  const calm = window.matchMedia("(prefers-reduced-motion: reduce)");
  const paper = getComputedStyle(document.documentElement).getPropertyValue("--paper").trim() || "#fff4f4";

  const IN = 2.4, OUT = 1.5;                 // seconds for the full change, there and back
  let grid, atlas, glyphs, alpha, noise, thr;
  let t = 0, target = 0, raf = 0, prev = 0, drawn = -1;
  let origin = { x: 0.5, y: 0.4 };           // where the change starts, share of the photo

  const hash = (n) => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };

  /* ---------- sampling ---------- */

  function layout() {
    const cssW = fig.clientWidth, cssH = photo.clientHeight;
    if (!cssW || !cssH || !photo.complete || !photo.naturalWidth) return false;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cols = colsFor(cssW, 60, 200);
    const W = Math.round(cssW * dpr), H = Math.round(cssH * dpr);
    const rows = Math.max(20, Math.round(H / ((W / cols) * CELL_ASPECT)));
    const cw = W / cols, ch = H / rows;
    canvas.width = W; canvas.height = H;
    grid = { cols, rows, cw, ch, W, H, gw: Math.ceil(cw), cssW, cssH };
    atlas = buildAtlas(cw, ch);

    const small = make(cols, rows);
    const g = small.getContext("2d", { willReadFrequently: true });
    g.imageSmoothingQuality = "high";
    g.drawImage(photo, 0, 0, cols, rows);
    const px = g.getImageData(0, 0, cols, rows).data;
    glyphs = glyphsFromData(px, cols, rows, new Uint8Array(cols * rows), 1.1, false);   // dark = dense reads best for a face
    alpha = new Uint8Array(cols * rows);
    noise = new Float32Array(cols * rows);
    for (let i = 0; i < alpha.length; i++) { alpha[i] = px[i * 4 + 3]; noise[i] = hash(i * 0.37); }
    setOrigin(origin.x, origin.y);
    drawn = -1;
    draw();
    return true;
  }

  /* when each cell flips: nearer the entry point = earlier, with some noise so it spreads raggedly */
  function setOrigin(ox, oy) {
    origin = { x: ox, y: oy };
    const { cols, rows, cssW, cssH } = grid;
    thr = new Float32Array(cols * rows);
    const far = Math.hypot(Math.max(ox, 1 - ox) * cssW, Math.max(oy, 1 - oy) * cssH);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const d = Math.hypot(((c + 0.5) / cols - ox) * cssW, ((r + 0.5) / rows - oy) * cssH) / far;
        thr[r * cols + c] = d * 0.8 + noise[r * cols + c] * 0.2;
      }
    }
  }

  /* ---------- drawing ---------- */

  function draw() {
    if (!grid || t === drawn) return;
    drawn = t;
    const { cols, rows, cw, ch, gw } = grid;
    ctx.clearRect(0, 0, grid.W, grid.H);
    if (t <= 0) return;
    for (let i = 0; i < glyphs.length; i++) {
      if (alpha[i] < 24) continue;                              // outside the cut-out
      const s = Math.max(0, Math.min(1, (t * 1.35 - thr[i]) * 4));
      if (s <= 0) continue;
      const x = (i % cols) * cw, y = ((i / cols) | 0) * ch;
      ctx.globalAlpha = s;
      ctx.fillStyle = paper;                                    // covers the photo under this cell
      ctx.fillRect(x - 0.5, y - 0.5, cw + 1, ch + 1);
      if (glyphs[i]) ctx.drawImage(atlas, glyphs[i] * gw, 0, gw, atlas.height, x, y, gw, atlas.height);
    }
    ctx.globalAlpha = 1;
  }

  /* ---------- animation ---------- */

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
    target = to;
    if (!raf && grid) raf = requestAnimationFrame(tick);
  }

  /* ---------- input ---------- */

  fig.addEventListener("pointerenter", (e) => {
    if (e.pointerType === "touch" || !grid) return;
    if (t === 0) {                                              // new origin only when fully back to the photo
      const r = fig.getBoundingClientRect();
      setOrigin((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
    }
    go(1);
  });
  fig.addEventListener("pointerleave", (e) => { if (e.pointerType !== "touch") go(0); });
  fig.addEventListener("pointerup", (e) => {                    // tap toggles on touch screens
    if (e.pointerType === "touch") go(target ? 0 : 1);
  });

  /* ---------- boot ---------- */

  const start = () => { if (layout()) fig.classList.add("is-ready"); };
  if (photo.complete) start(); else photo.addEventListener("load", start, { once: true });

  let timer = 0;
  new ResizeObserver(() => { clearTimeout(timer); timer = setTimeout(() => { if (grid) layout(); }, 120); }).observe(fig);
})();

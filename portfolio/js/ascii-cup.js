/* ASCII coffee cup for the Douwe Egberts page, with steam rising from it.
   The cup is the photo sampled into glyphs (drawn once). The steam is a small
   particle system splatted into a density field and drawn as lighter-to-denser
   characters on a second canvas. Needs ascii-lib.js. */
(() => {
  "use strict";

  const host = document.querySelector("[data-ascii-cup]");
  if (!host || !window.AsciiLib) return;

  const { make, toGlyphs, buildAtlas, colsFor, CELL_ASPECT } = window.AsciiLib;

  /* the box in source px: the cup (y 330..1469) plus headroom for the steam */
  const WORLD = { x: 38, y: -430, w: 1730, h: 1899 };
  const CUP = { x: 38, y: 330, w: 1730, h: 1139 };
  const MOUTH = { x0: 640, x1: 1130, y: 520 };           // where steam leaves the cup, source px
  const STEAM = " .:~*";                                 // thin -> dense
  const FPS = 30;

  const calm = window.matchMedia("(prefers-reduced-motion: reduce)");
  const cStatic = host.querySelector(".cup-static");
  const cSteam = host.querySelector(".cup-steam");
  const sctx = cStatic.getContext("2d");
  const tctx = cSteam.getContext("2d");

  let img, grid, field;
  let running = false, visible = true, raf = 0, prev = 0, last = 0, spawnDebt = 0;
  const parts = [];

  const hash = (n) => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };

  /* ---------- layout + the cup ---------- */

  function layout() {
    const cssW = host.clientWidth;
    if (!cssW || !img) return false;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cols = colsFor(cssW, 80, 200);
    const W = Math.round(cssW * dpr), H = Math.round(W * WORLD.h / WORLD.w);
    const rows = Math.max(30, Math.round(H / ((W / cols) * CELL_ASPECT)));
    const cw = W / cols, ch = H / rows;
    for (const c of [cStatic, cSteam]) { c.width = W; c.height = H; }
    grid = { cols, rows, cw, ch, W, H, gw: Math.ceil(cw), cssH: host.clientHeight,
      cupAtlas: buildAtlas(cw, ch), steamAtlas: buildAtlas(cw, ch, STEAM),
      sx: cols / WORLD.w, sy: rows / WORLD.h };
    field = new Float32Array(cols * rows);

    // resting cup: the crop scaled into its place in the cell grid
    const small = make(cols, rows);
    const g = small.getContext("2d", { willReadFrequently: true });
    g.imageSmoothingQuality = "high";
    g.drawImage(img, CUP.x, CUP.y, CUP.w, CUP.h,
      (CUP.x - WORLD.x) * grid.sx, (CUP.y - WORLD.y) * grid.sy, CUP.w * grid.sx, CUP.h * grid.sy);
    const glyphs = toGlyphs(g, cols, rows, new Uint8Array(cols * rows), 1.05);
    sctx.clearRect(0, 0, W, H);
    for (let i = 0; i < glyphs.length; i++) {
      const gi = glyphs[i];
      if (gi) sctx.drawImage(grid.cupAtlas, gi * grid.gw, 0, grid.gw, grid.cupAtlas.height,
        (i % cols) * cw, ((i / cols) | 0) * ch, grid.gw, grid.cupAtlas.height);
    }

    parts.length = 0;
    for (let i = 0; i < 100; i++) step(1 / FPS);          // start with steam already in the air
    drawSteam(0);
    return true;
  }

  /* ---------- steam ---------- */

  function spawn() {
    const { sx, sy } = grid;
    const x = MOUTH.x0 + Math.random() * (MOUTH.x1 - MOUTH.x0);
    parts.push({
      c: (x - WORLD.x) * sx, r: (MOUTH.y - WORLD.y) * sy,
      vy: 8 + Math.random() * 5,                              // rows per second
      ph: Math.random() * 6.28, sway: 2 + Math.random() * 2.5,
      age: 0, life: 2.6 + Math.random() * 1.2,
      peak: 0.28 + Math.random() * 0.22
    });
  }

  function step(dt) {
    spawnDebt += dt * 34;
    while (spawnDebt >= 1) { spawnDebt -= 1; spawn(); }
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.age += dt;
      if (p.age >= p.life) { parts.splice(i, 1); continue; }
      const t = p.age / p.life;
      p.r -= p.vy * dt * (0.7 + t * 0.5);                      // speeds up as it thins
      p.c += Math.sin(p.age * 1.6 + p.ph) * p.sway * (0.3 + t) * dt * 3;
    }
  }

  function drawSteam(now) {
    const { cols, rows, cw, ch } = grid;
    field.fill(0);
    for (const p of parts) {
      const t = p.age / p.life;
      const ry = 1.1 + 2.8 * t, rx = ry * CELL_ASPECT;         // round in pixels, wider in cells
      const amp = p.peak * Math.min(1, p.age / 0.35) * Math.pow(1 - t, 1.2);
      const c0 = Math.max(0, Math.floor(p.c - rx)), c1 = Math.min(cols - 1, Math.ceil(p.c + rx));
      const r0 = Math.max(0, Math.floor(p.r - ry)), r1 = Math.min(rows - 1, Math.ceil(p.r + ry));
      for (let r = r0; r <= r1; r++) {
        const dy = (r + 0.5 - p.r) / ry;
        for (let c = c0; c <= c1; c++) {
          const dx = (c + 0.5 - p.c) / rx;
          const d2 = dx * dx + dy * dy;
          if (d2 < 1) field[r * cols + c] += amp * (1 - d2);
        }
      }
    }
    const fadeTop = 7;                                          // rows over which steam fades out at the top
    const tick = Math.floor(now / 110);
    tctx.clearRect(0, 0, grid.W, grid.H);
    for (let r = 0; r < rows; r++) {
      const edge = Math.min(1, r / fadeTop);
      for (let c = 0; c < cols; c++) {
        let d = field[r * cols + c];
        if (d < 0.04) continue;
        d *= edge * (0.72 + 0.56 * hash(c * 31 + r * 17 + tick * 7));   // wispy flicker
        const gi = d < 0.1 ? 0 : d < 0.22 ? 1 : d < 0.4 ? 2 : d < 0.7 ? 3 : 4;
        if (gi) tctx.drawImage(grid.steamAtlas, gi * grid.gw, 0, grid.gw, grid.steamAtlas.height,
          c * cw, r * ch, grid.gw, grid.steamAtlas.height);
      }
    }
  }

  /* ---------- loop ---------- */

  function frame(now) {
    raf = 0;
    if (!running) return;
    const dt = Math.min(0.1, Math.max(0.001, (now - (prev || now)) / 1000));
    prev = now;
    step(dt);
    if (now - last >= 1000 / FPS - 1) { last = now; drawSteam(now); }
    raf = requestAnimationFrame(frame);
  }

  function play() {
    if (running || calm.matches || !visible || document.hidden || !grid) return;
    running = true;
    raf = requestAnimationFrame(frame);
  }
  function stop() {
    running = false; prev = 0;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  /* ---------- boot ---------- */

  const src = new Image();
  src.onload = () => { img = src; layout(); host.classList.add("is-ready"); play(); };
  src.src = host.dataset.src;

  let timer = 0;
  new ResizeObserver(() => { clearTimeout(timer); timer = setTimeout(() => { if (img) { layout(); play(); } }, 120); }).observe(host);

  new IntersectionObserver(([e]) => { visible = e.isIntersecting; visible ? play() : stop(); }).observe(host);
  document.addEventListener("visibilitychange", () => (document.hidden ? stop() : play()));
  calm.addEventListener("change", () => (calm.matches ? stop() : play()));
})();

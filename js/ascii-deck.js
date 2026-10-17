/* Live ASCII DJ set: CDJ-3000 x2 + Xone:92, drawn as real glyphs on canvas.
   The source photo is sampled into a character grid. Cells inside the two
   jog wheels are re-sampled from a rotated copy of the photo every frame,
   so the platters turn while the rest of the set stays still.
   Each deck is one small physics model: the platter angle drives both the
   rotation and the position of the waveform on that deck's screen, so a
   scratch with the pointer moves the waveform with it. */
(() => {
  "use strict";

  const host = document.querySelector("[data-ascii-deck]");
  if (!host) return;

  const SRC = host.dataset.src;
  const { DARK, CELL_ASPECT, make, toGlyphs, buildAtlas, colsFor } = window.AsciiLib;
  const FPS = 30;                      // idle frame rate; 60 while scratching
  const W0 = (33.33 / 60) * Math.PI * 2;                 // nominal platter speed, rad/s
  const BEAT_PX = 15;                                    // waveform px per beat (174 bpm look)
  const PX_PER_RAD = (BEAT_PX * 174 / 60) / W0;          // waveform px per platter radian

  /* crop of the source photo (px) and the two jog wheels inside it */
  const CROP = { x: 188, y: 120, w: 524, h: 232 };
  const WHEELS = [
    { x: 274.4 - CROP.x, y: 279.05 - CROP.y, r: 56, phase: 0 },
    { x: 626.4 - CROP.x, y: 279.05 - CROP.y, r: 56, phase: 0.37 }
  ];
  /* waveform strip on each deck's screen: extent, playhead x, centre line y */
  const SCREENS = [
    { x0: 36, x1: 136, y0: 36, y1: 52, head: 63.5, cy: 44 },
    { x0: 388, x1: 488, y0: 36, y1: 52, head: 415.5, cy: 44 }
  ];

  const decks = WHEELS.map((w) => ({
    ang: w.phase * Math.PI * 2, vel: W0, hover: false, last: 0, pend: 0
  }));

  const calm = window.matchMedia("(prefers-reduced-motion: reduce)");
  const hero = host.closest(".hero") || host;
  const layerStatic = host.querySelector(".deck-static");
  const layerLive = host.querySelector(".deck-live");
  const sctx = layerStatic.getContext("2d");
  const lctx = layerLive.getContext("2d");

  let crop;                 // cropped source, source resolution
  let grid;                 // cell grid + glyph atlas + wheel/screen regions
  let running = false, visible = true, last = 0, prev = 0, raf = 0;

  /* claims every cell whose centre lies inside `inside(x, y)` (source px) for `id` */
  function claim(id, box, inside) {
    const { cols, rows, sx, sy } = grid;
    const c0 = Math.max(0, Math.floor(box.x0 * sx)), c1 = Math.min(cols, Math.ceil(box.x1 * sx));
    const r0 = Math.max(0, Math.floor(box.y0 * sy)), r1 = Math.min(rows, Math.ceil(box.y1 * sy));
    for (let r = r0; r < r1; r++) {
      for (let c = c0; c < c1; c++) {
        if (inside((c + 0.5) / sx, (r + 0.5) / sy)) grid.owner[r * cols + c] = id;
      }
    }
    return { c0, c1, r0, r1, bw: c1 - c0, bh: r1 - r0, x0: c0 / sx, y0: r0 / sy };
  }

  function layout() {
    const cssW = host.clientWidth || host.getBoundingClientRect().width;
    if (!cssW) return false;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cols = colsFor(cssW);
    const W = Math.round(cssW * dpr);
    const H = Math.round(W * CROP.h / CROP.w);
    const rows = Math.max(20, Math.round(H / ((W / cols) * CELL_ASPECT)));
    const cw = W / cols, ch = H / rows;

    for (const c of [layerStatic, layerLive]) { c.width = W; c.height = H; }
    grid = {
      cols, rows, cw, ch, W, H, sx: cols / CROP.w, sy: rows / CROP.h,
      atlas: buildAtlas(cw, ch), gw: Math.ceil(cw),
      owner: new Int8Array(cols * rows).fill(-1)     // -1 static, 0/1 wheel, 2/3 screen
    };

    grid.wheels = WHEELS.map((w, k) => {
      const area = claim(k, { x0: w.x - w.r, x1: w.x + w.r, y0: w.y - w.r, y1: w.y + w.r },
        (x, y) => (x - w.x) ** 2 + (y - w.y) ** 2 <= w.r * w.r);
      return { ...area, cvs: make(area.bw, area.bh), glyphs: new Uint8Array(area.bw * area.bh) };
    });
    grid.screens = SCREENS.map((sc, k) => claim(2 + k, sc, (x) => x >= sc.x0 && x <= sc.x1));
    return true;
  }

  function drawGlyph(ctx, g, c, r) {
    if (!g) return;
    ctx.drawImage(grid.atlas, g * grid.gw, 0, grid.gw, grid.atlas.height,
      c * grid.cw, r * grid.ch, grid.gw, grid.atlas.height);
  }

  function clearArea(a) {
    lctx.clearRect(a.c0 * grid.cw - 1, a.r0 * grid.ch - 1,
      (a.c1 - a.c0) * grid.cw + 3, (a.r1 - a.r0) * grid.ch + 3);
  }

  function drawStatic() {
    const { cols, rows } = grid;
    const small = make(cols, rows);
    const g = small.getContext("2d", { willReadFrequently: true });
    g.imageSmoothingQuality = "high";
    g.drawImage(crop, 0, 0, cols, rows);
    const glyphs = toGlyphs(g, cols, rows, new Uint8Array(cols * rows));
    sctx.clearRect(0, 0, grid.W, grid.H);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        if (grid.owner[i] < 0) drawGlyph(sctx, glyphs[i], c, r);
      }
    }
  }

  /* ---------- the turning platters ---------- */

  function drawWheels() {
    const { sx, sy, cols } = grid;
    WHEELS.forEach((w, k) => {
      const wh = grid.wheels[k];
      const g = wh.cvs.getContext("2d", { willReadFrequently: true });
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, wh.bw, wh.bh);
      // work in cell space: scale source px -> cells, rotate around the wheel centre
      g.imageSmoothingQuality = "medium";
      g.translate((w.x - wh.x0) * sx, (w.y - wh.y0) * sy);
      g.scale(sx, sy);
      g.rotate(decks[k].ang);
      g.drawImage(crop, -w.x, -w.y);
      toGlyphs(g, wh.bw, wh.bh, wh.glyphs);

      clearArea(wh);
      for (let r = 0; r < wh.bh; r++) {
        for (let c = 0; c < wh.bw; c++) {
          if (grid.owner[(wh.r0 + r) * cols + wh.c0 + c] === k) {
            drawGlyph(lctx, wh.glyphs[r * wh.bw + c], wh.c0 + c, wh.r0 + r);
          }
        }
      }
    });
  }

  /* ---------- the playing waveform ---------- */

  const hash = (n) => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };

  /* waveform height (0..1) at a track position in beats: kick on the beat, hat on the off-beat */
  function amp(beats) {
    const f = beats - Math.floor(beats);
    const off = (beats + 0.5) - Math.floor(beats + 0.5);
    const a = 0.22 + 0.55 * Math.exp(-f * 4.5) + 0.2 * Math.exp(-off * 9) + 0.2 * hash(Math.floor(beats * 7));
    return a > 1 ? 1 : a;
  }

  function drawScreens() {
    const { sx, sy, cols } = grid;
    SCREENS.forEach((sc, k) => {
      const area = grid.screens[k];
      const pos = decks[k].ang * PX_PER_RAD;     // track position follows the platter
      const half = (sc.y1 - sc.y0) / 2;
      clearArea(area);
      for (let r = area.r0; r < area.r1; r++) {
        const v = Math.abs((r + 0.5) / sy - sc.cy) / half;
        for (let c = area.c0; c < area.c1; c++) {
          if (grid.owner[r * cols + c] !== 2 + k) continue;
          const rel = (c + 0.5) / sx - sc.head;           // source px right of the playhead
          const a = amp((pos + rel) / BEAT_PX);
          const played = rel < 0;
          let g = DARK;                                   // dark screen
          if (Math.abs(rel) < 0.6 / sx) g = 1;            // playhead line
          else if (v <= a) g = v <= a * 0.5 ? (played ? 1 : 4) : (played ? 3 : 6);
          drawGlyph(lctx, g, c, r);
        }
      }
    });
  }

  /* ---------- deck physics ---------- */

  function step(dt) {
    let busy = false;
    for (const d of decks) {
      if (d.hover) {
        // the record is held: it only moves with the pointer
        const move = d.pend; d.pend = 0;
        d.ang += move;
        d.vel += (move / dt - d.vel) * Math.min(1, dt * 18);
        busy = true;
      } else {
        d.vel += (W0 - d.vel) * (1 - Math.exp(-dt * 4));   // spin back up to speed
        d.ang += d.vel * dt;
        if (Math.abs(d.vel - W0) > 0.05) busy = true;
      }
      d.vel = Math.max(-60, Math.min(60, d.vel));
    }
    return busy;
  }

  /* ---------- pointer scratch ---------- */

  function clearHover() {
    for (const d of decks) { d.hover = false; d.pend = 0; }
    hero.classList.remove("is-scratch");
  }

  function onMove(e) {
    if (!grid || !visible || calm.matches || e.pointerType === "touch") return;
    const rect = host.getBoundingClientRect();
    if (!rect.width) return;
    const px = (e.clientX - rect.left) / rect.width * CROP.w;
    const py = (e.clientY - rect.top) / rect.height * CROP.h;
    let over = false;
    WHEELS.forEach((w, k) => {
      const d = decks[k];
      const dx = px - w.x, dy = py - w.y;
      const dist = Math.hypot(dx, dy);
      if (dist > w.r) { d.hover = false; return; }
      over = true;
      const a = Math.atan2(dy, dx);
      if (!d.hover) { d.hover = true; d.last = a; return; }
      if (dist > 6) {                       // near the spindle the angle is noise
        let delta = a - d.last;
        if (delta > Math.PI) delta -= Math.PI * 2;
        if (delta < -Math.PI) delta += Math.PI * 2;
        d.pend += delta;
      }
      d.last = a;
    });
    hero.classList.toggle("is-scratch", over);
  }

  /* ---------- loop ---------- */

  function frame(now) {
    raf = 0;
    if (!running) return;
    const dt = Math.min(0.1, Math.max(0.001, (now - (prev || now)) / 1000));
    prev = now;
    const busy = step(dt);
    if (now - last >= 1000 / (busy ? 60 : FPS) - 1) {
      last = now;
      drawWheels();
      drawScreens();
    }
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
    clearHover();
  }

  function render() {
    if (!crop || !layout()) return;
    drawStatic();
    drawWheels();
    drawScreens();
  }

  /* ---------- boot ---------- */

  const img = new Image();
  img.onload = () => {
    crop = make(CROP.w, CROP.h);
    crop.getContext("2d").drawImage(img, CROP.x, CROP.y, CROP.w, CROP.h, 0, 0, CROP.w, CROP.h);
    render();
    host.classList.add("is-ready");
    play();
  };
  img.src = SRC;

  let resizeTimer = 0;
  new ResizeObserver(() => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { if (crop) { render(); play(); } }, 120);
  }).observe(host);

  window.addEventListener("pointermove", onMove, { passive: true });
  window.addEventListener("scroll", clearHover, { passive: true });
  document.documentElement.addEventListener("pointerleave", clearHover);

  new IntersectionObserver(([e]) => { visible = e.isIntersecting; visible ? play() : stop(); }).observe(host);
  document.addEventListener("visibilitychange", () => (document.hidden ? stop() : play()));
  calm.addEventListener("change", () => (calm.matches ? stop() : play()));
})();

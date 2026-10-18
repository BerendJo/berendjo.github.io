/* ASCII Funktion-One speaker for the work overview.
   It always plays on a 174 bpm grid while it is on screen: the horn pumps
   (glyphs bulge outward) every beat and ASCII music notes float up out of it.
   Scrolling turns it up: harder pump and more notes. Needs ascii-lib.js. */
(() => {
  "use strict";

  const host = document.querySelector("[data-ascii-speaker]");
  if (!host || !window.AsciiLib) return;

  const { RAMP, CELL_ASPECT, make, toGlyphs, buildAtlas, colsFor } = window.AsciiLib;

  const CROP = { x: 340, y: 140, w: 516, h: 812 };          // speaker inside the 1200px source
  const HORN = { x: 260, y: 290, rx: 225, ry: 215 };        // pumping ellipse, crop px
  const BLEED = { l: 0.2, t: 0.2 };                          // notes canvas overhang, share of speaker w / h (matches css)
  const BEAT = 60 / 174;
  const PUMP = 0.09;                                         // horn bulge at full pulse
  const FLASH = 1.6;                                         // glyph levels the horn darkens by at full pulse

  /* chunky ASCII notes (shared sprites), drawn 2x2 cells per sprite cell */
  const SPRITES = window.AsciiLib.NOTE_SPRITES;
  const SCALE = 2;

  const calm = window.matchMedia("(prefers-reduced-motion: reduce)");
  const cStatic = host.querySelector(".spk-static");
  const cLive = host.querySelector(".spk-live");
  const cNotes = host.querySelector(".spk-notes");
  const sctx = cStatic.getContext("2d");
  const lctx = cLive.getContext("2d");
  const nctx = cNotes.getContext("2d");
  const paper = "#fff4f4";   // drawn light; the canvas filter flips it with the theme

  let img, grid, base;                 // base = glyph per cell of the resting speaker
  let visible = false, running = false, raf = 0, prev = 0, beat = 0;
  let scrollY = window.scrollY, acc = 0, speed = 0, beatIn = 0, pump = 0, drawnPump = -1;
  const notes = [];

  const hash = (n) => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };

  /* ---------- layout + static render ---------- */

  function layout() {
    const cssW = host.clientWidth, cssH = host.clientHeight;
    if (!cssW || !cssH || !img) return false;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cols = colsFor(cssW, 70, 200);
    const W = Math.round(cssW * dpr), H = Math.round(W * CROP.h / CROP.w);
    const rows = Math.max(20, Math.round(H / ((W / cols) * CELL_ASPECT)));
    const cw = W / cols, ch = H / rows;
    for (const c of [cStatic, cLive]) { c.width = W; c.height = H; }
    cNotes.width = Math.round(cNotes.clientWidth * dpr);
    cNotes.height = Math.round(cNotes.clientHeight * dpr);

    grid = { cols, rows, cw, ch, W, H, cssW, cssH, dpr, gw: Math.ceil(cw), atlas: buildAtlas(cw, ch),
      sx: cols / CROP.w, sy: rows / CROP.h, horn: new Uint8Array(cols * rows) };

    // glyphs of the resting speaker
    const small = make(cols, rows);
    const g = small.getContext("2d", { willReadFrequently: true });
    g.imageSmoothingQuality = "high";
    g.drawImage(img, CROP.x, CROP.y, CROP.w, CROP.h, 0, 0, cols, rows);
    base = toGlyphs(g, cols, rows, new Uint8Array(cols * rows), 0.9);

    // horn cells belong to the live layer, the rest is drawn once
    let r0 = rows, r1 = 0, c0 = cols, c1 = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const d = hornDist(c, r);
        if (d < 1) {
          grid.horn[r * cols + c] = 1;
          if (r < r0) r0 = r; if (r >= r1) r1 = r + 1;
          if (c < c0) c0 = c; if (c >= c1) c1 = c + 1;
        }
      }
    }
    grid.box = { c0, c1, r0, r1 };
    sctx.clearRect(0, 0, W, H);
    for (let i = 0; i < base.length; i++) {
      if (!grid.horn[i]) glyph(sctx, base[i], i % cols, (i / cols) | 0);
    }
    notes.length = 0;
    nctx.clearRect(0, 0, cNotes.width, cNotes.height);
    drawnPump = -1;
    drawHorn(0);
    return true;
  }

  function glyph(ctx, g, c, r, ox = 0, oy = 0) {
    if (!g) return;
    ctx.drawImage(grid.atlas, g * grid.gw, 0, grid.gw, grid.atlas.height,
      c * grid.cw + ox, r * grid.ch + oy, grid.gw, grid.atlas.height);
  }

  /* elliptical distance (0 centre .. 1 edge) of a cell from the horn centre */
  function hornDist(c, r) {
    const x = (c + 0.5) / grid.sx - HORN.x, y = (r + 0.5) / grid.sy - HORN.y;
    return Math.hypot(x / HORN.rx, y / HORN.ry);
  }

  /* ---------- the pumping horn ---------- */

  function drawHorn(p) {
    if (p === drawnPump || (p !== 0 && Math.abs(p - drawnPump) < 0.004)) return;
    drawnPump = p;
    const { cols, rows, box } = grid;
    lctx.clearRect(box.c0 * grid.cw - 1, box.r0 * grid.ch - 1,
      (box.c1 - box.c0) * grid.cw + 3, (box.r1 - box.r0) * grid.ch + 3);
    const cx = HORN.x * grid.sx, cy = HORN.y * grid.sy;
    for (let r = box.r0; r < box.r1; r++) {
      for (let c = box.c0; c < box.c1; c++) {
        if (!grid.horn[r * cols + c]) continue;
        let sc = c, sr = r;
        if (p > 0.001) {
          const d = hornDist(c, r);
          const k = 1 + PUMP * p * (1 - d * d);              // centre bulges, rim stays put
          sc = Math.round(cx + (c + 0.5 - cx) / k - 0.5);
          sr = Math.round(cy + (r + 0.5 - cy) / k - 0.5);
          if (sc < 0 || sc >= cols || sr < 0 || sr >= rows) { sc = c; sr = r; }
        }
        let gi = base[sr * cols + sc];
        if (gi && p > 0.05) {                                // thump: horn flashes darker on the beat
          const lift = p * FLASH, n = Math.floor(lift);
          gi = Math.min(RAMP.length - 1, gi + n + (hash(r * cols + c) < lift - n ? 1 : 0));   // dithered, so weak pulses still show
        }
        glyph(lctx, gi, c, r);
      }
    }
  }

  /* ---------- notes ---------- */

  function emit(n) {
    const k = grid.cssW / 300;
    const ox = (BLEED.l * grid.cssW) + HORN.x / CROP.w * grid.cssW;
    const oy = (BLEED.t * grid.cssH) + HORN.y / CROP.h * grid.cssH;
    for (let i = 0; i < n; i++) {
      const a = (Math.random() - 0.5) * 1.9;                   // fan out around "up"
      const v = (65 + Math.random() * 55) * k;
      notes.push({
        x: ox + (Math.random() - 0.5) * 50 * k, y: oy + (Math.random() - 0.5) * 30 * k,
        vx: Math.sin(a) * v * 0.6, vy: -Math.cos(a) * v,
        age: 0, life: 1.9 + Math.random() * 0.8,
        wob: Math.random() * 6.28, spr: SPRITES[(Math.random() * SPRITES.length) | 0],
        seed: Math.random() * 1000
      });
    }
  }

  function drawNotes(dt) {
    nctx.clearRect(0, 0, cNotes.width, cNotes.height);
    const cwCss = grid.cw / grid.dpr, chCss = grid.ch / grid.dpr;
    for (let i = notes.length - 1; i >= 0; i--) {
      const n = notes[i];
      n.age += dt;
      if (n.age >= n.life) { notes.splice(i, 1); continue; }
      n.x += n.vx * dt; n.y += n.vy * dt;
      const t = n.age / n.life;
      const fade = t < 0.4 ? 1 : 1 - (t - 0.4) / 0.6;           // dissolves into lighter glyphs
      const x = n.x + Math.sin(n.age * 4.2 + n.wob) * 7;
      const c0 = Math.round(x / cwCss), r0 = Math.round(n.y / chCss);
      const { w, h } = n.spr;
      // paper halo so the note reads over the dark cabinet
      if (fade > 0.45) {
        nctx.fillStyle = paper;
        nctx.fillRect((c0 - 1) * grid.cw, (r0 - 1) * grid.ch, (w * SCALE + 2) * grid.cw, (h * SCALE + 2) * grid.ch);
      }
    }
    for (const n of notes) {                                    // glyphs on top of every halo
      const t = n.age / n.life;
      const fade = t < 0.4 ? 1 : 1 - (t - 0.4) / 0.6;
      const x = n.x + Math.sin(n.age * 4.2 + n.wob) * 7;
      const c0 = Math.round(x / cwCss), r0 = Math.round(n.y / chCss);
      const { w, h, rows } = n.spr;
      for (let r = 0; r < h; r++) {
        for (let c = 0; c < w; c++) {
          const gi = rows[r][c];
          if (gi <= 0) continue;
          const g = Math.round(gi * fade);
          if (g <= 0) continue;
          for (let dy = 0; dy < SCALE; dy++) {
            for (let dx = 0; dx < SCALE; dx++) {
              glyph(nctx, g, c0 + c * SCALE + dx, r0 + r * SCALE + dy);
            }
          }
        }
      }
    }
  }

  /* ---------- loop ---------- */

  function onScroll() {
    const y = window.scrollY;
    acc += Math.abs(y - scrollY);
    scrollY = y;
    if (visible) start();
  }

  function frame(now) {
    raf = 0;
    if (!running) return;
    if (speed < 5 && prev && now - prev < 32) { raf = requestAnimationFrame(frame); return; }   // 30 fps when idle
    const dt = Math.min(0.1, Math.max(0.001, (now - (prev || now)) / 1000));
    prev = now;

    speed += (acc / dt - speed) * Math.min(1, dt * 6);          // px/s, smoothed
    acc = 0;

    beatIn -= dt;
    if (beatIn <= 0) {
      beatIn += BEAT;
      beat++;
      if (speed > 40) {                                         // scrolling: harder kick, more notes
        pump = 1.2;
        emit(speed > 2400 ? 3 : speed > 1100 ? 2 : 1);
      } else {                                                  // idle: a softer pump every beat, a note every other beat
        pump = Math.max(pump, 0.6);
        if (beat % 2 === 0) emit(1);
      }
    }
    pump *= Math.exp(-dt * 9);
    if (pump < 0.002) pump = 0;

    drawHorn(pump);
    drawNotes(dt);

    raf = requestAnimationFrame(frame);
  }

  function start() {
    if (running || calm.matches || document.hidden || !grid) return;
    running = true; beatIn = 0; beat = 0;
    raf = requestAnimationFrame(frame);
  }
  function stop() {
    running = false; prev = 0; speed = 0; pump = 0;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    if (grid) { notes.length = 0; nctx.clearRect(0, 0, cNotes.width, cNotes.height); drawHorn(0); }
  }

  /* ---------- boot ---------- */

  const src = new Image();
  src.onload = () => {
    img = src;
    layout();
    host.classList.add("is-ready");
    if (visible) start();
  };
  src.src = host.dataset.src;

  let timer = 0;
  new ResizeObserver(() => { clearTimeout(timer); timer = setTimeout(() => { if (img) layout(); }, 120); }).observe(host);

  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) start(); else stop(); }).observe(host);
  document.addEventListener("visibilitychange", () => (document.hidden ? stop() : visible && start()));
  window.addEventListener("scroll", onScroll, { passive: true });
  calm.addEventListener("change", () => { if (calm.matches) stop(); else if (visible) start(); });
})();

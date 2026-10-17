/* Easter egg: type "bejo" anywhere and ASCII music notes rain down the page.
   Big notes fall fast in front, small pale ones drift slowly behind. Keyboard
   only; skipped with prefers-reduced-motion. Needs ascii-lib.js. */
(() => {
  "use strict";

  if (!window.AsciiLib) return;
  const { NOTE_SPRITES, buildAtlas, CELL_ASPECT } = window.AsciiLib;

  const WORD = "bejo";
  const DURATION = 3800;                       // ms of spawning; the last notes fall out after that
  const CW = 3.7, CH = CW * CELL_ASPECT;       // cell size, css px
  const calm = window.matchMedia("(prefers-reduced-motion: reduce)");
  const paper = getComputedStyle(document.documentElement).getPropertyValue("--paper").trim() || "#fff4f4";

  let canvas, ctx, atlas, gw, dpr, vw, vh, raf = 0, prev = 0, endAt = 0, debt = 0;
  const notes = [];

  function open() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    vw = window.innerWidth; vh = window.innerHeight;
    canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    canvas.style.cssText = "position:fixed;inset:0;width:100%;height:100%;z-index:90;pointer-events:none";
    canvas.width = Math.round(vw * dpr); canvas.height = Math.round(vh * dpr);
    document.body.appendChild(canvas);
    ctx = canvas.getContext("2d");
    atlas = buildAtlas(CW * dpr, CH * dpr);
    gw = Math.ceil(CW * dpr);
  }

  function spawn() {
    const big = Math.random() < 0.45;
    const spr = NOTE_SPRITES[(Math.random() * NOTE_SPRITES.length) | 0];
    const scale = big ? 2 : 1;
    notes.push({
      spr, scale, big,
      x: Math.random() * vw, y: -spr.h * scale * CH,
      vy: big ? 330 + Math.random() * 200 : 170 + Math.random() * 120,
      sway: 6 + Math.random() * 14, ph: Math.random() * 6.28, age: 0
    });
  }

  function put(g, c, r) {
    ctx.drawImage(atlas, g * gw, 0, gw, atlas.height, c * CW * dpr, r * CH * dpr, gw, atlas.height);
  }

  function frame(now) {
    raf = 0;
    const dt = Math.min(0.05, Math.max(0.001, (now - (prev || now)) / 1000));
    prev = now;
    if (now < endAt) { debt += dt * 30; while (debt >= 1) { debt -= 1; spawn(); } }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = notes.length - 1; i >= 0; i--) {
      const n = notes[i];
      n.age += dt;
      n.y += n.vy * dt;
      if (n.y > vh + 20) { notes.splice(i, 1); continue; }
    }
    // small pale notes first, big ones in front
    for (const pass of [false, true]) {
      for (const n of notes) {
        if (n.big !== pass) continue;
        const { w, h, rows } = n.spr;
        const c0 = Math.round((n.x + Math.sin(n.age * 3 + n.ph) * n.sway) / CW), r0 = Math.round(n.y / CH);
        if (n.big) {                                                // paper outline so it reads over dark images
          ctx.fillStyle = paper;
          for (let r = 0; r < h; r++) {
            for (let c = 0; c < w; c++) {
              if (rows[r][c] > 0) ctx.fillRect((c0 + c * n.scale - 1) * CW * dpr, (r0 + r * n.scale - 1) * CH * dpr,
                (n.scale + 2) * CW * dpr, (n.scale + 2) * CH * dpr);
            }
          }
        }
        for (let r = 0; r < h; r++) {
          for (let c = 0; c < w; c++) {
            let g = rows[r][c];
            if (g <= 0) continue;
            if (!n.big) g = Math.max(1, Math.round(g * 0.6));       // far away = lighter glyphs
            for (let dy = 0; dy < n.scale; dy++) {
              for (let dx = 0; dx < n.scale; dx++) put(g, c0 + c * n.scale + dx, r0 + r * n.scale + dy);
            }
          }
        }
      }
    }

    if (now >= endAt && !notes.length) { canvas.remove(); canvas = null; prev = 0; return; }
    raf = requestAnimationFrame(frame);
  }

  function trigger() {
    if (calm.matches) return;
    endAt = performance.now() + DURATION;                           // typing it again keeps the rain going
    if (!canvas) open();
    if (!raf) raf = requestAnimationFrame(frame);
  }

  let typed = "";
  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.repeat || e.key.length !== 1) return;
    const t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    typed = (typed + e.key.toLowerCase()).slice(-WORD.length);
    if (typed === WORD) { typed = ""; trigger(); }
  });

  window.addEventListener("resize", () => { if (canvas) { notes.length = 0; endAt = 0; } });   // frame() tidies up

  if (window.console && console.log) console.log("%c\u266B type \"bejo\"", "font-family:monospace");
})();

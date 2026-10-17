/* ASCII padlock for the Edufort page. Scrolling past it unlocks and locks it:
   the shackle lifts out of the body, swings aside around its long leg and
   comes back down again. The body is drawn once; only the shackle is
   re-sampled when the scroll position changes. Needs ascii-lib.js. */
(() => {
  "use strict";

  const host = document.querySelector("[data-ascii-lock]");
  if (!host || !window.AsciiLib) return;

  const { make, toGlyphs, buildAtlas, colsFor, CELL_ASPECT } = window.AsciiLib;

  /* source is 512 x 512: body below BODY_Y, shackle above; WORLD adds headroom for the lift */
  const WORLD = { x: 40, y: -95, w: 432, h: 607 };
  const BODY_Y = 225;
  const LEGS = [[128, 192], [320, 384]];      // shackle legs, x ranges
  const PIVOT = 352;                           // long (right) leg axis
  const LIFT = 72;                             // px the shackle rises
  const SWING = 78 * Math.PI / 180;            // max turn about the long leg

  const calm = window.matchMedia("(prefers-reduced-motion: reduce)");
  const cStatic = host.querySelector(".lock-static");
  const cLive = host.querySelector(".lock-live");
  const sctx = cStatic.getContext("2d");
  const lctx = cLive.getContext("2d");

  let img, sprite, grid, small, sg;
  let target = 0, current = 0, shown = -1, raf = 0;

  const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
  const smooth = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };

  /* ---------- layout ---------- */

  function layout() {
    const cssW = host.clientWidth;
    if (!cssW || !img) return false;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cols = colsFor(cssW, 70, 200);
    const W = Math.round(cssW * dpr), H = Math.round(W * WORLD.h / WORLD.w);
    const rows = Math.max(30, Math.round(H / ((W / cols) * CELL_ASPECT)));
    const cw = W / cols, ch = H / rows;
    for (const c of [cStatic, cLive]) { c.width = W; c.height = H; }
    grid = { cols, rows, cw, ch, W, H, gw: Math.ceil(cw), atlas: buildAtlas(cw, ch),
      sx: cols / WORLD.w, sy: rows / WORLD.h };
    // rows whose centre is above the body belong to the shackle
    grid.bodyRow = Math.ceil((BODY_Y - WORLD.y) * grid.sy - 0.5);

    small = make(cols, rows);
    sg = small.getContext("2d", { willReadFrequently: true });
    sg.imageSmoothingQuality = "high";

    // resting lock -> body rows, drawn once
    place(sg, 0, 1);
    sg.drawImage(img, 0, 0);
    const glyphs = toGlyphs(sg, cols, rows, new Uint8Array(cols * rows));
    sctx.clearRect(0, 0, W, H);
    for (let r = grid.bodyRow; r < rows; r++) {
      for (let c = 0; c < cols; c++) put(sctx, glyphs[r * cols + c], c, r);
    }
    shown = -1;
    drawShackle(current);
    return true;
  }

  const put = (ctx, g, c, r) => {
    if (g) ctx.drawImage(grid.atlas, g * grid.gw, 0, grid.gw, grid.atlas.height,
      c * grid.cw, r * grid.ch, grid.gw, grid.atlas.height);
  };

  /* map source px -> cells, then lift and foreshorten about the long leg (the turn) */
  function place(ctx, lift, scaleX) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.scale(grid.sx, grid.sy);
    ctx.translate(-WORLD.x, -WORLD.y);
    ctx.translate(PIVOT, -lift);
    ctx.scale(scaleX, 1);
    ctx.translate(-PIVOT, 0);
  }

  /* ---------- shackle ---------- */

  /* the shackle with its legs extended down, so it still reaches the body when lifted */
  function buildSprite() {
    sprite = make(512, 512);
    const g = sprite.getContext("2d");
    g.drawImage(img, 0, 0, 512, BODY_Y, 0, 0, 512, BODY_Y);
    g.fillStyle = "#000";
    for (const [x0, x1] of LEGS) g.fillRect(x0, BODY_Y - 1, x1 - x0, LIFT + 40);
  }

  function drawShackle(open) {
    if (Math.abs(open - shown) < 0.002) return;
    shown = open;
    const lift = smooth(open / 0.45) * LIFT;
    const turn = smooth((open - 0.4) / 0.6) * SWING;
    place(sg, lift, Math.cos(turn));
    sg.drawImage(sprite, 0, 0);
    const { cols, bodyRow } = grid;
    const glyphs = toGlyphs(sg, cols, grid.rows, new Uint8Array(cols * grid.rows));
    lctx.clearRect(0, 0, grid.W, grid.H);
    for (let r = 0; r < bodyRow; r++) {
      for (let c = 0; c < cols; c++) put(lctx, glyphs[r * cols + c], c, r);
    }
  }

  /* ---------- scroll ---------- */

  /* 0 as the lock enters the screen, 1 as it leaves: shut -> open -> shut */
  function openness() {
    const rect = host.getBoundingClientRect();
    const vh = window.innerHeight;
    const t = (vh - rect.top) / (vh + rect.height);
    return smooth((t - 0.1) / 0.25) * (1 - smooth((t - 0.5) / 0.25));
  }

  function tick() {
    raf = 0;
    current += (target - current) * 0.2;                        // a little weight, like a real latch
    if (Math.abs(target - current) < 0.002) current = target;
    drawShackle(current);
    if (current !== target) raf = requestAnimationFrame(tick);
  }

  function onScroll() {
    target = openness();
    if (!raf && grid) raf = requestAnimationFrame(tick);
  }

  /* ---------- boot ---------- */

  const src = new Image();
  src.onload = () => {
    img = src;
    buildSprite();
    layout();
    host.classList.add("is-ready");
    if (!calm.matches) { target = current = openness(); drawShackle(current); }
  };
  src.src = host.dataset.src;

  let timer = 0;
  new ResizeObserver(() => { clearTimeout(timer); timer = setTimeout(() => { if (img) { layout(); if (!calm.matches) onScroll(); } }, 120); }).observe(host);

  if (!calm.matches) {
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
  }
})();

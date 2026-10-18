/* Scroll reveal: a block arrives as ASCII art and quickly resolves into the real
   thing. Pictures become ASCII of themselves (same look as the hover morph), text
   lines become glyph bars.

   Built to stay smooth while scrolling:
   - blocks are prepared in idle time while they are still below the fold: the whole
     ASCII picture is sampled and drawn once into an off-screen canvas;
   - the reveal itself only updates a tiny mask (one pixel per cell) and composites
     it, a few canvas calls per frame however big the block is;
   - colours are drawn in the current theme, so no canvas filter is needed.

   AsciiLib.revealAscii(el) -> Promise. Needs ascii-lib.js. */
(() => {
  "use strict";

  const lib = window.AsciiLib;
  if (!lib) return;
  const { make, glyphsFromData, buildAtlas, whenIdle, CELL_ASPECT } = lib;

  const CW = 3.7, CH = CW * CELL_ASPECT;       // cell size, css px
  const PIXEL_BUDGET = 3e6;                    // off-screen picture size cap, so a huge block stays cheap
  const MEDIA = ".tile-media, .p-panel, .p-photo, .p-covers, .about-photo";
  const SKIP = "canvas, noscript, script, style";
  const hash = (n) => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  lib.revealMs = 950;                          // length of the dissolve

  const root = document.documentElement;
  const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");
  const isDark = () => (root.dataset.theme ? root.dataset.theme === "dark" : darkQuery.matches);

  /* blocks that are ASCII art already just come in */
  const isPlain = (el) => el.matches("[data-ascii-speaker]") || !!el.querySelector("[data-ascii-cup], [data-ascii-lock]");

  /* wait for the pictures to load and decode (decoding off the main thread, so the later drawImage is cheap) */
  async function imagesReady(el) {
    const imgs = [...el.querySelectorAll("img")];
    const loaded = imgs.map((i) => (i.complete && i.naturalWidth ? 1 : new Promise((r) => {
      i.addEventListener("load", r, { once: true });
      i.addEventListener("error", r, { once: true });
    })));
    await Promise.race([Promise.all(loaded).then(() => Promise.all(imgs.map((i) => (i.decode ? i.decode().catch(() => {}) : 0)))), sleep(2500)]);
  }

  /* draw one <img> where it sits, honouring object-fit, padding and opacity (css px, relative to the element) */
  function drawImg(g, img, er) {
    const cs = getComputedStyle(img);
    const num = (v) => parseFloat(v) || 0;
    const r = img.getBoundingClientRect();
    const x = r.left - er.left + num(cs.paddingLeft), y = r.top - er.top + num(cs.paddingTop);
    const w = r.width - num(cs.paddingLeft) - num(cs.paddingRight);
    const h = r.height - num(cs.paddingTop) - num(cs.paddingBottom);
    const iw = img.naturalWidth, ih = img.naturalHeight;
    if (!iw || !ih || w <= 0 || h <= 0) return;
    let dx = x, dy = y, dw = w, dh = h, sx = 0, sy = 0, sw = iw, sh = ih;
    if (cs.objectFit === "cover") {
      const k = Math.max(w / iw, h / ih);
      sw = w / k; sh = h / k; sx = (iw - sw) / 2; sy = (ih - sh) / 2;
    } else if (cs.objectFit === "contain") {
      const k = Math.min(w / iw, h / ih);
      dw = iw * k; dh = ih * k; dx = x + (w - dw) / 2; dy = y + (h - dh) / 2;
    }
    g.globalAlpha = cs.opacity === "" ? 1 : num(cs.opacity);
    g.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
    g.globalAlpha = 1;
  }

  /* which cells hide under which glyph: pictures sampled, text lines as bars */
  function plan(el, er, cols, rows) {
    const cover = new Uint8Array(cols * rows);
    const glyph = new Uint8Array(cols * rows);
    const cellRange = (x, y, w, h) => ({
      c0: Math.max(0, Math.floor(x / CW)), c1: Math.min(cols, Math.ceil((x + w) / CW)),
      r0: Math.max(0, Math.floor(y / CH)), r1: Math.min(rows, Math.ceil((y + h) / CH))
    });

    const hosts = new Set(el.querySelectorAll(MEDIA));
    if (el.matches(MEDIA)) hosts.add(el);
    hosts.forEach((host) => {
      const imgs = [...host.querySelectorAll("img")].filter((i) => i.naturalWidth && i.offsetWidth);
      if (!imgs.length) return;
      const hr = host.getBoundingClientRect();
      const { c0, c1, r0, r1 } = cellRange(hr.left - er.left, hr.top - er.top, hr.width, hr.height);
      const hc = c1 - c0, hrw = r1 - r0;
      if (hc < 2 || hrw < 2) return;
      const small = make(hc, hrw);
      const g = small.getContext("2d", { willReadFrequently: true });
      g.imageSmoothingQuality = "high";
      g.setTransform(1 / CW, 0, 0, 1 / CH, -c0, -r0);            // css px relative to the element -> cells
      const bg = getComputedStyle(host).backgroundColor;
      if (bg && bg !== "transparent" && bg !== "rgba(0, 0, 0, 0)") {
        g.fillStyle = bg;
        g.fillRect(hr.left - er.left, hr.top - er.top, hr.width, hr.height);
      }
      for (const img of imgs) drawImg(g, img, er);
      const px = g.getImageData(0, 0, hc, hrw).data;
      const gl = glyphsFromData(px, hc, hrw, new Uint8Array(hc * hrw), 1.5, false);
      for (let r = 0; r < hrw; r++) {
        for (let c = 0; c < hc; c++) {
          const k = r * hc + c, i = (r0 + r) * cols + c0 + c;
          if (px[k * 4 + 3] < 24) continue;                      // transparent gaps stay uncovered
          cover[i] = 1; glyph[i] = gl[k];
        }
      }
    });

    /* text lines and buttons: bars of random glyphs */
    const bar = (x, y, w, h) => {
      const { c0, c1, r0, r1 } = cellRange(x, y, w, h);
      for (let r = r0; r < r1; r++) {
        for (let c = c0; c < c1; c++) {
          const i = r * cols + c;
          if (cover[i]) continue;
          cover[i] = 1;
          const n = hash(i * 0.73);
          glyph[i] = n < 0.18 ? 0 : 2 + Math.floor(hash(i * 1.91) * 8);
        }
      }
    };
    el.querySelectorAll(".btn").forEach((b) => {
      const r = b.getBoundingClientRect();
      bar(r.left - er.left, r.top - er.top, r.width, r.height);
    });
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        if (!n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        const p = n.parentElement;
        return !p || p.closest(SKIP) || p.closest(MEDIA) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
      }
    });
    const range = document.createRange();
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      range.selectNodeContents(n);
      for (const r of range.getClientRects()) {
        if (r.width > 1 && r.height > 1) bar(r.left - er.left, r.top - er.top, r.width, r.height);
      }
    }
    return { cover, glyph };
  }

  /* everything a reveal needs, ready before it is wanted. Resolves to null when the block just fades in. */
  async function build(el, urgent) {
    if (isPlain(el)) return null;
    const hop = () => (urgent ? Promise.resolve() : new Promise((r) => whenIdle(r)));   // spread the heavy parts over idle slices
    await imagesReady(el);
    await hop();

    const er = el.getBoundingClientRect();
    if (er.width < 8 || er.height < 8) return null;
    const cols = Math.ceil(er.width / CW), rows = Math.ceil(er.height / CH);
    const { cover, glyph } = plan(el, er, cols, rows);
    const cells = [];
    for (let i = 0; i < cover.length; i++) if (cover[i]) cells.push(i);
    if (!cells.length) return null;
    await hop();

    const dark = isDark();
    const paper = dark ? "#120f10" : "#fff4f4", ink = dark ? "#fff4f4" : "#120f10";
    const scale = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(PIXEL_BUDGET / (er.width * er.height)));
    const W = Math.max(1, Math.round(er.width * scale)), H = Math.max(1, Math.round(er.height * scale));
    const cw = W / cols, ch = H / rows, gw = Math.ceil(cw);
    const atlas = buildAtlas(cw, ch, undefined, ink);

    /* the whole ASCII picture, drawn once; the reveal only shows parts of it through a mask */
    const full = make(W, H);
    const fg = full.getContext("2d");
    fg.fillStyle = paper;
    for (const i of cells) {
      const c = i % cols, r = (i / cols) | 0;
      const x0 = Math.floor(c * cw), x1 = Math.min(W, Math.floor((c + 1) * cw));
      const y0 = Math.floor(r * ch), y1 = Math.min(H, Math.floor((r + 1) * ch));
      fg.fillRect(x0, y0, x1 - x0, y1 - y0);
      if (glyph[i]) fg.drawImage(atlas, glyph[i] * gw, 0, gw, atlas.height, c * cw, r * ch, gw, atlas.height);
    }
    const mask = make(cols, rows);
    const mctx = mask.getContext("2d");
    const maskData = mctx.createImageData(cols, rows);

    const live = Uint32Array.from(cells);
    const thr = new Float32Array(cols * rows);
    for (const i of live) thr[i] = ((i / cols | 0) / rows) * 0.55 + ((i % cols) / cols) * 0.3 + hash(i * 0.37) * 0.15;

    return { w: er.width, h: er.height, dark, lang: root.lang, W, H, full, mask, mctx, maskData, live, thr };
  }

  /* prepared blocks, keyed by element; each value is a promise of the build result */
  const prepared = new Map();
  const started = new WeakSet();
  const free = (e) => { if (e) { e.full.width = 0; } };

  function prepare(el, urgent = false) {
    let p = prepared.get(el);
    if (!p) {
      p = build(el, urgent).catch(() => null);
      prepared.set(el, p);
    }
    return p;
  }

  /* is it close enough to being seen that preparing it makes sense? */
  const near = (el) => {
    const r = el.getBoundingClientRect();
    return r.top < window.innerHeight * 2.2 && r.bottom > -window.innerHeight;
  };

  async function revealAscii(el) {
    started.add(el);
    let entry;
    const lazy = prepared.get(el);
    if (lazy) {
      // prepared ahead of time; but never keep the block invisible for long if the browser is too busy to finish it
      entry = await Promise.race([lazy, sleep(600).then(() => undefined)]);
      prepared.delete(el);
      if (entry === undefined) { lazy.then(free); entry = await build(el, true); }
    } else {
      entry = await prepare(el, true);
      prepared.delete(el);
    }
    if (!entry) { el.classList.add("in"); return; }

    // the page may have changed since it was prepared (theme, language, resize): rebuild if so
    const er = el.getBoundingClientRect();
    if (Math.abs(er.width - entry.w) > 1.5 || Math.abs(er.height - entry.h) > 1.5 || entry.dark !== isDark() || entry.lang !== root.lang) {
      free(entry);
      entry = await build(el, true);
      if (!entry) { el.classList.add("in"); return; }
    }

    const { full, mask, mctx, maskData, live, thr, W, H } = entry;
    const canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    canvas.width = W; canvas.height = H;
    canvas.style.cssText = `position:absolute;left:0;top:0;width:${entry.w}px;height:${entry.h}px;z-index:6;pointer-events:none`;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    const d = maskData.data;

    /* T runs 0 -> 1.25; a cell's cover fades out once T passes its threshold */
    const draw = (T) => {
      let left = 0;
      for (let n = 0; n < live.length; n++) {
        const i = live[n], s = 1 - Math.max(0, Math.min(1, (T - thr[i]) * 5));
        d[i * 4 + 3] = (s * 255) | 0;
        if (s > 0) left++;
      }
      mctx.putImageData(maskData, 0, 0);
      ctx.globalCompositeOperation = "source-over";
      ctx.clearRect(0, 0, W, H);
      ctx.drawImage(full, 0, 0);
      ctx.globalCompositeOperation = "destination-in";           // keep only the cells still covered
      ctx.drawImage(mask, 0, 0, W, H);
      ctx.globalCompositeOperation = "source-over";
      return left;
    };

    const wasStatic = getComputedStyle(el).position === "static";
    if (wasStatic) el.style.position = "relative";
    draw(0);                                                     // fully covered before the real content shows
    el.appendChild(canvas);
    el.classList.add("in");

    await new Promise((resolve) => {
      const dur = lib.revealMs, t0 = performance.now();
      const frame = (now) => {
        const left = draw(Math.min(1.25, ((now - t0) / dur) * 1.25));
        if (left) requestAnimationFrame(frame); else resolve();
      };
      requestAnimationFrame(frame);
    });
    canvas.remove();
    free(entry);
    if (wasStatic) el.style.position = "";
  }

  /* ---- prepare blocks ahead of time ---- */

  const blocks = [...document.querySelectorAll(".reveal")];
  const prepareIfNear = (el) => {
    if (started.has(el) || prepared.has(el) || !near(el)) return;
    prepare(el);
  };
  if (blocks.length && "IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        if (started.has(e.target)) io.unobserve(e.target); else prepareIfNear(e.target);
      }
    }, { rootMargin: "0px 0px 120% 0px" });
    blocks.forEach((el) => io.observe(el));
  }

  /* theme, language or width changed: prepared pictures are stale, redo the ones that are close */
  function invalidate() {
    for (const [el, p] of prepared) {
      if (started.has(el)) continue;
      prepared.delete(el);
      p.then(free);
    }
    blocks.forEach(prepareIfNear);
  }
  new MutationObserver(invalidate).observe(root, { attributes: true, attributeFilter: ["lang", "data-theme"] });
  darkQuery.addEventListener("change", invalidate);
  let lastW = window.innerWidth, timer = 0;
  window.addEventListener("resize", () => {
    if (window.innerWidth === lastW) return;                     // mobile address bar: height only
    lastW = window.innerWidth;
    clearTimeout(timer);
    timer = setTimeout(invalidate, 250);
  });

  lib.revealAscii = revealAscii;
})();

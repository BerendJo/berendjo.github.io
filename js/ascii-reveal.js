/* Scroll reveal: a block arrives as ASCII art and quickly resolves into the real
   thing. Pictures become ASCII of themselves (same look as the hover morph), text
   lines become glyph bars. A temporary canvas covers the block and its cells
   dissolve in a sweep from the top left; then the canvas is removed.
   AsciiLib.revealAscii(el) -> Promise. Needs ascii-lib.js. */
(() => {
  "use strict";

  const lib = window.AsciiLib;
  if (!lib) return;
  const { make, glyphsFromData, buildAtlas, CELL_ASPECT } = lib;

  const CW = 3.7, CH = CW * CELL_ASPECT;       // cell size, css px
  const STAGES = 3;                            // glyph + cover fade in this many steps
  const MEDIA = ".tile-media, .p-panel, .p-photo, .p-covers, .about-photo";
  const SKIP = "canvas, noscript, script, style";
  const hash = (n) => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  lib.revealMs = 950;                          // length of the dissolve

  /* the canvas is flipped by --ascii-filter in dark mode, so cover cells are drawn in the pre-flip colour */
  function coverColor() {
    const f = getComputedStyle(document.documentElement).getPropertyValue("--ascii-filter").trim();
    return f && f !== "none" ? "#edf0ef" : "#fff4f4";
  }

  async function imagesReady(el) {
    const waits = [...el.querySelectorAll("img")].map((i) => (i.complete && i.naturalWidth ? 1 : new Promise((r) => {
      i.addEventListener("load", r, { once: true });
      i.addEventListener("error", r, { once: true });
    })));
    await Promise.race([Promise.all(waits), sleep(2000)]);
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

  async function revealAscii(el) {
    // blocks that are ASCII art already just come in
    if (el.matches("[data-ascii-speaker]") || el.querySelector("[data-ascii-cup], [data-ascii-lock]")) {
      el.classList.add("in");
      return;
    }
    await imagesReady(el);
    const er = el.getBoundingClientRect();
    if (er.width < 8 || er.height < 8) { el.classList.add("in"); return; }

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cols = Math.ceil(er.width / CW), rows = Math.ceil(er.height / CH);
    const { cover, glyph } = plan(el, er, cols, rows);
    const cells = [];
    for (let i = 0; i < cover.length; i++) if (cover[i]) cells.push(i);
    if (!cells.length) { el.classList.add("in"); return; }

    const cw = CW * dpr, ch = CH * dpr, gw = Math.ceil(cw);
    const atlas = buildAtlas(cw, ch);
    const canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    canvas.width = Math.round(er.width * dpr); canvas.height = Math.round(er.height * dpr);
    canvas.style.cssText = `position:absolute;left:0;top:0;width:${er.width}px;height:${er.height}px;z-index:6;pointer-events:none;filter:var(--ascii-filter)`;
    const ctx = canvas.getContext("2d");
    const paper = coverColor();

    const stage = new Uint8Array(cover.length);
    const thr = new Float32Array(cover.length);
    const px = (v, max) => Math.min(max, Math.floor(v));
    const paintCell = (i, st) => {
      const c = i % cols, r = (i / cols) | 0;
      const x0 = px(c * cw, canvas.width), x1 = px((c + 1) * cw, canvas.width);
      const y0 = px(r * ch, canvas.height), y1 = px((r + 1) * ch, canvas.height);
      ctx.clearRect(x0, y0, x1 - x0, y1 - y0);
      if (!st) return;
      ctx.globalAlpha = st / STAGES;
      ctx.fillStyle = paper;
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
      if (glyph[i]) ctx.drawImage(atlas, glyph[i] * gw, 0, gw, atlas.height, c * cw, r * ch, gw, atlas.height);
    };
    for (const i of cells) {
      stage[i] = STAGES;
      thr[i] = ((i / cols | 0) / rows) * 0.55 + ((i % cols) / cols) * 0.3 + hash(i * 0.37) * 0.15;
      paintCell(i, STAGES);
    }
    ctx.globalAlpha = 1;

    const wasStatic = getComputedStyle(el).position === "static";
    if (wasStatic) el.style.position = "relative";
    el.appendChild(canvas);
    el.classList.add("in");                                      // the real content, hidden under the cover

    await new Promise((resolve) => {
      const dur = lib.revealMs, t0 = performance.now();
      const frame = (now) => {
        const T = Math.min(1.25, ((now - t0) / dur) * 1.25);
        let left = 0;
        for (const i of cells) {
          const s = 1 - Math.max(0, Math.min(1, (T - thr[i]) * 5));
          const st = Math.ceil(s * STAGES - 1e-6);
          if (st !== stage[i]) { stage[i] = st; paintCell(i, st); }
          if (st) left++;
        }
        ctx.globalAlpha = 1;
        if (left) requestAnimationFrame(frame); else resolve();
      };
      requestAnimationFrame(frame);
    });
    canvas.remove();
    if (wasStatic) el.style.position = "";
  }

  lib.revealAscii = revealAscii;
})();

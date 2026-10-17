/* Work cards on the home page: hover a card and its picture slowly turns into
   ASCII art. The card's images are re-composed into one picture (backgrounds,
   object-fit, layered images and opacity included) and handed to AsciiLib.morph.
   Mouse/pen only: on touch the cards just open the project. */
(() => {
  "use strict";

  if (!window.AsciiLib || !window.AsciiLib.morph) return;

  /* draw one <img> where it sits inside its card picture, honouring object-fit, padding and opacity */
  function drawImg(g, img, sx, sy) {
    const cs = getComputedStyle(img);
    const num = (v) => parseFloat(v) || 0;
    const x = img.offsetLeft + num(cs.paddingLeft), y = img.offsetTop + num(cs.paddingTop);
    const w = img.offsetWidth - num(cs.paddingLeft) - num(cs.paddingRight);
    const h = img.offsetHeight - num(cs.paddingTop) - num(cs.paddingBottom);
    const iw = img.naturalWidth, ih = img.naturalHeight;
    if (!iw || !ih || w <= 0 || h <= 0) return;
    let dx = x, dy = y, dw = w, dh = h, srcX = 0, srcY = 0, srcW = iw, srcH = ih;
    if (cs.objectFit === "cover") {
      const k = Math.max(w / iw, h / ih);
      srcW = w / k; srcH = h / k; srcX = (iw - srcW) / 2; srcY = (ih - srcH) / 2;
    } else if (cs.objectFit === "contain") {
      const k = Math.min(w / iw, h / ih);
      dw = iw * k; dh = ih * k; dx = x + (w - dw) / 2; dy = y + (h - dh) / 2;
    }
    g.globalAlpha = num(cs.opacity) || 1;
    g.drawImage(img, srcX, srcY, srcW, srcH, dx * sx, dy * sy, dw * sx, dh * sy);
    g.globalAlpha = 1;
  }

  document.querySelectorAll(".tile").forEach((tile) => {
    const host = tile.querySelector(".tile-media");
    if (!host) return;
    const imgs = [...host.querySelectorAll("img")];

    window.AsciiLib.morph({
      hover: tile,
      host,
      gamma: 1.5,                                                   // photos are bright: push the glyphs denser
      minCols: 70, maxCols: 240,
      measure: () => (imgs.every((i) => i.complete && i.naturalWidth) ? { cssW: host.clientWidth, cssH: host.clientHeight } : null),
      paint: (g, cols, rows, w, h) => {
        g.fillStyle = getComputedStyle(host).backgroundColor;       // ink or tinted behind the photo
        g.fillRect(0, 0, cols, rows);
        for (const img of imgs) drawImg(g, img, cols / w, rows / h);
      }
    });
  });
})();

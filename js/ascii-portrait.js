/* About-section headshot: hover it and the photo slowly turns into ASCII art.
   Uses AsciiLib.morph (ascii-morph.js). Touch: tap toggles. */
(() => {
  "use strict";

  const fig = document.querySelector("[data-ascii-portrait]");
  if (!fig || !window.AsciiLib || !window.AsciiLib.morph) return;
  const photo = fig.querySelector("img");

  window.AsciiLib.morph({
    hover: fig,
    host: fig,
    canvas: fig.querySelector("canvas"),
    cutout: true,                        // transparent cut-out: only the person turns into ASCII
    gamma: 1.1,                          // dark = dense reads best for a face
    touchToggle: true,
    minCols: 60, maxCols: 200,
    measure: () => (photo.complete && photo.naturalWidth ? { cssW: fig.clientWidth, cssH: photo.clientHeight } : null),
    paint: (g, cols, rows) => g.drawImage(photo, 0, 0, cols, rows)
  });
})();

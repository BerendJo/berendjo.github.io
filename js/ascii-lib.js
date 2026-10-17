/* Shared ASCII rendering helpers: the glyph ramp, image -> glyph sampling and
   a glyph atlas, so every ASCII piece on the site draws with the same look. */
window.AsciiLib = (() => {
  "use strict";

  const INK = "#120f10";
  const RAMP = " .:-=+*#%@";          // light -> dark
  const DARK = RAMP.length - 1;
  const CELL_ASPECT = 1.78;            // cell height / width

  const make = (w, h) => {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    return c;
  };

  /* fills glyph indices (0 = blank) from raw RGBA pixels already scaled to w x h cells.
     Higher gamma = darker, denser result. invert = bright pixels get the dense glyphs. */
  function glyphsFromData(px, w, h, out, gamma = 0.65, invert = false) {
    for (let i = 0, n = w * h; i < n; i++) {
      const o = i * 4;
      const a = px[o + 3] / 255;
      if (a < 0.08) { out[i] = 0; continue; }
      const lum = (0.2126 * px[o] + 0.7152 * px[o + 1] + 0.0722 * px[o + 2]) / 255;
      // gamma + stretch: black bodies reach full ink, greys stay mid
      const base = invert
        ? Math.max(0, Math.min(1, (lum - 0.03) / 0.8))
        : Math.max(0, Math.min(1, (1 - Math.pow(lum, gamma) - 0.06) / 0.84));
      const g = Math.round(base * Math.min(1, a * 1.3) * DARK);
      out[i] = g < 0 ? 0 : g > DARK ? DARK : g;
    }
    return out;
  }

  /* same, reading the pixels from a canvas context */
  const toGlyphs = (ctx, w, h, out, gamma, invert) =>
    glyphsFromData(ctx.getImageData(0, 0, w, h).data, w, h, out, gamma, invert);

  /* one strip with a pre-rendered glyph per character (default: the ramp), so drawing a cell is a drawImage */
  function buildAtlas(cw, ch, chars = RAMP) {
    const atlas = make(Math.ceil(cw) * chars.length, Math.ceil(ch));
    const g = atlas.getContext("2d");
    g.fillStyle = INK;
    g.font = `700 ${ch * 0.92}px Consolas, "SF Mono", Menlo, "Courier New", monospace`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    for (let i = 1; i < chars.length; i++) {
      g.fillText(chars[i], (i + 0.5) * Math.ceil(cw), ch * 0.54);
    }
    return atlas;
  }

  /* cols for an element this wide (css px): about 3.7px per cell */
  const colsFor = (cssW, min = 110, max = 260) => Math.max(min, Math.min(max, Math.round(cssW / 3.7)));

  /* chunky ASCII music notes (eighth, quarter, beamed pair) as glyph-index grids; 0 = blank */
  const NOTE_SPRITES = [
    [" ##@=",
     " #  *",
     " #",
     "@@#",
     "@@"],
    ["  #",
     "  #",
     "  #",
     "@@#",
     "@@"],
    [" #@@@@#",
     " #    #",
     " #    #",
     "@@#  @@#",
     "@@   @@"]
  ].map((rows) => {
    const w = Math.max(...rows.map((r) => r.length));
    return { w, h: rows.length, rows: rows.map((r) => [...r.padEnd(w)].map((ch) => RAMP.indexOf(ch))) };
  });

  return { INK, RAMP, DARK, CELL_ASPECT, NOTE_SPRITES, make, toGlyphs, glyphsFromData, buildAtlas, colsFor };
})();

(function(){
var __stubs = { fs: { existsSync: function(){ return false; }, readFileSync: function(){ return ""; } }, path: { dirname: function(){ return ""; }, join: function(){ return ""; }, basename: function(p){ return String(p); } } };
var __defs = {
"src/gen/lib/prek/trace.js": function(module, exports, require){
/*
 * trace.js — the letter-drawing primitives, and the only copy of them.
 *
 * WHY THIS IS ITS OWN FILE AND WHY IT IS UMD. These four functions draw a
 * traceable word: the glyph paths, the start dot, the dashes, and the width
 * arithmetic that lets a word be centered without measuring text. They were
 * inside paper.js, which is a Node module full of page furniture, and the shop's
 * name generator needs them in a BROWSER.
 *
 * The lazy way is to write them again in the page's script. That is two copies of
 * the same geometry, and they drift — somebody widens the start dot here, the
 * generator keeps the old one, and the sheet a parent prints from the website
 * stops matching the sheet in the pack they bought. So there is one file, it
 * runs in both places, and paper.js requires it rather than owning it.
 *
 * The glyph table is passed IN rather than required, because in the browser it
 * arrives as inlined JSON and here it comes from ./glyphs. Same numbers either
 * way; the delivery differs.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./glyphs').GLYPHS);
  } else {
    root.Trace = factory(root.GLYPHS);
  }
})(typeof self !== 'undefined' ? self : this, function (GLYPHS) {
  const r = (n) => Math.round(n * 100) / 100;

  /* Pen weights, in px at the reference row height. */
  const REF_ROW_H = 0.65 * 96;
  const SW_MODEL = 3.0;
  const SW_TRACE = 2.4;
  const DASH = [5.5, 4.5];
  const DOT_R = 2.6;
  const START_R = 3.4;
  /*
   * THE LETTER TO COPY IS THE SUBJECT'S COLOR, and this file cannot ask which
   * subject it is: it runs in the browser too, for the name generator, where
   * there is no pack and no palette module to require. So the color is settable
   * — setAccent() — and paper.js sets it from the pack it is generating for. The
   * default is the house orange, which is what the name generator wants and what
   * a page with no subject should get.
   *
   * It mattered: every pre-K literacy sheet is an ENGLISH sheet, and every one of
   * them was printing its letters in math orange.
   */
  let ACCENT = '#C0511D';
  const setAccent = (hex) => { if (hex) ACCENT = hex; };
  /* Warm, and the same lightness the neutral gray had — a guide still has to
     lose to a pencil, which color does not change. */
  const INK_TRACE = '#B09A88';

  const LETTER_GAP = 0.16;
  const SPACE_W = 0.4;

  /* The three ruling lines, exported so anything drawing a writing line uses
   * the same greys the packs do rather than picking its own. */
  const RULES = { top: '#CFC3B2', mid: '#BCAE9C', base: '#16130F' };

  /* A letter drawn small should not have a proportionally fat pen — below the
   * reference height the stroke thins, but only so far. */
  const weightFactor = (s) => Math.max(0.65, Math.min(1, s / REF_ROW_H));

  function drawPaths(g, x, y, s, { trace = false, showStart = false } = {}) {
    const f = weightFactor(s);
    const sw = ((trace ? SW_TRACE : SW_MODEL) * f) / s;
    const ink = trace ? INK_TRACE : ACCENT;
    const dash = trace ? ` stroke-dasharray="${r((DASH[0] * f) / s)} ${r((DASH[1] * f) / s)}"` : '';

    const parts = g.d.map(
      (d) =>
        `<path d="${d}" fill="none" stroke="${ink}" stroke-width="${r(sw)}"` +
        ` stroke-linecap="round" stroke-linejoin="round"${dash}/>`
    );

    for (const [dx, dy] of g.dots || [])
      parts.push(`<circle cx="${dx}" cy="${dy}" r="${r((DOT_R * f) / s)}" fill="${ink}"/>`);

    /* Every letter gets its own start dot — each one has its own starting point,
     * and that is the thing being taught. */
    if (showStart && g.d.length) {
      const m = g.d[0].match(/^M\s*(-?[\d.]+)[\s,]+(-?[\d.]+)/);
      if (m)
        parts.push(
          `<circle cx="${parseFloat(m[1])}" cy="${parseFloat(m[2])}" r="${r(
            (START_R * f) / s
          )}" fill="${ACCENT}"/>`
        );
    }

    return `<g transform="translate(${r(x)} ${r(y)}) scale(${r(s)})">${parts.join('')}</g>`;
  }

  /* Width of a word in units, so it can be centered without measuring text. */
  function wordWidth(text, gap = LETTER_GAP) {
    let w = 0;
    [...text].forEach((ch, i) => {
      if (i) w += gap;
      w += ch === ' ' ? SPACE_W : (GLYPHS[ch] || { w: SPACE_W }).w;
    });
    return w;
  }

  function drawWord(text, x, y, s, opts = {}) {
    const gap = opts.gap === undefined ? LETTER_GAP : opts.gap;
    let cx = x;
    const out = [];
    [...text].forEach((ch, i) => {
      if (i) cx += gap * s;
      if (ch === ' ') {
        cx += SPACE_W * s;
        return;
      }
      const g = GLYPHS[ch];
      if (!g) throw new Error(`No glyph for "${ch}" in "${text}"`);
      out.push(drawPaths(g, cx, y, s, opts));
      cx += g.w * s;
    });
    return out.join('');
  }

  /* Which characters this can draw at all — the generator needs to say so
   * rather than throwing from inside a path builder. */
  const canDraw = (text) => [...text].every((ch) => ch === ' ' || Boolean(GLYPHS[ch]));

  return { drawPaths, drawWord, wordWidth, canDraw, setAccent, LETTER_GAP, SPACE_W, RULES, GLYPHS };
});

},
"src/gen/lib/prek/glyphs.js": function(module, exports, require){
/*
 * Monoline manuscript alphabet — single-stroke skeleton letterforms.
 *
 * WHY THIS EXISTS
 * A font glyph is a filled shape. Stroking one gives you an OUTLINE — two edges
 * with a gap between them — which reads to a child as "color this in." Tracing
 * needs the opposite: one line running down the CENTER of the letter, following
 * the path the pencil actually travels. No installed font can provide that, so
 * the letterforms are drawn here as paths.
 *
 * COORDINATE SYSTEM (1 unit = the height from top line to baseline)
 *
 *   y = 0     top line          <- capitals and tall letters start here
 *   y = 0.5   dashed midline    <- lowercase bodies start here
 *   y = 1.0   baseline          <- everything sits here
 *   y = 1.3   descender depth   <- g j p q y
 *
 *   x starts at 0; each glyph declares its own advance width `w`.
 *
 * Shapes are ball-and-stick manuscript print (straight lines + round bowls),
 * which is what's taught for early printing. The lowercase a and g are
 * deliberately single-story.
 *
 * PER GLYPH
 *   w     advance width in units
 *   d     array of SVG path strings — ONE ENTRY PER PEN STROKE, in the order a
 *         child should write them (so start dots and any future stroke-order
 *         numbering land in the right place)
 *   dots  optional filled dots, for the tittles on i and j
 */

/*
 * ROUND SHAPES USE ARCS, NOT CUBICS.
 *
 * A cubic Bezier never reaches its control points — it gets roughly three
 * quarters of the way — so hand-placed controls drew every bowl noticeably
 * narrower than declared, and joins missed by a visible gap. An arc takes
 * explicit radii, so `cx + rx` really is the rightmost point.
 *
 * Handy property used throughout: when an arc's two endpoints share an x (a
 * vertical chord), ry is fixed at half the chord length and rx IS the bulge.
 * So `M0 0 A.6 .5 0 0 1 0 1` bulges exactly .6 to the right. Same for a
 * horizontal chord with rx and ry swapped.
 *
 * Arc flags: sweep 0 = counter-clockwise on screen (y grows downward),
 * sweep 1 = clockwise. large-arc 1 takes the long way round.
 */
const UPPER = {
  A: { w: 0.64, d: ['M0 1 L.32 0 L.64 1', 'M.14 .64 H.5'] },
  B: { w: 0.56, d: ['M0 0 V1', 'M0 0 A.42 .25 0 0 1 0 .5', 'M0 .5 A.48 .25 0 0 1 0 1'] },
  C: { w: 0.62, d: ['M.54 .16 A.28 .48 0 1 0 .54 .84'] },
  D: { w: 0.62, d: ['M0 0 V1', 'M0 0 A.6 .5 0 0 1 0 1'] },
  E: { w: 0.56, d: ['M0 0 V1', 'M0 0 H.54', 'M0 .5 H.42', 'M0 1 H.54'] },
  F: { w: 0.54, d: ['M0 0 V1', 'M0 0 H.52', 'M0 .5 H.4'] },
  G: { w: 0.66, d: ['M.54 .16 A.28 .48 0 1 0 .54 .84', 'M.54 .84 V.52 H.34'] },
  H: { w: 0.6, d: ['M0 0 V1', 'M.6 0 V1', 'M0 .5 H.6'] },
  I: { w: 0.5, d: ['M.25 0 V1', 'M.08 0 H.42', 'M.08 1 H.42'] },
  /* Hook travels right-to-left UNDER the baseline, which from the right-hand
   * point is clockwise — sweep 1. Sweep 0 arcs over the top instead. */
  J: { w: 0.5, d: ['M.4 0 V.76 A.18 .22 0 0 1 .04 .76'] },
  K: { w: 0.58, d: ['M0 0 V1', 'M.54 0 L.06 .55', 'M.22 .4 L.58 1'] },
  L: { w: 0.52, d: ['M0 0 V1 H.5'] },
  M: { w: 0.68, d: ['M0 1 V0 L.34 .62 L.68 0 V1'] },
  N: { w: 0.62, d: ['M0 1 V0 L.62 1 V0'] },
  O: { w: 0.68, d: ['M.34 0 A.32 .5 0 0 0 .34 1 A.32 .5 0 0 0 .34 0'] },
  P: { w: 0.56, d: ['M0 0 V1', 'M0 0 A.46 .27 0 0 1 0 .54'] },
  Q: { w: 0.68, d: ['M.34 0 A.32 .5 0 0 0 .34 1 A.32 .5 0 0 0 .34 0', 'M.44 .74 L.68 1.06'] },
  R: { w: 0.58, d: ['M0 0 V1', 'M0 0 A.46 .27 0 0 1 0 .54', 'M.3 .54 L.58 1'] },
  S: { w: 0.56, d: ['M.52 .18 C.46 .02 .06 0 .06 .28 C.06 .52 .5 .48 .5 .74 C.5 1.02 .1 1 .04 .84'] },
  T: { w: 0.58, d: ['M.29 0 V1', 'M0 0 H.58'] },
  U: { w: 0.6, d: ['M0 0 V.68 A.3 .3 0 0 0 .6 .68 V0'] },
  V: { w: 0.6, d: ['M0 0 L.3 1 L.6 0'] },
  W: { w: 0.76, d: ['M0 0 L.17 1 L.38 .3 L.59 1 L.76 0'] },
  X: { w: 0.58, d: ['M0 0 L.58 1', 'M.58 0 L0 1'] },
  Y: { w: 0.58, d: ['M0 0 L.29 .52 L.58 0', 'M.29 .52 V1'] },
  Z: { w: 0.56, d: ['M0 0 H.56 L0 1 H.56'] },
};

/*
 * Lowercase bowls are one shared ellipse: center (.25,.75), rx .21, ry .25 —
 * so every bowl spans x .04-.46 and y .5-1 exactly, touching the midline and
 * the baseline. Stems at x .04 (b p) or .46 (a d g q u) meet it precisely.
 * Shoulders on h m n r are top-half arcs of the same family.
 */
const LOWER = {
  a: { w: 0.5, d: ['M.25 .5 A.21 .25 0 0 0 .25 1 A.21 .25 0 0 0 .25 .5', 'M.46 .5 V1'] },
  b: { w: 0.5, d: ['M.04 0 V1', 'M.25 .5 A.21 .25 0 0 0 .25 1 A.21 .25 0 0 0 .25 .5'] },
  c: { w: 0.48, d: ['M.39 .57 A.21 .25 0 1 0 .39 .93'] },
  d: { w: 0.5, d: ['M.25 .5 A.21 .25 0 0 0 .25 1 A.21 .25 0 0 0 .25 .5', 'M.46 0 V1'] },
  /* Bar first, then counter-clockwise (sweep 0) up over the top, round the
   * left and down to ~5 o'clock. Sweep 1 here travels the wrong way and
   * collapses into a hook. */
  e: { w: 0.48, d: ['M.04 .75 H.45 A.21 .25 0 1 0 .38 .93'] },
  f: { w: 0.4, d: ['M.36 .14 A.12 .12 0 0 0 .12 .14 V1', 'M0 .5 H.34'] },
  g: {
    w: 0.5,
    d: [
      'M.25 .5 A.21 .25 0 0 0 .25 1 A.21 .25 0 0 0 .25 .5',
      'M.46 .5 V1.1 C.46 1.32 .12 1.32 .06 1.2',
    ],
  },
  h: { w: 0.5, d: ['M.04 0 V1', 'M.04 .72 A.21 .22 0 0 1 .46 .72 V1'] },
  i: { w: 0.26, d: ['M.13 .5 V1'], dots: [[0.13, 0.34]] },
  j: { w: 0.3, d: ['M.18 .5 V1.08 A.09 .11 0 0 1 0 1.08'], dots: [[0.18, 0.34]] },
  k: { w: 0.48, d: ['M.04 0 V1', 'M.42 .5 L.08 .78', 'M.2 .68 L.46 1'] },
  l: { w: 0.24, d: ['M.12 0 V1'] },
  m: {
    w: 0.74,
    d: [
      'M.04 .5 V1',
      'M.04 .72 A.16 .22 0 0 1 .36 .72 V1',
      'M.36 .72 A.16 .22 0 0 1 .68 .72 V1',
    ],
  },
  n: { w: 0.5, d: ['M.04 .5 V1', 'M.04 .72 A.21 .22 0 0 1 .46 .72 V1'] },
  o: { w: 0.5, d: ['M.25 .5 A.22 .25 0 0 0 .25 1 A.22 .25 0 0 0 .25 .5'] },
  p: { w: 0.5, d: ['M.04 .5 V1.3', 'M.25 .5 A.21 .25 0 0 0 .25 1 A.21 .25 0 0 0 .25 .5'] },
  q: { w: 0.5, d: ['M.25 .5 A.21 .25 0 0 0 .25 1 A.21 .25 0 0 0 .25 .5', 'M.46 .5 V1.3'] },
  r: { w: 0.38, d: ['M.04 .5 V1', 'M.04 .72 A.17 .22 0 0 1 .33 .56'] },
  s: { w: 0.42, d: ['M.38 .6 C.32 .48 .04 .48 .04 .66 C.04 .82 .36 .78 .36 .92 C.36 1.06 .08 1.04 .02 .94'] },
  t: { w: 0.38, d: ['M.14 .25 V.88 C.14 1.02 .3 1.02 .36 .96', 'M.02 .5 H.32'] },
  u: { w: 0.5, d: ['M.04 .5 V.75 A.21 .25 0 0 0 .46 .75', 'M.46 .5 V1'] },
  v: { w: 0.46, d: ['M.02 .5 L.24 1 L.46 .5'] },
  w: { w: 0.66, d: ['M.02 .5 L.16 1 L.33 .62 L.5 1 L.64 .5'] },
  x: { w: 0.44, d: ['M.02 .5 L.42 1', 'M.42 .5 L.02 1'] },
  y: { w: 0.48, d: ['M.02 .5 L.25 1', 'M.46 .5 L.14 1.3'] },
  z: { w: 0.44, d: ['M.02 .5 H.42 L.02 1 H.42'] },
};

/*
 * Digits span the full height, y 0 -> 1, like capitals.
 *
 * Strokes are ordered the way a child writes them, and each digit's FIRST
 * stroke begins where the pencil goes down — that's where the start dot lands,
 * so a numeral that starts at the bottom would teach the wrong habit.
 * 4, 8 and 9 are deliberately two strokes; drawn as one they pinch into an
 * hourglass or read as a letter.
 */
const DIGITS = {
  /*
   * Round shapes use ARC commands (A rx ry rot large sweep x y), not cubics.
   * A cubic never reaches its control points — it tops out at about 3/4 of the
   * way there — so hand-placed controls silently drew shapes ~25% narrower
   * than declared, and 9's tail ended up floating beside its bowl instead of
   * touching it. An arc's radii are exact, so the extremes are where you say.
   */
  0: { w: 0.55, d: ['M.275 .03 A.225 .47 0 0 0 .275 .97 A.225 .47 0 0 0 .275 .03'] },
  1: { w: 0.36, d: ['M.05 .26 L.25 .04 V.97'] },
  2: { w: 0.55, d: ['M.06 .26 C.08 .04 .52 .02 .52 .32 C.52 .6 .1 .74 .06 .97 H.54'] },
  3: { w: 0.55, d: ['M.07 .18 C.14 0 .5 .02 .5 .26 C.5 .45 .3 .5 .22 .5 C.32 .5 .54 .55 .54 .76 C.54 1 .14 1.03 .06 .86'] },
  4: { w: 0.58, d: ['M.38 .03 L.04 .68 H.56', 'M.38 .03 V.97'] },
  5: { w: 0.55, d: ['M.5 .05 H.16 L.11 .44 C.22 .34 .54 .4 .54 .7 C.54 .97 .16 1.04 .06 .89'] },
  /* Loop is an arc centered at (.29,.735) with ry .235, so its bottom is exactly
   * .97 — sitting ON the baseline. As cubics it stopped short at ~.87 and the
   * whole loop appeared to hover above the line. */
  6: {
    w: 0.55,
    d: [
      'M.45 .06 C.22 .14 .07 .38 .07 .735',
      'M.07 .735 A.22 .235 0 0 0 .51 .735 A.22 .235 0 0 0 .07 .735',
    ],
  },
  7: { w: 0.52, d: ['M.04 .05 H.5 L.22 .97'] },
  /* Bottom loop is deliberately wider than the top one, as in a written 8. */
  8: {
    w: 0.55,
    d: [
      'M.275 .04 A.195 .23 0 0 0 .275 .5 A.195 .23 0 0 0 .275 .04',
      'M.275 .5 A.225 .235 0 0 0 .275 .97 A.225 .235 0 0 0 .275 .5',
    ],
  },
  /* The bowl owns the top ~55%, and the tail starts at cx+rx (.3+.24 = .54),
   * exactly the bowl's rightmost point, so the two actually join. */
  9: {
    w: 0.58,
    d: ['M.3 .04 A.24 .27 0 0 0 .3 .58 A.24 .27 0 0 0 .3 .04', 'M.54 .31 V.97'],
  },
};

/* Punctuation, so sentences can actually end. A full stop has no strokes at
 * all — just a dot — so anything reading d[0] must tolerate an empty d. */
const PUNCT = {
  '.': { w: 0.2, d: [], dots: [[0.1, 0.94]] },
  '!': { w: 0.2, d: ['M.1 .04 V.74'], dots: [[0.1, 0.94]] },
  '?': { w: 0.42, d: ['M.05 .22 A.16 .18 0 1 1 .21 .46 V.62'], dots: [[0.21, 0.94]] },
  ',': { w: 0.2, d: ['M.12 .9 C.12 1.02 .07 1.08 .03 1.1'] },
  "'": { w: 0.16, d: ['M.08 .48 V.66'] },
  '-': { w: 0.3, d: ['M.03 .75 H.27'] },
};

const GLYPHS = { ...UPPER, ...LOWER, ...DIGITS, ...PUNCT };

/* Start point of a glyph = the first M coordinate of its first stroke. Used to
 * print the green "start here" dot. */
function startPoint(ch) {
  const g = GLYPHS[ch];
  if (!g || !g.d.length) return null; // a full stop has no strokes
  const m = g.d[0].match(/^M\s*(-?[\d.]+)[\s,]+(-?[\d.]+)/);
  return m ? [parseFloat(m[1]), parseFloat(m[2])] : null;
}

module.exports = { GLYPHS, UPPER, LOWER, DIGITS, PUNCT, startPoint };

},
"src/gen/sheet.ts": function(module, exports, require){
"use strict";
/*
 * sheet.ts — the house chrome a generated sheet is wrapped in.
 *
 * A sheet made in the app has to come out of the printer looking like a sheet
 * off the shelf, or the shelf's whole claim — that these are one product made
 * by one person to one standard — falls over in the most visible way possible,
 * on paper, in a parent's hand.
 *
 * So the CSS here is the shelf's own: the same `:root` values, the same
 * `@page { size: letter portrait; margin: 0.4in 0.45in }`, the same header with
 * a display character and a 3px slate rule under it, the same muted footer with
 * the wordmark in accent. Lifted from the `<style>` block at the top of any
 * sheet — see math-06-grade1/10-tens-and-ones.html.
 *
 * NOTE THE FONT. Printed sheets ask for Quicksand and fall back through URW
 * Gothic and Century Gothic. A phone will have none of them and will land on
 * its own rounded sans, which is close enough and is what the fallback chain is
 * for. The alternative — embedding a webfont as base64 in every generated
 * sheet — would add roughly 40KB to each print for a difference only a
 * designer would see.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.esc = void 0;
exports.sheet = sheet;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
exports.esc = esc;
function sheet(c) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="sheet-kind" content="worksheet">
<title>${esc(c.title)}</title>
<style>
  @page { size: letter ${c.land ? 'landscape' : 'portrait'}; margin: 0.4in 0.45in; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  :root {
    --ink: #16130F; --muted: #6B635A; --rule: #CFC3B2; --guide: #BCAE9C;
    --accent: #C0511D; --tint: #F7EDE4; --slate: #2E5A78;
  }
  body {
    font-family: Quicksand, 'URW Gothic', 'Century Gothic', sans-serif;
    color: #000; background: #fff;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .page { width: 100%; }
  .page + .page { page-break-before: always; }
  /* A screen ignores @page margins, so the preview drew every made sheet edge
     to edge while the paper has 0.4in / 0.45in of white round it. The shelf's
     sheets carry the same screen padding; print is untouched. */
  @media screen { .page { padding: 0.4in 0.45in; } }
  header {
    display: flex; align-items: center; gap: 16px;
    border-bottom: 3px solid var(--slate); padding-bottom: 7px; margin-bottom: 2px;
  }
  .bigletter { font-size: 38pt; font-weight: 700; line-height: 1; letter-spacing: .02em; }
  .htext { flex: 1; }
  h1 { font-size: 14pt; font-weight: 700; margin: 0 0 2px; }
  .sub { font-size: 10pt; color: var(--muted); margin: 0; }
  .nameline {
    font-size: 9.5pt; color: var(--muted);
    border-bottom: 1px solid var(--ink); width: 2in;
    padding-bottom: 1px; align-self: flex-end;
  }
  .dir { font-size: 11pt; margin: 12px 0 10px; }
  footer {
    margin-top: 10px; padding-top: 6px; border-top: 1px solid var(--rule);
    font-size: 8.5pt; color: var(--muted);
    display: flex; justify-content: space-between; align-items: center;
  }
  .brand { font-size: 7pt; letter-spacing: .04em; color: var(--accent); }
  table { border-collapse: collapse; }
  /* The parent-copy badge, lifted from the shelf's key pages so the two match
     on paper. Tinted rather than outlined, because it has to be recognisable
     at a glance from across a table with the page upside down. */
  .badgeline {
    display: inline-block; font-size: 8.5pt; font-weight: 700;
    letter-spacing: .06em; text-transform: uppercase;
    color: var(--accent); background: var(--tint);
    border: 1.5px solid var(--accent); padding: 2px 8px; margin-bottom: 8px;
  }
</style>
</head>
<body>
<div class="page">
  <header>
    ${c.big ? `<div class="bigletter">${esc(c.big)}</div>` : ''}
    <div class="htext">
      <h1>${esc(c.title)}</h1>
      ${c.sub ? `<p class="sub">${esc(c.sub)}</p>` : ''}
    </div>
    <div class="nameline">Name</div>
  </header>
  ${c.dir ? `<p class="dir">${esc(c.dir)}</p>` : ''}
  ${c.body}
  <footer>
    <span>${esc(c.footL ?? '')}</span>
    <span class="brand">KITCHEN TABLE</span>
    <span>${esc(c.footR ?? '')}</span>
  </footer>
</div>
${(c.also ?? []).map(extra).join('\n')}
</body>
</html>`;
}
/* A following page. Same furniture as the first, minus the name line — a parent
 * copy is not written on, and a second page a child writes on is still the same
 * child whose name is already at the top of page one. */
function extra(e) {
    return `<div class="page">
  <header>
    ${e.big ? `<div class="bigletter">${esc(e.big)}</div>` : ''}
    <div class="htext">
      <h1>${esc(e.title)}</h1>
      ${e.sub ? `<p class="sub">${esc(e.sub)}</p>` : ''}
    </div>
  </header>
  ${e.badge ? `<div class="badgeline">${esc(e.badge)}</div>` : ''}
  ${e.dir ? `<p class="dir">${esc(e.dir)}</p>` : ''}
  ${e.body}
  <footer>
    <span>${esc(e.footL ?? '')}</span>
    <span class="brand">KITCHEN TABLE</span>
    <span></span>
  </footer>
</div>`;
}

},
"src/gen/packs/lib/prek/cursivetype.js": function(module, exports, require){
/*
 * cursivetype.js — cursive rows set in the real font.
 *
 * WHAT THIS REPLACES. Every cursive sheet used to draw its letters from
 * lib/prek/cursive.js: fifty-two letterforms typed out as Bezier paths by hand,
 * from memory. They were bad, and no amount of care in the layout around them
 * made up for it. The letters are now type — see cursivefont.js for which font
 * and, more usefully, for which two fonts were tried and rejected first.
 *
 * WHERE THE RULES GO, which is the whole job of this file. A handwriting sheet
 * has a top line, a dashed middle line and a baseline, and a letter is right or
 * wrong depending on which of them it touches. So the rules are placed from the
 * font's own measurements rather than from an assumption:
 *
 *   x-height    0.344 em   the dashed line — a, c, e, m, n, o, u stop here
 *   ascender    0.703 em   the top line — b, f, h, k, l, t and the capitals
 *   descender   0.391 em   below the baseline — f, g, j, p, q, y
 *
 * That is a ratio of 2.04 x-heights to the ascender, which is the ruling school
 * handwriting paper has always used, so a cursive row lines up with a printed
 * row from the rest of the shelf and with paper.js's own blankRow(). The font
 * before this one was 1.86 and did not, which is worth knowing if it is ever
 * swapped again: the rules follow the font, not the other way round.
 *
 * ROWS SIZE THEMSELVES. A row is an inline-block containing a line of text, so
 * the browser measures it. Nothing here computes a width for layout — the two
 * places that genuinely need a number in node (where to put a join mark, and
 * how far a sentence has to shrink) get it from cursivemetrics.js.
 *
 * A ROW IS ONLY AS TALL AS WHAT IS ON IT. The depth reserved under the baseline
 * is measured from the actual characters, not assumed. Reserving the full
 * descender under every row adds a sixth of a row height to each one, and a
 * sheet of twelve rows quietly grows past the bottom of the paper and prints as
 * two sides with nothing anywhere reporting a problem. fits.js found exactly
 * that, twice.
 *
 * ROWS ALIGN ON THE WRITING LINE, NOT ON THE BOTTOM OF THE BOX, and the two are
 * not the same thing once the paragraph above is true. A row is only as tall as
 * what is on it, so a cell holding `a` is short and a cell holding `j` is a
 * quarter of an inch taller. Sit those two side by side and align their bottom
 * edges — which is what a flex row does by default, and what every row on these
 * sheets used to ask for — and the j's baseline rule ends up a quarter inch
 * ABOVE the a's. The letters look like they are hovering, and a child reading
 * the page sees twenty-six letters that do not agree about where the line is.
 *
 * So every row carries an invisible strut, `.cbase`, exactly as tall as the
 * distance from the top of the box to the baseline. That gives the box a real
 * text baseline sitting on the writing line, so `align-items: baseline` in the
 * container — and plain inline layout, which aligns on the baseline anyway —
 * puts the rules of every row on the same line, whatever is written on them and
 * whatever height the rows are ruled at. Aligning tops would work too, but only
 * for as long as every row in a container happens to share a rowH, and that is
 * an assumption nothing checks.
 *
 * THE TRACE IS DOTTED, not hollow. An outlined letter — transparent fill, thin
 * stroke — is what a font makes easy, and on a monoline script it draws TWO
 * lines that a child then writes between, rather than one line to go over. So
 * the letter is drawn solid and gray and then masked with a dot grid, which
 * breaks it into the dotted stroke a tracing sheet actually wants.
 *
 * THE JOIN MARKS. Sheet 20's whole design is that the connector between two
 * letters is printed heavy and black while the letters stay gray, because it is
 * invisible when everything is one color and it is the thing being taught. A
 * font cannot hand you the connector as a separate object — it is part of the
 * letters either side. So the word is drawn twice: gray underneath, black on
 * top, and the black copy is masked down to a soft ellipse sitting on the
 * boundary between the two letters. What shows through is the connector.
 *
 * WHAT WAS LOST WITH THE OLD ENGINE, and it is worth being straight about. It
 * knew each letter's start point and drew a dot there, and it knew whether a
 * letter's pen finished high or low. Type has no opinion about either. The
 * exits still matter and are still taught — that data is in cursive.js and is
 * still where sheets 21 and 22 get it — but the start dots are gone.
 */

const { FONTS } = require('./cursivefont');
const { PX, CONTENT_W, SIDE_PAD, r } = require('./paper');

/*
 * ONE ENGINE, TWO FACES — see cursivefont.js for why the shelf carries both.
 *
 * Everything below depends on the font: the advance widths and kerning come
 * from its measured metrics, the ruling is placed from its own ascender and
 * x-height, and the pen weight is scaled to it. So the whole module is built
 * PER FACE rather than reading one global set of numbers, and asking for a face
 * hands back the same API bound to that font's measurements.
 *
 * `league` is the default and is what every existing sheet is set in. The
 * module's own exports are that face, unchanged, so a generator that never
 * heard of any of this keeps working exactly as before.
 */
function build(fontKey) {
  const face = FONTS[fontKey];
  if (!face) throw new Error(`cursivetype: no font "${fontKey}" — have ${Object.keys(FONTS).join(', ')}`);
  const FONT = face.base64;
  const FAMILY = face.family;
  /*
   * NAMED, NOT INTERPOLATED. This was require(`./cursivemetrics-${fontKey}`),
   * which node resolves happily and a bundler cannot resolve at all — Metro
   * rejects the file outright, and with it every pack that draws cursive.
   *
   * There are two faces and there have only ever been two, so listing them
   * costs nothing and the error below is better than a module-not-found: it
   * names the font and says which ones exist. League keeps the original
   * filename; see measure-cursive.js.
   */
  const METRICS = {
    league: require('./cursivemetrics'),
    playwrite: require('./cursivemetrics-playwrite'),
  };
  const metrics = METRICS[fontKey];
  if (!metrics) throw new Error(`cursivetype: no metrics for "${fontKey}" — have ${Object.keys(METRICS).join(', ')}`);
  const { width, INK, SIDE, BOX } = metrics;

  /*
   * HOW FAR THIS FACE OVERHANGS ITS OWN ADVANCE WIDTH, measured, per face.
   *
   * Two things need it, and both used to carry a number hand-measured off
   * League Script and applied to whatever face was loaded — which is exactly
   * the bug this file keeps finding in other guises. League reaches 0.438em
   * left of the origin on `j` and 0.494em past the advance on `N`; Playwrite,
   * drawn for schoolchildren rather than for looks, reaches 0.313 and 0.247.
   * Using League's figures for Playwrite is not unsafe, but it throws away a
   * fifth of an inch of writing line for nothing, and the reverse WOULD be
   * unsafe. The cushion is for the pen, which the canvas measurement of the
   * outline does not include.
   */
  const SWING_L = Math.max(...Object.values(SIDE).map((v) => v[0])) / 1000;
  const SWING_R = Math.max(...Object.values(SIDE).map((v) => v[1])) / 1000;
  const PEN_CUSHION = 0.03;

  /* Per em, measured — see measure-cursive.js. */
  const ASC = Math.max(...[...'bdfhklt'].map((c) => INK[c][0])) / 1000;
  const XH = INK.x[0] / 1000;
  const DESC = Math.max(...[...'fgjpqy'].map((c) => INK[c][1])) / 1000;

  /* The font's own line box. With line-height set to its sum the half-leading is
   * zero, so the baseline sits exactly ASC_BOX below the top of the box — which is
   * how a line of type gets put on a rule. */
  const ASC_BOX = BOX[0] / 1000;
  const LINE_BOX = (BOX[0] + BOX[1]) / 1000;

  const TOP_PAD = 5; /* so the top rule's stroke is not clipped */
  const PAD = 12; /* breathing room at the left of a standalone row */

  const INK_COLOR = '#4a4a4a';
  const TRACE = '#a2a2a2';
  const JOIN_INK = '#111';
  /* On a join sheet the letters go lighter so the black connector reads as a mark
   * of its own rather than a slightly darker part of the same word. The letters
   * are not the lesson on those sheets; the bit between them is. */
  const INK_UNDER_JOIN = '#9a9a9a';

  /*
   * THE PEN IS THICKENED. League Script is drawn thin — a hairline at the size a
   * worksheet prints, which photocopies to nothing and reads as a wisp rather
   * than a pencil line. A text-stroke in the fill color is the only way to add
   * weight to a single-weight font, and 1.8px at the reference row is a pencil.
   * The dotted trace is thickened harder still, because a dot punched out of a
   * hairline is a fleck and a dot punched out of a pencil line is a dot — and
   * because the stroke has to stay WIDER than the dot grid that masks it. See
   * traceStyle().
   */
  const REF_ROW = 0.65 * PX;
  const penScale = (rowH) => Math.max(0.6, rowH / REF_ROW);
  const weight = (rowH, px, color) => `-webkit-text-stroke:${r(px * penScale(rowH))}px ${color};`;

  /* How far below the baseline the deepest character on this line reaches. A
   * blank row passes null: nothing is on it yet, but a child is about to write on
   * it and needs the room. */
  function descentPx(text, rowH) {
    const fs = rowH / ASC;
    if (text === null) return fs * DESC;
    let d = 0;
    for (const ch of text) {
      const m = INK[ch];
      if (m) d = Math.max(d, (m[1] / 1000) * fs);
    }
    return Math.max(d, 0.03 * rowH);
  }

  /*
   * Everything a row of a given height needs, in px. `rowH` is the top line to
   * the baseline, the same thing it means everywhere else on the shelf.
   */
  function geom(rowH, text = '') {
    if (!Number.isFinite(rowH) || rowH <= 0) throw new Error(`cursivetype: rowH is ${rowH}`);
    const fs = rowH / ASC;
    const base = TOP_PAD + rowH;
    return {
      fs,
      base,
      top: TOP_PAD,
      mid: base - fs * XH,
      line: fs * LINE_BOX,
      /* where the text box's top edge goes so its baseline lands on the rule */
      inkTop: base - fs * ASC_BOX,
      height: base + descentPx(text, rowH) + 6,
    };
  }

  /* Width of `text` in px at a given row height. */
  const textW = (text, rowH) => (width(text) * rowH) / ASC;

  /* Largest row height at which `text` still fits across `usable` px. */
  function fitRowH(text, { max = 0.5 * PX, min = 0.2 * PX, usable = CONTENT_W - SIDE_PAD * 2, pad = 1.06 } = {}) {
    return Math.max(min, Math.min(max, (usable / (width(text) * pad)) * ASC));
  }

  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  /*
   * A MASKED LAYER HAS TO BE BIGGER THAN ITS TEXT, and this is the padding that
   * makes it so.
   *
   * A mask paints across the element's box and nowhere else, so any ink outside
   * that box is not masked — it is ERASED. And a line of cursive always has ink
   * outside its box: the advance width stops where the next letter starts, while
   * the exit stroke of the last letter carries on past it, and the text-stroke
   * that thickens the pen adds half its width all the way round on top of that.
   * Measured on `ccc` at the reference row, the mask was cutting 3.3px off the
   * left of the first letter and 2.2px off the tail of the last one.
   *
   * It only shows on the copies to trace, because they are the only layers with a
   * mask on them, and it got worse the moment the pen was thickened. So the
   * masked layers are padded and pulled back by the same amount: same ink in the
   * same place, in a box big enough that the mask covers all of it.
   *
   * THE NUMBER IS MEASURED, and it has to be, because a script face overhangs by
   * far more than looks plausible. Every glyph in the font was rendered against a
   * marker at its own origin and the ink compared with the advance width the
   * layout uses. The worst are nothing like the average:
   *
   *   right   N 0.505 em, J 0.482, F 0.365   the exit sweep of a capital
   *   left    j 0.456 em, M 0.383, J 0.377   the descender loop, which swings
   *                                          back under the letter before it
   *
   * 0.55 em covers the worst of those with room for the text-stroke on top. It is
   * generous on purpose: the box paints nothing, so padding it costs nothing but
   * a number, while getting it wrong costs a clipped letter that no check on the
   * shelf would catch.
   */
  const maskPad = (g) => Math.ceil((Math.max(SWING_L, SWING_R) + PEN_CUSHION) * g.fs);

  /*
   * One layer of text: the gray model, the dotted trace, or a masked join mark.
   * They are stacked on each other, so all of them are positioned from the same
   * origin and none of them is in the flow.
   *
   * `pad` is for the masked ones — see above. It moves the box, never the text.
   */
  function layer(text, g, x, style, pad = 0) {
    return (
      `<div class="cink" style="left:${r(x - pad)}px;top:${r(g.inkTop - pad)}px;` +
      (pad ? `padding:${r(pad)}px;` : '') +
      /* The family goes on the element, not just in the class, so that a sheet
       * carrying both faces does not hand every row to whichever @font-face
       * block was included last. */
      `font-family:'${FAMILY}',cursive;` +
      `font-size:${r(g.fs)}px;line-height:${r(g.line)}px;${style}">${esc(text)}</div>`
    );
  }

  /*
   * A FACE THAT IS ALREADY A PENCIL LINE IS NOT THICKENED.
   *
   * The text-stroke exists because League Script draws a 0.020em hairline that
   * photocopies to nothing. Playwrite draws 0.0875em at weight 400 — four times
   * that, before anything is added. Adding League's stroke to it produces a
   * marker pen, and on the dotted trace it produces a blob, because the dot
   * grid then cuts a stroke twice the width it was calibrated against.
   */
  const modelStyle = (rowH, dim) => {
    const c = dim ? INK_UNDER_JOIN : INK_COLOR;
    return face.variable ? `color:${c};font-weight:400;` : `color:${c};` + weight(rowH, 1.8, c);
  };

  /*
   * The dotted trace.
   *
   * A dot grid punched through a solid gray letter. The pitch is a fraction of
   * the row so the dots stay the same size relative to the letter at every ruling
   * — a fixed pitch turns the small rows into a smear and leaves the big ones
   * looking like a dotted border. The stroke is thickened first, so what survives
   * the mask is a row of round dots rather than flecks.
   */
  function traceStyle(rowH) {
    /*
     * THE PITCH SCALES WITH THE PEN, NOT WITH THE ROW, and that is the whole
     * correctness condition here. A dot grid coarser than the stroke it is
     * punching does not bead the stroke — it cuts ACROSS it, and what survives is
     * the two edges of the line with the middle gone, which is precisely the
     * hollow outline this file exists to avoid. It shows up worst on the long
     * smooth arcs of the curl family, and worst of all on the first copy in a
     * row, because that one always lands on the same phase.
     *
     * The pitch used to be rowH/12 with its own floor while the stroke scaled by
     * penScale() with a different one, so the two drifted apart as rows got
     * smaller and the ratio was never the same twice. Tying the pitch to
     * penScale keeps dots and pen in the fixed proportion below at every ruling
     * on the shelf, which is the only way this stays right when a sheet picks a
     * row height nobody tested.
     */
    /*
     * The pitch is three quarters of the pen, whichever face is loaded. On
     * League that works out through penScale, because its stroke IS the pen
     * that was added to it. On a face with a real stroke of its own it comes
     * from the measured stem — see `stem` in cursivefont.js.
     */
    const stemPx = face.stem * (rowH / ASC);
    const pitch = r(Math.max(2.6, face.variable ? 0.75 * stemPx : 3.9 * penScale(rowH)));
    const mask = 'radial-gradient(circle at center, #000 62%, transparent 68%)';
    return (
      `color:${TRACE};` +
      (face.variable ? 'font-weight:400;' : weight(rowH, 3.2, TRACE)) +
      `-webkit-mask-image:${mask};mask-image:${mask};` +
      `-webkit-mask-size:${pitch}px ${pitch}px;mask-size:${pitch}px ${pitch}px;` +
      '-webkit-mask-repeat:repeat;mask-repeat:repeat;'
    );
  }

  /*
   * The join marks for one line of text, as extra layers.
   *
   * One layer per join rather than one layer with several holes in it: a mask
   * image is a single gradient, and two ellipses in one gradient is not a thing
   * CSS will do. Words are short and there are at most a handful of these.
   */
  function joinLayers(text, g, x0, rowH) {
    const out = [];
    for (let i = 1; i < text.length; i++) {
      if (text[i - 1] === ' ' || text[i] === ' ') continue;
      /* The boundary between the two letters. The mask and the text it masks live
       * in the same layer box, so this is measured from the layer's left edge and
       * x0 does not come into it. */
      const jx = textW(text.slice(0, i), rowH);
      const jy = g.base - g.inkTop - 0.18 * g.fs * XH;
      /*
       * THE EDGE IS HARD, AND THAT IS THE WHOLE POINT OF THE MARK.
       *
       * This gradient used to run #000 at 40% out to transparent at 100%, so
       * the black copy faded away across most of the ellipse. What printed was
       * not a marked stroke but a soft shadow: dark in the middle, half-dark
       * around it, spread over part of the letter either side as well as the
       * connector. A reader cannot tell what is being pointed at, because
       * nothing has an edge — the ink is neither the black of the join nor the
       * gray of the letters.
       *
       * With a hard stop the mark means one thing. The ellipse is invisible
       * where it crosses paper and shows only where it crosses ink, so what
       * appears is a short length of the stroke printed black — which is
       * exactly the claim the sheet is making. It is also smaller than it was,
       * because at the old size it blacked out the bottom of both letters
       * rather than the stroke between them.
       */
      const mask =
        `radial-gradient(ellipse ${r(0.154 * g.fs)}px ${r(0.238 * g.fs)}px at ${r(jx)}px ${r(jy)}px,` +
        ' #000 92%, transparent 94%)';
      out.push(
        layer(
          text,
          g,
          x0,
          `color:${JOIN_INK};` +
            /* Same reason as modelStyle: on a face with a real stroke the
             * connector reads as heavy because it is BLACK against gray
             * letters, not because it has been fattened. Thickening it here
             * turned the join into a blob rather than a stroke. */
            (face.variable ? 'font-weight:400;' : weight(rowH, 2.3, JOIN_INK)) +
            `-webkit-mask-image:${mask};mask-image:${mask};`
        )
      );
    }
    return out;
  }

  /*
   * The baseline strut. A zero-width inline-block takes its baseline from its own
   * bottom edge, so one of exactly `base` px high puts the row's text baseline on
   * the writing line — see the note at the top of this file. It draws nothing.
   */
  const strut = (g) => `<i class="cbase" style="height:${r(g.base)}px"></i>`;

  /*
   * A LETTER DRAWN TO BE GONE OVER, rather than beaded into dots.
   *
   * The dotted trace is the right thing on a teaching sheet, where a letter is
   * being learned a family at a time and the dots say "put the pencil here". It
   * is the wrong thing on a whole-alphabet chart, where fifty-two letters at a
   * readable size all beaded at once turn the page into texture and every tight
   * counter fills in — the same merging that made Hh unreadable on sheet 33.
   *
   * So this is the other tracing convention, and the one every alphabet chart
   * sold uses: the letter drawn once, thin and gray, to be written straight over.
   * No mask, so nothing can be eaten and nothing can merge.
   */
  /*
   * A FACE WITH A WEIGHT AXIS DOES NOT NEED THE TRICK. Faking a light letter out
   * of a single-weight hairline means a text-stroke, and a text-stroke thickens
   * the outline in every direction — it cannot make a stroke THINNER than the
   * font draws it. Playwrite has weights from 100, so a letter to go over is
   * just a light weight, drawn by the type designer rather than approximated.
   */
  const LIGHT_INK = '#4a4a4a';
  const lightStyle = (rowH) =>
    face.variable
      ? `color:${LIGHT_INK};font-weight:${face.variable[0]};`
      : `color:${LIGHT_INK};` + weight(rowH, 0.75, LIGHT_INK);

  /*
   * The three rules, spanning whatever the row is wide.
   *
   *   'primary'  top rule, dashed midline, HEAVY baseline. The baseline is the
   *              one a child is being taught to sit letters on, so on a teaching
   *              sheet it is the strongest line on the page.
   *   'light'    all three thin and gray. For a chart, where five rulings stacked
   *              up the page with a black bar under each would read as five
   *              barriers rather than as paper.
   */
  const rulesLight = (g) =>
    `<i class="crule" style="top:${r(g.top)}px;border-top:1px solid var(--rule)"></i>` +
    `<i class="crule" style="top:${r(g.mid)}px;border-top:1px dashed #b9b9b9"></i>` +
    `<i class="crule" style="top:${r(g.base)}px;border-top:1px solid var(--rule)"></i>`;

  const rules = (g) =>
    `<i class="crule" style="top:${r(g.top)}px;border-top:1.4px solid var(--rule)"></i>` +
    `<i class="crule" style="top:${r(g.mid)}px;border-top:1.4px dashed #9a9a9a"></i>` +
    `<i class="crule" style="top:${r(g.base)}px;border-top:2.6px solid var(--slate)"></i>`;

  /*
   * A word or phrase on its own three rules, sized to itself.
   *
   *   trace     dotted, to be gone over
   *   showJoin  blacken the connectors — see the note at the top of this file
   */
  function word(text, { rowH = 0.65 * PX, trace = false, showJoin = false } = {}) {
    const g = geom(rowH, text);
    const w = textW(text, rowH) + PAD * 2;
    const layers = [
      trace
        ? layer(text, g, PAD, traceStyle(rowH), maskPad(g))
        : layer(text, g, PAD, modelStyle(rowH, showJoin)),
    ];
    if (showJoin && !trace) layers.push(...joinLayers(text, g, PAD, rowH));
    return (
      `<span class="crow" style="width:${r(w)}px;height:${r(g.height)}px" role="img" ` +
      `aria-label="${esc(text)} in cursive">${strut(g)}${rules(g)}${layers.join('')}</span>`
    );
  }

  /*
   * A model and the copies to trace, ON ONE SET OF RULES.
   *
   * WHY THIS EXISTS, and it is the same mistake three sheets were making. A row
   * of "here is the letter, now trace it" was built as two separate word() boxes
   * sitting in a flex row. Each box pads its rules PAD px past its own ink at
   * both ends — which is right for a word standing on its own, so the rule does
   * not stop dead at the ink — and the flex gap sat between them. That put 45px
   * of empty ruled line between the model and the first letter to trace, a third
   * of it stranded inside the trace box before its first letter, and it broke the
   * ruling into two segments with a visible gap in the middle. A handwriting
   * sheet has ONE line running under everything on it; two lines with a hole
   * between them is a different, worse thing that nobody would draw on purpose.
   *
   * So the parts go in one box, with one set of rules under all of them, and the
   * only space between a model and its copies is the gap actually asked for.
   *
   * `items` is a list of strings, or of { text, trace, showJoin } — same three
   * options word() takes, per part. `gap` is in row heights, and matches the
   * model-to-trace gap fullRow() has always used, so the two agree on paper.
   *
   * `full` rules the whole width of the page instead of stopping at the ink. Use
   * it when what is on the line is meant to be CARRIED ON — a child who traces to
   * the end of the dotted letters and finds the rule stops there has been told to
   * stop, and the empty half of the line is the part where the writing is his.
   *
   * A FULL ROW STARTS CLEAR OF THE MARGIN, which costs half an inch and is worth
   * it. A script letter does not begin at its origin: `j` reaches 0.46 em to the
   * LEFT of where the layout puts it, `M` 0.38 and `J` 0.38, because the loop
   * swings back under the letter before. Start the text at the margin and a line
   * beginning with one of those hangs into it — measured at 19.5px on the row
   * beginning `jklmnopqr` — while a line beginning `abc` starts on the rule, so
   * the rows do not line up down the left edge either. The inset is the worst
   * swing in the font, so every row begins in the same place whatever is on it.
   */
  const LEFT_SWING = SWING_L + PEN_CUSHION;
  function row(items, { rowH = 0.65 * PX, gap = 0.35, full = false, rule = 'primary' } = {}) {
    const parts = items.map((it) => (typeof it === 'string' ? { text: it } : it));
    if (!parts.length) throw new Error('cursivetype.row: nothing to put on the line');
    if (rule !== 'primary' && rule !== 'light')
      throw new Error(`cursivetype.row: unknown rule "${rule}" — 'primary' or 'light'`);

    /* The rules are sized to everything on the line, so a descender anywhere on
     * it gets its room — the row is one row, not one row per part. */
    const g = geom(rowH, parts.map((p) => p.text).join(''));
    const gapPx = gap * rowH;

    const layers = [];
    let x = full ? SIDE_PAD + LEFT_SWING * g.fs : PAD;
    for (const p of parts) {
      layers.push(
        p.trace
          ? layer(p.text, g, x, traceStyle(rowH), maskPad(g))
          : p.light
            ? layer(p.text, g, x, lightStyle(rowH))
            : layer(p.text, g, x, modelStyle(rowH, p.showJoin))
      );
      if (p.showJoin && !p.trace) layers.push(...joinLayers(p.text, g, x, rowH));
      x += textW(p.text, rowH) + gapPx;
    }
    const w = x - gapPx + PAD;

    const label = parts.map((p) => (p.trace || p.light ? `${p.text} to trace` : p.text)).join(', ');
    const box = full
      ? `<div class="crow crow-full" style="height:${r(g.height)}px"`
      : `<span class="crow" style="width:${r(w)}px;height:${r(g.height)}px"`;
    const ruled = rule === 'light' ? rulesLight(g) : rules(g);
    return (
      `${box} role="img" aria-label="${esc(label)} in cursive">` +
      `${strut(g)}${ruled}${layers.join('')}</${full ? 'div' : 'span'}>`
    );
  }

  /*
   * A full-width writing line: the model at the left, a dotted copy beside it to
   * trace, and the rest of the line left empty for the child's own. This is how a
   * word actually gets practiced — on the rules it was modeled on, not on a
   * separate line an inch below.
   */
  function fullRow(text, { rowH = 0.5 * PX, showJoin = false, trace = true } = {}) {
    const g = geom(rowH, text);
    const w = textW(text, rowH);
    const layers = [layer(text, g, SIDE_PAD, modelStyle(rowH, showJoin))];
    if (showJoin) layers.push(...joinLayers(text, g, SIDE_PAD, rowH));
    if (trace)
      layers.push(layer(text, g, SIDE_PAD + w + 0.35 * rowH, traceStyle(rowH), maskPad(g)));
    return (
      `<div class="crow crow-full" style="height:${r(g.height)}px" role="img" ` +
      `aria-label="write ${esc(text)}">${strut(g)}${rules(g)}${layers.join('')}</div>`
    );
  }

  /* An empty ruled line, ruled for THIS font — a cursive sheet's blank lines have
   * to match the models above them. */
  function blankRow(rowH = 0.5 * PX, label = 'blank writing line') {
    const g = geom(rowH, null);
    return (
      `<div class="crow crow-full" style="height:${r(g.height)}px" role="img" ` +
      `aria-label="${esc(label)}">${strut(g)}${rules(g)}</div>`
    );
  }

  /*
   * Drop into any doc's CSS.
   *
   * THE FAMILY IS NAMED PER FACE, so a sheet can carry both without them
   * fighting over one name — and so that a page which includes two of these
   * blocks gets two fonts rather than whichever @font-face happened to come
   * last. The shared row rules are repeated in both blocks, which is harmless:
   * they are identical, and the alternative is a second thing to remember to
   * include.
   */
  const CSS = `
    @font-face {
      font-family: '${FAMILY}';
      src: url(data:font/woff2;base64,${FONT}) format('woff2');
      font-weight: ${face.variable ? `${face.variable[0]} ${face.variable[1]}` : '400'};
      font-display: block;
    }
    .crow { position: relative; display: inline-block; vertical-align: baseline;
      line-height: 0; }
    .crow-full { display: block; width: 100%; }
    .cbase { display: inline-block; width: 0; }
    .crule { position: absolute; left: 0; right: 0; height: 0; display: block; }
    .cink { position: absolute; white-space: pre; font-family: '${FAMILY}', cursive;
      font-weight: 400; -webkit-font-smoothing: antialiased;
      -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  `;


  return { word, row, fullRow, blankRow, geom, fitRowH, textW, width, CSS, ASC, XH, DESC, LEFT_SWING };
}

/* The League face is the module, so nothing that already requires this changes.
 * `forFont` is how a sheet asks for the other one. */
module.exports = { ...build('league'), forFont: build, FONTS };

},
"src/gen/packs/lib/prek/cursivefont.js": function(module, exports, require){
/*
 * cursivefont.js — the letterforms, as a font rather than as my drawings.
 *
 * WHAT THIS REPLACES AND WHY. This shelf's cursive was once twenty-six lowercase
 * letterforms and twenty-six capitals hand-typed as Bezier paths, drawn from
 * memory and adjusted until a render looked passable. They were bad — a "2"
 * where an L should be, an "n" where an s should be, nine of the lowercase
 * unreadable at the size the sheets actually print.
 *
 * THIS IS LEAGUE SCRIPT, and it is the third font tried, which is worth
 * recording so nobody repeats the first two.
 *
 *   Edu NSW ACT Cursive   an Australian state education standard, and correct
 *                         in every technical sense. But it is upright, its
 *                         ascenders do not loop, and its CAPITALS are not
 *                         cursive at all — they are the printed capitals with a
 *                         slant added. It reads as type, not as handwriting.
 *   Cedarville Cursive    tried for the capitals alone, over the NSW lowercase.
 *                         The capitals are properly looped, but its letters
 *                         vary in height by forty per cent and two fonts on one
 *                         line never stopped looking like two fonts.
 *   League Script         monoline, slanted, looped ascenders AND descenders,
 *                         lead-in strokes, and the traditional school capitals
 *                         — the Q really is drawn as a 2. It is the alphabet on
 *                         every cursive tracing sheet ever sold, which is the
 *                         point: it is what a pencil does, not what a computer
 *                         does.
 *
 * ITS ASCENDER IS 2.04 X-HEIGHTS, which is the ruling every handwriting sheet
 * in the world already uses and the previous font was not: the dashed middle
 * line lands where a child expects it, and a cursive row matches a printed one
 * from the rest of the shelf. That is luck rather than judgement, but it is
 * worth knowing before anyone swaps the font again.
 *
 * Copyright (c) The League of Moveable Type. SIL OFL 1.1 — free to embed and to
 * ship in something sold. 25 KB, which is a fair price for letters that are the
 * right shape.
 *
 * IT IS EMBEDDED, NOT LINKED. A sheet is a standalone file that has to work on a
 * customer's machine, offline, with no font installed and no network. So the
 * font travels inside the HTML as base64.
 */

const FONT =
  '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';

/* ---------------------------------------------------------- a second face */

/*
 * PLAYWRITE US TRAD, and why the shelf now carries two cursives rather than a
 * better one.
 *
 * League Script above is a display script. It is handsome, it is what a cursive
 * tracing sheet looks like when someone picks a font for the look of it, and it
 * is what every sheet in english-08-cursive is set in. What it is not is a school
 * font: its capitals carry ornamental entry loops, and its `s` is knotted at the
 * top where a school `s` is a plain point. Both are wrong for a child copying a
 * letter, and neither can be fixed — a font has one `s` and this one has no
 * stylistic alternates. That was checked: salt, ss01-ss04, dlig and swsh all
 * render identically.
 *
 * Playwrite is a school-handwriting family by TypeTogether, drawn per country to
 * the letterforms that country actually teaches; US Trad is the traditional
 * American cursive. Plain capitals, pointed `s`, and the Q drawn as a 2. SIL OFL
 * through Google Fonts, so it is safe in something sold.
 *
 * IT HAS A WEIGHT AXIS, 100 to 400, and that matters more than it sounds. Every
 * piece of tracing machinery in cursivetype.js — the dot mask, the text-stroke
 * thickening, the mask padding, the pitch-tied-to-pen rule — exists because
 * League Script is a single hairline weight and a light letter had to be faked
 * out of it. With a weight axis, a letter to trace is simply a light weight.
 *
 * SUBSET TO WHAT THE SHELF WRITES, which is measure-cursive.js's CHARSET: 41KB
 * against 72KB for the full face. Google Fonts does the subsetting server-side
 * through the `text=` parameter, which is how this was cut without adding a
 * build dependency to a repo that deliberately has none.
 *
 * Copyright TypeTogether. SIL OFL 1.1.
 */
const PLAYWRITE =
  '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';

module.exports = {
  /* Keyed by the name a sheet asks for. `league` is the default everywhere and
   * is what all of english-08-cursive is set in; nothing changes for it. */
  FONTS: {
    /*
     * `stem` is the width of a vertical stroke, in em, MEASURED off an `l` at
     * 200px and divided down. It is here because the tracing machinery needs to
     * know how thick the pen already is, and the two faces are nothing alike:
     *
     *   League       0.020 em   a true hairline — it has to be thickened, which
     *                           is what the text-stroke in cursivetype.js is for
     *   Playwrite    0.0875 em at weight 400, and 0.040 at weight 100. Four
     *                           times League's stroke before anything is added.
     *
     * Thickening Playwrite the way League needs turns the dotted trace into a
     * blob, because the dot grid ends up finer than the stroke it is punching.
     * So the pen weight and the dot pitch both come from this number.
     */
    league: { base64: FONT, family: 'CursiveLeague', variable: false, stem: 0.02 },
    playwrite: {
      base64: PLAYWRITE,
      family: 'CursivePlaywrite',
      variable: [100, 400],
      stem: 0.0875,
    },
  },
  /* The original single-font export, still the League face. Kept so that
   * anything reaching for it gets what it always got. */
  FONT,
};


},
"src/gen/packs/lib/prek/paper.js": function(module, exports, require){
/*
 * paper.js — shared drawing engine for handwriting sheets.
 *
 * Everything that puts ink on a ruled line lives here so the sheet generators
 * only decide WHAT goes on the page, not how it's drawn.
 *
 * COORDINATE SYSTEM  (see glyphs.js for the full description)
 *   1 unit = the height from top line to baseline
 *   y=0 top line · y=0.5 dashed midline · y=1 baseline · y=1.3 descender depth
 *
 * Letters are drawn as monoline paths, NOT font glyphs: a font glyph is a
 * filled shape, so stroking it yields an outline (two edges with a gap), which
 * a child reads as "colour this in." A single dashed line down the center of
 * the stroke is the path the pencil actually travels.
 *
 * Everything is SVG because a path point's `y` is exact. Rules and letters
 * share one coordinate system and cannot drift apart — which is precisely what
 * went wrong when this was HTML text floated over CSS borders.
 */

const { GLYPHS, startPoint } = require('./glyphs');
/* The one palette, defined beside the sheet CSS that uses it most. Early-years
 * paper carries the same rule and the same ink as the rest of the shelf — what
 * it does NOT take is color on the letter models and tracing guides below,
 * which are gray on purpose: a child traces those. */
const { PALETTE } = require('../sheet');
const { currentAccent } = require('../palette');
/* The drawn letterforms live in trace.js, which is browser-safe and so cannot
 * read a pack. Tell it which subject it is drawing for. */
require('./trace').setAccent(currentAccent());
const { brandLine } = require('../brand');
const BRAND = brandLine();

/* ------------------------------------------------------------- dimensions */
const PX = 96; // CSS px per inch
const CONTENT_W = 7.6 * PX; // 8.5in sheet minus 0.45in side margins
const TOP_PAD = 5; // so the top rule's stroke isn't clipped
const SIDE_PAD = 14;
const DESC_DEPTH = 0.3; // units below the baseline to leave for descenders

/* ------------------------------------------------------------ pen weights */
/* In px. Divided by the scale factor at draw time so they stay constant on
 * paper no matter how big the letters are. */
const SW_MODEL = 3.0; // solid example letter
const SW_TRACE = 2.4; // dashed letter to trace
const DASH = [5.5, 4.5];
const DOT_R = 2.6; // tittle on i / j
const START_R = 3.4; // "start here" dot

/*
 * WARM GUIDES, AND ONE THING IN COLOR.
 *
 * These were neutral greys, chosen for one reason that still holds: a guide a
 * child traces over has to LOSE to a pencil. Color does not change that job,
 * so each is swapped for a warm tone of the same lightness — #9e9e9e and
 * #B09A88 measure within a point of each other — and the page stops reading as
 * a photocopy without the letter models getting any louder.
 *
 * THE START DOT IS THE ONE THING IN COLOR, and the reason to bother: it is not
 * traced, it is an instruction — where the pencil goes down. In gray it was one
 * more gray mark among the letter's own; in the accent a four-year-old finds it
 * without being told twice. check.js allows the shelf's own inks on a child's
 * page precisely because of marks like this one: it is the only hue on the
 * sheet, so a mono printer leaves a dot of the same weight in the same place.
 *
 * The baseline stays near-black, because it is the line the writing sits on and
 * everything else is measured against it.
 */
const INK_MODEL = currentAccent(); // the letter shown to copy — this subject's color
const INK_TRACE = '#B09A88'; // the dashed letter to trace over
const INK_START = currentAccent(); // "start here" — an instruction, so the accent
const RULE_TOP = '#CFC3B2';
const RULE_MID = '#BCAE9C';
const RULE_BASE = '#16130F';

const FONT_STACK = "Quicksand, 'URW Gothic', 'Century Gothic', sans-serif";

const r = (n) => Math.round(n * 100) / 100;

const svgHeight = (rowH) => TOP_PAD + rowH + Math.ceil(rowH * DESC_DEPTH) + 4;

/* ---------------------------------------------------------------- drawing */

/*
 * Draw a glyph-shaped object: { w, d: [path strings], dots?: [[x,y]] }.
 * Accepts an ad-hoc object so pre-writing strokes can reuse the machinery
 * without pretending to be letters.
 */
/* Pen weights are absolute px so they print the same everywhere — but on the
 * smaller rulings a fixed 5.5px dash is proportionally much coarser than on the
 * big pre-K lines, and the letters go muddy. Taper the weights below the
 * reference ruling. At 0.65in the factor is 1, so the pre-K sheets are
 * untouched. */
const REF_ROW_H = 0.65 * PX;
const weightFactor = (s) => Math.max(0.65, Math.min(1, s / REF_ROW_H));

/* Same, looked up by character. */
function glyph(ch, x, y, s, opts) {
  const g = GLYPHS[ch];
  if (!g) throw new Error(`No glyph for "${ch}"`);
  return drawPaths(g, x, y, s, opts);
}

/*
 * A ruled row.
 *
 *   cells   what to place, left to right. Each is either
 *             { ch, trace }        a letter or digit
 *             { shape, trace }     an ad-hoc { w, d } object
 *           A null/undefined entry leaves that slot empty.
 *   slots   how many the line divides into. Keeping this fixed across rows
 *           makes letter size and spacing identical from row to row.
 *   rowH    top line to baseline, in px
 *   showStart  draw the "start here" dot (default true)
 */
function ruledRow({
  cells,
  slots,
  rowH,
  label = 'writing line',
  showStart = true,
  rules = 'primary',
}) {
  if (!Number.isFinite(rowH)) throw new Error(`ruledRow(${label}): rowH is ${rowH}`);

  const baseline = TOP_PAD + rowH;
  const midY = TOP_PAD + rowH / 2;
  const step = (CONTENT_W - SIDE_PAD * 2) / slots;
  const h = svgHeight(rowH);

  const out = [];
  cells.forEach((cell, i) => {
    if (!cell) return;
    const g = cell.shape || GLYPHS[cell.ch];
    if (!g) throw new Error(`No glyph for "${cell.ch}"`);
    const cx = SIDE_PAD + step * (i + 0.5);
    out.push(
      drawPaths(g, cx - (g.w * rowH) / 2, TOP_PAD, rowH, {
        trace: cell.trace,
        showStart: showStart && !cell.noStart,
      })
    );
  });

  const glyphBlock = out.length ? '\n        ' + out.join('\n        ') : '';

  /*
   * 'primary' — top rule, dashed midline, heavy baseline. For letters and
   *             digits, where the midline is the whole point.
   * 'track'   — top and bottom rules only. For pre-writing strokes: a
   *             horizontal stroke drawn at y=.5 lands exactly on a dashed
   *             midline and disappears into it, and a corner's foot at y=1
   *             vanishes into the baseline. Shapes are not letters and don't
   *             need the x-height guide.
   */
  const ruleLines =
    rules === 'track'
      ? `        <line x1="0" y1="${TOP_PAD}" x2="${r(CONTENT_W)}" y2="${TOP_PAD}" stroke="${RULE_TOP}" stroke-width="1.4"/>
        <line x1="0" y1="${r(baseline)}" x2="${r(
          CONTENT_W
        )}" y2="${r(baseline)}" stroke="${RULE_TOP}" stroke-width="1.6"/>`
      : `        <line x1="0" y1="${TOP_PAD}" x2="${r(CONTENT_W)}" y2="${TOP_PAD}" stroke="${RULE_TOP}" stroke-width="1.4"/>
        <line x1="0" y1="${r(midY)}" x2="${r(CONTENT_W)}" y2="${r(
          midY
        )}" stroke="${RULE_MID}" stroke-width="1.4" stroke-dasharray="7 7"/>
        <line x1="0" y1="${r(baseline)}" x2="${r(CONTENT_W)}" y2="${r(
          baseline
        )}" stroke="${RULE_BASE}" stroke-width="2.6"/>`;

  return `      <svg class="row" viewBox="0 0 ${r(CONTENT_W)} ${r(
    h
  )}" width="100%" role="img" aria-label="${label}">
${ruleLines}${glyphBlock}
      </svg>`;
}

/*
 * Convenience for the common "one model, then N dashed, then blank" row.
 */
function traceRow(ch, { models = 1, traces = 0, slots, rowH, label }) {
  const cells = [];
  for (let i = 0; i < models + traces; i++) {
    cells.push({ ch, trace: i >= models });
  }
  return ruledRow({ cells, slots, rowH, label: label || `writing line for ${ch}` });
}

/* An empty ruled line. */
const blankRow = (rowH, label = 'blank writing line') =>
  ruledRow({ cells: [], slots: 1, rowH, label });

/* ------------------------------------------------------------------ words */

/*
 * THE LETTER-DRAWING PRIMITIVES LIVE IN trace.js AND THIS FILE BORROWS THEM.
 * They used to be declared here. The shop's name generator needs the same four
 * functions in a browser, and two copies of the same geometry drift — somebody
 * widens the start dot in one and a sheet printed from the website stops
 * matching the sheet in the pack somebody bought. One file, running in both.
 */
const { drawPaths, drawWord, wordWidth, LETTER_GAP, SPACE_W } = require('./trace');

/*
 * Largest row height at which `copies` of `text` still fit across the line.
 * Long words and sentences have to shrink; short ones stay at full size. Being
 * computed rather than hand-tuned means adding a sentence can't silently push
 * text off the edge of the page.
 */
function fitRowH(text, copies, { max = 0.65 * PX, min = 0.26 * PX, pad = 1.12 } = {}) {
  const usable = CONTENT_W - SIDE_PAD * 2;
  const h = usable / (copies * wordWidth(text) * pad);
  return Math.max(min, Math.min(max, h));
}

/*
 * A ruled row holding copies of a word or sentence.
 *   slots  how many the line divides into
 *   draw   how many to actually render (the rest of the line stays blank)
 *   models how many of those are solid; the remainder are dashed to trace
 */
function wordRow({ text, slots, draw = slots, models = 1, rowH, label, align = 'center' }) {
  /* A bad rowH or slots silently becomes NaN in the viewBox and the row
   * renders as nothing — no crash, no warning, just a blank sheet. Catch it
   * where it happens rather than in a browser console. */
  if (!Number.isFinite(rowH)) throw new Error(`wordRow("${text}"): rowH is ${rowH}`);
  if (!Number.isFinite(slots) || slots < 1)
    throw new Error(`wordRow("${text}"): slots is ${slots}`);

  const baseline = TOP_PAD + rowH;
  const midY = TOP_PAD + rowH / 2;
  const h = svgHeight(rowH);
  const usable = CONTENT_W - SIDE_PAD * 2;
  const slotW = usable / slots;
  const wpx = wordWidth(text) * rowH;

  const out = [];
  for (let i = 0; i < draw; i++) {
    /* Sentences start at the left margin, the way a child writes them.
     * Centring is only right when several copies share the line. */
    const cx =
      align === 'left' ? SIDE_PAD + slotW * i : SIDE_PAD + slotW * i + (slotW - wpx) / 2;
    out.push(
      drawWord(text, cx, TOP_PAD, rowH, { trace: i >= models, showStart: true })
    );
  }

  return `      <svg class="row" viewBox="0 0 ${r(CONTENT_W)} ${r(
    h
  )}" width="100%" role="img" aria-label="${label || `writing line for ${text}`}">
        <line x1="0" y1="${TOP_PAD}" x2="${r(CONTENT_W)}" y2="${TOP_PAD}" stroke="${RULE_TOP}" stroke-width="1.4"/>
        <line x1="0" y1="${r(midY)}" x2="${r(CONTENT_W)}" y2="${r(
    midY
  )}" stroke="${RULE_MID}" stroke-width="1.4" stroke-dasharray="7 7"/>
        <line x1="0" y1="${r(baseline)}" x2="${r(CONTENT_W)}" y2="${r(
    baseline
  )}" stroke="${RULE_BASE}" stroke-width="2.6"/>
        ${out.join('\n        ')}
      </svg>`;
}

/*
 * A single glyph as a standalone SVG, for grids and charts rather than ruled
 * lines. Every glyph is drawn in a box spanning y 0 -> 1.32, so capitals,
 * x-height letters and descenders all share one baseline and a row of mixed
 * letters sits straight.
 */
function glyphSVG(ch, s, { pad = 6, ink } = {}) {
  const g = GLYPHS[ch];
  if (!g) throw new Error(`No glyph for "${ch}"`);
  const w = g.w * s + pad * 2;
  const h = 1.32 * s + pad * 2;
  const body = drawPaths(g, pad, pad, s, { trace: false, showStart: false });
  const tinted = ink ? body.replace(/stroke="[^"]*"/g, `stroke="${ink}"`).replace(/fill="#[^"]*"/g, `fill="${ink}"`) : body;
  return `<svg viewBox="0 0 ${r(w)} ${r(h)}" height="${r(h)}" role="img" aria-label="${ch}">${tinted}</svg>`;
}

/* --------------------------------------------------------------- page CSS */

/* Shared print skeleton. Page margins live ONLY in @page — putting padding on
 * body as well makes the two stack and eats an inch off every side. Screen
 * padding is quarantined in @media screen so it never affects print. */
const baseCSS = `
  @page { size: letter portrait; margin: 0.4in 0.45in; }

  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }

  ${PALETTE}

  body {
    font-family: ${FONT_STACK};
    color: #000; background: #fff;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }

  /* ORDER MATTERS. This generic rule must come BEFORE the @media screen block:
   * both selectors have the same specificity, so whichever is declared last
   * wins. With it after, it overrode the screen width and the preview stretched
   * to the viewport — rows scaled up and pages measured 16in tall. Print was
   * always fine (@media screen doesn't apply), but the on-screen proof lied. */
  .page { width: 100%; }
  .page + .page { page-break-before: always; }

  @media screen {
    body { padding: 0.4in; background: #ddd; }
    .page {
      background: #fff; padding: 0.4in 0.45in;
      width: 8.5in; min-height: 11in;
      margin: 0 auto 22px; box-shadow: 0 2px 10px rgba(0,0,0,.3);
    }
  }

  header {
    display: flex; align-items: center; gap: 16px;
    border-bottom: 3px solid var(--slate); padding-bottom: 7px; margin-bottom: 2px;
  }
  .bigletter { font-size: 38pt; font-weight: 700; line-height: 1; letter-spacing: .02em; }
  .htext { flex: 1; }
  h1 { font-size: 14pt; font-weight: 700; margin: 0 0 2px; }
  .sub { font-size: 10pt; color: var(--muted); margin: 0; }
  .nameline {
    font-size: 9.5pt; color: var(--muted);
    border-bottom: 1px solid var(--ink); width: 2in;
    padding-bottom: 1px; align-self: flex-end;
  }

  .label { font-size: 11.5pt; font-weight: 700; margin: 9px 0 1px; }
  .label span { font-weight: 400; font-size: 10pt; color: var(--muted); }

  .row { display: block; width: 100%; height: auto; margin-bottom: .06in; }
  /* Rows that follow the header directly would otherwise jam against its rule. */
  header + .row { margin-top: .12in; }

  .words {
    margin-top: 10px; padding-top: 7px; border-top: 1px solid var(--rule);
    font-size: 12.5pt;
    display: flex; align-items: baseline; gap: 9px; flex-wrap: wrap;
  }
  .words b { font-size: 14pt; }
  .words em { font-style: normal; color: var(--muted); }

  /* The wordmark rides in the footer line that was already there — see the note
     in lib/sheet.js. No height, upright, a size down, and never louder than the
     two slots it sits between. */
  .brand { font-style: normal; font-size: 7pt; letter-spacing: .04em;
    color: var(--accent); align-self: center; }

  footer {
    margin-top: 7px; font-size: 8.5pt; color: var(--muted);
    display: flex; justify-content: space-between;
  }

  .chart { display: grid; grid-template-columns: repeat(6, 1fr); gap: 7px; margin-top: 14px; }
  .cell {
    border: 2px solid var(--slate); border-radius: 8px; height: 1.35in;
    display: flex; align-items: center; justify-content: center;
  }
`;

/*
 * WHAT A SHEET IS, declared rather than guessed.
 *
 * lib/sheet.js has carried this since grade 3: a sheet says whether it is a
 * worksheet, a game, a reference or a form, check.js reads the declaration,
 * and anything calling itself a worksheet has to carry an answer key. This
 * engine never had it, which is why every sheet built on it — fourteen packs,
 * kinder through grade 2 — is invisible to that check.
 *
 * The list is deliberately the same four words. Two engines with two different
 * vocabularies for the same idea would be worse than one engine with none.
 *
 *   worksheet   questions with answers. Needs a key.
 *   game        two players and a pencil. There is nothing to mark.
 *   reference   a hundred chart, a number line, a word list. Nothing is asked.
 *   form        a diary, a log, a page of tracing. The answer is the child's.
 */
const { endDocument } = require('../seed');

const SHEET_KINDS = new Set(['worksheet', 'game', 'reference', 'form']);

/*
 * TURNING THE PAPER, for the sheets whose content is one wide thing.
 *
 * Almost everything on the shelf is portrait and should stay so: a worksheet
 * with questions down it reads better tall. But a number line, a timeline and
 * an alphabet are each one long object, and folding them into stacked rows is a
 * compromise nobody chose — see queue/LANDSCAPE-SCOPE.md.
 *
 * BOTH BOXES HAVE TO TURN. `@page` is what the printer obeys and the `@media
 * screen` block is what the on-screen proof shows, so a sheet that turns only
 * one of them lies about what comes out of the printer. That is why this is a
 * helper rather than a line each sheet writes for itself: the first landscape
 * sheet wrote it out in full, and the second one is the one that earns moving
 * it here before the two copies drift.
 *
 * The margin is a parameter because a chart has no writing in its margin to
 * protect and can afford a narrower one than a worksheet.
 */
const landscapeCSS = (margin = 0.35) => `
  @page { size: letter landscape; margin: ${margin}in; }
  @media screen {
    .page { width: 11in; min-height: 8.5in; padding: ${margin}in; }
  }
`;

/* `colour` is the same declaration lib/sheet.js carries — see the long note
 * there for why color on this shelf has to be asked for. */
const doc = (title, pages, extraCSS = '', { kind = 'worksheet', colour = false } = {}) => {
  if (!SHEET_KINDS.has(kind)) {
    throw new Error(`doc("${title}"): unknown kind "${kind}" — use one of ${[...SHEET_KINDS].join(', ')}`);
  }
  /* Closes this sheet's randomness window — see seedTag() in lib/seed.js. */
  endDocument();
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="sheet-kind" content="${kind}">${colour ? '\n<meta name="sheet-color" content="yes">' : ''}
<title>${title}</title>
<style>${baseCSS}${KEY_CSS}${extraCSS}</style>
</head>
<body>

${pages.join('\n\n')}

</body>
</html>
`;
};

/* Standard page header block. */
const pageHeader = ({ mark, title, sub, name = true }) => `  <header>
    <div class="bigletter">${mark}</div>
    <div class="htext">
      <h1>${title}</h1>
      <p class="sub">${sub}</p>
    </div>${name ? '\n    <div class="nameline">Name</div>' : ''}
  </header>`;

/* ------------------------------------------------------------- answer key */

/*
 * Lifted out of math-05-kinder/generate-counting.js, which invented it privately
 * and where three sheets already print it. Nothing about it was specific to
 * counting; it was in a pack because this file had no answer to the question.
 *
 * It is folded into `baseCSS` at doc() time rather than handed to each pack as
 * an extra, because a key that looks different in two packs is a key a parent
 * has to learn twice.
 */
const KEY_CSS = `
  .page.key { background: #fcfcfa; }
  .page.key header { border-bottom-style: double; border-bottom-width: 3px; }
  .keylist { font-size: 11pt; line-height: 1.7; }
  .keylist p { margin: .02in 0; }
  .keynote { border: 1.5px solid var(--deep); border-radius: 8px; padding: .07in .12in;
    margin: .1in 0 0; font-size: 10pt; line-height: 1.5; }
`;

/*
 * An answer key page for a sheet built on this engine.
 *
 *   items   answers, in order. A string, or { a, why } where the `why` sits
 *           under its own answer.
 *   body    for the keys whose answers are not a numbered list — a sorting
 *           sheet has three summary lines and no question 1. Supply one or the
 *           other; `items` is the common case and `body` is the escape hatch,
 *           the same split lib/sheet.js makes between keyPage and keyListPage.
 *   note    the WHAT TO WATCH paragraph, and at these ages it is the important
 *           half of the page.
 *
 * WHY THE NOTE MATTERS MORE THAN THE ANSWERS HERE. At five and six almost
 * every answer is a single digit a parent can work out unaided, so a bare list
 * tells them nothing they did not know. What they cannot see is the difference
 * between a child who knows 3 + 2 and one who got there by counting five
 * fingers from one — same mark on the paper, different child, different next
 * sheet. The note is where that gets said, and it is why `keyPage` refuses to
 * build without one.
 *
 * The header carries no name line: this page is kept back, not handed over.
 */
const keyPage = ({ title, sub, items, body, note, footL = 'Answer key — keep this one back', footR = '', seed = '' }) => {
  if (!note) throw new Error(`keyPage("${title}"): a key on this engine needs a "what to watch" note`);
  if (!items && !body) throw new Error(`keyPage("${title}"): needs either items or a body`);
  return `<div class="page key">
${pageHeader({ mark: '&#10003;', title, sub, name: false })}
  <div class="keylist">${
    body ||
    items
      .map((it, i) => {
        const a = typeof it === 'string' ? it : it.a;
        const why = typeof it === 'object' && it.why ? `<br><span class="sub">${it.why}</span>` : '';
        return `<p><b>${i + 1}.</b> ${a}${why}</p>`;
      })
      .join('')
  }</div>
  <div class="keynote">${note}</div>

  <footer>
    <span>${footL}${seed}</span>
    <span class="brand">${BRAND}</span>
    <span>${footR}</span>
  </footer>
</div>`;
};

module.exports = {
  PX,
  CONTENT_W,
  TOP_PAD,
  SIDE_PAD,
  landscapeCSS,
  DESC_DEPTH,
  INK_MODEL,
  INK_TRACE,
  FONT_STACK,
  r,
  svgHeight,
  drawPaths,
  glyph,
  glyphSVG,
  ruledRow,
  traceRow,
  blankRow,
  wordWidth,
  drawWord,
  wordRow,
  fitRowH,
  baseCSS,
  doc,
  keyPage,
  KEY_CSS,
  SHEET_KINDS,
  pageHeader,
  startPoint,
};

},
"src/gen/packs/lib/prek/glyphs.js": function(module, exports, require){
/*
 * Monoline manuscript alphabet — single-stroke skeleton letterforms.
 *
 * WHY THIS EXISTS
 * A font glyph is a filled shape. Stroking one gives you an OUTLINE — two edges
 * with a gap between them — which reads to a child as "color this in." Tracing
 * needs the opposite: one line running down the CENTER of the letter, following
 * the path the pencil actually travels. No installed font can provide that, so
 * the letterforms are drawn here as paths.
 *
 * COORDINATE SYSTEM (1 unit = the height from top line to baseline)
 *
 *   y = 0     top line          <- capitals and tall letters start here
 *   y = 0.5   dashed midline    <- lowercase bodies start here
 *   y = 1.0   baseline          <- everything sits here
 *   y = 1.3   descender depth   <- g j p q y
 *
 *   x starts at 0; each glyph declares its own advance width `w`.
 *
 * Shapes are ball-and-stick manuscript print (straight lines + round bowls),
 * which is what's taught for early printing. The lowercase a and g are
 * deliberately single-story.
 *
 * PER GLYPH
 *   w     advance width in units
 *   d     array of SVG path strings — ONE ENTRY PER PEN STROKE, in the order a
 *         child should write them (so start dots and any future stroke-order
 *         numbering land in the right place)
 *   dots  optional filled dots, for the tittles on i and j
 */

/*
 * ROUND SHAPES USE ARCS, NOT CUBICS.
 *
 * A cubic Bezier never reaches its control points — it gets roughly three
 * quarters of the way — so hand-placed controls drew every bowl noticeably
 * narrower than declared, and joins missed by a visible gap. An arc takes
 * explicit radii, so `cx + rx` really is the rightmost point.
 *
 * Handy property used throughout: when an arc's two endpoints share an x (a
 * vertical chord), ry is fixed at half the chord length and rx IS the bulge.
 * So `M0 0 A.6 .5 0 0 1 0 1` bulges exactly .6 to the right. Same for a
 * horizontal chord with rx and ry swapped.
 *
 * Arc flags: sweep 0 = counter-clockwise on screen (y grows downward),
 * sweep 1 = clockwise. large-arc 1 takes the long way round.
 */
const UPPER = {
  A: { w: 0.64, d: ['M0 1 L.32 0 L.64 1', 'M.14 .64 H.5'] },
  B: { w: 0.56, d: ['M0 0 V1', 'M0 0 A.42 .25 0 0 1 0 .5', 'M0 .5 A.48 .25 0 0 1 0 1'] },
  C: { w: 0.62, d: ['M.54 .16 A.28 .48 0 1 0 .54 .84'] },
  D: { w: 0.62, d: ['M0 0 V1', 'M0 0 A.6 .5 0 0 1 0 1'] },
  E: { w: 0.56, d: ['M0 0 V1', 'M0 0 H.54', 'M0 .5 H.42', 'M0 1 H.54'] },
  F: { w: 0.54, d: ['M0 0 V1', 'M0 0 H.52', 'M0 .5 H.4'] },
  G: { w: 0.66, d: ['M.54 .16 A.28 .48 0 1 0 .54 .84', 'M.54 .84 V.52 H.34'] },
  H: { w: 0.6, d: ['M0 0 V1', 'M.6 0 V1', 'M0 .5 H.6'] },
  I: { w: 0.5, d: ['M.25 0 V1', 'M.08 0 H.42', 'M.08 1 H.42'] },
  /* Hook travels right-to-left UNDER the baseline, which from the right-hand
   * point is clockwise — sweep 1. Sweep 0 arcs over the top instead. */
  J: { w: 0.5, d: ['M.4 0 V.76 A.18 .22 0 0 1 .04 .76'] },
  K: { w: 0.58, d: ['M0 0 V1', 'M.54 0 L.06 .55', 'M.22 .4 L.58 1'] },
  L: { w: 0.52, d: ['M0 0 V1 H.5'] },
  M: { w: 0.68, d: ['M0 1 V0 L.34 .62 L.68 0 V1'] },
  N: { w: 0.62, d: ['M0 1 V0 L.62 1 V0'] },
  O: { w: 0.68, d: ['M.34 0 A.32 .5 0 0 0 .34 1 A.32 .5 0 0 0 .34 0'] },
  P: { w: 0.56, d: ['M0 0 V1', 'M0 0 A.46 .27 0 0 1 0 .54'] },
  Q: { w: 0.68, d: ['M.34 0 A.32 .5 0 0 0 .34 1 A.32 .5 0 0 0 .34 0', 'M.44 .74 L.68 1.06'] },
  R: { w: 0.58, d: ['M0 0 V1', 'M0 0 A.46 .27 0 0 1 0 .54', 'M.3 .54 L.58 1'] },
  S: { w: 0.56, d: ['M.52 .18 C.46 .02 .06 0 .06 .28 C.06 .52 .5 .48 .5 .74 C.5 1.02 .1 1 .04 .84'] },
  T: { w: 0.58, d: ['M.29 0 V1', 'M0 0 H.58'] },
  U: { w: 0.6, d: ['M0 0 V.68 A.3 .3 0 0 0 .6 .68 V0'] },
  V: { w: 0.6, d: ['M0 0 L.3 1 L.6 0'] },
  W: { w: 0.76, d: ['M0 0 L.17 1 L.38 .3 L.59 1 L.76 0'] },
  X: { w: 0.58, d: ['M0 0 L.58 1', 'M.58 0 L0 1'] },
  Y: { w: 0.58, d: ['M0 0 L.29 .52 L.58 0', 'M.29 .52 V1'] },
  Z: { w: 0.56, d: ['M0 0 H.56 L0 1 H.56'] },
};

/*
 * Lowercase bowls are one shared ellipse: center (.25,.75), rx .21, ry .25 —
 * so every bowl spans x .04-.46 and y .5-1 exactly, touching the midline and
 * the baseline. Stems at x .04 (b p) or .46 (a d g q u) meet it precisely.
 * Shoulders on h m n r are top-half arcs of the same family.
 */
const LOWER = {
  a: { w: 0.5, d: ['M.25 .5 A.21 .25 0 0 0 .25 1 A.21 .25 0 0 0 .25 .5', 'M.46 .5 V1'] },
  b: { w: 0.5, d: ['M.04 0 V1', 'M.25 .5 A.21 .25 0 0 0 .25 1 A.21 .25 0 0 0 .25 .5'] },
  c: { w: 0.48, d: ['M.39 .57 A.21 .25 0 1 0 .39 .93'] },
  d: { w: 0.5, d: ['M.25 .5 A.21 .25 0 0 0 .25 1 A.21 .25 0 0 0 .25 .5', 'M.46 0 V1'] },
  /* Bar first, then counter-clockwise (sweep 0) up over the top, round the
   * left and down to ~5 o'clock. Sweep 1 here travels the wrong way and
   * collapses into a hook. */
  e: { w: 0.48, d: ['M.04 .75 H.45 A.21 .25 0 1 0 .38 .93'] },
  f: { w: 0.4, d: ['M.36 .14 A.12 .12 0 0 0 .12 .14 V1', 'M0 .5 H.34'] },
  g: {
    w: 0.5,
    d: [
      'M.25 .5 A.21 .25 0 0 0 .25 1 A.21 .25 0 0 0 .25 .5',
      'M.46 .5 V1.1 C.46 1.32 .12 1.32 .06 1.2',
    ],
  },
  h: { w: 0.5, d: ['M.04 0 V1', 'M.04 .72 A.21 .22 0 0 1 .46 .72 V1'] },
  i: { w: 0.26, d: ['M.13 .5 V1'], dots: [[0.13, 0.34]] },
  j: { w: 0.3, d: ['M.18 .5 V1.08 A.09 .11 0 0 1 0 1.08'], dots: [[0.18, 0.34]] },
  k: { w: 0.48, d: ['M.04 0 V1', 'M.42 .5 L.08 .78', 'M.2 .68 L.46 1'] },
  l: { w: 0.24, d: ['M.12 0 V1'] },
  m: {
    w: 0.74,
    d: [
      'M.04 .5 V1',
      'M.04 .72 A.16 .22 0 0 1 .36 .72 V1',
      'M.36 .72 A.16 .22 0 0 1 .68 .72 V1',
    ],
  },
  n: { w: 0.5, d: ['M.04 .5 V1', 'M.04 .72 A.21 .22 0 0 1 .46 .72 V1'] },
  o: { w: 0.5, d: ['M.25 .5 A.22 .25 0 0 0 .25 1 A.22 .25 0 0 0 .25 .5'] },
  p: { w: 0.5, d: ['M.04 .5 V1.3', 'M.25 .5 A.21 .25 0 0 0 .25 1 A.21 .25 0 0 0 .25 .5'] },
  q: { w: 0.5, d: ['M.25 .5 A.21 .25 0 0 0 .25 1 A.21 .25 0 0 0 .25 .5', 'M.46 .5 V1.3'] },
  r: { w: 0.38, d: ['M.04 .5 V1', 'M.04 .72 A.17 .22 0 0 1 .33 .56'] },
  s: { w: 0.42, d: ['M.38 .6 C.32 .48 .04 .48 .04 .66 C.04 .82 .36 .78 .36 .92 C.36 1.06 .08 1.04 .02 .94'] },
  t: { w: 0.38, d: ['M.14 .25 V.88 C.14 1.02 .3 1.02 .36 .96', 'M.02 .5 H.32'] },
  u: { w: 0.5, d: ['M.04 .5 V.75 A.21 .25 0 0 0 .46 .75', 'M.46 .5 V1'] },
  v: { w: 0.46, d: ['M.02 .5 L.24 1 L.46 .5'] },
  w: { w: 0.66, d: ['M.02 .5 L.16 1 L.33 .62 L.5 1 L.64 .5'] },
  x: { w: 0.44, d: ['M.02 .5 L.42 1', 'M.42 .5 L.02 1'] },
  y: { w: 0.48, d: ['M.02 .5 L.25 1', 'M.46 .5 L.14 1.3'] },
  z: { w: 0.44, d: ['M.02 .5 H.42 L.02 1 H.42'] },
};

/*
 * Digits span the full height, y 0 -> 1, like capitals.
 *
 * Strokes are ordered the way a child writes them, and each digit's FIRST
 * stroke begins where the pencil goes down — that's where the start dot lands,
 * so a numeral that starts at the bottom would teach the wrong habit.
 * 4, 8 and 9 are deliberately two strokes; drawn as one they pinch into an
 * hourglass or read as a letter.
 */
const DIGITS = {
  /*
   * Round shapes use ARC commands (A rx ry rot large sweep x y), not cubics.
   * A cubic never reaches its control points — it tops out at about 3/4 of the
   * way there — so hand-placed controls silently drew shapes ~25% narrower
   * than declared, and 9's tail ended up floating beside its bowl instead of
   * touching it. An arc's radii are exact, so the extremes are where you say.
   */
  0: { w: 0.55, d: ['M.275 .03 A.225 .47 0 0 0 .275 .97 A.225 .47 0 0 0 .275 .03'] },
  1: { w: 0.36, d: ['M.05 .26 L.25 .04 V.97'] },
  2: { w: 0.55, d: ['M.06 .26 C.08 .04 .52 .02 .52 .32 C.52 .6 .1 .74 .06 .97 H.54'] },
  3: { w: 0.55, d: ['M.07 .18 C.14 0 .5 .02 .5 .26 C.5 .45 .3 .5 .22 .5 C.32 .5 .54 .55 .54 .76 C.54 1 .14 1.03 .06 .86'] },
  4: { w: 0.58, d: ['M.38 .03 L.04 .68 H.56', 'M.38 .03 V.97'] },
  5: { w: 0.55, d: ['M.5 .05 H.16 L.11 .44 C.22 .34 .54 .4 .54 .7 C.54 .97 .16 1.04 .06 .89'] },
  /* Loop is an arc centered at (.29,.735) with ry .235, so its bottom is exactly
   * .97 — sitting ON the baseline. As cubics it stopped short at ~.87 and the
   * whole loop appeared to hover above the line. */
  6: {
    w: 0.55,
    d: [
      'M.45 .06 C.22 .14 .07 .38 .07 .735',
      'M.07 .735 A.22 .235 0 0 0 .51 .735 A.22 .235 0 0 0 .07 .735',
    ],
  },
  7: { w: 0.52, d: ['M.04 .05 H.5 L.22 .97'] },
  /* Bottom loop is deliberately wider than the top one, as in a written 8. */
  8: {
    w: 0.55,
    d: [
      'M.275 .04 A.195 .23 0 0 0 .275 .5 A.195 .23 0 0 0 .275 .04',
      'M.275 .5 A.225 .235 0 0 0 .275 .97 A.225 .235 0 0 0 .275 .5',
    ],
  },
  /* The bowl owns the top ~55%, and the tail starts at cx+rx (.3+.24 = .54),
   * exactly the bowl's rightmost point, so the two actually join. */
  9: {
    w: 0.58,
    d: ['M.3 .04 A.24 .27 0 0 0 .3 .58 A.24 .27 0 0 0 .3 .04', 'M.54 .31 V.97'],
  },
};

/* Punctuation, so sentences can actually end. A full stop has no strokes at
 * all — just a dot — so anything reading d[0] must tolerate an empty d. */
const PUNCT = {
  '.': { w: 0.2, d: [], dots: [[0.1, 0.94]] },
  '!': { w: 0.2, d: ['M.1 .04 V.74'], dots: [[0.1, 0.94]] },
  '?': { w: 0.42, d: ['M.05 .22 A.16 .18 0 1 1 .21 .46 V.62'], dots: [[0.21, 0.94]] },
  ',': { w: 0.2, d: ['M.12 .9 C.12 1.02 .07 1.08 .03 1.1'] },
  "'": { w: 0.16, d: ['M.08 .48 V.66'] },
  '-': { w: 0.3, d: ['M.03 .75 H.27'] },
};

const GLYPHS = { ...UPPER, ...LOWER, ...DIGITS, ...PUNCT };

/* Start point of a glyph = the first M coordinate of its first stroke. Used to
 * print the green "start here" dot. */
function startPoint(ch) {
  const g = GLYPHS[ch];
  if (!g || !g.d.length) return null; // a full stop has no strokes
  const m = g.d[0].match(/^M\s*(-?[\d.]+)[\s,]+(-?[\d.]+)/);
  return m ? [parseFloat(m[1]), parseFloat(m[2])] : null;
}

module.exports = { GLYPHS, UPPER, LOWER, DIGITS, PUNCT, startPoint };

},
"src/gen/packs/lib/sheet.js": function(module, exports, require){
/*
 * sheet.js — shared page furniture for the grade 3 packs.
 *
 * prek-handwriting/paper.js is a DRAWING engine: it puts monoline glyphs on
 * ruled lines and knows nothing about worksheets. This is the other half —
 * the paper itself. Headers, directions boxes, problem grids, answer boxes,
 * ruled response lines, answer keys, print CSS.
 *
 * Every grade 3 generator requires this, so a change to the margin, the
 * ruling height or the answer-key styling lands on all four packs at once.
 * That is the point: four packs that each owned a copy of this CSS drifted
 * within a week, and a child can tell.
 *
 * CONVENTIONS THIS FILE ENFORCES (see ../README.md for the reasoning)
 *   - page margins live in @page ONLY; body padding stays 0 for print
 *   - the generic `.page` rule is declared BEFORE @media screen
 *   - answer keys are their own .page, so they break onto a fresh sheet and
 *     can be printed and withheld
 *   - handwriting response lines are 0.375in — standard 3rd-grade ruling
 */

/* --------------------------------------------------------------- typefaces */

/*
 * Georgia has OLD-STYLE figures: 3 4 5 7 9 sit below the baseline. Beautiful in
 * prose, wrong for arithmetic — a column of them doesn't line up and a 7 reads
 * as a descender. So text packs get the serif and anything with digits in it
 * gets a lining-figure sans.
 */
/* Who made this sheet — one module, so a rename is one edit. See lib/brand.js. */
const { brandLine } = require('./brand');
const BRAND = brandLine();

const FONT_TEXT = 'Georgia, "Times New Roman", serif';
const FONT_MATH = '"Trebuchet MS", "Segoe UI", Tahoma, Verdana, sans-serif';

/* 3rd-grade ruling, matching the DOL sheets and the `young` name sheets. */
const RULE_H = '0.375in';

/* ------------------------------------------------------------------ escape */

/*
 * Sheet content is authored as plain text and dropped into HTML, so the three
 * structural characters have to be neutralised. Everything that takes an
 * author-supplied string runs it through this; helpers that deliberately accept
 * markup (rich(), the answer-key `fixed` strings) say so in their comment.
 */
const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/*
 * For the handful of places that WANT inline markup — <u> in an answer key,
 * <b> in a directions line. Passes through untouched; the caller owns it.
 */
const rich = (s) => String(s);

/* ------------------------------------------------------------------ pieces */

/* A named blank: "Name ______  Date ____". `short` pins the date field. */
const nameline = ({ score } = {}) =>
  `  <div class="nameline">
    <span>Name</span>
    <span class="short">Date</span>${
      score ? `\n    <span class="short">Score &nbsp;____ / ${score}</span>` : ''
    }
  </div>`;

/*
 * The gray box at the top. `text` is the instruction; `tip` is the smaller
 * italic line under it — a worked example, a reminder, the mnemonic.
 * Both accept inline markup.
 */
const directions = (text, tip) =>
  `  <div class="directions">
    <b>DIRECTIONS:</b> ${rich(text)}${
      tip ? `\n    <div class="tip">${rich(tip)}</div>` : ''
    }
  </div>`;

/* Ruled response lines, 3rd-grade height. Solid top, dashed midline, heavy
 * baseline — same three-line primary rule as every other pack. */
const writeLines = (n = 1, { indent = true } = {}) =>
  Array.from(
    { length: n },
    () => `<div class="write${indent ? '' : ' flush'}"></div>`
  ).join('');

/* A square to write an answer in. `w` in inches. */
const answerBox = ({ w = 0.7, h = 0.5, label = '' } = {}) =>
  `<span class="abox" style="width:${w}in;height:${h}in">${
    label ? `<span class="alab">${esc(label)}</span>` : ''
  }</span>`;

/* ------------------------------------------------------- confidence marks */

/*
 * Three rings beside a question: filled, half, hollow. Ring one BEFORE
 * checking the answer.
 *
 * WHAT THIS IS FOR, and it is the one thing no other sheet on this shelf can
 * report. A marked page has two states per question, right and wrong, and
 * those two states hide four situations that need four different responses:
 *
 *   sure and right      knows it. Stop practicing this.
 *   sure and WRONG      a confident misconception — the most expensive kind,
 *                       because drilling it makes it worse. Reteach the idea,
 *                       do not hand over more of the same sheet.
 *   guessed and RIGHT   not knowledge, luck. A score counts this as knowing it
 *                       and moves the child on, which is how a gap gets
 *                       buried under the next thing built on top of it.
 *   guessed and wrong   does not know it. Teach it. The cheapest of the four.
 *
 * The two diagonals are invisible on every sheet here, and they are the two
 * that change what you do next. That is the whole argument.
 *
 * THE MARK GOES ON BEFORE THE ANSWER IS CHECKED or it measures nothing — a
 * child who already knows they were wrong will not ring "sure", and then the
 * column just repeats the mark. `directions` should say so.
 *
 * NO WORDS IN THE MARK. Position and fill carry the meaning — solid on the
 * left down to hollow on the right — so it works for a six-year-old and does
 * not add a reading load to a math sheet. The legend is printed once.
 */
const confRing = (fill) =>
  `<span class="cring cring-${fill}"></span>`;

const confidence = () =>
  `<span class="conf" role="img" aria-label="ring one before checking: sure, think so, guessed">${confRing(
    'full'
  )}${confRing('half')}${confRing('none')}</span>`;

/*
 * The legend, printed once per page that uses the marks. Takes the sentence
 * that tells the child WHEN to ring, because getting that wrong voids the
 * column and it is the instruction adults skip.
 */
const confidenceLegend = () =>
  `<div class="conflegend">
    <span class="conftitle">Before you check:</span>
    <span class="confitem">${confRing('full')} I am sure</span>
    <span class="confitem">${confRing('half')} I think so</span>
    <span class="confitem">${confRing('none')} I guessed</span>
  </div>`;

/*
 * A stacked column sum:  324
 *                      + 168
 *                      ------
 *
 *   rows    the operands, top to bottom
 *   op      the sign, printed against the LAST operand
 *   answer  fill the answer row in (used by answer keys); omit for a blank
 *
 * Two grid columns, so the operator can never collide with a wide number.
 */
/*
 * `carry` draws the small digits above the columns — the actual method, which
 * until now could only be described in a sentence underneath. Written as a
 * right-aligned string in the same tabular figures as the sum, so a digit lands
 * over the column it belongs to; use FIGURE SPACE (\u2007) for a column that
 * takes no carry, because an ordinary space is narrower than a digit and slides
 * everything one place left.
 *
 *   vert(['265', '147'], '+', { carry: '11\u2007', answer: '412' })
 *
 * It exists for the faded worked examples — see lib/formats.js faded(). A
 * child who is shown the carries on the first sum, given them on the second and
 * asked for them on the third has done the last step of the method before doing
 * all of it, which the sheets could not offer while the only thing this could
 * draw was a bare sum.
 */
const vert = (rows, op = '+', { answer = '', carry = '' } = {}) => {
  const head = carry
    ? `<span class="op carry"></span><span class="carry">${esc(carry)}</span>`
    : '';
  const cells = rows
    .map((v, i) => {
      const last = i === rows.length - 1;
      return `<span class="op${last ? ' last' : ''}">${last ? esc(op) : ''}</span><span class="${
        last ? 'last' : ''
      }">${esc(v)}</span>`;
    })
    .join('');
  return `<span class="vert">${head}${cells}<span class="ans"></span><span class="ans">${esc(answer)}</span></span>`;
};

/* Open space for working out, with a faint label so it doesn't read as a
 * mistake in the layout. */
const workspace = ({ h = 1.1, label = 'Show your work' } = {}) =>
  `<div class="work" style="height:${h}in"><span>${esc(label)}</span></div>`;

/*
 * Multiple choice. `opts` is an array of strings (markup allowed — fractions
 * and SVGs go in here). Letters are generated, never authored, so inserting an
 * option can't leave two Cs.
 */
const mcq = (opts, { cols = opts.length <= 4 ? opts.length : 2 } = {}) =>
  `<div class="mcq" style="grid-template-columns:repeat(${cols},1fr)">${opts
    .map(
      (o, i) =>
        `<span class="opt"><b>${String.fromCharCode(65 + i)}.</b> ${rich(o)}</span>`
    )
    .join('')}</div>`;

/*
 * A problem grid. `items` are pre-rendered strings; this only handles the
 * columns and the numbering. `start` lets a second grid on the same sheet
 * continue the numbering rather than restarting at 1.
 */
/*
 * `numbered: false` is for a grid that is NOT questions.
 *
 * Grade 3's simple-machines sheet lays its six machine types out as reference
 * cards — a diagram, the name in bold, a sentence saying what it does — and
 * the grid numbered them 1 to 6. Nothing on that panel is asked, so nothing on
 * it is answered: the key jumps straight to page 2, whose ten objects are ALSO
 * numbered 1 to 10. A child told to "do number 4" had two of them, and every
 * key entry sat against whichever the reader happened to look at.
 *
 * A numbered thing is a thing somebody has to answer. Reference is not.
 */
const grid = (items, { cols = 4, start = 1, cls = '', numbered = true } = {}) =>
  `<div class="grid ${cls}" style="grid-template-columns:repeat(${cols},1fr)">${items
    .map(
      (it, i) =>
        `<div class="prob">${
          numbered ? `<span class="pn">${start + i}.</span>` : ''
        }<div class="pbody">${rich(it)}</div></div>`
    )
    .join('')}</div>`;

/*
 * A numbered list of questions with ruled lines under each — the shape every
 * reading/science/social response page takes.
 *   { q, lines, space }  question text, how many ruled lines, or open space
 */
const questions = (items, { start = 1, confidence: conf = false } = {}) =>
  `<ol class="qs${conf ? ' hasconf' : ''}" start="${start}">${items
    .map(
      (it) =>
        `<li>${conf ? confidence() : ''}<span class="qt">${rich(it.q)}</span>${
          it.mcq ? mcq(it.mcq, it.mcqCols ? { cols: it.mcqCols } : undefined) : ''
        }${it.space ? workspace({ h: it.space, label: it.spaceLabel || 'Show your work' }) : ''}${writeLines(
          it.lines || 0
        )}</li>`
    )
    .join('')}</ol>`;

/*
 * A plain data table. `head` is an array of column labels, `rows` an array of
 * arrays. A cell of null renders as an empty writing cell — that's how the
 * "fill in the table" sheets are built.
 */
const table = (head, rows, { cls = '' } = {}) =>
  `<table class="tbl ${cls}">
    <thead><tr>${head.map((h) => `<th>${rich(h)}</th>`).join('')}</tr></thead>
    <tbody>${rows
      .map(
        (r) =>
          `<tr>${r
            .map((c) => `<td${c === null ? ' class="blank"' : ''}>${c === null ? '' : rich(c)}</td>`)
            .join('')}</tr>`
      )
      .join('')}</tbody>
  </table>`;

/* ------------------------------------------------------------------- pages */

/*
 * One printed side. Everything is optional except body, so this covers the
 * plain "header + problems" sheet and the fully dressed one equally.
 */
const page = ({
  title,
  sub,
  badge,
  name = false,
  score,
  dir,
  tip,
  body,
  footL = '',
  footR = '',
  cls = '',
  cont = false,
}) => `<div class="page ${cls}">
  <header${cont ? ' class="cont"' : ''}>
    ${badge ? `<div class="keybadge">${esc(badge)}</div>` : ''}
    <h1>${rich(title)}</h1>
    ${sub ? `<p class="sub">${rich(sub)}</p>` : ''}
  </header>
${name ? nameline({ score }) : ''}
${dir ? directions(dir, tip) : ''}

${body}

  <footer>
    <span>${rich(footL)}</span>
    <span class="brand">${BRAND}</span>
    <span>${rich(footR)}</span>
  </footer>
</div>`;

/*
 * The answer key. Always its own page, always badged, so a sheet handed to a
 * child can't have the answers on the back of it.
 *
 * `items` are strings; `why` lines are the teaching note — what the mistake
 * would have been. Those are what make the key usable by a parent who hasn't
 * done long division since school.
 */
/*
 * `after` is for answers that belong to questions the sheet does NOT number.
 *
 * The numbered run here is numbered by position — item 3 prints as "3." — so
 * anything dropped into the middle of it shifts every answer after it by one.
 * Grade 4's long-words sheet did exactly that: its word-parts table is a table
 * with no question numbers on it, its answers sat in the middle of the key,
 * and six numbered questions further down were answered by the six entries
 * above them. A parent checking question 21 read the answer to something else.
 *
 * So unnumbered answers go after the run, labeled, instead of inside it.
 */
const keyPage = ({ title, sub, items, after = '', footL = '', footR = '', cols = 4 }) =>
  page({
    badge: 'Answer Key — Parent Copy',
    title,
    sub,
    cls: 'key',
    body: `<div class="grid keygrid" style="grid-template-columns:repeat(${cols},minmax(0,1fr))">${items
      .map(
        (it, i) =>
          `<div class="prob"><span class="pn">${i + 1}.</span><div class="pbody">${rich(
            typeof it === 'string' ? it : it.a
          )}${
            typeof it === 'object' && it.why
              ? `<span class="why">${rich(it.why)}</span>`
              : ''
          }</div></div>`
      )
      .join('')}</div>${after || ''}`,
    footL,
    footR,
  });

/*
 * THE PARENT PAGE FOR A SHEET THAT HAS NO ANSWERS.
 *
 * The shelf has always had two states, and they leave a hole between them. A
 * `worksheet` carries an answer key. A `form` — a book log, a story a child
 * invents — carries nothing, because there is nothing a key could say that
 * would not be invented. But the sheets that do the best work in reading and
 * in history are neither: "what do you think this story was saying?" has no
 * settled answer AND is not a blank page. It has better and worse answers, and
 * a parent sitting down with it has been given nothing to go on.
 *
 * What got written instead, twelve times across the shelf, was a `why` line
 * saying "no right answer — worth talking about rather than marking". That is
 * true and it is not help. It tells a parent what NOT to do.
 *
 * SO THE UNIT HERE IS NOT A RUBRIC, IT IS THE NEXT QUESTION. A thin answer
 * from a child is almost never wrong; it is unfinished, and the parent's job
 * is one specific sentence that opens it back up. "It was sad" is not a bad
 * answer to what a story was saying — it is the first half of a good one, and
 * "which part made it sad?" gets the second half. A rubric grades the child. A
 * follow-up question keeps them working, which is the only thing that helps at
 * the table on a Tuesday.
 *
 * Each item is:
 *   q      the question, shortened — enough to find it, not the whole thing
 *   look   what a good answer HAS. Substance, never wording, and never length
 *   thin   what a not-yet answer looks like — a real one, in a child's voice
 *   ask    the ONE follow-up. Exactly one, so it gets used
 *   strong (optional) what an unusually good answer does, so an adult can
 *          recognize it rather than mark it merely acceptable
 *
 * `dont` is the sheet-level line about what not to correct, and it defaults to
 * the one that matters most: red pen on the spelling of a thinking answer
 * teaches the child that the spelling was the point.
 */
const guidePage = ({
  title,
  sub,
  items,
  dont = 'Don\'t mark spelling, handwriting or grammar here, or the next answer will be shorter and safer.',
  footL = '',
  footR = '',
}) =>
  page({
    badge: 'What a Good Answer Looks Like — Parent Copy',
    title,
    sub,
    cls: 'key',
    body: `<div class="note" style="margin-top:2px"><b>No right answers here.</b> Each question shows what a
  good answer has, and one follow-up to ask if it isn't there yet. Ask it once, then stop.</div>

  <div class="note" style="margin-top:8px">${rich(dont)}</div>

  <ol class="guide" style="margin-top:12px">${items
    .map(
      (it) => `<li>
      <div class="gq">${rich(it.q)}</div>
      <div class="glook"><b>Looking for:</b> ${rich(it.look)}</div>
      <div class="gthin"><b>Not yet:</b> ${rich(it.thin)}</div>
      <div class="gask"><b>Ask:</b> ${rich(it.ask)}</div>
      ${it.strong ? `<div class="gstrong"><b>Unusually good:</b> ${rich(it.strong)}</div>` : ''}
    </li>`
    )
    .join('')}</ol>`,
    footL,
    footR,
  });

/* A key laid out as a numbered list instead of a grid — for written answers
 * that are sentences rather than numbers. */
const keyListPage = ({ title, sub, items, footL = '', footR = '' }) =>
  page({
    badge: 'Answer Key — Parent Copy',
    title,
    sub,
    cls: 'key',
    body: `<ol class="qs keylist">${items
      .map(
        (it) =>
          `<li><span class="qt">${rich(typeof it === 'string' ? it : it.a)}</span>${
            typeof it === 'object' && it.why
              ? `<span class="why">${rich(it.why)}</span>`
              : ''
          }</li>`
      )
      .join('')}</ol>`,
    footL,
    footR,
  });

/* --------------------------------------------------------------------- CSS */

/*
 * The palette is the subject's — see lib/palette.js for which and why. It is
 * resolved once, when the generator loads, from the pack the generator lives
 * in.
 */
const { paletteCSS, subjectOfCaller } = require('./palette');
const PALETTE = paletteCSS(subjectOfCaller());

const CSS = `
  /* Page margins live HERE only — body padding stays 0 for print so the two
     don't stack and eat the sheet. */
  @page { size: letter portrait; margin: 0.45in 0.5in; }

  /*
   * THE PALETTE. The same one the shop wears (kitchen-table/BRAND.md): warm
   * near-black ink, one accent, pine kept back for the answer key.
   *
   * WHY A SHEET HAS COLOR AT ALL. Every sheet was pure grayscale — #000 rules,
   * #333 subtitles, #f0f0f0 boxes — which is what you get by never deciding.
   * The paper is the product and it looked like a fax. A printer set to
   * grayscale, or one that has no color to give, renders all of this as the
   * greys it already had, so nothing below costs a parent anything they were
   * not already spending.
   *
   * WHAT STAYS BLACK, ON PURPOSE:
   *   - anything drawn to be written on (rules, name lines, answer boxes)
   *   - anything drawn to be traced or colored in (line art, letter guides)
   *   - the confidence rings, which have to survive a mono laser
   * Color marks the sheet's own furniture — its rule, its numbering, its
   * boxes — and never the part a child puts a pencil through.
   */
  ${PALETTE}

  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }

  body {
    font-family: var(--font);
    color: #000; background: #fff;
    font-size: 12pt; line-height: 1.3;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }

  /* ORDER MATTERS. This generic rule must come BEFORE the @media screen block:
     same specificity, so whichever is declared last wins. With it after, the
     on-screen preview stretches to the viewport instead of 8.5in — print is
     unaffected, but the proof you check before printing is wrong. */
  .page { width: 100%; }
  .page + .page { page-break-before: always; }

  @media screen {
    body { padding: 0.5in; background: #ddd; }
    .page {
      background: #fff; padding: 0.45in 0.5in;
      width: 8.5in; min-height: 11in;
      margin: 0 auto 24px; box-shadow: 0 2px 10px rgba(0,0,0,.3);
    }
  }

  /* ------------------------------------------------------------- header */
  header { border-bottom: 3px double var(--accent); padding-bottom: 6px; }
  header.cont { border-bottom: 1px solid var(--rule); }
  h1 { font-size: 16pt; margin: 0 0 1px; letter-spacing: .01em; }
  .sub { font-size: 10pt; font-style: italic; color: var(--muted); margin: 0; }

  .nameline { display: flex; gap: 26px; font-size: 10.5pt; margin: 11px 0 12px; }
  .nameline span { flex: 1; border-bottom: 1px solid var(--ink); padding-bottom: 1px; }
  .nameline span.short { flex: 0 0 1.9in; }

  .directions {
    font-size: 10.5pt; line-height: 1.35;
    background: var(--tint); border-left: 4px solid var(--accent);
    padding: 7px 10px; margin: 12px 0 14px;
  }
  .directions b { letter-spacing: .03em; }
  .tip { font-style: italic; margin-top: 3px; }

  /* ------------------------------------------------- problems and grids */
  .grid { display: grid; gap: 13px 16px; margin-top: 4px; }
  .prob { page-break-inside: avoid; display: flex; gap: 5px; align-items: flex-start; }
  .pn { font-weight: bold; font-size: 11pt; min-width: .28in; flex: 0 0 auto; color: var(--accent); }
  .pbody { flex: 1; min-width: 0; }

  /* Digits need lining figures and even widths whatever the body font is. */
  .num, .vert, .horiz { font-family: ${FONT_MATH}; font-variant-numeric: lining-nums tabular-nums; }

  /* A stacked column algorithm.
     Two grid columns — operator, then digits — because a floated or absolutely
     positioned operator overlaps the digits as soon as the numbers get wide,
     and "324" with a + sitting on the 3 is unreadable. The grid also lets the
     rule under the last operand span BOTH columns, which is how it is written
     by hand. The rule is heavy: it is the line you write the answer beneath. */
  .vert {
    display: inline-grid; grid-template-columns: auto auto;
    font-size: 15pt; line-height: 1.3; text-align: right;
  }
  .vert > span { padding: 0 0 1px 0; }
  .vert .op { text-align: left; padding-right: .16in; }
  .vert .last { border-bottom: 2.5px solid var(--ink); padding-bottom: 3px; }
  .vert .ans { height: .4in; }
  /* Partial-products working, for 2-digit x 1-digit before the short method. */
  .vert .part { font-size: 11pt; color: var(--muted); }
  /* A row of worked examples that fade — see lib/formats.js faded(). The
     caption is what makes the fade legible: without it the third one looks like
     a question somebody forgot to number. */
  .egrow { display: flex; gap: .34in; align-items: flex-start; margin: 0 0 4px; }
  .eg { display: inline-flex; flex-direction: column; align-items: center; gap: 2px; }
  .eglab { font-size: 8.5pt; color: var(--slate); letter-spacing: .02em; }

  /* The carried digits. Small and grey so the sum still reads as the sum, and
     tight to the row below it so a carry sits ON the column it goes into. */
  .vert .carry { font-size: 9pt; color: var(--slate); line-height: 1; padding: 0 0 1px 0; }

  .horiz { font-size: 14pt; white-space: nowrap; }

  /* Row numbers in a word list. Gray and small: they are there so a list can be
     dictated ("number seven") and marked without counting down the page, and
     they must not compete with the word itself. */
  .wn { color: var(--muted); font-size: 9pt; }

  /* The box an answer goes in. inline-block so it can sit mid-sentence. */
  .abox {
    display: inline-block; border: 1.6px solid var(--slate); border-radius: 3px;
    vertical-align: middle; margin: 0 3px; position: relative; background: #fff;
  }
  /* Scoped to the box: as a bare ".alab" it pinned any generator's own .alab
     to the bottom of the page (life-07-signs-and-forms 40, 2026-09-24). */
  .abox > .alab {
    position: absolute; bottom: 1px; left: 0; right: 0;
    text-align: center; font-size: 7pt; color: var(--muted); font-style: italic;
  }

  /* Confidence marks. The rings are drawn with a border and a gradient rather
     than an SVG so they stay inline with the question text at any font size,
     and print black on a mono laser without relying on a background image. */
  .conf { float: right; margin: 2px 0 0 8px; white-space: nowrap; }
  .cring {
    display: inline-block; width: 11px; height: 11px; margin-left: 4px;
    border: 1.4px solid var(--slate); border-radius: 50%; vertical-align: middle;
  }
  .cring-full { background: var(--accent); }
  .cring-half { background: linear-gradient(90deg, var(--accent) 50%, #fff 50%); }
  .cring-none { background: #fff; }
  ol.qs.hasconf li { overflow: hidden; }

  .conflegend {
    border: 1.2px solid var(--rule); border-radius: 4px;
    padding: 3px 8px; margin: 0 0 7px;
    font-size: 8.5pt; color: var(--muted); display: flex; gap: 14px; align-items: center;
  }
  .conftitle { font-weight: 700; color: var(--ink); }
  .confitem { white-space: nowrap; }

  .work {
    border: 1.4px dashed var(--rule); border-radius: 4px;
    margin: 6px 0 2px; position: relative;
  }
  /* The label S.work() puts in the box: a DIRECT child only. As ".work span"
     it also caught every span inside any generator's own .work content and
     stacked them all at the top-left corner (math-11-grade6 47, 2026-09-23). */
  .work > span {
    position: absolute; top: 3px; left: 6px;
    font-size: 8pt; color: var(--muted); font-style: italic;
  }

  /* ------------------------------------------------------ writing lines */
  /* Primary rule: solid top, dashed midline, heavy baseline. Capitals reach
     the top line, lowercase bodies sit under the dashed one. */
  .write {
    position: relative; height: ${RULE_H};
    margin: 6px 0 0 .3in;
    border-top: 1px solid var(--rule); border-bottom: 2px solid var(--ink);
  }
  .write.flush { margin-left: 0; }
  .write + .write { margin-top: .17in; }
  .write::after {
    content: ""; position: absolute; left: 0; right: 0; top: 50%;
    border-top: 1px dashed var(--guide);
  }

  /* ------------------------------------------------------- question list */
  ol.qs { margin: 0; padding: 0 0 0 .34in; }
  ol.qs li { margin-bottom: 13px; page-break-inside: avoid; }
  ol.qs li::marker { font-weight: bold; font-size: 11pt; color: var(--accent); }
  .qt { display: block; }

  .mcq { display: grid; gap: 3px 14px; margin: 5px 0 2px .12in; font-size: 11pt; }
  .opt { white-space: nowrap; }

  /* -------------------------------------------------------------- tables */
  .tbl { border-collapse: collapse; margin: 8px 0; font-size: 11pt; width: 100%; }
  .tbl th, .tbl td { border: 1.4px solid var(--ink); padding: 5px 8px; text-align: left; }
  .tbl th { color: var(--slate); }
  .tbl th { background: var(--tint); font-size: 10pt; letter-spacing: .02em; }
  .tbl td.blank { height: .34in; }
  .tbl.narrow { width: auto; }
  .tbl.center td, .tbl.center th { text-align: center; }

  /* ------------------------------------------------------------ passages */
  .passage {
    border: 1.5px solid var(--slate); border-radius: 4px;
    padding: 11px 14px; margin-bottom: 12px;
    font-size: 11.5pt; line-height: 1.55;
  }
  .passage h2 { font-size: 13pt; margin: 0 0 6px; color: var(--deep); }
  .passage p { margin: 0 0 8px; }
  .passage p:last-child { margin-bottom: 0; }
  .passage .byline { font-size: 9.5pt; font-style: italic; color: var(--muted); margin-bottom: 8px; }
  /* Numbered paragraphs, so a question can say "in paragraph 2". */
  .passage p.np { position: relative; padding-left: .3in; }
  .passage p.np::before {
    content: attr(data-p); position: absolute; left: 0; top: 0;
    font-size: 9pt; color: var(--accent); font-weight: bold;
  }

  .wordbank {
    border: 1.5px dashed var(--slate); border-radius: 4px;
    padding: 8px 12px; margin: 10px 0 12px;
    font-size: 11.5pt; text-align: center;
  }
  .wordbank b { display: block; font-size: 9.5pt; letter-spacing: .06em;
    text-transform: uppercase; margin-bottom: 4px; color: var(--accent); }
  .wordbank span { display: inline-block; margin: 2px 11px; }

  .note {
    border-left: 4px solid var(--deep); background: var(--tintdeep);
    padding: 7px 11px; margin: 10px 0; font-size: 10.5pt;
  }
  .note b { letter-spacing: .02em; }

  /* -------------------------------------------------------------- footer */
  /* THE WORDMARK SITS IN THE FOOTER THAT WAS ALREADY THERE, so it costs no
     height at all — a sheet that fitted before fits now. Upright where the rest
     of the line is italic, and a size down: it is a signature, not a message,
     and it must never compete with "Score: ___ / 10". */
  .brand { font-style: normal; font-size: 7.5pt; letter-spacing: .04em;
    color: var(--accent); align-self: center; }

  footer {
    margin-top: 14px; padding-top: 6px; border-top: 1px solid var(--rule);
    font-size: 9pt; font-style: italic; color: var(--muted);
    display: flex; justify-content: space-between;
  }

  /* ---------------------------------------------------------- answer key */
  .keybadge {
    display: inline-block; border: 2px solid var(--deep); color: var(--deep); padding: 2px 9px;
    font-size: 9.5pt; font-weight: bold; letter-spacing: .08em;
    text-transform: uppercase; margin-bottom: 6px;
  }
  .key .why {
    display: block; font-size: 9pt; font-style: italic; color: var(--muted); margin-top: 1px;
  }
  /* Highlight rather than underline: <u> in a key marks WHAT CHANGED, and an
     underline under a comma is invisible. */
  .key u { text-decoration: none; background: var(--tint); padding: 0 2px; font-weight: bold; }
  .keygrid .pbody { font-family: ${FONT_MATH}; font-size: 12pt; }
  /* A key's pictures scale to their column: at 1fr a wide drawing pushed a
     three-column key 92px off the paper (art-04-drawing 10, 2026-09-24). */
  .keygrid svg { max-width: 100%; height: auto; }
  .keylist .qt { font-weight: normal; }

  /*
   * The guide page. Four lines per question, and the ASK line is the one that
   * gets used at the table, so it is the one with a rule beside it — a parent
   * scanning this page in ten seconds should land on the follow-up question
   * and nothing else.
   */
  .guide { padding-left: .3in; }
  .guide li { margin-bottom: 11px; page-break-inside: avoid; }
  .guide .gq { font-weight: bold; font-size: 11pt; margin-bottom: 3px; }
  /* 9pt, matching the key's own why line, because the guide page is the
     binding constraint on every open sheet: four lines per question against a
     key's one, and at 10pt a sheet with seven questions ran onto a second
     side. Found by measuring, not chosen. (No backticks in here — this CSS
     lives inside a template literal and one would close it.) */
  .guide .glook, .guide .gthin, .guide .gstrong {
    font-size: 9pt; line-height: 1.3; margin-top: 1px;
  }
  .guide .gthin { color: var(--muted); }
  .guide .gstrong { color: var(--muted); font-style: italic; }
  .guide .gask {
    font-size: 9.5pt; line-height: 1.3; margin-top: 3px;
    border-left: 3px solid var(--slate); padding-left: 7px;
  }
  .key .qs li { margin-bottom: 9px; }

  /*
   * INLINE-BLOCK, NOT BLOCK, AND THIS WAS WRONG FOR A LONG TIME. A block-level
   * svg ignores text-align: center on its parent and sits flush left — so 117
   * sheets across 35 packs said "centre this diagram" and got a left-aligned
   * one. Twenty-five of them were origami and paper-plane fold sequences, where
   * the whole page is diagrams.
   *
   * Nobody spotted it because a left-flush diagram looks deliberate; it only
   * reads as wrong next to a centered one, and no sheet has both.
   *
   * inline-block makes text-align do what every one of those authors meant,
   * and leaves a diagram in a left-aligned container exactly where it was.
   * vertical-align: top kills the baseline gap that inline elements otherwise
   * leave underneath them, which would have pushed long pages over.
   */
  svg { display: inline-block; vertical-align: top; }
  svg.inline { vertical-align: middle; }
`;

/*
 * Wrap pages into a document.
 *
 *   font   'text' (Georgia — reading, science, social) or
 *          'math' (lining figures — anything built out of digits)
 *
 *   kind   what sort of sheet this is. Emitted as a <meta> tag, which is how
 *          check.js decides whether an answer key is required:
 *
 *            'worksheet'  (default) questions to answer — MUST have a key
 *            'game'       rules and a board; nothing to mark
 *            'reference'  a chart or checklist to keep
 *            'form'       a blank template to fill in repeatedly
 *
 *          This used to be a filename regex in check.js (/chart|blank|-log/…),
 *          which meant a sheet could opt out of being checked by accident, just
 *          by being named badly. Declaring it in the document is a decision the
 *          author makes on purpose and the checker can read.
 */
const { endDocument } = require('./seed');

/*
 * `open` is a sheet whose questions have no settled answers but do have better
 * and worse ones. It carries a guidePage instead of a keyPage, and check.js
 * requires that page exactly as strictly as it requires a key — the point of
 * adding a kind rather than reusing `form` is that `form` means "nothing to
 * say to the parent", and these sheets have a great deal to say.
 */
const SHEET_KINDS = new Set(['worksheet', 'game', 'reference', 'form', 'open']);

/*
 * TURNING THE PAPER, for the sheets whose content is one wide thing.
 *
 * Almost everything on this shelf is portrait and should stay so — a worksheet
 * with questions down it reads better tall, and long lines are harder for a
 * child to track. But a number line, a timeline and a fraction strip are each
 * ONE long object, and folding them into stacked rows is a compromise nobody
 * chose. See queue/LANDSCAPE-SCOPE.md for what qualifies and what does not.
 *
 * BOTH BOXES HAVE TO TURN. `@page` is what the printer obeys; the `@media
 * screen` block is what the on-screen proof shows. Turn only one and the proof
 * lies about what comes out of the printer — which is the failure the note at
 * the top of this file's CSS already warns about for margins.
 *
 * Drop the result into a sheet's own `css`, which lands after this file's, so
 * it overrides rather than races. lib/prek/paper.js carries the same helper for
 * the packs built on that skeleton.
 */
const landscapeCSS = (margin = 0.4) => `
  @page { size: letter landscape; margin: ${margin}in; }
  @media screen {
    .page { width: 11in; min-height: 8.5in; padding: ${margin}in; }
  }
`;

/*
 * COLOR IS A DECLARATION, NOT A DEFAULT — and the reason is the printer.
 *
 * `lib/draw.js` says it at the top: the printer in the house is a mono laser.
 * On one of those a red line and a green line come out as two similar greys,
 * so a sheet that teaches WITH color becomes unreadable at exactly the moment
 * color was doing the work. Everything on this shelf is therefore black on
 * white, and the two packs where color matters push it off the page instead:
 * art-04-drawing's color group is titled "Color, Which You Have To Supply", and
 * the cabbage test names the ends of its scale in words because the color is
 * in the glass on the table rather than in the ink.
 *
 * SO THERE IS EXACTLY ONE CASE LEFT: content where color IS the subject and
 * cannot be supplied by the child or seen in the world. Light mixing is the
 * example that forced this flag — red and green light make yellow, which no
 * child can discover with pencils, cannot see in the kitchen, and cannot be
 * shown in gray.
 *
 * Passing `colour: true` stamps the sheet so check.js can hold the line: any
 * SATURATED color on a page a child gets must be declared here. Answer keys
 * are exempt — those are a parent copy, and a gray highlight still highlights.
 *
 * Declaring it does not excuse the sheet from working in gray. The rule that
 * cannot be automated, and is in queue/CONVENTIONS.md instead: every color a
 * sheet prints must also be NAMED in words on the same page, so a mono print
 * degrades to a usable sheet rather than a broken one.
 */
const doc = (title, pages, { font = 'text', css = '', kind = 'worksheet', colour = false } = {}) => {
  if (!SHEET_KINDS.has(kind)) {
    throw new Error(`doc("${title}"): unknown kind "${kind}" — use one of ${[...SHEET_KINDS].join(', ')}`);
  }
  /* Closes this sheet's randomness window, so the next sheet's footer is judged
   * on its own draws rather than on this one's. See seedTag() in lib/seed.js. */
  endDocument();

  /*
   * "KEEP GOING ON PAGE 2 →" WAS COPY-PASTED, AND 29 SHEETS TOLD A CHILD TO TURN
   * TO THE WRONG PAGE. Every generator wrote the number by hand, so cloning a
   * page to make page 3 carried "page 2" along with it — page 2 of Same Start
   * says keep going on page 2, page 3 of the color wheel says page 3, and one
   * social studies sheet sends the reader from page 2 to page 5. Nobody spotted
   * it because it is right on page 1 of everything, which is the page anybody
   * checks.
   *
   * The number is not a thing to be authored. doc() is the only place that knows
   * the running order, so it is the only place that can be right, and it now
   * overwrites whatever the generator guessed. A sheet's last page saying "keep
   * going" is a different bug — there is nowhere to go — so that one throws.
   */
  /*
   * AND THE PAGE NUMBERS THEMSELVES HAVE TO RUN 1, 2, 3. Fixing the "keep going"
   * pointers left five that still disagreed, and those turned out to be worse
   * than a wrong arrow: Solid, Liquid, Gas was assembled [p1, p2, p2b, p2c] with
   * p2 labeled page 3 and p2b labeled page 2, so the sheet printed its pages
   * in the order 1, 3, 2, 4 — the continuation of page 1 came after the topic it
   * continues into. Who To Tell had a page labeled "Page 3 of 3" in a
   * four-page sheet, copy-pasted from the form sheet above it.
   *
   * Both had been on the shelf for months. Nobody reads page 3's own header; you
   * read page 1 and then turn over. So the running order is checked here, where
   * it is knowable, rather than trusted to whoever named the variables.
   */
  /* NOT "the numbers run 1, 2, 3" — that was the first version of this rule and
   * it was wrong, which is worth recording because it is the failure this shelf
   * keeps making. It threw out Five Cards, whose page 1 is a sheet of cards to
   * cut out and carries "Cut these out first" instead of a number, and the
   * writing bank, which opens the same way. Both were correct and the checker
   * was not. The rule that is actually true is that a number, WHERE THERE IS
   * ONE, has to match where the page really sits. */
  const marks = pages.map((p) => /Page (\d+) of (\d+)/.exec(p));
  const totals = new Set(marks.filter(Boolean).map((m) => m[2]));
  if (totals.size > 1)
    throw new Error(
      `doc("${title}"): pages disagree about how many there are — ${[...totals].join(' and ')}`
    );
  marks.forEach((m, i) => {
    if (m && Number(m[1]) !== i + 1)
      throw new Error(
        `doc("${title}"): the page headed "Page ${m[1]} of ${m[2]}" is actually page ${i + 1} — ` +
          `either the array passed to doc() is out of order, or the header was copy-pasted`
      );
  });

  /* A page with no number, sitting between two that have one, is a header
   * somebody forgot: the child turns from page 2 to a page that does not say
   * what it is and then to page 4. An unnumbered page BEFORE the numbering
   * starts (a cut-out sheet) or after it ends (the key) is normal. */
  const first = marks.findIndex(Boolean);
  const last = marks.length - 1 - [...marks].reverse().findIndex(Boolean);
  if (first !== -1)
    for (let i = first; i <= last; i++)
      if (!marks[i])
        throw new Error(
          `doc("${title}"): page ${i + 1} of ${pages.length} has no "Page n of m" header but the ` +
            `pages either side of it do — the numbering skips over it`
        );

  const numberOf = (p) => {
    const m = /Page (\d+) of \d+/.exec(p);
    return m ? Number(m[1]) : null;
  };
  pages = pages.map((p, i) => {
    if (!/Keep going on page \d+/.test(p)) return p;
    if (i === pages.length - 1)
      throw new Error(
        `doc("${title}"): the last page says "keep going" and there is no page after it`
      );
    const next = numberOf(pages[i + 1]) ?? i + 2;
    return p.replace(/Keep going on page \d+/g, `Keep going on page ${next}`);
  });
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="sheet-kind" content="${kind}">${colour ? '\n<meta name="sheet-color" content="yes">' : ''}
<title>${esc(title)}</title>
<style>
  :root { --font: ${font === 'math' ? FONT_MATH : FONT_TEXT}; }
${CSS}${css}
</style>
</head>
<body>

${pages.join('\n\n')}

</body>
</html>
`;
};

/*
 * Write a file and report it the same way every generator does, so `node
 * build.js` output reads as one list rather than five different formats.
 */
function emit(fs, path, outDir, name, html, note = '') {
  fs.writeFileSync(path.join(outDir, name), html);
  console.log(`${name.padEnd(34)} ${note}`);
}

/*
 * THE PLAN OF A SHEET, AS STEPS YOU CAN SEE — Wil, 2026-09-22: "Most of the
 * sheets are not intuitive. It's read a whole lot of instructions to figure
 * out what the heck to do."
 *
 * A sheet whose first page is for READING — a story, a passage, a teaching
 * page — used to say so only in its directions line and its footer, which is
 * exactly the text nobody reads before deciding what a page is. This puts the
 * order of the sheet at the top as numbered steps, so a glance answers "what
 * do I do with this": read it, then turn over.
 *
 * INLINE STYLES, NOT A NEW CLASS IN CSS. The shared stylesheet is embedded in
 * every sheet on the shelf, so a rule added there changes 1,800 files that do
 * not use it. The one class, `plan`, is there to be FOUND — pageone.js reads a
 * page carrying it as a signposted reading page rather than a page with
 * nothing to do.
 *
 *   plan(['Read the story out loud, twice', 'Draw it in the box', 'Turn over: 4 questions'])
 */
const plan = (steps) =>
  `<div class="plan" style="display:flex;align-items:stretch;gap:.08in;margin:.02in 0 .1in">${steps
    .map(
      (s, i) =>
        `${i ? '<div style="align-self:center;font-size:16pt;font-weight:700;color:var(--ink)">&rarr;</div>' : ''}` +
        `<div style="flex:1;display:flex;align-items:center;gap:.07in;border:1.8px solid var(--ink);border-radius:5px;padding:.05in .08in">` +
        `<span style="flex:0 0 auto;display:inline-block;width:.26in;height:.26in;line-height:.26in;border-radius:50%;background:var(--ink);color:#fff;text-align:center;font-weight:700;font-size:11pt">${i + 1}</span>` +
        `<span style="font-size:10.5pt;font-weight:700;line-height:1.2">${s}</span></div>`
    )
    .join('')}</div>`;

module.exports = {
  plan,
  PALETTE,
  landscapeCSS,
  FONT_TEXT,
  FONT_MATH,
  RULE_H,
  esc,
  rich,
  nameline,
  directions,
  writeLines,
  answerBox,
  confidence,
  confidenceLegend,
  vert,
  workspace,
  mcq,
  grid,
  questions,
  table,
  page,
  keyPage,
  keyListPage,
  guidePage,
  doc,
  emit,
  CSS,
};

},
"src/gen/packs/lib/brand.js": function(module, exports, require){
/*
 * brand.js — who made this sheet, in one place.
 *
 * WHY THE SHEETS SAY A NAME AT ALL. A worksheet is the rare thing in this
 * business that travels on its own: it goes home in a bag, gets photocopied by
 * a teacher who liked it, gets handed to another parent at a table. Every one
 * of those journeys was anonymous — of 1,363 sheets exactly one said where it
 * came from — so the cheapest distribution the shelf has was printing nothing.
 *
 * WHY IT IS ONE LINE AND NOT A LOGO. The mark is a good mark, but a mark on
 * 4,896 printed sides is decoration a parent pays for in toner, and it dates
 * faster than the name does. A wordmark in the footer costs a fifth of a line
 * that was already there.
 *
 * WHY NO URL YET. There is no domain. kitchen-table/PLAN.md lists four
 * candidates, all unverified, and build.js still has SITE = ''. A name can be
 * changed in this file and rebuilt; a wrong web address printed on a thousand
 * sheets and pressed into a KDP paperback cannot be changed at all. The line
 * below is ready for it — fill URL in the day the domain is real.
 *
 * RENAMING IS ONE EDIT. Everything on the shelf is generated, so the name is
 * not typed anywhere else: change NAME here, run build.js, and 1,363 sheets
 * say the new thing. That is the whole reason it lives in a module.
 */

const NAME = 'Kitchen Table';
const URL = ''; // e.g. 'kitchentableworksheets.com' — see kitchen-table/PLAN.md

/* Name, then the address if there is one. Kept to a single short string so it
 * can sit in a footer slot without changing the height of the line. */
const brandLine = () => (URL ? `${NAME} · ${URL}` : NAME);

module.exports = { NAME, URL, brandLine };

},
"src/gen/packs/lib/palette.js": function(module, exports, require){
/*
 * palette.js — the ink a sheet is printed in, and the one place it is decided.
 *
 * WHY MORE THAN ONE. The shelf started with a single accent, which is right for
 * a web page that uses it three times and wrong for a worksheet that has a
 * hundred borders on it: one hue everywhere is not a palette, it is a tint, and
 * a wall of orange sheets is what that looks like at 1,363.
 *
 * WHY BY SUBJECT. It has to vary by something, and subject is the something a
 * parent already sorts by — the math pile, the reading pile. A shelf where
 * every math sheet is one color and every science sheet another is easier to
 * hand out at a table, easier to find in a drawer, and tells you what you are
 * holding before you have read a word of it. Level would change under a child
 * as they grow; pack would give ninety-nine colors, which is none.
 *
 * WHAT DOES NOT VARY. Ink, the warm greys, the writing guides, the slate of the
 * frames and the pine of the answer key are the same on every sheet — they are
 * the paper's furniture, not its subject. Only the accent moves, so two sheets
 * from different subjects are recognisably the same shelf.
 *
 * AND THE ACCENT DOES NOT DO EVERYTHING. On a math sheet the top rule, the
 * directions, the numbering and the word bank were all the accent, which made
 * the page orange rather than a page with an orange accent on it. The roles are
 * split now: the accent is the sheet's own voice — its rule and its numbering —
 * slate is what the sheet is built out of, and pine is anything addressed to
 * the grown-up. Three hues on a page, each meaning something different, and one
 * of them changing by subject.
 *
 * PRINTING. These are chosen for a color laser: each is dark enough to hold a
 * hairline, and they land on distinguishably different greys on a mono printer,
 * which is a fallback getting better rather than a design constraint. Every one
 * is a permitted ink in check.js — which reads INKS below rather than keeping
 * its own list, because two lists is one disagreement.
 */

/* Shared by every sheet on the shelf. */
const BASE = {
  ink: '#16130F', // text — warm near-black, never #000
  muted: '#6B635A', // secondary text
  rule: '#CFC3B2', // hairlines
  guide: '#BCAE9C', // the dashed midline a child writes across
  slate: '#2E5A78', // structure — frames, boxes, and the directions
  tintslate: '#E9EFF4', // slate at a whisper
  deep: '#2C4A45', // the grown-up's page: keys, notes
  tintdeep: '#ECF1EF',
};

/*
 * One accent per subject, and a tint of it for filled boxes. The tint is the
 * accent at about 12% on white — light enough to print without swallowing the
 * text on top of it, strong enough to read as a fill rather than a smudge.
 */
const SUBJECTS = {
  math: { accent: '#C0511D', tint: '#F7EDE4' }, // burnt orange — the house color
  english: { accent: '#7B3B5E', tint: '#F6EBF1' }, // plum
  science: { accent: '#1E6E6E', tint: '#E6F1F1' }, // teal
  social: { accent: '#3B4E8C', tint: '#EAEDF7' }, // indigo
  life: { accent: '#5C6B2F', tint: '#EFF2E6' }, // olive
  quiet: { accent: '#8A5A2B', tint: '#F5EDE4' }, // warm brown, for the quiet pages
};

/*
 * A pack says its subject in pack.js, and says it in its own word: "reading",
 * "grammar", "cursive", "geology", "origami". Forty-six of them, which is not a
 * palette — so each maps onto one of the six above. The list is written out
 * rather than guessed at from the word, because "water" is science, "money" is
 * life skills and "table" is a games pack, and no rule short of reading them
 * gets that right.
 */
const OF_SUBJECT = {
  /* Math */
  math: 'math', manipulatives: 'math', time: 'math', 'Where to start': 'math', Math: 'math',
  /* English — anything made of words */
  reading: 'english', english: 'english', grammar: 'english', writing: 'english',
  literacy: 'english', words: 'english', print: 'english', cursive: 'english',
  sound: 'english', anybook: 'english', English: 'english', Writing: 'english',
  /* Science */
  science: 'science', chemistry: 'science', weather: 'science', water: 'science',
  light: 'science', geology: 'science', astronomy: 'science', body: 'science',
  food: 'science', Science: 'science',
  /* Social studies — people, places and the past */
  social: 'social', world: 'social', history: 'social', geography: 'social',
  'Social studies': 'social',
  /* Life skills — running a life, and how to think */
  money: 'life', schedule: 'life', everyday: 'life', thinking: 'life', logic: 'life',
  online: 'life', how: 'life', work: 'life', guide: 'life', hunt: 'life', 'Life skills': 'life',
  Learning: 'life',
  /* Quiet pages — the ones with no lesson in them */
  pictures: 'quiet', scenes: 'quiet', pages: 'quiet', drawing: 'quiet', crafts: 'quiet',
  origami: 'quiet', paper: 'quiet', planes: 'quiet', games: 'quiet', table: 'quiet',
  inside: 'quiet', Music: 'quiet', Anytime: 'quiet', 'Quiet pages': 'quiet',
};

const keyFor = (subject) => OF_SUBJECT[subject] || (SUBJECTS[subject] ? subject : 'math');

/* The :root block a sheet's stylesheet opens with. */
function paletteCSS(subject) {
  const s = SUBJECTS[keyFor(subject)];
  return `:root {
    --ink:    ${BASE.ink};
    --muted:  ${BASE.muted};
    --rule:   ${BASE.rule};
    --guide:  ${BASE.guide};
    --accent: ${s.accent};
    --tint:   ${s.tint};
    --slate:  ${BASE.slate};
    --tintslate: ${BASE.tintslate};
    --deep:   ${BASE.deep};
    --tintdeep: ${BASE.tintdeep};
  }`;
}

/*
 * WHICH PACK IS ASKING. A generator lives in its pack's folder and is run by
 * path, so its own argv says where it is; pack.js beside it says what subject
 * it teaches. Reading it here means the 562 generators did not each have to be
 * told to pass a subject through, and a new pack gets its color by existing.
 */
function subjectOfCaller() {
  /*
   * AN EXPLICIT SUBJECT WINS, and exists because argv is not always there.
   *
   * Reading the caller's path is right when a generator is a script run by
   * build.js, and impossible anywhere else: a harness that requires the
   * generator leaves argv[1] pointing at itself, and on a phone there is no
   * argv at all. Both cases quietly fell back to the house orange, which is a
   * wrong sheet that looks like a right one.
   *
   * So a caller that knows the subject can say so. Nothing in the shelf's own
   * build sets this, and the path-reading below is unchanged for it.
   */
  const told = globalThis.__WORKSHEET_SUBJECT;
  if (typeof told === 'string' && told) return told;

  try {
    const path = require('path');
    const fs = require('fs');
    const dir = path.dirname(process.argv[1] || '');
    const pack = path.join(dir, 'pack.js');
    /*
     * module.require, NOT require. Both do the same thing in Node, but a bare
     * `require(variable)` is a static-resolution error for a bundler — Metro
     * refuses the whole file, which stops the app carrying generators at all.
     * The indirection is invisible to Node and unparseable to the bundler,
     * which is exactly what is wanted: the branch is dead on a phone anyway,
     * because the subject is passed explicitly above.
     */
    if (fs.existsSync(pack)) return module.require(pack).subject || '';
  } catch (e) {
    /* No pack, no subject, house color. Never a reason to fail a build. */
  }
  return '';
}

/*
 * THE ACCENT ON ITS OWN, for the things that are drawn rather than styled.
 *
 * An SVG attribute cannot read a CSS variable, so the letter a child traces and
 * the dot they start it from need the color itself. They were given the house
 * orange as a literal, which meant every pre-K literacy sheet — an ENGLISH
 * sheet, plum — printed a page of orange letters, and the subject palette said
 * one thing while the biggest mark on the paper said another.
 */
function accentFor(subject) {
  return SUBJECTS[keyFor(subject)].accent;
}

/* The accent of whichever pack is generating right now. */
function currentAccent() {
  return accentFor(subjectOfCaller());
}

/* Every accent, for check.js — the saturated hues a child's page may carry. */
const INKS = [...new Set([...Object.values(SUBJECTS).map((s) => s.accent), BASE.slate, BASE.deep])];

module.exports = { BASE, SUBJECTS, paletteCSS, subjectOfCaller, accentFor, currentAccent, INKS };

},
"src/gen/packs/lib/seed.js": function(module, exports, require){
/*
 * seed.js — one knob that re-rolls every randomised sheet, in every pack.
 *
 *   node build.js                 the default set, byte-identical every time
 *   node build.js --seed 7        a completely fresh set of puzzles
 *   WORKSHEET_SEED=7 node build.js   same thing via the environment
 *
 * The sheets that use this are the ones with generated content rather than
 * authored content: letter hunts, shape hunts, odd-one-out, b/d grids,
 * patterns, missing-number sequences, count-and-write, and — in the grade 3
 * packs — every computation drill, fact grid and number-line sheet.
 *
 * Two properties worth keeping:
 *
 * 1. DETERMINISM. A given seed always produces the same files, so a rebuild
 *    with no flag never silently churns the folder, and a diff means a real
 *    change rather than reshuffled noise.
 *
 * 2. INDEPENDENT STREAMS. Each generator derives its own stream from the
 *    master seed by name, so adding a shuffle to one file cannot shift the
 *    output of another. Sharing one stream would make every sheet in the
 *    folder change whenever any one of them gained a random call.
 *
 * This file used to live in prek-handwriting/. It moved up to lib/ when the
 * grade 3 packs arrived and needed the same guarantees; prek-handwriting/seed.js
 * is now a one-line re-export so that pack's requires still work unchanged.
 */

const DEFAULT_SEED = 20260803;

function masterSeed() {
  const i = process.argv.indexOf('--seed');
  const raw =
    i > -1 && process.argv[i + 1] !== undefined
      ? process.argv[i + 1]
      : process.env.WORKSHEET_SEED;

  if (raw === undefined || raw === '') return DEFAULT_SEED;

  const v = Number(raw);
  if (!Number.isFinite(v) || v < 0 || !Number.isInteger(v)) {
    console.error(`Bad --seed "${raw}" — use a whole number, e.g. --seed 7`);
    process.exit(1);
  }
  return v >>> 0;
}

/* FNV-1a over the generator's name, mixed with the master seed. */
function seedFor(name) {
  let h = 0x811c9dc5 ^ masterSeed();
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/*
 * How many random numbers this process has drawn, across every stream.
 *
 * It exists to keep seedTag() honest — see below. A counter rather than a
 * boolean because "how much randomness is on this page" is the question you
 * actually want when a sheet surprises you.
 */
let draws = 0;

/*
 * The draw count as at the last completed document.
 *
 * Every generator on this shelf is written the same way — one function per
 * sheet, which computes its data and then returns S.doc(...) — so the random
 * numbers a sheet uses are drawn between the previous doc() and its own. That
 * makes "did the count move since the last document" a per-sheet answer rather
 * than a per-process one, which is the difference between 71 sheets lying and
 * none.
 */
let mark = 0;

/*
 * Draws that belong to every sheet in the file rather than to one of them.
 *
 * A few generators compute all their problem sets at module scope and then emit
 * six sheets from them. Those draws land before the first doc(), so the window
 * rule would credit them to sheet one and leave the rest looking authored — an
 * under-stamp, which is the direction that matters, because a sheet that really
 * did re-roll and does not say so never gets handed back.
 *
 * There is no way to tell that pattern apart from inside here: "draws before
 * the first document" looks identical whether they were for one sheet or for
 * all six. So those generators say so, in one line, right after the shared data
 * is built. `node sets.js` is what finds the ones that need it.
 */
let shared = false;

/* mulberry32 — small, fast, deterministic. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    draws++;
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rngFor = (name) => rng(seedFor(name));

const shuffle = (arr, rand) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/*
 * A SHUFFLE WHERE NOTHING LANDS BACK ON ITS OWN ROW.
 *
 * For a matching exercise, `shuffle` is not good enough and the difference is
 * not cosmetic: shuffle nine things and one or two come back to where they
 * started about as often as not, and each one is a mark a child scores by
 * pointing straight across without reading either column. A sweep of the shelf
 * found thirty-three of them, spread over the pre-K letter and sound sheets,
 * the seasons, the habitats and grade 3's seeds.
 *
 * Two generators already had a local copy of this with a comment explaining
 * why; four others used a plain shuffle for the same job. One copy, here,
 * beside the shuffle it is so easily mistaken for.
 *
 * The rotation at the end is a guaranteed derangement for any length above
 * one, so this always returns something — but it is a fallback, and callers
 * that care should still assert the result rather than trust it.
 */
const derange = (arr, rand) => {
  if (arr.length < 2) return [...arr];
  for (let attempt = 0; attempt < 200; attempt++) {
    const out = shuffle(arr, rand);
    if (out.every((v, i) => v !== arr[i])) return out;
  }
  return arr.map((_, i) => arr[(i + 1) % arr.length]);
};

const isDefaultSeed = () => masterSeed() === DEFAULT_SEED;

/*
 * Printed in the footer of re-rolled sheets. Without it, two printouts of the
 * same worksheet are indistinguishable on paper and you can't tell which set
 * a child has already done.
 *
 * IT USED TO LIE, AND THE LIE WAS EXPENSIVE. Every generator that called this
 * stamped every sheet it emitted, whether or not that sheet contained a single
 * generated number. Measured with `node sets.js` across 680 sheets: 177
 * re-rolled and **383 printed a new set number on a page that was
 * byte-identical to the last one**. That is not a cosmetic problem. The entire
 * point of a set number is that a sheet can be handed back weeks later with
 * different numbers, so the second attempt tests the skill; hand back the same
 * numbers under a new number and it tests whether they remember the answers,
 * which looks exactly like retention and is not.
 *
 * So the stamp is now earned, and it is measured PER SHEET: if no random number
 * was drawn between the end of the last document and the building of this
 * footer, there is no set number. A process-wide counter got that mostly right
 * and left 71 sheets still lying, because a generator emits several sheets and
 * one of them using randomness stamped all of them. Per-document accounting
 * works because every generator here has the same shape — one function per
 * sheet, compute, then return doc() — so a sheet's draws land inside its own
 * window.
 *
 * The remaining way to fool it is a generator that computes every sheet's data
 * up front and emits afterwards: the draws all land before the first doc() and
 * later sheets are UNDER-stamped, which is the worse direction — a sheet that
 * really did re-roll and does not say so. `node sets.js` reports that case on
 * its own, because it knows which sheets actually moved.
 */
const seedTag = () =>
  isDefaultSeed() || (draws === mark && !(shared && draws > 0))
    ? ''
    : ` &middot; set ${masterSeed()}`;

/*
 * "The numbers I just generated are used by every sheet in this file."
 *
 * Call it once, immediately after building problem sets at module scope. From
 * then on every sheet this generator emits carries a set number, because every
 * one of them really does change when the seed does.
 */
const sharedDraws = () => {
  shared = true;
};

/*
 * Called by doc() the moment a document is finished, closing the window that
 * seedTag() measures. Anything drawn after this belongs to the next sheet.
 *
 * A generator that builds every sheet's data up front and only then emits them
 * defeats this — all the draws land before the first doc() and only the first
 * sheet is stamped, which is an UNDER-stamp and the direction that matters.
 * `node sets.js` reports those separately for exactly that reason: it knows
 * which sheets really moved, so it can catch a sheet that changed and did not
 * say so.
 */
const endDocument = () => {
  mark = draws;
};

/* ------------------------------------------------------------ conveniences */
/* The grade 3 generators build problem sets rather than shuffling fixed lists,
 * so they need a few more primitives than the pre-K pack did. */

/* Integer in [lo, hi], inclusive both ends. */
const int = (rand, lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));

/* One element of arr. */
const pick = (rand, arr) => arr[Math.floor(rand() * arr.length)];

/*
 * `count` DISTINCT items produced by fn(). Drills that repeat 6 x 7 three times
 * on one page look like a bug to a child and waste a third of the sheet, so
 * every generated problem set goes through here. key() decides what "distinct"
 * means — usually the problem text.
 *
 * Gives up after a bounded number of attempts and returns what it has, so an
 * over-constrained request (20 distinct facts from a 12-fact pool) degrades to
 * a shorter sheet rather than hanging the build.
 */
/*
 * `ok` is the fourth argument and it exists because of what people did without
 * it: `distinct(6, …).filter(…)`.
 *
 * That reads as "six of these, the ones that qualify" and behaves as "however
 * many of six happened to qualify". Six sheets on this shelf were doing it,
 * and the losses were not small — grade 4's decimals sheet asked for four
 * hundredths and printed four on 69% of seeds, three on 28%, and on one seed
 * in three hundred printed ONE. Grade 3's money sheet printed two change
 * questions where five were intended.
 *
 * Nothing anywhere could see it. The sheet is still valid, the key still
 * matches, the score line still adds up — it is simply a shorter sheet than
 * the author wrote, on some seeds and not others, which is the hardest kind of
 * wrong to notice.
 *
 * Passing the test in here instead re-rolls the value that fails it, so the
 * count is the count. check.js refuses the .filter() form.
 */
function distinct(count, fn, key = JSON.stringify, ok = null) {
  const out = [];
  const seen = new Set();
  for (let i = 0; i < count * 60 && out.length < count; i++) {
    const v = fn();
    if (ok && !ok(v)) continue;
    const k = key(v);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(v);
  }
  /*
   * AND IF IT CANNOT FIND THEM, IT SAYS SO.
   *
   * Returning a short set quietly is the exact failure the `ok` argument was
   * added to remove, and leaving it in the helper would just move it one level
   * down: an `ok` that is too strict, or a value space smaller than `count`,
   * would produce the same silently-shorter sheet by a different route.
   *
   * count * 60 attempts is a lot of rope. Running out means the request cannot
   * be met, which is a bug in the caller and worth stopping the build for.
   */
  if (out.length < count) {
    throw new Error(
      `distinct: asked for ${count} and could only find ${out.length} in ${count * 60} tries — ` +
        `either the values run out or the test rejects too much`
    );
  }
  return out;
}

module.exports = {
  rng,
  rngFor,
  shuffle,
  derange,
  masterSeed,
  isDefaultSeed,
  seedTag,
  sharedDraws,
  endDocument,
  drawCount: () => draws,
  DEFAULT_SEED,
  int,
  pick,
  distinct,
};

},
"src/gen/packs/lib/prek/trace.js": function(module, exports, require){
/*
 * trace.js — the letter-drawing primitives, and the only copy of them.
 *
 * WHY THIS IS ITS OWN FILE AND WHY IT IS UMD. These four functions draw a
 * traceable word: the glyph paths, the start dot, the dashes, and the width
 * arithmetic that lets a word be centered without measuring text. They were
 * inside paper.js, which is a Node module full of page furniture, and the shop's
 * name generator needs them in a BROWSER.
 *
 * The lazy way is to write them again in the page's script. That is two copies of
 * the same geometry, and they drift — somebody widens the start dot here, the
 * generator keeps the old one, and the sheet a parent prints from the website
 * stops matching the sheet in the pack they bought. So there is one file, it
 * runs in both places, and paper.js requires it rather than owning it.
 *
 * The glyph table is passed IN rather than required, because in the browser it
 * arrives as inlined JSON and here it comes from ./glyphs. Same numbers either
 * way; the delivery differs.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./glyphs').GLYPHS);
  } else {
    root.Trace = factory(root.GLYPHS);
  }
})(typeof self !== 'undefined' ? self : this, function (GLYPHS) {
  const r = (n) => Math.round(n * 100) / 100;

  /* Pen weights, in px at the reference row height. */
  const REF_ROW_H = 0.65 * 96;
  const SW_MODEL = 3.0;
  const SW_TRACE = 2.4;
  const DASH = [5.5, 4.5];
  const DOT_R = 2.6;
  const START_R = 3.4;
  /*
   * THE LETTER TO COPY IS THE SUBJECT'S COLOR, and this file cannot ask which
   * subject it is: it runs in the browser too, for the name generator, where
   * there is no pack and no palette module to require. So the color is settable
   * — setAccent() — and paper.js sets it from the pack it is generating for. The
   * default is the house orange, which is what the name generator wants and what
   * a page with no subject should get.
   *
   * It mattered: every pre-K literacy sheet is an ENGLISH sheet, and every one of
   * them was printing its letters in math orange.
   */
  let ACCENT = '#C0511D';
  const setAccent = (hex) => { if (hex) ACCENT = hex; };
  /* Warm, and the same lightness the neutral gray had — a guide still has to
     lose to a pencil, which color does not change. */
  const INK_TRACE = '#B09A88';

  const LETTER_GAP = 0.16;
  const SPACE_W = 0.4;

  /* The three ruling lines, exported so anything drawing a writing line uses
   * the same greys the packs do rather than picking its own. */
  const RULES = { top: '#CFC3B2', mid: '#BCAE9C', base: '#16130F' };

  /* A letter drawn small should not have a proportionally fat pen — below the
   * reference height the stroke thins, but only so far. */
  const weightFactor = (s) => Math.max(0.65, Math.min(1, s / REF_ROW_H));

  function drawPaths(g, x, y, s, { trace = false, showStart = false } = {}) {
    const f = weightFactor(s);
    const sw = ((trace ? SW_TRACE : SW_MODEL) * f) / s;
    const ink = trace ? INK_TRACE : ACCENT;
    const dash = trace ? ` stroke-dasharray="${r((DASH[0] * f) / s)} ${r((DASH[1] * f) / s)}"` : '';

    const parts = g.d.map(
      (d) =>
        `<path d="${d}" fill="none" stroke="${ink}" stroke-width="${r(sw)}"` +
        ` stroke-linecap="round" stroke-linejoin="round"${dash}/>`
    );

    for (const [dx, dy] of g.dots || [])
      parts.push(`<circle cx="${dx}" cy="${dy}" r="${r((DOT_R * f) / s)}" fill="${ink}"/>`);

    /* Every letter gets its own start dot — each one has its own starting point,
     * and that is the thing being taught. */
    if (showStart && g.d.length) {
      const m = g.d[0].match(/^M\s*(-?[\d.]+)[\s,]+(-?[\d.]+)/);
      if (m)
        parts.push(
          `<circle cx="${parseFloat(m[1])}" cy="${parseFloat(m[2])}" r="${r(
            (START_R * f) / s
          )}" fill="${ACCENT}"/>`
        );
    }

    return `<g transform="translate(${r(x)} ${r(y)}) scale(${r(s)})">${parts.join('')}</g>`;
  }

  /* Width of a word in units, so it can be centered without measuring text. */
  function wordWidth(text, gap = LETTER_GAP) {
    let w = 0;
    [...text].forEach((ch, i) => {
      if (i) w += gap;
      w += ch === ' ' ? SPACE_W : (GLYPHS[ch] || { w: SPACE_W }).w;
    });
    return w;
  }

  function drawWord(text, x, y, s, opts = {}) {
    const gap = opts.gap === undefined ? LETTER_GAP : opts.gap;
    let cx = x;
    const out = [];
    [...text].forEach((ch, i) => {
      if (i) cx += gap * s;
      if (ch === ' ') {
        cx += SPACE_W * s;
        return;
      }
      const g = GLYPHS[ch];
      if (!g) throw new Error(`No glyph for "${ch}" in "${text}"`);
      out.push(drawPaths(g, cx, y, s, opts));
      cx += g.w * s;
    });
    return out.join('');
  }

  /* Which characters this can draw at all — the generator needs to say so
   * rather than throwing from inside a path builder. */
  const canDraw = (text) => [...text].every((ch) => ch === ' ' || Boolean(GLYPHS[ch]));

  return { drawPaths, drawWord, wordWidth, canDraw, setAccent, LETTER_GAP, SPACE_W, RULES, GLYPHS };
});

},
"src/gen/packs/lib/prek/cursivemetrics.js": function(module, exports, require){
/*
 * cursivemetrics.js — the league cursive face, measured. GENERATED — DO NOT EDIT.
 *
 * Regenerate with:  node lib/prek/measure-cursive.js
 * That file explains what these numbers are and why they have to be baked.
 *
 * Everything is per 1000 units of font-size.
 *
 *   ADV / KERN   advance width and kerning. 69 characters,
 *                467 kerning pairs.
 *   INK          how far each character's ink reaches above and below the
 *                baseline, so a row can be exactly as tall as what is on it.
 *   SIDE         how far it reaches OUTSIDE its advance width, left of the
 *                origin and right of where the next letter starts. A script
 *                face overhangs by a third of an em and more, which is why a
 *                masked layer has to be padded and a full-width row indented.
 *   BOX          the font's own line box — with line-height set to its sum, the
 *                half-leading is zero and the baseline sits BOX[0] below the top
 *                of the box, which is how a line of type is put on a rule.
 */

/* char:advance;char:advance… */
const ADV_SRC = "0:506.5;1:369.1;2:524.7;3:542.3;4:535.2;5:557.9;6:453.8;7:304;8:651;9:360; :268.2;!:404.9;':158.2;,:132.2;-:466.1;.:145.2;?:544.3;A:786.5;B:647.8;C:480.5;D:656.3;E:551.4;F:542.3;G:656.3;H:601.6;I:542.3;J:396.5;K:584.6;L:542.3;M:775.4;N:599.6;O:619.1;P:783.2;Q:653.6;R:751.3;S:613.3;T:524.1;U:587.2;V:748;W:1015.6;X:633.5;Y:599.6;Z:757.8;a:577.5;b:444;c:459.6;d:575.5;e:457;f:332;g:496.7;h:504.6;i:279.3;j:207;k:436.8;l:347;m:806;n:555.3;o:563.8;p:580.1;q:519.5;r:424.5;s:352.2;t:432.3;u:546.2;v:559.2;w:618.5;x:488.9;y:513.7;z:442.1";

/* first;second:delta;second:delta… — one entry per character that kerns at all */
const KERN_SRC = [
  "0;2:-78.1;9:36.5",
  "1;2:-62.4;3:-67.6;4:-83.3;6:-57.3;7:83.4;9:57.4",
  "2;0:52.1;1:130.3;7:52.2;9:83.4",
  "3;0:26.1;1:73;2:-46.8;9:83.4",
  "4;0:62.5;1:62.5;3:31.2;7:104.2;9:88.5",
  "5;2:-88.5",
  "6;1:52.1;9:72.9",
  "7;1:203.2;2:36.5;3:31.3;4:72.9;6:46.9;9:145.9",
  "8;1:-15.5;2:-182.2;3:-140.6;4:-140.6;6:-135.4",
  "9;0:78.2;1:145.9;4:26;6:41.7",
  "I;l:116.6",
  "O;h:37.8",
  "a;a:1.9;b:-2;c:-3.9;e:4.6;f:15;g:-5.8;h:6.4;i:1.9;j:-8.5;k:-12.3;l:3.9;m:14.9;p:6.5;q:-10.4;r:-5.9;s:9.8;t:10.4;u:-2;v:-12.3;w:1.9;y:-5.9",
  "b;a:-6.5;b:9.8;c:-6.5;d:-8.4;e:7.9;f:5.9;g:-14.9;h:7.8;i:3.9;j:-6.5;k:-10.4;l:9.8;m:5.9;n:7.9;o:3.9;p:-15;q:-14.9;v:-6.5;w:9.8;y:-4.6",
  "c;b:-8.4;c:-8.4;d:-1.9;f:10.5;g:-10.3;h:1.9;j:-12.3;k:-16.2;m:3.9;o:-1.9;p:3.9;q:-14.3;r:-7.8;s:4;t:7.8;u:-8.4;v:-16.2;y:-10.4",
  "d;a:2;b:-3.9;e:2;f:14.4;g:-3.8;h:8.4;i:6.5;j:-3.9;k:-10.3;l:3.9;m:18.9;p:8.5;q:-8.4;r:-2;s:10.5;t:14.3;v:-10.3;w:3.9;y:-3.9",
  "e;a:-6.5;b:-6.5;c:-8.4;d:-6.5;f:5.9;g:-12.3;i:-1.9;j:-12.3;k:-20.8;o:-4.5;p:-6.5;q:-16.9;r:-22.1;s:-8.4;t:-6.5;u:-8.4;v:-14.2;y:-10.4",
  "f;a:19.5;b:6.6;c:16.3;d:19.6;e:19.6;f:22.9;g:16.4;h:31.2;i:27.4;j:19.6;k:10.5;l:20.9;m:38.4;n:26.1;o:16.3;p:29.3;q:6.6;r:16.3;s:29.3;t:33.2;u:18.9;v:10.5;w:19.6;y:13",
  "g;a:4.6;b:-6.5;c:-4.5;f:16.4;g:-2.5;h:7.8;i:5.9;j:-6.4;k:-12.9;l:2.7;m:16.3;p:10.4;q:-8.4;r:-2.6;s:10.5;t:13.1",
  "h;b:-3.9;c:-5.9;e:2.6;f:13;g:-5.9;h:4.5;i:4.5;j:-7.8;k:-14.3;p:4.5;q:-12.4;r:-10.5;s:2.6;t:5.8;u:-3.9;v:-12.4;w:2.6;y:-5.9",
  "i;b:-8.5;c:-3.9;d:-1.9;f:12.4;g:-5.8;h:1.9;j:-1.9;k:-16.2;m:6.5;o:-3.9;p:4.5;q:-12.3;r:-8.5;s:6.5;t:5.8;u:-3.9;v:-14.3;y:-8.5",
  "j;b:-6.5;c:-5.8;f:13.1;g:-6.4;h:12.4;j:-1.2;k:-14.2;m:12.4;p:2;q:-12.3;r:-8.5;s:4;t:7.2;u:-6.5;v:-14.2;y:-8.5",
  "k;a:4.6;d:4.6;e:4.6;f:20.9;h:11.7;i:8.5;j:4.6;k:-7.7;l:4.6;m:20.9;n:10.5;p:15;q:-5.8;r:4.6;s:17;t:19.6;v:-7.1;w:4.6",
  "l;b:-8.4;c:-6.5;f:10.5;g:-8.4;h:5.8;i:2;j:-2.6;k:-14.9;m:7.8;p:3.9;q:-13;r:-10.4;s:2;t:4.6;u:-4.5;v:-14.9;y:-10.4",
  "m;b:-3.9;c:-3.2;f:13.7;g:-6.5;h:6.5;i:4.5;k:-13;m:16.9;p:6.5;q:-12.3;r:-5.9;s:6.5;t:8.4;v:-10.4;w:2.6;y:-6.5",
  "n;b:-6.5;c:-6.4;d:-1.9;f:8.5;g:-10.3;h:2;j:-3.8;k:-16.8;q:-14.3;r:-12.4;t:2.6;u:-6.4;v:-14.2;y:-8.5",
  "o;b:-8.4;c:-6.5;d:-1.9;f:12.4;g:-8.4;h:5.8;i:2;j:-1.9;k:-14.9;m:12.4;p:3.9;q:-12.3;r:-7.8;s:5.9;t:7.8;u:-6.5;v:-12.3;y:-6.5",
  "p;a:-4;b:-2;c:-5.8;d:-3.9;e:2.6;f:6.5;g:-10.4;r:-18.3;s:-5.9;t:-5.2;u:-5.9;v:-14.3;w:2.6;y:-7.9",
  "q;a:-97.6;b:-43.6;c:-85.2;d:-95.6;e:5.9;f:49.5;g:-104.1;h:-54;i:-12.3;j:54.1;r:-27.3",
  "r;b:-16.9;e:-1.9;f:47.5;h:26.6;i:18.9;j:18.9;k:5.9;l:8.4;m:59.9;n:35.2;o:-6.5;p:47.5;q:-15;u:8.5;w:5.8",
  "s;a:-10.4;c:-6.5;d:-6.5;g:-18.8;k:-16.9;p:-12.4;q:-18.8;u:-4.5;v:-8.4;w:6.5;y:-10.4",
  "t;a:6.5;d:4.6;e:8.5;f:20.9;h:10.4;i:10.4;j:4.6;k:-7.8;l:6.5;m:23.4;n:6.5;o:4.6;p:10.4;q:-3.9;r:-2;s:13;t:52.1;u:4.6;v:-5.8;w:8.4",
  "u;a:-5.9;b:-14.3;c:-12.3;d:-8.4;e:-5.8;f:6.6;g:-14.3;i:-3.9;j:-8.4;k:-22.7;l:-5.8;o:-8.4;q:-18.2;r:-12.4;t:2;u:-10.4;v:-20.1;w:-5.8;y:-12.4",
  "v;a:-120.4;b:-78.7;c:-78.7;d:-93;e:-35.1;g:-72.2;o:-49.4;t:-85.9;v:15.1",
  "w;b:43.6;c:10.4;e:29.3;f:24.8;g:-8.4;h:35.1;i:26.7;j:31.3;k:12.4;l:39.7;m:26.7;n:37.1;o:22.1;p:-4.6;q:-4.5;u:24.8;w:41.6;y:14.3",
  "y;b:-3.9;f:16.9;g:-3.9;h:8.4;i:4.5;k:-10.4;m:16.9;p:10.4;q:-10.4;r:-2;s:12.4;t:12.3;v:-10.4;y:-4",
  "z;a:26;b:11.7;c:20.8;d:24.7;e:26;f:24.7;g:19.5;h:31.2;i:29.9;j:26;k:13;l:27.3;m:40.3;n:20.8;o:24.7;p:31.2;q:15.6;r:18.8;s:32.5;t:27.3;u:20.8;v:11.7;w:28.6;y:19.5"
];

/* char:inkAbove:inkBelow */
const INK_SRC = "0:641:16;1:641:16;2:641:31;3:625:63;4:641:31;5:594:47;6:609:47;7:594:78;8:672:94;9:625:47; :0:0;!:578:16;':563:-359;,:78:47;-:219:-187;.:78:16;?:578:16;A:672:31;B:672:47;C:625:31;D:641:47;E:641:16;F:625:31;G:641:313;H:734:156;I:609:78;J:641:266;K:641:31;L:609:172;M:609:141;N:641:47;O:609:31;P:609:78;Q:578:219;R:594:109;S:672:63;T:594:78;U:609:125;V:609:94;W:594:125;X:594:78;Y:641:141;Z:594:63;a:344:16;b:672:16;c:328:16;d:594:16;e:375:16;f:672:375;g:344:391;h:688:16;i:469:0;j:469:391;k:688:16;l:656:16;m:344:16;n:344:16;o:359:16;p:406:375;q:359:375;r:391:31;s:406:16;t:703:16;u:359:16;v:375:16;w:344:16;x:344:47;y:359:391;z:359:391";

/* char:leftOfOrigin:rightOfAdvance */
const SIDE_SRC = "0:-31:9;1:-47:162;2:-16:100;3:-16:67;4:-47:168;5:-31:98;6:-31:62;7:-16:212;8:0:-42;9:-47:187; :0:-268;!:-47:17;':-172:123;,:-31:-7;-:-16:-29;.:-47:-20;?:-31:-13;A:-16:229;B:125:55;C:-16:129;D:109:109;E:-62:-5;F:31:364;G:-172:125;H:16:227;I:31:317;J:359:479;K:203:244;L:0:333;M:375:84;N:234:494;O:0:162;P:31:61;Q:-16:18;R:63:46;S:156:74;T:78:320;U:125:210;V:109:18;W:63:-16;X:188:242;Y:63:307;Z:63:70;a:31:16;b:16:56;c:31:9;d:31:159;e:16:27;f:328:168;g:188:19;h:78:27;i:47:18;j:438:12;k:63:48;l:47:106;m:172:7;n:125:23;o:16:14;p:328:29;q:16:27;r:0:-3;s:16:38;t:31:36;u:47:1;v:31:35;w:31:100;x:78:11;y:156:18;z:172:42";

/* the font's line box: ascent, descent */
const BOX = [716,391];

const ADV = {};
for (const t of ADV_SRC.split(';')) ADV[t[0]] = +t.slice(2);

const KERN = {};
for (const line of KERN_SRC) {
  const a = line[0];
  for (const t of line.slice(2).split(';')) KERN[a + t[0]] = +t.slice(2);
}

const INK = {};
for (const t of INK_SRC.split(';')) {
  const [above, below] = t.slice(2).split(':');
  INK[t[0]] = [+above, +below];
}

const SIDE = {};
for (const t of SIDE_SRC.split(';')) {
  const [left, right] = t.slice(2).split(':');
  SIDE[t[0]] = [+left, +right];
}

/*
 * Width of `text` in em — multiply by font-size for px.
 *
 * An unknown character throws instead of measuring as nothing. A sentence that
 * is quietly narrower than the layout believes does not error, it just runs off
 * the end of its line on paper.
 */
function width(text) {
  let w = 0;
  for (let i = 0; i < text.length; i++) {
    const adv = ADV[text[i]];
    if (adv === undefined) throw new Error(`cursivemetrics: no width for "${text[i]}" in "${text}"`);
    w += adv;
    if (i) w += KERN[text[i - 1] + text[i]] || 0;
  }
  return w / 1000;
}

module.exports = { ADV, KERN, INK, SIDE, BOX, width };

},
"src/gen/packs/lib/prek/cursivemetrics-playwrite.js": function(module, exports, require){
/*
 * cursivemetrics-playwrite.js — the playwrite cursive face, measured. GENERATED — DO NOT EDIT.
 *
 * Regenerate with:  node lib/prek/measure-cursive.js playwrite
 * That file explains what these numbers are and why they have to be baked.
 *
 * Everything is per 1000 units of font-size.
 *
 *   ADV / KERN   advance width and kerning. 69 characters,
 *                1334 kerning pairs.
 *   INK          how far each character's ink reaches above and below the
 *                baseline, so a row can be exactly as tall as what is on it.
 *   SIDE         how far it reaches OUTSIDE its advance width, left of the
 *                origin and right of where the next letter starts. A script
 *                face overhangs by a third of an em and more, which is why a
 *                masked layer has to be padded and a full-width row indented.
 *   BOX          the font's own line box — with line-height set to its sum, the
 *                half-leading is zero and the baseline sits BOX[0] below the top
 *                of the box, which is how a line of type is put on a rule.
 */

/* char:advance;char:advance… */
const ADV_SRC = "0:846;1:499;2:736;3:756;4:770;5:756;6:812;7:613;8:756;9:812; :300;!:388;':169;,:313;-:576;.:313;?:560;A:1087;B:1009;C:860;D:1139;E:775;F:1030;G:1143;H:1193;I:1008;J:837;K:1103;L:903;M:1444;N:1071;O:1094;P:855;Q:1059;R:1041;S:991;T:800;U:1058;V:1009;W:1417;X:920;Y:1011;Z:878;a:622;b:614;c:522;d:641;e:444;f:438;g:622;h:676;i:300;j:316;k:564;l:394;m:989;n:671;o:588;p:701;q:635;r:568;s:550;t:388;u:646;v:604;w:855;x:640;y:640;z:465";

/* first;second:delta;second:delta… — one entry per character that kerns at all */
const KERN_SRC = [
  "7;,:-88;.:-88",
  ",;A:-40;B:-60;C:-40;H:-90;J:-60;K:-90;M:-110;N:-110;O:-40;P:-60;Q:-40;R:-60;T:-50;U:-110;V:-110;W:-110;Y:-110;Z:-80;b:100;e:80;f:100;h:100;k:100;l:100;p:100;r:100;s:100;t:-30;u:-50;w:-50;y:-50",
  "-;B:-70;D:-50;G:-40;H:-140;J:-20;K:-140;L:-30;M:-100;N:-100;P:-70;R:-70;S:-140;T:-50;U:-100;V:-100;W:-100;X:-140;Y:-100;Z:-90;b:-30;f:-30;h:-30;k:-30;l:-30;p:-30;r:-30;s:-30",
  ".;A:-40;B:-60;C:-40;H:-90;J:-60;K:-90;M:-110;N:-110;O:-40;P:-60;Q:-40;R:-60;T:-50;U:-110;V:-110;W:-110;Y:-110;Z:-80;b:100;e:80;f:100;h:100;k:100;l:100;p:100;r:100;s:100;t:-30;u:-50;w:-50;y:-50",
  "A;-:-80;A:-30;B:-40;C:-30;H:-50;I:-44;J:-50;K:-50;M:-70;N:-70;O:-30;P:-40;Q:-30;R:-40;T:-20;U:-70;V:-70;W:-70;Y:-70;Z:-60;a:-43;b:-56;c:-43;d:-56;e:-56;f:-56;g:-43;h:-56;i:-31;j:-56;k:-56;l:-56;m:44;n:44;o:-43;p:-123;q:-43;r:-31;s:-56;t:-56;u:-31;v:44;w:-23;x:31;y:-31;z:-13",
  "B;H:-10;K:-10;S:-20;X:-10",
  "C;a:5;b:-8;c:5;d:-8;e:-8;f:-8;g:5;h:-8;i:17;j:-8;k:-8;l:-8;m:92;n:92;o:5;p:-75;q:5;r:-8;s:-8;t:-8;u:17;v:92;w:25;x:37;y:17;z:32",
  "D;,:-70;.:-70;F:-10;G:-20;H:-20;I:-50;K:-20;M:-20;N:-20;S:-50;U:-20;V:-20;W:-20;X:-20;Y:-20;Z:-62",
  "E;B:-20;J:-10;P:-20;R:-20;S:-40;a:-6;b:-19;c:-6;d:-19;e:-19;f:-19;g:-6;h:-19;i:6;j:-19;k:-19;l:-19;m:81;n:81;o:-6;p:-86;q:-6;r:-19;s:-19;t:-19;u:6;v:81;w:14;x:26;y:6;z:21",
  "F;,:-80;-:-60;.:-80;A:-30;B:-20;C:-30;E:-40;G:-90;I:-110;J:-20;L:-30;O:-30;P:-20;Q:-30;R:-20;S:-180;X:-20;a:-80;b:-4;c:-56;d:-80;e:-20;f:-4;h:-4;k:-4;l:-4;o:-56;p:-4;r:-4;s:-4;t:-50;u:-80;w:-80;y:-80",
  "G;,:-70;.:-70;F:-10;G:-20;H:-20;I:-50;K:-20;M:-20;N:-20;S:-50;U:-20;V:-20;W:-20;X:-20;Y:-20;Z:-62",
  "H;S:-20",
  "I;S:-30;a:83;b:70;c:83;d:70;e:70;f:70;g:83;h:70;i:95;j:70;k:70;l:70;m:170;n:170;o:83;p:3;q:83;r:95;s:70;t:70;u:95;v:170;w:103;x:157;y:95;z:113",
  "J;B:-30;H:-40;K:-40;M:-40;N:-40;P:-30;R:-30;U:-40;V:-40;W:-40;Y:-40;Z:-40;a:-54;b:-5;c:-54;d:-67;e:-30;f:-5;g:-54;h:-67;i:-42;j:-67;k:-67;l:-5;m:64;n:64;o:-54;p:-134;q:-54;r:-30;s:-42;t:-67;u:-42;v:64;w:-34;x:-5;y:-42;z:-30",
  "K;-:-140;A:-20;B:-30;C:-20;H:-20;J:-50;K:-20;M:-50;N:-50;O:-20;P:-30;Q:-20;R:-30;U:-50;V:-50;W:-50;Y:-50;Z:-30;a:-92;b:-105;c:-92;d:-105;e:-105;f:-105;g:-92;h:-105;i:-80;j:-105;k:-105;l:-105;m:-5;n:-5;o:-92;p:-172;q:-92;r:-80;s:-105;t:-105;u:-80;v:-5;w:-72;x:-18;y:-80;z:-62",
  "L;-:-50;B:-40;H:-60;J:-20;K:-60;M:-48;N:-48;P:-40;R:-40;S:-20;U:-48;V:-48;W:-48;Y:-48;Z:-40;a:-55;b:-68;c:-55;d:-68;e:-68;f:-68;g:-55;h:-68;i:-43;j:-68;k:-68;l:-68;m:32;n:32;o:-55;p:-135;q:-55;r:-43;s:-68;t:-68;u:-43;v:32;w:-35;x:19;y:-43;z:-25",
  "M;-:-80;A:-30;B:-40;C:-30;H:-50;I:-44;J:-50;K:-50;M:-70;N:-70;O:-30;P:-40;Q:-30;R:-40;T:-20;U:-70;V:-70;W:-70;Y:-70;Z:-60;a:-35;b:-48;c:-35;d:-48;e:-48;f:-48;g:-35;h:-48;i:-23;j:-48;k:-48;l:-48;m:52;n:52;o:-35;p:-115;q:-35;r:-23;s:-48;t:-48;u:-23;v:52;w:-15;x:39;y:-23;z:-5",
  "N;-:-80;A:-30;B:-40;C:-30;H:-50;I:-44;J:-50;K:-50;M:-70;N:-70;O:-30;P:-40;Q:-30;R:-40;T:-20;U:-70;V:-70;W:-70;Y:-70;Z:-60;a:-36;b:-49;c:-36;d:-49;e:-49;f:-49;g:-36;h:-49;i:-24;j:-49;k:-49;l:-49;m:51;n:51;o:-36;p:-116;q:-36;r:-24;s:-49;t:-49;u:-24;v:51;w:-16;x:38;y:-24;z:-6",
  "O;,:-60;.:-60;B:-30;H:-30;I:-40;K:-30;M:-30;N:-30;P:-30;R:-30;S:-60;U:-30;V:-30;W:-30;Y:-30;Z:-62",
  "P;,:-120;-:-60;.:-120;G:-60;I:-110;S:-170;a:-72;b:-10;c:-36;d:-72;e:-30;f:-10;h:-10;k:-10;l:-10;o:-36;p:-10;r:-10;s:-10;t:-4;u:-44;w:-44;y:-44",
  "Q;a:-1;b:-14;c:-1;d:-14;e:-14;f:-14;g:-1;h:-14;i:11;j:-14;k:-14;l:-14;m:86;n:86;o:-1;p:-81;q:-1;r:11;s:-14;t:-14;u:11;v:86;w:19;x:73;y:11;z:29",
  "R;-:-110;A:-20;B:-20;C:-20;H:-40;J:-20;K:-40;M:-70;N:-70;O:-20;P:-20;Q:-20;R:-20;T:-22;U:-70;V:-70;W:-70;Y:-70;Z:-40;a:-29;b:-42;c:-29;d:-42;e:-42;f:-42;g:-29;h:-42;i:-17;j:-42;k:-42;l:-42;m:58;n:58;o:-29;p:-109;q:-29;r:-17;s:-42;t:-42;u:-17;v:58;w:-9;x:45;y:-17;z:1",
  "S;A:-20;C:-20;H:-20;K:-20;M:-40;N:-40;O:-20;Q:-20;T:-10;U:-40;V:-40;W:-40;Y:-40;Z:-40",
  "T;,:-70;-:-70;.:-70;A:-40;B:-30;C:-40;E:-30;G:-100;I:-120;J:-10;L:-20;O:-40;P:-30;Q:-40;R:-30;S:-160;X:-20;a:-102;b:-32;c:-108;d:-102;e:-58;f:-32;h:-32;i:-32;k:-32;l:-32;m:-56;n:-56;o:-108;p:-32;r:-32;s:-32;t:-26;u:-100;v:-56;w:-100;y:-100",
  "U;-:-80;A:-30;B:-40;C:-30;H:-50;I:-44;J:-50;K:-50;M:-70;N:-70;O:-30;P:-40;Q:-30;R:-40;T:-20;U:-70;V:-70;W:-70;Y:-70;Z:-60;a:-36;b:-49;c:-36;d:-49;e:-49;f:-49;g:-36;h:-49;i:-24;j:-49;k:-49;l:-49;m:51;n:51;o:-36;p:-116;q:-36;r:-24;s:-49;t:-49;u:-24;v:51;w:-16;x:38;y:-24;z:-6",
  "V;,:-60;.:-60;G:-50;I:-60;S:-100;a:-66;b:-18;c:-20;d:-66;e:-68;f:-18;h:-18;k:-18;l:-18;o:-20;p:-18;r:-18;s:-18;t:-20;u:-50;w:-50;y:-50",
  "W;,:-60;.:-60;G:-50;I:-60;S:-100;a:-66;b:-18;c:-20;d:-66;e:-68;f:-18;h:-18;k:-18;l:-18;o:-20;p:-18;r:-18;s:-18;t:-20;u:-50;w:-50;y:-50",
  "X;-:-110;A:-20;B:-20;C:-20;H:-40;J:-20;K:-40;M:-70;N:-70;O:-20;P:-20;Q:-20;R:-20;T:-22;U:-70;V:-70;W:-70;Y:-70;Z:-40;a:-49;b:-62;c:-49;d:-62;e:-62;f:-62;g:-49;h:-62;i:-37;j:-62;k:-62;l:-62;m:38;n:38;o:-49;p:-129;q:-49;r:-37;s:-62;t:-62;u:-37;v:38;w:-29;x:25;y:-37;z:-19",
  "Y;Z:-40;a:-20;b:29;c:-20;d:-33;e:4;f:29;g:-20;h:-33;i:-8;j:-33;k:-33;l:29;m:98;n:98;o:-20;p:-100;q:-20;r:4;s:-8;t:-33;u:-8;v:98;x:29;y:-8;z:4",
  "Z;B:-30;H:-40;K:-40;M:-40;N:-40;P:-30;R:-30;U:-40;V:-40;W:-40;Y:-40;Z:-40;a:-35;b:14;c:-35;d:-48;e:-11;f:14;g:-35;h:-48;i:-23;j:-48;k:-48;l:14;m:83;n:83;o:-35;p:-115;q:-35;r:-11;s:-23;t:-48;u:-23;v:83;w:-15;x:14;y:-23;z:-11",
  "a;-:-30;a:13;c:13;g:13;i:25;m:100;n:100;o:13;p:-67;q:13;r:25;u:25;v:100;w:33;x:87;y:25;z:43",
  "b;a:13;b:25;c:13;e:56;f:25;g:13;h:25;i:25;k:25;l:25;m:25;n:25;o:13;p:-67;q:13;u:25;v:25;w:33;x:25;y:25",
  "c;a:17;b:4;c:17;d:4;e:4;f:4;g:17;h:4;i:29;j:4;k:4;l:4;m:129;n:129;o:17;p:-63;q:17;r:4;s:4;t:4;u:29;v:129;w:37;x:47;y:29;z:4",
  "d;-:-30;a:13;c:13;g:13;i:25;m:100;n:100;o:13;p:-67;q:13;r:25;u:25;v:100;w:33;x:87;y:25;z:43",
  "e;,:40;.:40;a:13;c:13;g:13;i:25;m:125;n:125;o:13;p:-67;q:13;r:12;u:25;v:125;w:33;x:62;y:25;z:37",
  "f;a:13;c:13;g:13;i:25;m:100;n:100;o:13;p:-67;q:13;r:37;u:25;v:100;w:33;x:87;y:25;z:25",
  "g;a:13;b:12;c:13;f:12;g:13;i:25;l:12;m:106;n:106;o:13;p:-67;q:13;r:12;u:25;v:106;w:33;x:62;y:25;z:25",
  "h;a:13;c:13;g:13;i:25;m:100;n:100;o:13;p:-67;q:13;r:25;u:25;v:100;w:33;x:87;y:25;z:43",
  "i;-:-30;a:13;c:13;g:13;i:25;m:100;n:100;o:13;p:-67;q:13;r:25;u:25;v:100;w:33;x:87;y:25;z:43",
  "j;a:13;b:12;c:13;f:12;g:13;i:25;l:12;m:106;n:106;o:13;p:-67;q:13;r:12;u:25;v:106;w:33;x:62;y:25;z:25",
  "k;a:13;c:13;g:13;i:25;m:100;n:100;o:13;p:-67;q:13;r:25;u:25;v:100;w:33;x:87;y:25;z:43",
  "l;a:13;c:13;g:13;i:25;m:100;n:100;o:13;p:-67;q:13;r:25;u:25;v:100;w:33;x:87;y:25;z:43",
  "m;a:13;c:13;g:13;i:25;m:100;n:100;o:13;p:-67;q:13;r:25;u:25;v:100;w:33;x:87;y:25;z:43",
  "n;a:13;c:13;g:13;i:25;m:100;n:100;o:13;p:-67;q:13;r:25;u:25;v:100;w:33;x:87;y:25;z:43",
  "o;a:13;b:25;c:13;e:68;f:25;g:13;i:25;l:25;o:13;p:-67;q:13;u:25;w:33;x:25;y:25",
  "p;a:13;c:13;g:13;i:25;m:100;n:100;o:13;p:-67;q:13;r:25;u:25;v:100;w:33;x:87;y:25;z:43",
  "q;a:13;c:13;g:13;i:25;m:100;n:100;o:13;p:-67;q:13;r:25;u:25;v:100;w:33;x:87;y:25;z:43",
  "r;a:13;c:13;g:13;i:25;m:100;n:100;o:13;p:-67;q:13;r:25;u:25;v:100;w:33;x:87;y:25;z:43",
  "s;a:13;c:13;g:13;i:25;m:100;n:100;o:13;p:-67;q:13;r:25;u:25;v:100;w:33;x:87;y:25;z:43",
  "t;a:13;c:13;g:13;i:25;m:100;n:100;o:13;p:-67;q:13;r:25;u:25;v:100;w:33;x:87;y:25;z:43",
  "u;-:-30;a:13;c:13;g:13;i:25;m:100;n:100;o:13;p:-67;q:13;r:25;u:25;v:100;w:33;x:87;y:25;z:43",
  "v;a:13;b:25;c:13;e:56;f:25;g:13;h:25;i:25;k:25;l:25;m:25;n:25;o:13;p:-67;q:13;u:25;v:25;w:33;x:25;y:25",
  "w;a:13;b:25;c:13;e:56;f:25;g:13;h:25;i:25;k:25;l:25;m:25;n:25;o:13;p:-67;q:13;u:25;v:25;w:33;x:25;y:25",
  "x;a:38;b:25;c:38;d:25;e:25;f:25;g:38;h:25;i:50;j:25;k:25;l:25;m:125;n:125;o:38;p:-42;q:38;r:50;s:25;t:25;u:50;v:125;w:58;x:112;y:50;z:68",
  "y;a:13;b:12;c:13;f:12;g:13;i:25;l:12;m:106;n:106;o:13;p:-67;q:13;r:12;u:25;v:106;w:33;x:62;y:25;z:25",
  "z;a:13;b:37;c:13;f:37;g:13;i:37;j:12;l:37;m:137;n:137;o:13;p:-55;q:13;t:12;u:37;v:137;w:45;x:50;y:37;z:25"
];

/* char:inkAbove:inkBelow */
const INK_SRC = "0:1016:31;1:1016:16;2:1016:0;3:1016:31;4:1031:16;5:1000:31;6:1016:31;7:1000:16;8:1016:31;9:1031:16; :0:0;!:1016:16;':1016:-703;,:94:203;-:391:-297;.:109:47;?:1016:16;A:1016:31;B:1016:16;C:1016:31;D:1016:31;E:1016:31;F:1016:31;G:1016:16;H:1016:16;I:1031:31;J:1016:531;K:1016:31;L:1016:31;M:1031:31;N:1031:31;O:1031:31;P:1016:16;Q:1016:141;R:1016:31;S:1094:31;T:1000:31;U:1016:31;V:1063:31;W:1063:31;X:1031:31;Y:1016:531;Z:1016:531;a:531:31;b:1031:31;c:531:31;d:1016:31;e:531:31;f:1031:531;g:531:531;h:1031:31;i:797:16;j:797:531;k:1031:31;l:1031:31;m:531:16;n:531:16;o:531:31;p:531:531;q:531:531;r:578:31;s:594:31;t:734:16;u:516:16;v:531:31;w:531:31;x:531:31;y:516:531;z:531:531";

/* char:leftOfOrigin:rightOfAdvance */
const SIDE_SRC = "0:-94:76;1:-141:64;2:31:92;3:-31:57;4:-47:11;5:-16:135;6:-125:47;7:-31:215;8:-31:88;9:-109:32; :0:-300;!:-62:96;':-203:206;,:63:-157;-:-109:-45;.:-16:-157;?:-94:159;A:-125:38;B:-141:22;C:-141:140;D:-47:17;E:-78:100;F:-78:220;G:31:45;H:-203:41;I:-94:39;J:-47:-24;K:-203:147;L:16:35;M:-156:-22;N:-156:-24;O:-125:172;P:-141:145;Q:-125:-12;R:-141:6;S:63:-22;T:-94:247;U:-203:36;V:-172:194;W:-172:208;X:-31:80;Y:-203:67;Z:-62:75;a:-31:-28;b:219:-5;c:-47:25;d:-31:125;e:188:56;f:219:171;g:31:-28;h:203:-35;i:-31:59;j:313:59;k:203:45;l:219:215;m:0:-36;n:0:-30;o:-47:-41;p:188:-29;q:-31:6;r:219:-37;s:219:-128;t:-47:50;u:-47:-37;v:0:-41;w:-47:-42;x:-47:16;y:16:-31;z:141:19";

/* the font's line box: ascent, descent */
const BOX = [1428,504];

const ADV = {};
for (const t of ADV_SRC.split(';')) ADV[t[0]] = +t.slice(2);

const KERN = {};
for (const line of KERN_SRC) {
  const a = line[0];
  for (const t of line.slice(2).split(';')) KERN[a + t[0]] = +t.slice(2);
}

const INK = {};
for (const t of INK_SRC.split(';')) {
  const [above, below] = t.slice(2).split(':');
  INK[t[0]] = [+above, +below];
}

const SIDE = {};
for (const t of SIDE_SRC.split(';')) {
  const [left, right] = t.slice(2).split(':');
  SIDE[t[0]] = [+left, +right];
}

/*
 * Width of `text` in em — multiply by font-size for px.
 *
 * An unknown character throws instead of measuring as nothing. A sentence that
 * is quietly narrower than the layout believes does not error, it just runs off
 * the end of its line on paper.
 */
function width(text) {
  let w = 0;
  for (let i = 0; i < text.length; i++) {
    const adv = ADV[text[i]];
    if (adv === undefined) throw new Error(`cursivemetrics: no width for "${text[i]}" in "${text}"`);
    w += adv;
    if (i) w += KERN[text[i - 1] + text[i]] || 0;
  }
  return w / 1000;
}

module.exports = { ADV, KERN, INK, SIDE, BOX, width };

}
};
var __cache = {};
function norm(p){
  var out = [];
  p.split('/').forEach(function(part){
    if (!part || part === '.') return;
    if (part === '..') out.pop(); else out.push(part);
  });
  return out.join('/');
}
function dirname(p){ var i = p.lastIndexOf('/'); return i < 0 ? '' : p.slice(0, i); }
function make(from){
  return function(id){
    if (__stubs[id]) return __stubs[id];
    var key = norm(dirname(from) + '/' + id);
    if (!__defs[key]) { for (var e of ['.js', '.ts']) if (__defs[key + e]) { key = key + e; break; } }
    if (!__defs[key]) throw new Error('no module ' + id + ' from ' + from);
    if (__cache[key]) return __cache[key].exports;
    var m = __cache[key] = { exports: {} };
    __defs[key](m, m.exports, make(key));
    return m.exports;
  };
}
/* palette.js reads process.argv to find its pack; there is none here. */
if (!window.process) window.process = { argv: [], env: {} };
window.KTN = { require: function(rel){ return make('x/' + rel)('./' + rel.split('/').pop()); },
               load: function(abs){ return make('')('./' + abs); } };
})();
(function(){
var K=window.KTN;
var T=K.load('src/gen/lib/prek/trace.js');
var S=K.load('src/gen/sheet.ts');
var CT=K.load('src/gen/packs/lib/prek/cursivetype.js').forFont('playwrite');
var el=function(id){return document.getElementById(id);};

/*
 * TWENTY-FOUR, NOT TWELVE. The app's maker caps at 12 because it is a phone
 * keyboard and a phone-width field. Here there is room, and both drawings
 * scale to the page rather than running off it — "Alexander Maximilian" still
 * comes out at 44pt in print and 48 in cursive, which is a bigger letter than
 * most handwriting sheets use. Twenty-four is where the letters get small
 * enough to argue about, so that is where it stops.
 */
function clean(s){return (s||'').replace(/[‘’]/g,"'").replace(/s+/g,' ').trim().slice(0,24);}

/*
 * WHICH LETTERS EXIST. The print alphabet is glyphs.js — 68 shapes, A-Z a-z
 * 0-9 and six marks including the apostrophe and the hyphen, so O'Brien and
 * Mary-Jane draw as easily as Milo. What none of it has is accents: Zoë and
 * José threw, in BOTH styles, and a thrown error in the handler killed the
 * preview outright until you reloaded.
 *
 * So the characters are checked before anything is drawn and the message names
 * the one at fault. Saying "that will not work" without saying which letter is
 * the kind of help that is not.
 */
function unsupported(name){
  var bad=[];
  for(var i=0;i<name.length;i++){
    var c=name.charAt(i);
    if(c===' ') continue;
    if(!T.GLYPHS[c] && bad.indexOf(c)<0) bad.push(c);
  }
  return bad;
}

/*
 * PRINT — the app's own nameTracing maker, line for line. Same page width,
 * same row height, same fit-to-the-page scale, same rules, and the same first
 * row solid to copy from with the rest dotted to trace. A name sheet from here
 * and one from the app are the same sheet.
 */
/*
 * HOW MANY ROWS ACTUALLY FIT, measured rather than assumed.
 *
 * kitchen-table/PLAN.md killed a builder UI on the site partly because
 * "client-side generation ships sheets fits.js never verified — the worst
 * possible failure mode under this brand". It was right about this page: run
 * through the same headless-Chrome count fits.js uses, "Milo" at ten rows came
 * out on THREE printed sides. Seven was the last that held; eight spilled.
 *
 * So the row count is clamped to what the page has room for, computed from the
 * same scale the drawing uses — a long name draws smaller and therefore fits
 * more rows, which a fixed cap of seven would get wrong in the other
 * direction. 580pt is the measured budget: 7 rows at full size is 556pt and
 * held, 8 is 634pt and did not.
 *
 * CURSIVE IS NOT CLAMPED because it does not need to be — ten rows was
 * verified on one side, its rows being shorter than print's.
 */
function printRows(name,want){
  var W=7.6*72, scale=Math.min(62,(W-24)/Math.max(T.wordWidth(name),0.001));
  return Math.max(2,Math.min(want,Math.floor((580-10)/(scale+16))));
}

function printSheet(name,rows){
  var W=7.6*72, rowH=62, width=T.wordWidth(name);
  var scale=Math.min(rowH,(W-24)/Math.max(width,0.001));
  var lines=[];
  for(var i=0;i<rows;i++){
    var top=10+i*(scale+16);
    lines.push('<line x1="0" y1="'+(top+scale)+'" x2="'+W+'" y2="'+(top+scale)+'" stroke="#CFC3B2" stroke-width="1"/>');
    lines.push('<line x1="0" y1="'+(top+scale*0.5)+'" x2="'+W+'" y2="'+(top+scale*0.5)+'" stroke="#E6DCCF" stroke-width="1" stroke-dasharray="4 4"/>');
    lines.push(T.drawWord(name,12,top,scale,{trace:i>0,showStart:true}));
  }
  return '<svg viewBox="0 0 '+W+' '+(10+rows*(scale+16))+'" width="100%" role="img" aria-label="rows to trace the name '+S.esc(name)+'">'+lines.join('')+'</svg>';
}

/*
 * CURSIVE — lib/prek/cursivetype.js, which is what english-06-cursive is set
 * with. Not a lookalike: the same Playwrite US Trad face, the same three rules
 * at the weights and colours that file chose, the same traceable outline, and
 * the same fitRowH that makes a long name fit the page.
 *
 * I DREW THIS BY HAND FIRST AND EVERY PART OF IT WAS WRONG — four rules where
 * the pack draws three, wrong weights, a grey filled word where a traceable
 * one is an outline, and no fit-to-page, so ten rows ran 842pt down a 700pt
 * page. The renderer already existed. Bundling eleven modules to reach it is
 * cheaper than being subtly wrong on a handwriting sheet.
 *
 * fullRow is the model AND its trace on one set of rules; blankRow is the same
 * rules with nothing on them. That is the pack's own arrangement: go over it
 * once, then write it from nothing.
 */
function cursiveSheet(name,rows){
  var rowH=CT.fitRowH(name);
  var out=[CT.fullRow(name,{rowH:rowH,trace:true})];
  for(var i=1;i<rows;i++) out.push(CT.blankRow(rowH,'a line to write '+name+' on'));
  return '<style>'+CT.CSS+'</style><div class="cwrap">'+out.join('')+'</div>';
}

function say(msg){var n=el('nmsg'); if(n){n.textContent=msg||''; n.hidden=!msg;}}

/*
 * NOTHING IN HERE MAY THROW. A handler that throws stops firing, so one bad
 * character used to freeze the preview until a reload — which is exactly how
 * the cursive bug presented too. Everything is guarded and anything unexpected
 * is reported rather than swallowed.
 */
function build(){
  try{
  var name=clean(el('nm').value)||'Milo';
  var rows=Math.max(2,Math.min(10,parseInt(el('rw').value,10)||6));
  var cursive=document.querySelector('input[name=st]:checked').value==='cursive';
  var asked=rows;
  if(!cursive) rows=printRows(name,rows);
  var bad=unsupported(name);
  if(bad.length){
    say('There is no letter shape for '+bad.map(function(c){return '"'+c+'"';}).join(' or ')
      +'. The alphabet these are drawn from is A-Z, a-z, 0-9, and the apostrophe and hyphen.');
    return;
  }
  say(rows<asked
    ? 'Printed at this size, '+rows+' lines is what fits on one page. Cursive fits more, and '
      +'a longer name draws smaller so it fits more too.'
    : '');
  el('f-namer').srcdoc=S.sheet({
    big:name.charAt(0).toUpperCase(),
    title:name,
    sub:cursive?'Cursive name tracing':'Name tracing',
    dir:cursive
      ? 'Go over the grey name, then write it yourself on the lines below.'
      : 'Trace the grey letters. Start at each dot and follow the arrow.',
    footL:rows+' rows',
    body:cursive?cursiveSheet(name,rows):printSheet(name,rows)
  });
  }catch(e){ say('That name could not be drawn: '+(e&&e.message?e.message:e)); }
}

window.ktNamerPrint=function(){var f=el('f-namer');
  if(f&&f.contentWindow){f.contentWindow.focus();f.contentWindow.print();}
  return false;};

['nm','rw'].forEach(function(id){el(id).addEventListener('input',build);});
Array.prototype.forEach.call(document.querySelectorAll('input[name=st]'),function(r){r.addEventListener('change',build);});
build();
})();
/**
 * The scale-reference illustrations — dog, house, city, planet and the rest.
 *
 * These are painted to CANVAS TEXTURES rather than drawn with Phaser's Graphics
 * API, and that is the whole reason they look like objects instead of stacked
 * primitives. Graphics offers rectangles, circles and straight lines; it has no
 * bezier, no gradient, no clipping. Canvas2D has all three, so a dog can have
 * an actual curved spine, a planet an actual terminator, a coastline an actual
 * coastline.
 *
 * SHARED DESIGN RULES, so fourteen drawings read as one set:
 *  - Every object is a filled silhouette with a single dark outline of the same
 *    relative weight. A consistent outline is what makes flat art look drawn
 *    rather than assembled.
 *  - Light comes from the upper LEFT everywhere: lit faces up-left, shadow
 *    down-right, one soft highlight per rounded form.
 *  - Nothing is a bare axis-aligned box. Buildings get a side face so they read
 *    as solid; organic things are built from smooth curves through control
 *    points, never straight segments.
 *  - Each painter works in a 100x100 space with the GROUND at y=100 and the
 *    object centred on x=50, so the caller can scale one texture to any size.
 */

type Ctx = CanvasRenderingContext2D;

/** Design-space side length. Every painter draws inside 0..100 on both axes. */
export const REF_DESIGN = 100;

// --- palette ---------------------------------------------------------------
// Warm and slightly desaturated: these stand BESIDE the monster and the food,
// and must never out-shout them.
const OUT = "#5b4130"; // the one outline colour
const CREAM = "#fff4de";
const TAN = "#e9c89c";
const TAN_D = "#caa376";
const BROWN = "#a97c52";
const BROWN_D = "#7d5a3a";
const ROOF = "#b05a41";
const ROOF_D = "#8c4430";
const GLASS = "#bcd9e8";
const GLASS_D = "#8fb6c9";
const LIT = "#ffd98a"; // a lit window
const LEAF = "#8fae62";
const LEAF_D = "#6c8b47";
const STONE = "#c9bfae";
const STONE_D = "#a29682";
const STAR = "#fff6e0";
const SUNC = "#f7b733";
const WATER = "#84b6cc";
const WATER_D = "#5e93ab";

// --- drawing helpers -------------------------------------------------------

/** Outline weight, in design units, shared by everything. */
const LW = 2.1;

function stroke(ctx: Ctx, w = LW, color = OUT): void {
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.lineWidth = w;
  ctx.strokeStyle = color;
  ctx.stroke();
}

function fillStroke(ctx: Ctx, fill: string, w = LW): void {
  ctx.fillStyle = fill;
  ctx.fill();
  stroke(ctx, w);
}

/**
 * A smooth closed shape through control points — quadratics between successive
 * midpoints. This is what gives coastlines, animal bodies and clouds an organic
 * edge; joining the points with lineTo is exactly what made the old art look
 * like a polygon someone had given up on.
 */
function blob(ctx: Ctx, pts: [number, number][]): void {
  const n = pts.length;
  ctx.beginPath();
  let mx = (pts[n - 1][0] + pts[0][0]) / 2;
  let my = (pts[n - 1][1] + pts[0][1]) / 2;
  ctx.moveTo(mx, my);
  for (let i = 0; i < n; i++) {
    const cur = pts[i];
    const next = pts[(i + 1) % n];
    mx = (cur[0] + next[0]) / 2;
    my = (cur[1] + next[1]) / 2;
    ctx.quadraticCurveTo(cur[0], cur[1], mx, my);
  }
  ctx.closePath();
}

function roundRect(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

/** A soft radial glow, for suns, cores and portals. */
function glow(ctx: Ctx, x: number, y: number, r: number, color: string, a = 0.55): void {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.globalAlpha = a;
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

/** Deterministic pseudo-random, so star fields never re-roll between boots. */
function rnd(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** A soft ground shadow every object sits on, tying the set together. */
function groundShadow(ctx: Ctx, cx: number, w: number): void {
  ctx.globalAlpha = 0.16;
  ctx.fillStyle = OUT;
  ctx.beginPath();
  ctx.ellipse(cx, 99, w / 2, 4.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

/** A window with a sill and a mullion — the unit buildings are made of. */
function window4(ctx: Ctx, x: number, y: number, w: number, h: number, lit = false): void {
  roundRect(ctx, x, y, w, h, 1.1);
  fillStroke(ctx, lit ? LIT : GLASS, 1.2);
  ctx.beginPath();
  ctx.moveTo(x + w / 2, y);
  ctx.lineTo(x + w / 2, y + h);
  ctx.moveTo(x, y + h / 2);
  ctx.lineTo(x + w, y + h / 2);
  stroke(ctx, 0.7, "rgba(91,65,48,0.55)");
}

// --- the fourteen references ----------------------------------------------

/** 0 — Dog: a sitting pup in profile — one tapering head, floppy ear, collar. */
function dog(ctx: Ctx): void {
  groundShadow(ctx, 50, 66);
  // tail: a curl behind the haunch
  ctx.beginPath();
  ctx.moveTo(20, 74);
  ctx.bezierCurveTo(4, 70, 8, 48, 22, 54);
  stroke(ctx, 7, OUT);
  stroke(ctx, 4.6, TAN_D);
  // hind haunch
  ctx.beginPath();
  ctx.ellipse(32, 74, 16, 18, 0.08, 0, Math.PI * 2);
  fillStroke(ctx, TAN_D);
  // back legs / paw
  roundRect(ctx, 24, 84, 20, 13, 6);
  fillStroke(ctx, TAN_D);
  // front legs, drawn BEFORE the body so the body covers their tops and they
  // read as limbs emerging from the chest. Over the body they looked like two
  // pale posts parked in front of the dog.
  const foreleg = (lx: number, fill: string) => {
    ctx.beginPath();
    ctx.moveTo(lx - 6, 58);
    ctx.quadraticCurveTo(lx - 4.8, 76, lx - 4.3, 93);
    ctx.quadraticCurveTo(lx - 4.5, 98, lx, 98);
    ctx.quadraticCurveTo(lx + 4.5, 98, lx + 4.3, 93);
    ctx.quadraticCurveTo(lx + 4.8, 76, lx + 6, 58);
    ctx.closePath();
    fillStroke(ctx, fill);
    ctx.beginPath();
    ctx.moveTo(lx, 94);
    ctx.lineTo(lx, 97.2);
    stroke(ctx, 0.9, "rgba(91,65,48,0.5)");
  };
  foreleg(62.5, TAN_D);
  foreleg(73, TAN);
  // body: rises from rump to a higher shoulder, so it sits rather than lies
  blob(ctx, [
    [28, 66],
    [40, 56],
    [56, 52],
    [68, 58],
    [72, 74],
    [64, 88],
    [42, 90],
    [28, 82],
  ]);
  fillStroke(ctx, TAN);
  // pale chest, clipped inside the body
  ctx.save();
  blob(ctx, [
    [28, 66],
    [40, 56],
    [56, 52],
    [68, 58],
    [72, 74],
    [64, 88],
    [42, 90],
    [28, 82],
  ]);
  ctx.clip();
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = CREAM;
  ctx.beginPath();
  ctx.ellipse(64, 82, 17, 13, -0.35, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.restore();
  // HEAD — cranium and muzzle in ONE silhouette, tapering to the nose.
  // Drawn as two separate blobs before, which is why it looked bolted on.
  blob(ctx, [
    [52, 44],
    [60, 32],
    [74, 30],
    [84, 38],
    [90, 46],
    [93, 52],
    [86, 57],
    [74, 56],
    [62, 58],
    [52, 54],
  ]);
  fillStroke(ctx, TAN);
  // muzzle lightening, clipped to the head so the edge stays one line
  ctx.save();
  blob(ctx, [
    [52, 44],
    [60, 32],
    [74, 30],
    [84, 38],
    [90, 46],
    [93, 52],
    [86, 57],
    [74, 56],
    [62, 58],
    [52, 54],
  ]);
  ctx.clip();
  ctx.fillStyle = CREAM;
  blob(ctx, [
    [76, 44],
    [90, 44],
    [95, 51],
    [88, 58],
    [76, 57],
  ]);
  ctx.fill();
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = TAN_D;
  ctx.beginPath();
  ctx.ellipse(66, 54, 16, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.restore();
  // mouth line
  ctx.beginPath();
  ctx.moveTo(80, 53);
  ctx.quadraticCurveTo(86, 55, 90, 52);
  stroke(ctx, 1.1, "rgba(91,65,48,0.6)");
  // nose at the tip
  ctx.beginPath();
  ctx.ellipse(91.5, 47.5, 3.6, 3, -0.25, 0, Math.PI * 2);
  ctx.fillStyle = OUT;
  ctx.fill();
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = STAR;
  ctx.beginPath();
  ctx.arc(90.4, 46.4, 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  // floppy ear, hanging over the side of the head
  blob(ctx, [
    [60, 31],
    [70, 28],
    [73, 40],
    [68, 52],
    [58, 48],
    [55, 38],
  ]);
  fillStroke(ctx, BROWN);
  ctx.save();
  blob(ctx, [
    [60, 31],
    [70, 28],
    [73, 40],
    [68, 52],
    [58, 48],
    [55, 38],
  ]);
  ctx.clip();
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = OUT;
  ctx.fillRect(0, 42, 100, 20);
  ctx.globalAlpha = 1;
  ctx.restore();
  // eye
  ctx.beginPath();
  ctx.arc(79, 43, 2.9, 0, Math.PI * 2);
  ctx.fillStyle = OUT;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(78, 42, 1.1, 0, Math.PI * 2);
  ctx.fillStyle = STAR;
  ctx.fill();
  // eyebrow dot, the thing that gives it an expression
  ctx.globalAlpha = 0.45;
  ctx.fillStyle = BROWN_D;
  ctx.beginPath();
  ctx.ellipse(80, 37, 3.2, 1.4, -0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  // collar with a tag
  ctx.beginPath();
  ctx.moveTo(58, 58);
  ctx.quadraticCurveTo(66, 65, 75, 57);
  stroke(ctx, 5, ROOF);
  stroke(ctx, 1.2, OUT);
  ctx.beginPath();
  ctx.arc(67, 64.5, 2.4, 0, Math.PI * 2);
  fillStroke(ctx, SUNC, 1);
}

/** 1 — Human: a baker — jacket, apron with strings, toque, wooden spoon. */
function human(ctx: Ctx): void {
  groundShadow(ctx, 50, 38);
  // legs + shoes
  roundRect(ctx, 42.5, 72, 6.5, 23, 3);
  fillStroke(ctx, BROWN_D);
  roundRect(ctx, 51, 72, 6.5, 23, 3);
  fillStroke(ctx, BROWN_D);
  roundRect(ctx, 39.5, 92, 12, 5.5, 2.6);
  fillStroke(ctx, OUT, 1.3);
  roundRect(ctx, 48.5, 92, 12, 5.5, 2.6);
  fillStroke(ctx, "#6b4a33", 1.3);
  // jacket: shoulders narrower than hips, so it reads as a body not a box
  blob(ctx, [
    [39, 47],
    [50, 43],
    [61, 47],
    [64, 60],
    [63, 74],
    [50, 77],
    [37, 74],
    [36, 60],
  ]);
  fillStroke(ctx, CREAM);
  // apron, clipped so it follows the jacket's edge exactly
  ctx.save();
  blob(ctx, [
    [39, 47],
    [50, 43],
    [61, 47],
    [64, 60],
    [63, 74],
    [50, 77],
    [37, 74],
    [36, 60],
  ]);
  ctx.clip();
  blob(ctx, [
    [43, 55],
    [50, 53],
    [57, 55],
    [59, 66],
    [58, 78],
    [42, 78],
    [41, 66],
  ]);
  ctx.fillStyle = TAN;
  ctx.fill();
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = OUT;
  ctx.fillRect(0, 70, 100, 12);
  ctx.globalAlpha = 1;
  ctx.restore();
  blob(ctx, [
    [43, 55],
    [50, 53],
    [57, 55],
    [59, 66],
    [58, 78],
    [42, 78],
    [41, 66],
  ]);
  stroke(ctx, 1.3, "rgba(91,65,48,0.55)");
  // waist tie
  ctx.beginPath();
  ctx.moveTo(40, 64);
  ctx.quadraticCurveTo(50, 67, 60, 64);
  stroke(ctx, 2.6, BROWN);
  stroke(ctx, 0.9, OUT);
  // buttons
  ctx.fillStyle = "rgba(91,65,48,0.5)";
  for (const by of [50, 56]) {
    ctx.beginPath();
    ctx.arc(50, by, 1.1, 0, Math.PI * 2);
    ctx.fill();
  }
  // arms hanging at the sides, slightly bent outward
  ctx.beginPath();
  ctx.moveTo(39, 50);
  ctx.quadraticCurveTo(32, 60, 34, 70);
  stroke(ctx, 8.6, OUT);
  stroke(ctx, 6.2, CREAM);
  ctx.beginPath();
  ctx.moveTo(61, 50);
  ctx.quadraticCurveTo(68, 60, 66, 70);
  stroke(ctx, 8.6, OUT);
  stroke(ctx, 6.2, CREAM);
  // hands
  ctx.beginPath();
  ctx.arc(34, 72, 3.8, 0, Math.PI * 2);
  fillStroke(ctx, "#f0c396", 1.3);
  ctx.beginPath();
  ctx.arc(66, 72, 3.8, 0, Math.PI * 2);
  fillStroke(ctx, "#f0c396", 1.3);
  // a wooden spoon in the right hand — the prop that says "baker"
  ctx.beginPath();
  ctx.moveTo(67, 71);
  ctx.lineTo(74, 55);
  stroke(ctx, 2.6, BROWN);
  stroke(ctx, 0.9, OUT);
  ctx.beginPath();
  ctx.ellipse(75.2, 51.5, 4, 5.4, 0.35, 0, Math.PI * 2);
  fillStroke(ctx, TAN, 1.3);
  // neck
  roundRect(ctx, 47, 40, 6, 6, 2);
  fillStroke(ctx, "#dcaf86", 1.2);
  // head
  ctx.beginPath();
  ctx.ellipse(50, 32, 10.5, 11, 0, 0, Math.PI * 2);
  fillStroke(ctx, "#f0c396");
  // face
  ctx.fillStyle = OUT;
  ctx.beginPath();
  ctx.arc(46.2, 31.5, 1.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(53.8, 31.5, 1.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(50, 33.5, 3.6, 0.3, Math.PI - 0.3);
  stroke(ctx, 1.3);
  ctx.globalAlpha = 0.4;
  ctx.fillStyle = "#e2705f";
  ctx.beginPath();
  ctx.ellipse(42.6, 34.5, 3, 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(57.4, 34.5, 3, 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  // TOQUE: a band with a puffed crown of overlapping lobes
  blob(ctx, [
    [38, 20],
    [40, 12],
    [46, 7],
    [54, 7],
    [60, 12],
    [62, 20],
    [58, 23],
    [42, 23],
  ]);
  fillStroke(ctx, "#fffaf0");
  // lobe seams, so the crown reads as pleated cloth
  ctx.beginPath();
  ctx.moveTo(45, 21);
  ctx.quadraticCurveTo(44, 13, 47.5, 8.5);
  ctx.moveTo(55, 21);
  ctx.quadraticCurveTo(56, 13, 52.5, 8.5);
  stroke(ctx, 1, "rgba(91,65,48,0.4)");
  roundRect(ctx, 37.5, 20, 25, 6.5, 2.4);
  fillStroke(ctx, "#fffaf0", 1.6);
}

/** 2 — Car: side view, curved roofline, wheel arches, glass and lights. */
function car(ctx: Ctx): void {
  groundShadow(ctx, 50, 74);
  // body: one silhouette with a real roofline
  ctx.beginPath();
  ctx.moveTo(12, 82);
  ctx.lineTo(12, 72);
  ctx.quadraticCurveTo(13, 64, 24, 62);
  ctx.bezierCurveTo(30, 48, 44, 44, 56, 45);
  ctx.bezierCurveTo(66, 46, 72, 52, 76, 62);
  ctx.quadraticCurveTo(87, 64, 88, 72);
  ctx.lineTo(88, 82);
  ctx.closePath();
  fillStroke(ctx, ROOF);
  // lower body shading
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(12, 82);
  ctx.lineTo(12, 72);
  ctx.quadraticCurveTo(13, 64, 24, 62);
  ctx.bezierCurveTo(30, 48, 44, 44, 56, 45);
  ctx.bezierCurveTo(66, 46, 72, 52, 76, 62);
  ctx.quadraticCurveTo(87, 64, 88, 72);
  ctx.lineTo(88, 82);
  ctx.closePath();
  ctx.clip();
  ctx.fillStyle = ROOF_D;
  ctx.fillRect(0, 73, 100, 12);
  // a long body highlight along the shoulder
  ctx.globalAlpha = 0.32;
  ctx.fillStyle = CREAM;
  roundRect(ctx, 18, 65, 62, 3.4, 1.7);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.restore();
  // glass: two panes split by a pillar
  ctx.beginPath();
  ctx.moveTo(31, 60);
  ctx.bezierCurveTo(34, 51, 43, 48, 48, 48);
  ctx.lineTo(48, 60);
  ctx.closePath();
  fillStroke(ctx, GLASS, 1.5);
  ctx.beginPath();
  ctx.moveTo(52, 48);
  ctx.bezierCurveTo(60, 48, 66, 52, 70, 60);
  ctx.lineTo(52, 60);
  ctx.closePath();
  fillStroke(ctx, GLASS_D, 1.5);
  // door line + handle
  ctx.beginPath();
  ctx.moveTo(50, 62);
  ctx.lineTo(50, 78);
  stroke(ctx, 1.1, "rgba(91,65,48,0.55)");
  roundRect(ctx, 55, 67, 6, 1.8, 0.9);
  ctx.fillStyle = STONE;
  ctx.fill();
  // headlight / tail light
  roundRect(ctx, 84, 66, 5, 4.5, 2);
  fillStroke(ctx, LIT, 1.2);
  roundRect(ctx, 12, 67, 4, 4, 1.6);
  fillStroke(ctx, "#e2705f", 1.2);
  // wheels with arches
  for (const wx of [30, 70]) {
    ctx.beginPath();
    ctx.arc(wx, 82, 11, 0, Math.PI * 2);
    fillStroke(ctx, "#43342a");
    ctx.beginPath();
    ctx.arc(wx, 82, 5.2, 0, Math.PI * 2);
    fillStroke(ctx, STONE, 1.3);
    ctx.beginPath();
    ctx.arc(wx, 82, 1.8, 0, Math.PI * 2);
    ctx.fillStyle = STONE_D;
    ctx.fill();
  }
}

/** 3 — House: three-quarter view with a side face, so it reads as solid. */
function house(ctx: Ctx): void {
  groundShadow(ctx, 50, 70);
  // side face (right), darker
  ctx.beginPath();
  ctx.moveTo(66, 54);
  ctx.lineTo(84, 47);
  ctx.lineTo(84, 88);
  ctx.lineTo(66, 95);
  ctx.closePath();
  fillStroke(ctx, TAN_D);
  // front face
  roundRect(ctx, 22, 54, 44, 41, 1.5);
  fillStroke(ctx, CREAM);
  // roof: front slope + side slope, with overhang
  ctx.beginPath();
  ctx.moveTo(17, 56);
  ctx.lineTo(44, 32);
  ctx.lineTo(71, 56);
  ctx.closePath();
  fillStroke(ctx, ROOF);
  ctx.beginPath();
  ctx.moveTo(44, 32);
  ctx.lineTo(62, 25);
  ctx.lineTo(89, 49);
  ctx.lineTo(71, 56);
  ctx.closePath();
  fillStroke(ctx, ROOF_D);
  // ridge line
  ctx.beginPath();
  ctx.moveTo(44, 32);
  ctx.lineTo(62, 25);
  stroke(ctx, 1.4);
  // chimney
  roundRect(ctx, 66, 20, 9, 15, 1);
  fillStroke(ctx, ROOF_D, 1.6);
  // door with a step
  roundRect(ctx, 30, 72, 13, 23, 1.2);
  fillStroke(ctx, BROWN);
  ctx.beginPath();
  ctx.arc(40, 84, 1.2, 0, Math.PI * 2);
  ctx.fillStyle = SUNC;
  ctx.fill();
  roundRect(ctx, 28, 93, 17, 3.5, 1.4);
  fillStroke(ctx, STONE, 1.3);
  // windows
  window4(ctx, 48, 62, 13, 12, true);
  window4(ctx, 48, 79, 13, 12, false);
  // a small shrub for scale and life
  ctx.beginPath();
  ctx.ellipse(15, 91, 7, 6, 0, 0, Math.PI * 2);
  fillStroke(ctx, LEAF_D, 1.5);
  ctx.beginPath();
  ctx.ellipse(13.5, 89.5, 4, 3.4, 0, 0, Math.PI * 2);
  ctx.fillStyle = LEAF;
  ctx.fill();
}

/** 4 — Building: a mid-rise with a side face, parapet and lit windows. */
function building(ctx: Ctx): void {
  groundShadow(ctx, 50, 58);
  const lit = rnd(4210);
  // side face
  ctx.beginPath();
  ctx.moveTo(64, 22);
  ctx.lineTo(80, 16);
  ctx.lineTo(80, 90);
  ctx.lineTo(64, 96);
  ctx.closePath();
  fillStroke(ctx, TAN_D);
  // front
  roundRect(ctx, 26, 22, 38, 74, 1.5);
  fillStroke(ctx, CREAM);
  // parapet cap
  roundRect(ctx, 23, 17, 44, 6, 1.5);
  fillStroke(ctx, STONE);
  ctx.beginPath();
  ctx.moveTo(67, 20);
  ctx.lineTo(83, 14);
  ctx.lineTo(83, 19);
  ctx.lineTo(67, 25);
  ctx.closePath();
  fillStroke(ctx, STONE_D, 1.6);
  // window grid, some lit
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 3; c++) {
      window4(ctx, 30 + c * 11, 27 + r * 10.5, 8, 7.5, lit() > 0.62);
    }
  }
  // side-face windows, in perspective
  for (let r = 0; r < 6; r++) {
    const t = 27 + r * 10.5;
    ctx.beginPath();
    ctx.moveTo(67, t + 1);
    ctx.lineTo(77, t - 2.6);
    ctx.lineTo(77, t + 5);
    ctx.lineTo(67, t + 8.5);
    ctx.closePath();
    fillStroke(ctx, GLASS_D, 0.9);
  }
  // ground-floor entrance with a canopy
  roundRect(ctx, 38, 80, 15, 16, 1.2);
  fillStroke(ctx, GLASS_D, 1.4);
  roundRect(ctx, 35, 76, 21, 4, 1.6);
  fillStroke(ctx, ROOF, 1.4);
}

/** 5 — Town: a handful of small buildings and trees on a low rise. */
function town(ctx: Ctx): void {
  groundShadow(ctx, 50, 88);
  // gentle ground rise so it isn't a flat row
  ctx.beginPath();
  ctx.moveTo(2, 96);
  ctx.quadraticCurveTo(50, 84, 98, 96);
  ctx.lineTo(98, 100);
  ctx.lineTo(2, 100);
  ctx.closePath();
  fillStroke(ctx, LEAF_D, 1.5);

  const cottage = (x: number, w: number, h: number, roofC: string) => {
    const y = 92 - h;
    roundRect(ctx, x, y, w, h, 1.2);
    fillStroke(ctx, CREAM, 1.6);
    ctx.beginPath();
    ctx.moveTo(x - 3, y + 1);
    ctx.lineTo(x + w / 2, y - h * 0.42);
    ctx.lineTo(x + w + 3, y + 1);
    ctx.closePath();
    fillStroke(ctx, roofC, 1.6);
    window4(ctx, x + w * 0.22, y + h * 0.3, w * 0.26, h * 0.3, true);
  };
  // church with a spire, the landmark that makes it read as a village
  const cx = 50;
  roundRect(ctx, cx - 8, 56, 16, 36, 1.2);
  fillStroke(ctx, STONE, 1.6);
  ctx.beginPath();
  ctx.moveTo(cx - 10, 57);
  ctx.lineTo(cx, 30);
  ctx.lineTo(cx + 10, 57);
  ctx.closePath();
  fillStroke(ctx, ROOF_D, 1.6);
  ctx.beginPath();
  ctx.moveTo(cx, 30);
  ctx.lineTo(cx, 24);
  stroke(ctx, 1.6);
  ctx.beginPath();
  ctx.moveTo(cx - 2.5, 26);
  ctx.lineTo(cx + 2.5, 26);
  stroke(ctx, 1.6);
  window4(ctx, cx - 4, 66, 8, 12, true);

  cottage(14, 18, 24, ROOF);
  cottage(30, 15, 19, ROOF_D);
  cottage(64, 17, 22, ROOF);
  cottage(80, 14, 17, ROOF_D);

  // trees
  for (const [tx, ty, s] of [
    [8, 90, 1],
    [46, 92, 0.8],
    [96, 91, 0.9],
  ] as [number, number, number][]) {
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(tx, ty - 8 * s);
    stroke(ctx, 2.2 * s, BROWN_D);
    ctx.beginPath();
    ctx.ellipse(tx, ty - 12 * s, 6 * s, 7 * s, 0, 0, Math.PI * 2);
    fillStroke(ctx, LEAF, 1.5);
  }
}

/** 6 — City: a dense skyline with setbacks, haze and a standout tower. */
function city(ctx: Ctx): void {
  groundShadow(ctx, 50, 96);
  const lit = rnd(9931);
  type T = [number, number, number, string];
  // back row, hazier
  const back: T[] = [
    [6, 16, 44, STONE_D],
    [24, 14, 58, STONE_D],
    [58, 15, 52, STONE_D],
    [78, 16, 62, STONE_D],
  ];
  ctx.globalAlpha = 0.55;
  for (const [x, w, h, c] of back) {
    roundRect(ctx, x, 96 - h, w, h, 1);
    ctx.fillStyle = c;
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  const tower = (x: number, w: number, h: number, face: string, side: string) => {
    const y = 96 - h;
    // side face for depth
    ctx.beginPath();
    ctx.moveTo(x + w, y + 3);
    ctx.lineTo(x + w + 6, y);
    ctx.lineTo(x + w + 6, 93);
    ctx.lineTo(x + w, 96);
    ctx.closePath();
    fillStroke(ctx, side, 1.4);
    roundRect(ctx, x, y, w, h, 1.2);
    fillStroke(ctx, face, 1.5);
    const cols = Math.max(2, Math.floor(w / 6));
    const rows = Math.floor(h / 9);
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const wx = x + 2.4 + c * ((w - 4) / cols);
        roundRect(ctx, wx, y + 3.5 + r * 9, (w - 4) / cols - 1.6, 5.5, 0.7);
        ctx.fillStyle = lit() > 0.55 ? LIT : GLASS_D;
        ctx.fill();
      }
  };
  tower(4, 15, 40, CREAM, TAN_D);
  tower(30, 17, 60, CREAM, TAN_D);
  tower(62, 14, 46, CREAM, TAN_D);
  tower(82, 13, 34, CREAM, TAN_D);
  // the centre spire, tallest, with an antenna
  tower(46, 15, 78, "#fff8e8", TAN_D);
  ctx.beginPath();
  ctx.moveTo(53.5, 18);
  ctx.lineTo(53.5, 6);
  stroke(ctx, 1.8);
  ctx.beginPath();
  ctx.arc(53.5, 5, 2, 0, Math.PI * 2);
  fillStroke(ctx, "#e2705f", 1);
  // street haze
  ctx.globalAlpha = 0.3;
  const hz = ctx.createLinearGradient(0, 84, 0, 98);
  hz.addColorStop(0, "rgba(255,244,222,0)");
  hz.addColorStop(1, "rgba(255,244,222,1)");
  ctx.fillStyle = hz;
  ctx.fillRect(0, 84, 100, 14);
  ctx.globalAlpha = 1;
}

/** 7 — Country: a mapped landmass with a coast, river, hills and a flag. */
function country(ctx: Ctx): void {
  groundShadow(ctx, 50, 84);
  const land: [number, number][] = [
    [12, 74],
    [20, 56],
    [38, 48],
    [56, 52],
    [70, 44],
    [86, 54],
    [90, 70],
    [76, 84],
    [52, 88],
    [26, 86],
  ];
  blob(ctx, land);
  fillStroke(ctx, LEAF);
  // interior shading + features, clipped to the land
  ctx.save();
  blob(ctx, land);
  ctx.clip();
  ctx.globalAlpha = 0.4;
  ctx.fillStyle = LEAF_D;
  ctx.fillRect(0, 70, 100, 30);
  ctx.globalAlpha = 1;
  // river
  ctx.beginPath();
  ctx.moveTo(30, 50);
  ctx.bezierCurveTo(40, 62, 52, 64, 58, 86);
  stroke(ctx, 3.2, WATER);
  stroke(ctx, 1.6, "#a9d3e2");
  // hills
  for (const [hx, hy, s] of [
    [34, 62, 1],
    [46, 58, 0.8],
    [70, 62, 0.9],
  ] as [number, number, number][]) {
    ctx.beginPath();
    ctx.moveTo(hx - 9 * s, hy + 6 * s);
    ctx.quadraticCurveTo(hx, hy - 7 * s, hx + 9 * s, hy + 6 * s);
    ctx.closePath();
    fillStroke(ctx, BROWN, 1.3);
    ctx.beginPath();
    ctx.moveTo(hx - 3 * s, hy + 0.5 * s);
    ctx.quadraticCurveTo(hx, hy - 7 * s, hx + 3 * s, hy + 0.5 * s);
    ctx.closePath();
    ctx.fillStyle = CREAM;
    ctx.fill();
  }
  ctx.restore();
  // border dashes just inside the coast
  ctx.save();
  ctx.setLineDash([3, 3]);
  blob(ctx, land);
  stroke(ctx, 1.1, "rgba(91,65,48,0.55)");
  ctx.setLineDash([]);
  ctx.restore();
  // flag
  ctx.beginPath();
  ctx.moveTo(50, 52);
  ctx.lineTo(50, 16);
  stroke(ctx, 2.2, BROWN_D);
  ctx.beginPath();
  ctx.moveTo(51, 17);
  ctx.lineTo(51, 30);
  ctx.quadraticCurveTo(64, 26, 74, 30);
  ctx.lineTo(74, 17);
  ctx.quadraticCurveTo(64, 13, 51, 17);
  ctx.closePath();
  fillStroke(ctx, ROOF, 1.5);
  ctx.beginPath();
  ctx.arc(50, 15, 2.2, 0, Math.PI * 2);
  fillStroke(ctx, SUNC, 1.2);
}

/** 8 — Continent: a larger landmass, mountain ranges, a lake, on ocean. */
function continent(ctx: Ctx): void {
  // ocean disc behind, so it reads as land IN something
  ctx.beginPath();
  ctx.ellipse(50, 62, 47, 38, 0, 0, Math.PI * 2);
  fillStroke(ctx, WATER_D);
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(50, 62, 47, 38, 0, 0, Math.PI * 2);
  ctx.clip();
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = WATER;
  ctx.beginPath();
  ctx.ellipse(38, 46, 30, 18, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  // wave ticks
  for (const [wx, wy] of [
    [16, 76],
    [26, 84],
    [78, 78],
    [86, 66],
  ] as [number, number][]) {
    ctx.beginPath();
    ctx.moveTo(wx - 4, wy);
    ctx.quadraticCurveTo(wx, wy - 2, wx + 4, wy);
    stroke(ctx, 1.1, "rgba(255,244,222,0.75)");
  }
  ctx.restore();

  const land: [number, number][] = [
    [22, 70],
    [18, 52],
    [32, 38],
    [50, 34],
    [62, 42],
    [78, 40],
    [84, 56],
    [74, 74],
    [56, 82],
    [34, 80],
  ];
  blob(ctx, land);
  fillStroke(ctx, LEAF);
  ctx.save();
  blob(ctx, land);
  ctx.clip();
  // arid south
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = TAN;
  ctx.fillRect(0, 66, 100, 34);
  ctx.globalAlpha = 1;
  // mountain range, overlapping peaks
  for (let i = 0; i < 6; i++) {
    const mx = 30 + i * 8;
    const my = 52 + (i % 2) * 4;
    ctx.beginPath();
    ctx.moveTo(mx - 8, my + 7);
    ctx.lineTo(mx, my - 8);
    ctx.lineTo(mx + 8, my + 7);
    ctx.closePath();
    fillStroke(ctx, i % 2 ? BROWN_D : BROWN, 1.2);
    ctx.beginPath();
    ctx.moveTo(mx - 2.6, my - 2.6);
    ctx.lineTo(mx, my - 8);
    ctx.lineTo(mx + 2.6, my - 2.6);
    ctx.closePath();
    ctx.fillStyle = CREAM;
    ctx.fill();
  }
  // lake
  ctx.beginPath();
  ctx.ellipse(62, 62, 8, 5.5, 0.3, 0, Math.PI * 2);
  fillStroke(ctx, WATER, 1.2);
  ctx.restore();
}

/** 9 — Planet: lit limb, terminator, atmosphere rim, ring with occlusion. */
function planet(ctx: Ctx): void {
  const cx = 50;
  const cy = 54;
  const r = 30;
  // back half of the ring
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, 100, cy + 2);
  ctx.clip();
  ctx.beginPath();
  ctx.ellipse(cx, cy + 4, 46, 13, -0.16, 0, Math.PI * 2);
  stroke(ctx, 5.5, TAN_D);
  stroke(ctx, 2.4, TAN);
  ctx.restore();
  // atmosphere glow
  glow(ctx, cx, cy, r * 1.5, "rgba(150,205,230,0.85)", 0.5);
  // globe
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  fillStroke(ctx, WATER);
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  // continents
  blob(ctx, [
    [30, 40],
    [44, 34],
    [54, 42],
    [46, 52],
    [32, 52],
  ]);
  ctx.fillStyle = LEAF;
  ctx.fill();
  blob(ctx, [
    [52, 60],
    [66, 56],
    [72, 66],
    [60, 74],
    [50, 70],
  ]);
  ctx.fillStyle = LEAF_D;
  ctx.fill();
  blob(ctx, [
    [24, 62],
    [34, 60],
    [38, 70],
    [26, 74],
  ]);
  ctx.fillStyle = LEAF;
  ctx.fill();
  // polar cap
  ctx.beginPath();
  ctx.ellipse(cx, cy - r + 5, 15, 6, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#f2f8fb";
  ctx.fill();
  // terminator: night side falling off to the lower right
  const term = ctx.createLinearGradient(cx - r * 0.4, cy - r * 0.5, cx + r, cy + r);
  term.addColorStop(0, "rgba(30,28,60,0)");
  term.addColorStop(1, "rgba(30,28,60,0.62)");
  ctx.fillStyle = term;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  // specular highlight, upper left
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = STAR;
  ctx.beginPath();
  ctx.ellipse(cx - 11, cy - 13, 10, 7, -0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.restore();
  // front half of the ring
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, cy + 2, 100, 100 - cy);
  ctx.clip();
  ctx.beginPath();
  ctx.ellipse(cx, cy + 4, 46, 13, -0.16, 0, Math.PI * 2);
  stroke(ctx, 5.5, TAN_D);
  stroke(ctx, 2.4, CREAM);
  ctx.restore();
  // a small moon
  ctx.beginPath();
  ctx.arc(88, 26, 5.5, 0, Math.PI * 2);
  fillStroke(ctx, STONE, 1.4);
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = STONE_D;
  ctx.beginPath();
  ctx.arc(90, 28, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

/** 10 — Solar system: a sun, orbit ellipses and planets on them. */
function solarSystem(ctx: Ctx): void {
  const cx = 50;
  const cy = 56;
  // orbits, drawn behind
  const orbits = [22, 33, 44];
  for (const o of orbits) {
    ctx.beginPath();
    ctx.ellipse(cx, cy, o, o * 0.34, -0.1, 0, Math.PI * 2);
    stroke(ctx, 1.3, "rgba(91,65,48,0.5)");
  }
  // sun with corona
  glow(ctx, cx, cy, 30, "rgba(247,183,51,0.95)", 0.75);
  ctx.beginPath();
  ctx.arc(cx, cy, 13, 0, Math.PI * 2);
  fillStroke(ctx, SUNC);
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = "#ffe9a8";
  ctx.beginPath();
  ctx.arc(cx - 4, cy - 4, 6.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  // planets sitting ON the orbit paths
  const on = (o: number, ang: number, rad: number, col: string, ring = false) => {
    const px = cx + Math.cos(ang) * o;
    const py = cy + Math.sin(ang) * o * 0.34;
    if (ring) {
      ctx.beginPath();
      ctx.ellipse(px, py, rad * 2.1, rad * 0.75, -0.2, 0, Math.PI * 2);
      stroke(ctx, 1.8, TAN_D);
    }
    ctx.beginPath();
    ctx.arc(px, py, rad, 0, Math.PI * 2);
    fillStroke(ctx, col, 1.4);
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = STAR;
    ctx.beginPath();
    ctx.arc(px - rad * 0.32, py - rad * 0.32, rad * 0.42, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  };
  on(22, 2.5, 3.4, ROOF);
  on(33, 0.5, 5, WATER);
  on(44, 3.5, 6.2, TAN, true);
  // a few background stars
  const r = rnd(777);
  ctx.fillStyle = STAR;
  for (let i = 0; i < 14; i++) {
    const sx = r() * 100;
    const sy = r() * 100;
    if (Math.hypot(sx - cx, (sy - cy) / 0.4) < 48) continue;
    ctx.globalAlpha = 0.4 + r() * 0.5;
    ctx.beginPath();
    ctx.arc(sx, sy, 0.7 + r() * 0.9, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/**
 * 11 — Universe: a barred spiral galaxy on its own patch of deep space.
 *
 * The first attempt was pale stars straight onto the cream page and read as a
 * smudge — light-on-light has no contrast. It now sits on a soft dark nebula
 * disc, which is what lets the arms and core actually show.
 */
function universe(ctx: Ctx): void {
  const cx = 50;
  const cy = 52;
  const r = rnd(20260);

  // deep-space backdrop: a soft dark ellipse that fades out, so it never has a
  // hard edge against the cream page
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.24);
  ctx.scale(1, 0.62);
  const bg = ctx.createRadialGradient(0, 0, 4, 0, 0, 50);
  bg.addColorStop(0, "rgba(38,30,66,0.95)");
  bg.addColorStop(0.55, "rgba(48,38,82,0.72)");
  bg.addColorStop(1, "rgba(58,46,96,0)");
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.arc(0, 0, 50, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // the arms, in the galaxy's own squashed frame
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.24);
  ctx.scale(1, 0.5);

  // soft arm bands first, so the star dots sit on something
  for (const turn of [0, Math.PI]) {
    ctx.beginPath();
    for (let i = 0; i <= 60; i++) {
      const t = i / 60;
      const ang = turn + t * Math.PI * 1.7;
      const rad = 8 + Math.exp(t * 2.5) * 3.2;
      const px = Math.cos(ang) * rad;
      const py = Math.sin(ang) * rad;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.globalAlpha = 0.5;
    stroke(ctx, 13, "rgba(150,125,205,0.55)");
    ctx.globalAlpha = 0.75;
    stroke(ctx, 6.5, "rgba(206,186,240,0.7)");
    ctx.globalAlpha = 1;
  }

  // bright stars threaded along the arms
  for (const turn of [0, Math.PI]) {
    for (let i = 0; i < 120; i++) {
      const t = i / 119;
      const ang = turn + t * Math.PI * 1.7;
      const rad = 8 + Math.exp(t * 2.5) * 3.2;
      const spread = 3 + t * 7;
      const px = Math.cos(ang) * rad + (r() - 0.5) * spread;
      const py = Math.sin(ang) * rad + (r() - 0.5) * spread;
      ctx.globalAlpha = 0.5 + (1 - t) * 0.5;
      ctx.fillStyle = t < 0.35 ? "#fff4d2" : r() > 0.7 ? "#bcd9ff" : "#f3e6ff";
      ctx.beginPath();
      ctx.arc(px, py, Math.max(0.6, 2.1 - t * 1.1), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;

  // the central bar, angled across the core
  ctx.beginPath();
  ctx.ellipse(0, 0, 17, 6.5, 0.25, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,238,190,0.9)";
  ctx.fill();
  ctx.restore();

  // core glow, drawn unsquashed so it stays round and bright
  glow(ctx, cx, cy, 22, "rgba(255,236,180,0.95)", 0.9);
  ctx.beginPath();
  ctx.ellipse(cx, cy, 7, 5, -0.24, 0, Math.PI * 2);
  ctx.fillStyle = "#fffdf5";
  ctx.fill();

  // a few foreground stars with cross flares, for depth
  ctx.fillStyle = STAR;
  for (let i = 0; i < 26; i++) {
    const sx = r() * 100;
    const sy = r() * 100;
    const d = Math.hypot(sx - cx, (sy - cy) / 0.62);
    if (d < 14) continue;
    ctx.globalAlpha = 0.35 + r() * 0.55;
    const sr = 0.6 + r() * 1.1;
    ctx.beginPath();
    ctx.arc(sx, sy, sr, 0, Math.PI * 2);
    ctx.fill();
    if (sr > 1.4) {
      ctx.beginPath();
      ctx.moveTo(sx - sr * 3, sy);
      ctx.lineTo(sx + sr * 3, sy);
      ctx.moveTo(sx, sy - sr * 3);
      ctx.lineTo(sx, sy + sr * 3);
      stroke(ctx, 0.5, "rgba(255,246,224,0.75)");
    }
  }
  ctx.globalAlpha = 1;
}

/** 12 — Multiverse: nested bubble universes, each with its own galaxy. */
function multiverse(ctx: Ctx): void {
  const r = rnd(5150);
  const bubble = (bx: number, by: number, rad: number, tint: string) => {
    // filament linking it to the cluster centre
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.quadraticCurveTo((bx + 50) / 2, (by + 52) / 2 - 6, 50, 52);
    stroke(ctx, 1, "rgba(91,65,48,0.28)");
    // glassy sphere
    const g = ctx.createRadialGradient(
      bx - rad * 0.35,
      by - rad * 0.4,
      rad * 0.1,
      bx,
      by,
      rad
    );
    g.addColorStop(0, "rgba(255,250,240,0.95)");
    g.addColorStop(0.55, tint);
    g.addColorStop(1, "rgba(58,52,85,0.85)");
    ctx.beginPath();
    ctx.arc(bx, by, rad, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
    stroke(ctx, 1.5, "rgba(91,65,48,0.7)");
    // a tiny galaxy inside
    ctx.save();
    ctx.beginPath();
    ctx.arc(bx, by, rad * 0.94, 0, Math.PI * 2);
    ctx.clip();
    ctx.translate(bx, by);
    ctx.rotate(r() * Math.PI);
    ctx.scale(1, 0.45);
    for (const turn of [0, Math.PI]) {
      for (let i = 0; i < 26; i++) {
        const t = i / 25;
        const ang = turn + t * Math.PI * 1.7;
        const rad2 = rad * 0.12 + Math.exp(t * 2.2) * rad * 0.1;
        ctx.globalAlpha = 0.4 + (1 - t) * 0.55;
        ctx.fillStyle = "#fff3d4";
        ctx.beginPath();
        ctx.arc(Math.cos(ang) * rad2, Math.sin(ang) * rad2, rad * 0.055, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    ctx.restore();
    // rim light
    ctx.beginPath();
    ctx.arc(bx - rad * 0.3, by - rad * 0.35, rad * 0.36, 0.6, 2.4);
    stroke(ctx, 1.6, "rgba(255,250,240,0.75)");
  };
  bubble(28, 40, 20, "rgba(158,140,205,0.85)");
  bubble(70, 62, 24, "rgba(120,160,200,0.85)");
  bubble(44, 76, 14, "rgba(200,140,175,0.85)");
  bubble(76, 24, 11, "rgba(160,190,170,0.85)");
  // dust between them
  ctx.fillStyle = STAR;
  for (let i = 0; i < 16; i++) {
    ctx.globalAlpha = 0.25 + r() * 0.4;
    ctx.beginPath();
    ctx.arc(r() * 100, r() * 100, 0.5 + r() * 0.7, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/** 13 — Dimension: a rift, space bending into it, matter drawn inward. */
function dimension(ctx: Ctx): void {
  const cx = 50;
  const cy = 52;
  const r = rnd(1313);
  // warped space: concentric rings squeezed toward the tear
  for (let i = 8; i >= 1; i--) {
    const t = i / 8;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 12 + t * 36, (12 + t * 36) * (0.95 - t * 0.42), 0, 0, Math.PI * 2);
    stroke(ctx, 1 + (1 - t) * 1.4, `rgba(158,140,205,${0.18 + (1 - t) * 0.4})`);
  }
  glow(ctx, cx, cy, 42, "rgba(190,150,240,0.7)", 0.6);
  // the tear itself — a lens, wide at the middle, pinched at the ends
  ctx.beginPath();
  ctx.moveTo(cx, cy - 40);
  ctx.bezierCurveTo(cx + 20, cy - 20, cx + 20, cy + 20, cx, cy + 40);
  ctx.bezierCurveTo(cx - 20, cy + 20, cx - 20, cy - 20, cx, cy - 40);
  ctx.closePath();
  const lens = ctx.createLinearGradient(cx - 18, cy - 30, cx + 18, cy + 30);
  lens.addColorStop(0, "#ffeec0");
  lens.addColorStop(0.45, "#c9a0e8");
  lens.addColorStop(1, "#2b2545");
  ctx.fillStyle = lens;
  ctx.fill();
  stroke(ctx, 2, "rgba(255,238,190,0.9)");
  // inner slit
  ctx.beginPath();
  ctx.moveTo(cx, cy - 26);
  ctx.bezierCurveTo(cx + 8, cy - 12, cx + 8, cy + 12, cx, cy + 26);
  ctx.bezierCurveTo(cx - 8, cy + 12, cx - 8, cy - 12, cx, cy - 26);
  ctx.closePath();
  ctx.fillStyle = "#1d1833";
  ctx.fill();
  glow(ctx, cx, cy, 14, "rgba(255,245,210,0.9)", 0.8);
  // matter streaming in
  for (let i = 0; i < 16; i++) {
    const a = r() * Math.PI * 2;
    const d = 26 + r() * 26;
    const px = cx + Math.cos(a) * d;
    const py = cy + Math.sin(a) * d * 0.72;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.quadraticCurveTo(
      (px + cx) / 2 + (r() - 0.5) * 8,
      (py + cy) / 2,
      cx + Math.cos(a) * 12,
      cy + Math.sin(a) * 9
    );
    ctx.globalAlpha = 0.3 + r() * 0.4;
    stroke(ctx, 0.9, "#e6d2ff");
  }
  ctx.globalAlpha = 1;
}

/**
 * Painters in milestone order.
 *
 * No per-object size fudge is needed: BootScene crops each finished texture to
 * its opaque bounds, so the sprite IS the artwork and setting its height sets
 * the object's height. A car ends up short and wide, a tower tall and narrow,
 * with no bookkeeping.
 */
export const REF_ART: { name: string; paint: (ctx: Ctx) => void }[] = [
  { name: "dog", paint: dog },
  { name: "human", paint: human },
  { name: "car", paint: car },
  { name: "house", paint: house },
  { name: "building", paint: building },
  { name: "town", paint: town },
  { name: "city", paint: city },
  { name: "country", paint: country },
  { name: "continent", paint: continent },
  { name: "planet", paint: planet },
  { name: "solar system", paint: solarSystem },
  { name: "universe", paint: universe },
  { name: "multiverse", paint: multiverse },
  { name: "dimension", paint: dimension },
];

/** Texture key for a reference, by milestone index. */
export function refKey(index: number): string {
  return `ref${Math.max(0, Math.min(REF_ART.length - 1, index))}`;
}

/** Paint one reference into a square context of `size` px. */
export function paintRef(ctx: Ctx, index: number, size: number): void {
  const art = REF_ART[Math.max(0, Math.min(REF_ART.length - 1, index))];
  ctx.save();
  ctx.scale(size / REF_DESIGN, size / REF_DESIGN);
  art.paint(ctx);
  ctx.restore();
}

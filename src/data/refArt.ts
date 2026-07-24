/**
 * The scale-reference illustrations — dog, house, city, planet and the rest.
 *
 * FLAT VECTOR STYLE. No gradients, no glows, no soft shadows, no alpha washes.
 * An earlier pass used all four and read as painterly and fussy; this one gets
 * its quality from the two things that actually carry flat art:
 *
 *  1. SILHOUETTE. If the outline of a thing is right you recognise it instantly,
 *     and almost no interior detail is needed. If it is wrong, no amount of
 *     shading rescues it.
 *  2. PROPORTION. This is what separates "simple" from "a bunch of shapes". The
 *     previous car had wheels 59% of its body height — real cars are near 40% —
 *     which is why it read as a toy with giant wheels no matter how nicely it
 *     was shaded.
 *
 * The rules, applied to all fourteen so they read as one set:
 *  - One flat fill per surface. A second, darker flat tone is allowed ONLY where
 *    it describes a genuinely different plane (a roof, a side face), never as
 *    shading on a curve.
 *  - One outline colour at one weight, on every shape.
 *  - Interior detail only where it defines the object: a door, a window band, a
 *    wheel hub. Anything decorative was cut.
 *  - Each painter works in a 100x100 space, ground at y=100, centred on x=50.
 */

type Ctx = CanvasRenderingContext2D;

/** Design-space side length. Every painter draws inside 0..100 on both axes. */
export const REF_DESIGN = 100;

// --- palette: flat, warm, and deliberately small ---------------------------
const OUT = "#5b4130"; // the one outline colour
const CREAM = "#fff4de";
const TAN = "#e9c89c";
const TAN_D = "#cda87e"; // the "other plane" tone for tan things
const BROWN = "#a97c52";
const BROWN_D = "#7d5a3a";
const ROOF = "#b05a41";
const ROOF_D = "#94472f";
const GLASS = "#a9cfe2";
const LIT = "#ffd98a";
const LEAF = "#8fae62";
const LEAF_D = "#6c8b47";
const STONE = "#cfc5b4";
const STONE_D = "#ab9f8c";
const SUNC = "#f5b53a";
const WATER = "#84b6cc";
const WATER_D = "#5e93ab";
const NIGHT = "#4a4270";
const NIGHT_D = "#332d52";
const LILAC = "#b9a5dd";

// --- helpers ---------------------------------------------------------------

/** Outline weight, shared by everything. */
const LW = 2.2;

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

/** Smooth closed shape through control points — quadratics via midpoints. */
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

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
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

function circle(ctx: Ctx, x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
}

function ellipse(ctx: Ctx, x: number, y: number, rx: number, ry: number, rot = 0): void {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
}

/** A flat contact shadow — one tone, one alpha, no falloff. */
function shadow(ctx: Ctx, cx: number, w: number): void {
  ctx.globalAlpha = 0.14;
  ctx.fillStyle = OUT;
  ellipse(ctx, cx, 98.5, w / 2, 3.6);
  ctx.fill();
  ctx.globalAlpha = 1;
}

/** A band of identical windows — the flat shorthand for "inhabited". */
function windowBand(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  rows: number,
  cols: number,
  gapY: number,
  litEvery = 3
): void {
  const cw = w / cols;
  let i = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      roundRect(ctx, x + c * cw, y + r * gapY, cw * 0.62, gapY * 0.52, 0.8);
      fillStroke(ctx, i % litEvery === 0 ? LIT : GLASS, 1.1);
      i++;
    }
  }
}

// --- 0 Dog -----------------------------------------------------------------
/** Sitting pup in profile. Recognition lives in the head taper and the ear. */
function dog(ctx: Ctx): void {
  shadow(ctx, 52, 62);
  // tail
  ctx.beginPath();
  ctx.moveTo(26, 70);
  ctx.quadraticCurveTo(11, 64, 17, 50);
  stroke(ctx, 8, OUT);
  stroke(ctx, 5, TAN_D);
  // haunch, and the rear paw it rests on
  ellipse(ctx, 36, 70, 17, 19);
  fillStroke(ctx, TAN_D);
  ellipse(ctx, 32, 91, 11, 6.5);
  fillStroke(ctx, TAN_D);
  // BOTH forelegs go behind the body, so they emerge from the chest instead of
  // being two capsules stuck on the front of it
  for (const [lx, tone] of [
    [57, TAN_D],
    [68, TAN],
  ] as [number, string][]) {
    roundRect(ctx, lx, 58, 9.5, 38, 4.7);
    fillStroke(ctx, tone);
  }
  // body
  blob(ctx, [
    [30, 60],
    [44, 50],
    [60, 46],
    [73, 52],
    [77, 64],
    [72, 77],
    [50, 82],
    [32, 74],
  ]);
  fillStroke(ctx, TAN);
  // head: one silhouette that tapers to the nose
  blob(ctx, [
    [54, 38],
    [62, 26],
    [76, 24],
    [87, 31],
    [94, 40],
    [96, 46],
    [88, 51],
    [74, 51],
    [62, 52],
    [53, 47],
  ]);
  fillStroke(ctx, TAN);
  // ear — the single strongest "dog" cue, so it gets the second tone
  blob(ctx, [
    [62, 25],
    [72, 22],
    [75, 35],
    [69, 47],
    [59, 42],
    [57, 31],
  ]);
  fillStroke(ctx, BROWN);
  // nose
  ellipse(ctx, 94, 41, 3.6, 3, -0.25);
  ctx.fillStyle = OUT;
  ctx.fill();
  // eye
  circle(ctx, 81, 37, 2.9);
  ctx.fillStyle = OUT;
  ctx.fill();
  // mouth
  ctx.beginPath();
  ctx.moveTo(84, 47);
  ctx.quadraticCurveTo(89, 49.5, 93, 46.5);
  stroke(ctx, 1.3);
  // collar
  ctx.beginPath();
  ctx.moveTo(59, 51);
  ctx.quadraticCurveTo(67, 59, 76, 50);
  stroke(ctx, 5.5, ROOF);
  stroke(ctx, 1.2, OUT);
}

// --- 1 Human ---------------------------------------------------------------
/** A baker. Read from the toque and the apron; everything else is minimal. */
function human(ctx: Ctx): void {
  shadow(ctx, 50, 34);
  // legs
  roundRect(ctx, 42.5, 70, 7, 27, 3.2);
  fillStroke(ctx, BROWN_D);
  roundRect(ctx, 50.5, 70, 7, 27, 3.2);
  fillStroke(ctx, BROWN_D);
  // jacket — shoulders narrower than hem, so it is a body not a box
  blob(ctx, [
    [39, 46],
    [50, 42],
    [61, 46],
    [64, 58],
    [63, 73],
    [50, 76],
    [37, 73],
    [36, 58],
  ]);
  fillStroke(ctx, CREAM);
  // apron: a flat second tone, not a shadow
  ctx.save();
  blob(ctx, [
    [39, 46],
    [50, 42],
    [61, 46],
    [64, 58],
    [63, 73],
    [50, 76],
    [37, 73],
    [36, 58],
  ]);
  ctx.clip();
  blob(ctx, [
    [43, 56],
    [50, 54],
    [57, 56],
    [59, 66],
    [58, 78],
    [42, 78],
    [41, 66],
  ]);
  ctx.fillStyle = TAN;
  ctx.fill();
  ctx.restore();
  blob(ctx, [
    [43, 56],
    [50, 54],
    [57, 56],
    [59, 66],
    [58, 78],
    [42, 78],
    [41, 66],
  ]);
  stroke(ctx, 1.5);
  // arms — kept slim (about a fifth of torso width, as on a real body) and
  // swung clear of the torso, so they read as arms and not as puffed sleeves
  for (const dir of [-1, 1]) {
    const sx = 50 + dir * 11;
    const ex = 50 + dir * 20;
    ctx.beginPath();
    ctx.moveTo(sx, 49);
    ctx.quadraticCurveTo(sx + dir * 8, 57, ex, 68);
    stroke(ctx, 6.6, OUT);
    stroke(ctx, 4, CREAM);
    circle(ctx, ex, 70.5, 3.4);
    fillStroke(ctx, "#f0c396", 1.4);
  }
  // head
  circle(ctx, 50, 32, 11);
  fillStroke(ctx, "#f0c396");
  ctx.fillStyle = OUT;
  circle(ctx, 46.2, 31, 1.6);
  ctx.fill();
  circle(ctx, 53.8, 31, 1.6);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(50, 33.5, 3.6, 0.3, Math.PI - 0.3);
  stroke(ctx, 1.4);
  // toque: a band plus one puffed crown
  blob(ctx, [
    [38, 21],
    [40, 11],
    [50, 6],
    [60, 11],
    [62, 21],
    [50, 24],
  ]);
  fillStroke(ctx, "#fffaf0");
  roundRect(ctx, 38, 20, 24, 6.5, 2.2);
  fillStroke(ctx, "#fffaf0");
}

// --- 2 Car -----------------------------------------------------------------
/**
 * Side view. PROPORTION IS THE WHOLE FIX HERE: the car is 2.6 times as long as
 * it is tall and the wheels are ~40% of body height, matching a real car. The
 * previous one was 2.2 long with wheels at 59%, which is why it looked like a
 * toy with giant wheels.
 */
function car(ctx: Ctx): void {
  shadow(ctx, 50, 84);
  const GROUND = 88;
  const WR = 7; // wheel radius: 14 across vs a 34-tall body ≈ 41%
  const wy = GROUND - WR;

  // body: long, low, one silhouette
  ctx.beginPath();
  ctx.moveTo(7, 80);
  ctx.lineTo(7, 70);
  ctx.quadraticCurveTo(8, 64, 20, 62);
  ctx.bezierCurveTo(27, 51, 40, 48, 52, 48.5);
  ctx.bezierCurveTo(63, 49, 70, 54, 75, 62);
  ctx.quadraticCurveTo(90, 64, 92, 70);
  ctx.lineTo(92, 80);
  ctx.closePath();
  fillStroke(ctx, ROOF);

  // greenhouse: two flat panes, split by a pillar
  ctx.beginPath();
  ctx.moveTo(28, 61);
  ctx.bezierCurveTo(31, 54, 39, 51.5, 47, 51.5);
  ctx.lineTo(47, 61);
  ctx.closePath();
  fillStroke(ctx, GLASS, 1.5);
  ctx.beginPath();
  ctx.moveTo(51, 51.5);
  ctx.bezierCurveTo(59, 52, 65, 56, 69, 61);
  ctx.lineTo(51, 61);
  ctx.closePath();
  fillStroke(ctx, GLASS, 1.5);

  // door seam and handle — the only interior detail the body needs
  ctx.beginPath();
  ctx.moveTo(49, 63);
  ctx.lineTo(49, 76);
  stroke(ctx, 1.2);
  roundRect(ctx, 54, 66, 6, 1.9, 0.9);
  ctx.fillStyle = STONE;
  ctx.fill();

  // lights
  roundRect(ctx, 87.5, 66, 4.5, 4, 1.6);
  fillStroke(ctx, LIT, 1.2);
  roundRect(ctx, 7, 66.5, 4, 3.6, 1.4);
  fillStroke(ctx, "#e2705f", 1.2);

  // wheels: flat tyre, flat hub
  for (const wx of [27, 71]) {
    circle(ctx, wx, wy, WR);
    fillStroke(ctx, "#4a3a2e");
    circle(ctx, wx, wy, WR * 0.44);
    fillStroke(ctx, STONE, 1.3);
  }
}

// --- 3 House ---------------------------------------------------------------
/** Three-quarter view. The side face is a flat second tone, not shading. */
function house(ctx: Ctx): void {
  shadow(ctx, 52, 66);
  // side face
  ctx.beginPath();
  ctx.moveTo(66, 54);
  ctx.lineTo(84, 47);
  ctx.lineTo(84, 88);
  ctx.lineTo(66, 95);
  ctx.closePath();
  fillStroke(ctx, TAN_D);
  // front face
  ctx.beginPath();
  ctx.rect(22, 54, 44, 41);
  fillStroke(ctx, CREAM);
  // roof, two planes
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
  // chimney
  ctx.beginPath();
  ctx.rect(66, 20, 9, 14);
  fillStroke(ctx, ROOF_D);
  // door
  roundRect(ctx, 29, 71, 14, 24, 1.5);
  fillStroke(ctx, BROWN);
  // window
  roundRect(ctx, 49, 63, 13, 13, 1.2);
  fillStroke(ctx, LIT);
  ctx.beginPath();
  ctx.moveTo(55.5, 63);
  ctx.lineTo(55.5, 76);
  ctx.moveTo(49, 69.5);
  ctx.lineTo(62, 69.5);
  stroke(ctx, 1.1);
}

// --- 4 Building ------------------------------------------------------------
/** A mid-rise: front face, one flat side face, a clean window grid. */
function building(ctx: Ctx): void {
  shadow(ctx, 52, 54);
  // side face
  ctx.beginPath();
  ctx.moveTo(64, 22);
  ctx.lineTo(79, 16);
  ctx.lineTo(79, 90);
  ctx.lineTo(64, 96);
  ctx.closePath();
  fillStroke(ctx, TAN_D);
  // front
  ctx.beginPath();
  ctx.rect(27, 22, 37, 74);
  fillStroke(ctx, CREAM);
  // parapet
  ctx.beginPath();
  ctx.rect(24, 16, 43, 6);
  fillStroke(ctx, STONE);
  // windows
  windowBand(ctx, 31, 28, 30, 6, 3, 11);
  // door
  roundRect(ctx, 39, 82, 13, 14, 1.2);
  fillStroke(ctx, GLASS);
}

// --- 5 Town ----------------------------------------------------------------
/** Cottages around a church spire — the shape that says "village". */
function town(ctx: Ctx): void {
  shadow(ctx, 50, 88);
  // ground
  ctx.beginPath();
  ctx.moveTo(3, 96);
  ctx.quadraticCurveTo(50, 86, 97, 96);
  ctx.lineTo(97, 100);
  ctx.lineTo(3, 100);
  ctx.closePath();
  fillStroke(ctx, LEAF);

  const cottage = (x: number, w: number, h: number) => {
    const y = 92 - h;
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    fillStroke(ctx, CREAM, 1.7);
    ctx.beginPath();
    ctx.moveTo(x - 3.5, y + 1);
    ctx.lineTo(x + w / 2, y - h * 0.45);
    ctx.lineTo(x + w + 3.5, y + 1);
    ctx.closePath();
    fillStroke(ctx, ROOF, 1.7);
    roundRect(ctx, x + w * 0.28, y + h * 0.32, w * 0.34, h * 0.3, 0.8);
    fillStroke(ctx, LIT, 1.1);
  };

  // church
  ctx.beginPath();
  ctx.rect(42, 56, 16, 36);
  fillStroke(ctx, STONE, 1.8);
  ctx.beginPath();
  ctx.moveTo(39, 57);
  ctx.lineTo(50, 28);
  ctx.lineTo(61, 57);
  ctx.closePath();
  fillStroke(ctx, ROOF_D, 1.8);
  roundRect(ctx, 46, 66, 8, 13, 4);
  fillStroke(ctx, LIT, 1.2);

  cottage(13, 19, 25);
  cottage(64, 18, 23);
  cottage(83, 14, 17);

  // trees
  for (const [tx, s] of [
    [7, 1],
    [97, 0.85],
  ] as [number, number][]) {
    ctx.beginPath();
    ctx.moveTo(tx, 92);
    ctx.lineTo(tx, 84 * s + 8);
    stroke(ctx, 2.6, BROWN_D);
    ellipse(ctx, tx, 78 * s + 6, 7 * s, 8 * s);
    fillStroke(ctx, LEAF_D, 1.7);
  }
}

// --- 6 City ----------------------------------------------------------------
/** A skyline. Varied heights and one clear tallest tower carry it. */
function city(ctx: Ctx): void {
  shadow(ctx, 50, 94);
  const tower = (x: number, w: number, h: number, tone: string) => {
    const y = 96 - h;
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    fillStroke(ctx, tone, 1.8);
    const cols = Math.max(2, Math.round(w / 7));
    const rows = Math.floor((h - 8) / 11);
    windowBand(ctx, x + 2.5, y + 5, w - 5, rows, cols, 11, 3);
  };
  // back row, flat second tone — depth without shading
  for (const [x, w, h] of [
    [5, 15, 42],
    [26, 13, 56],
    [61, 14, 50],
    [80, 15, 60],
  ] as [number, number, number][]) {
    ctx.beginPath();
    ctx.rect(x, 96 - h, w, h);
    fillStroke(ctx, STONE_D, 1.8);
  }
  tower(3, 16, 36, CREAM);
  tower(22, 17, 50, CREAM);
  tower(43, 16, 74, CREAM); // the landmark
  tower(62, 15, 44, CREAM);
  tower(80, 15, 32, CREAM);
  // antenna
  ctx.beginPath();
  ctx.moveTo(51, 22);
  ctx.lineTo(51, 10);
  stroke(ctx, 2);
}

// --- 7 Country -------------------------------------------------------------
/** A mapped landmass with a flag. Coast shape does the work. */
function country(ctx: Ctx): void {
  shadow(ctx, 50, 78);
  const land: [number, number][] = [
    [14, 74],
    [22, 56],
    [40, 48],
    [58, 52],
    [72, 45],
    [87, 56],
    [89, 72],
    [74, 86],
    [50, 89],
    [26, 86],
  ];
  blob(ctx, land);
  fillStroke(ctx, LEAF);
  ctx.save();
  blob(ctx, land);
  ctx.clip();
  // river — one flat line, no shading
  ctx.beginPath();
  ctx.moveTo(20, 56);
  ctx.bezierCurveTo(27, 66, 30, 74, 30, 90);
  stroke(ctx, 3.4, WATER);
  // hills as ONE ridge, kept to a third of the land. Drawn as separate
  // triangles they showed the outline where they overlapped, which is exactly
  // what makes flat art look assembled.
  ctx.beginPath();
  ctx.moveTo(50, 78);
  ctx.lineTo(60, 59);
  ctx.lineTo(68, 69);
  ctx.lineTo(76, 57);
  ctx.lineTo(86, 78);
  ctx.closePath();
  fillStroke(ctx, LEAF_D, 1.7);
  ctx.restore();
  // flag
  ctx.beginPath();
  ctx.moveTo(42, 72);
  ctx.lineTo(42, 18);
  stroke(ctx, 2.6, BROWN_D);
  ctx.beginPath();
  ctx.moveTo(43, 19);
  ctx.lineTo(43, 34);
  ctx.lineTo(65, 34);
  ctx.lineTo(65, 19);
  ctx.closePath();
  fillStroke(ctx, ROOF, 1.8);
}

// --- 8 Continent -----------------------------------------------------------
/** Land in an ocean disc, with a flat mountain range. */
function continent(ctx: Ctx): void {
  ellipse(ctx, 50, 60, 46, 37);
  fillStroke(ctx, WATER);
  const land: [number, number][] = [
    [24, 68],
    [20, 50],
    [34, 37],
    [52, 33],
    [64, 41],
    [79, 39],
    [84, 55],
    [73, 72],
    [55, 80],
    [35, 78],
  ];
  blob(ctx, land);
  fillStroke(ctx, LEAF);
  ctx.save();
  blob(ctx, land);
  ctx.clip();
  // a flat arid region. A fillRect gave it a dead-straight horizon line; a
  // curved edge reads as terrain instead of as a crop.
  ctx.beginPath();
  ctx.moveTo(0, 66);
  ctx.bezierCurveTo(26, 60, 44, 74, 62, 70);
  ctx.bezierCurveTo(78, 67, 88, 72, 100, 68);
  ctx.lineTo(100, 100);
  ctx.lineTo(0, 100);
  ctx.closePath();
  ctx.fillStyle = TAN;
  ctx.fill();
  // the range is ONE path with several peaks, so overlapping outlines can't
  // show through between them
  ctx.beginPath();
  ctx.moveTo(30, 58);
  ctx.lineTo(38, 46);
  ctx.lineTo(46, 55);
  ctx.lineTo(54, 43);
  ctx.lineTo(62, 54);
  ctx.lineTo(70, 47);
  ctx.lineTo(78, 58);
  ctx.closePath();
  fillStroke(ctx, BROWN, 1.7);
  ctx.restore();
  // inland sea
  ellipse(ctx, 63, 71, 8, 5.5, 0.3);
  fillStroke(ctx, WATER_D, 1.5);
}

// --- 9 Planet --------------------------------------------------------------
/** Flat globe, flat continents, a ring drawn as two arcs so it passes behind. */
function planet(ctx: Ctx): void {
  const cx = 50;
  const cy = 54;
  const r = 30;
  // back half of the ring
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, 100, cy);
  ctx.clip();
  ellipse(ctx, cx, cy + 3, 45, 12, -0.15);
  stroke(ctx, 6.5, OUT);
  stroke(ctx, 3.4, TAN);
  ctx.restore();
  // globe
  circle(ctx, cx, cy, r);
  fillStroke(ctx, WATER);
  ctx.save();
  circle(ctx, cx, cy, r);
  ctx.clip();
  for (const pts of [
    [
      [30, 40],
      [45, 34],
      [55, 43],
      [46, 53],
      [31, 52],
    ],
    [
      [52, 62],
      [67, 58],
      [72, 68],
      [59, 76],
      [49, 71],
    ],
  ] as [number, number][][]) {
    blob(ctx, pts);
    ctx.fillStyle = LEAF;
    ctx.fill();
  }
  ctx.restore();
  // front half of the ring
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, cy, 100, 100 - cy);
  ctx.clip();
  ellipse(ctx, cx, cy + 3, 45, 12, -0.15);
  stroke(ctx, 6.5, OUT);
  stroke(ctx, 3.4, CREAM);
  ctx.restore();
}

// --- 10 Solar system -------------------------------------------------------
/** A sun and three planets on flat orbit lines. */
function solarSystem(ctx: Ctx): void {
  const cx = 50;
  const cy = 54;
  for (const o of [22, 34, 46]) {
    ellipse(ctx, cx, cy, o, o * 0.36, -0.08);
    stroke(ctx, 1.6, OUT);
  }
  circle(ctx, cx, cy, 14);
  fillStroke(ctx, SUNC);
  const at = (o: number, ang: number, rad: number, col: string) => {
    const px = cx + Math.cos(ang) * o;
    const py = cy + Math.sin(ang) * o * 0.36;
    circle(ctx, px, py, rad);
    fillStroke(ctx, col, 1.6);
  };
  at(22, 2.4, 4, ROOF);
  at(34, 0.55, 5.5, WATER);
  at(46, 3.5, 6.5, LEAF);
}

// --- 11 Universe -----------------------------------------------------------
/**
 * A spiral galaxy as FLAT shapes: a dark disc, two solid arm sweeps and a core.
 * The painterly version was thousands of alpha-blended dots; this is four
 * shapes and reads better at 40px.
 */
function universe(ctx: Ctx): void {
  const cx = 50;
  const cy = 52;
  // disc
  ellipse(ctx, cx, cy, 45, 25, -0.22);
  fillStroke(ctx, NIGHT_D);
  // Two arms. The first version drew them thin, and at 40px they vanished into
  // scratches — so they are broad wedges that taper, wide enough to survive the
  // size the game actually shows this at.
  ctx.save();
  ellipse(ctx, cx, cy, 45, 25, -0.22);
  ctx.clip(); // so an arm tip can never spill over the disc's outline
  ctx.translate(cx, cy);
  ctx.rotate(-0.22);
  ctx.scale(1, 0.56);
  for (const turn of [0, Math.PI]) {
    ctx.save();
    ctx.rotate(turn);
    ctx.beginPath();
    ctx.moveTo(4, -12);
    ctx.bezierCurveTo(34, -20, 52, 6, 30, 40);
    ctx.bezierCurveTo(42, 8, 28, -4, 2, 8);
    ctx.closePath();
    ctx.fillStyle = LILAC;
    ctx.fill();
    stroke(ctx, 2.4, NIGHT);
    ctx.restore();
  }
  ctx.restore();
  // core
  ellipse(ctx, cx, cy, 12, 8, -0.22);
  fillStroke(ctx, CREAM, 2.2);
}

// --- 12 Multiverse ---------------------------------------------------------
/**
 * Three flat bubbles, each holding its own small galaxy — the same two-arm
 * shape the "universe" reference uses, so the two steps read as related.
 * (A single comma-shaped swirl was tried first and looked like a clipping.)
 */
function multiverse(ctx: Ctx): void {
  const bubble = (bx: number, by: number, r: number, tone: string, arm: string) => {
    circle(ctx, bx, by, r);
    fillStroke(ctx, tone);
    ctx.save();
    circle(ctx, bx, by, r);
    ctx.clip();
    ctx.translate(bx, by);
    ctx.rotate(-0.3);
    ctx.scale(1, 0.6);
    const u = r / 52;
    ctx.fillStyle = arm;
    for (const turn of [0, Math.PI]) {
      ctx.save();
      ctx.rotate(turn);
      ctx.beginPath();
      ctx.moveTo(4 * u, -12 * u);
      ctx.bezierCurveTo(34 * u, -20 * u, 52 * u, 6 * u, 30 * u, 40 * u);
      ctx.bezierCurveTo(42 * u, 8 * u, 28 * u, -4 * u, 2 * u, 8 * u);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
    ellipse(ctx, bx, by, r * 0.24, r * 0.15, -0.3);
    fillStroke(ctx, CREAM, 1.6);
  };
  bubble(30, 42, 22, LILAC, "#fff4de");
  bubble(68, 62, 26, NIGHT, LILAC);
  bubble(46, 80, 14, WATER, "#fff4de");
}

// --- 13 Dimension ----------------------------------------------------------
/** A rift: three flat concentric rings and a solid lens. */
function dimension(ctx: Ctx): void {
  const cx = 50;
  const cy = 52;
  for (const [rx, ry] of [
    [44, 40],
    [32, 29],
    [21, 19],
  ] as [number, number][]) {
    ellipse(ctx, cx, cy, rx, ry);
    stroke(ctx, 2.2, LILAC);
  }
  // the tear
  ctx.beginPath();
  ctx.moveTo(cx, cy - 38);
  ctx.bezierCurveTo(cx + 19, cy - 19, cx + 19, cy + 19, cx, cy + 38);
  ctx.bezierCurveTo(cx - 19, cy + 19, cx - 19, cy - 19, cx, cy - 38);
  ctx.closePath();
  fillStroke(ctx, NIGHT);
  // inner slit
  ctx.beginPath();
  ctx.moveTo(cx, cy - 22);
  ctx.bezierCurveTo(cx + 8, cy - 10, cx + 8, cy + 10, cx, cy + 22);
  ctx.bezierCurveTo(cx - 8, cy + 10, cx - 8, cy - 10, cx, cy - 22);
  ctx.closePath();
  fillStroke(ctx, CREAM, 1.8);
}

/**
 * Painters in milestone order.
 *
 * BootScene crops each finished texture to its opaque bounds, so the sprite IS
 * the artwork and setting its height sets the object's height — a car ends up
 * short and wide, a tower tall and narrow, with no bookkeeping.
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

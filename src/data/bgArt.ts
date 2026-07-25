/**
 * The background environments — one per milestone, painted to canvas textures.
 *
 * THE CAMERA PULLS BACK AS THE MONSTER GROWS. That is the whole idea: the
 * monster never gets much bigger on screen, but the world behind it falls
 * away — a bakery, then a garden, then rooftops, then the curve of the planet,
 * then space — so its growth is told by everything else shrinking.
 *
 * EVERY STAGE PLACES THE MONSTER SOMEWHERE. Not centred — each scene has a
 * SPOT (see SPOTS) chosen to fit it: on its rug in the bakery, peeking over
 * the garden fence, on the ridge of a roof, drifting high-right on an
 * asteroid. The scene draws its perch at that spot and the monster is moved
 * there, so the pair always agree. Some stages also paint a FOREGROUND layer
 * (paintBgFront) that sits in front of the monster — the garden fence it
 * hides behind, the glass of its universe-bubble — which is what turns
 * "standing in front of scenery" into "being inside the scene".
 *
 * There is deliberately no size caption: the background IS the scale readout.
 *
 * COLOUR. These were first painted in the game's cream-and-honey UI palette,
 * which made fourteen different places look like one beige place. The world
 * is now properly coloured — blue skies, green fields, houses in coral and
 * teal and mustard — while the UI stays cream and brown. The scenery is still
 * flat (no outlines, no gradient shading; skies get a gradient because a wash
 * of light is what a sky IS) and still one step softer than the food, so the
 * food and HUD stay the loudest things on screen.
 *
 * Three hard constraints, checked in every painter:
 *  - The TOP ~110px carries the score and "GROWING TO" text in dark brown, so
 *    every sky's first gradient stop stays light. Mid-blue is fine (dark brown
 *    on #9ed6f2 is about 6:1) but a deep sky at the top is not.
 *  - The BIN panel covers x 60..340, y ~150..470 at only 9% ink, so scenery
 *    shows faintly through it. Detail that must actually READ belongs in the
 *    bottom band (y 470+) or the side strips — this is why the bakery's props
 *    are on the floor and not on the wall.
 *  - The monster's spot must keep its body below the bin and its label on
 *    screen: feet lines live in 585..640, x in 96..300.
 *
 * Painted in the 400x720 world, baked lazily by GameScene at RENDER_SCALE
 * (only the current and next stage ever live in texture memory at once).
 */

import { monsterScaleFor } from "../config";

type Ctx = CanvasRenderingContext2D;

const TAU = Math.PI * 2;

export const BG_W = 400;
export const BG_H = 720;
/** Highest distinct stage; milestones beyond clamp to it. */
export const BG_LAST = 13;

/** The feet ellipses bottom out ~63.5 body units below the monster origin. */
const FOOT_DROP = 63.5;

// --- the world palette ------------------------------------------------------
// Saturated enough to be a place, one step softer than the food.

const SKY_DAY: [number, string][] = [
  [0, "#cbeafa"],
  [0.45, "#9ed6f2"],
  [1, "#e4f1dd"],
];
const SKY_WARM: [number, string][] = [
  [0, "#d7ecf7"],
  [0.4, "#a8d8ec"],
  [1, "#fbe0bd"],
];
const GRASS = "#7cc45f";
const GRASS_D = "#5da844";
const GRASS_L = "#9ad477";
const LEAF = "#4e9c56";
const LEAF_D = "#3d7f47";
const WATER = "#5bb4dd";
const ROOF_CORAL = "#e8705c";
const ROOF_TEAL = "#3fa8a0";
const ROOF_PLUM = "#9d7bc4";
const ROOF_GOLD = "#eeae3a";
const WALL_CREAM = "#fff4dd";
const WALL_MINT = "#dcf0e2";
const WALL_BLUSH = "#ffdfe3";
const WOOD = "#b98d62";
const WOOD_D = "#966b46";
const STONE = "#c3bcb4";
const STONE_D = "#a49c94";
const WINDOW = "#ffd45f";
const CLOUD_W = "#ffffff";
const SNOW = "#fff6e0";

/**
 * Where the monster lives in each stage: the x it stands at and the world y
 * its feet touch. Chosen per scene — never just centred.
 */
const SPOTS: { x: number; feet: number }[] = [
  { x: 132, feet: 585 }, // m0 bakery: on its rug by the wainscot
  { x: 258, feet: 598 }, // m1 garden: BEHIND the picket fence, peeking over
  { x: 96, feet: 597 }, // m2 street: crossing at the left crosswalk
  { x: 284, feet: 602 }, // m3 rooftops: seated on the right-hand ridge
  { x: 140, feet: 608 }, // m4 skyline: on a parapet, taller tower across
  { x: 252, feet: 614 }, // m5 town: on the hilltop right of centre
  { x: 120, feet: 620 }, // m6 patchwork: in a clearing to the left
  { x: 268, feet: 620 }, // m7 stratosphere: on the curve, off-apex
  { x: 132, feet: 620 }, // m8 low orbit: the limb crests under it, left
  { x: 292, feet: 624 }, // m9 space: adrift high-right on its asteroid
  { x: 108, feet: 620 }, // m10 solar system: its planet rides a left orbit
  { x: 252, feet: 620 }, // m11 galaxies: seated on its spiral's core
  { x: 140, feet: 620 }, // m12 bubbles: inside its own bubble, left
  { x: 200, feet: 620 }, // m13 dimension: dead centre — it IS the still point
];

export function bgKey(milestone: number): string {
  return `bg${Math.min(Math.max(milestone, 0), BG_LAST)}`;
}

/** The monster's ORIGIN position for a milestone's stage (feet on the perch). */
export function bgSpot(milestone: number): { x: number; y: number } {
  const i = Math.min(Math.max(milestone, 0), BG_LAST);
  return {
    x: SPOTS[i].x,
    y: SPOTS[i].feet - FOOT_DROP * monsterScaleFor(i),
  };
}

/** Tiny deterministic PRNG so speckle and stars never shimmer between bakes. */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

/** Vertical wash over the whole frame — the sky. */
function sky(ctx: Ctx, stops: [number, string][]): void {
  const g = ctx.createLinearGradient(0, 0, 0, BG_H);
  for (const [t, c] of stops) g.addColorStop(t, c);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, BG_W, BG_H);
}

/**
 * A ground layer: a smooth line through `pts` with everything below it
 * filled. Quadratics through midpoints, same trick as refArt's blob().
 */
function ground(ctx: Ctx, pts: [number, number][], color: string): void {
  ctx.beginPath();
  ctx.moveTo(-4, pts[0][1]);
  ctx.lineTo(pts[0][0], pts[0][1]);
  for (let i = 0; i < pts.length - 1; i++) {
    const mx = (pts[i][0] + pts[i + 1][0]) / 2;
    const my = (pts[i][1] + pts[i + 1][1]) / 2;
    ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
  }
  const last = pts[pts.length - 1];
  ctx.lineTo(BG_W + 4, last[1]);
  ctx.lineTo(BG_W + 4, BG_H + 4);
  ctx.lineTo(-4, BG_H + 4);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

/**
 * One cloud as a single path of overlapping ellipses. One path, one fill:
 * with nonzero winding the overlaps fill uniformly, so a translucent cloud
 * shows no internal seams.
 */
function cloud(ctx: Ctx, x: number, y: number, s: number, color: string, alpha: number): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x - 19 * s, y, 15 * s, 10 * s, 0, 0, TAU);
  ctx.ellipse(x, y - 8 * s, 17 * s, 13 * s, 0, 0, TAU);
  ctx.ellipse(x + 19 * s, y + 1 * s, 14 * s, 9 * s, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/** Star speckle, seeded so it's stable. Kept out of the top-centre HUD. */
function stars(ctx: Ctx, seed: number, count: number, yMin: number, yMax: number): void {
  const r = rng(seed);
  ctx.save();
  for (let i = 0; i < count; i++) {
    const x = r() * BG_W;
    const y = yMin + r() * (yMax - yMin);
    // dodge the score block — a star inside a numeral reads as dirt
    if (y < 130 && x > 120 && x < 280) continue;
    const big = r() < 0.16;
    ctx.fillStyle = big ? "#fff3c4" : SNOW;
    ctx.globalAlpha = 0.3 + r() * (big ? 0.6 : 0.4);
    const s = big ? 2.1 : 1.2;
    ctx.fillRect(x, y, s, s);
  }
  ctx.restore();
}

/** A soft disc glow as stepped concentric circles — same trick as the aura. */
function glow(ctx: Ctx, x: number, y: number, r0: number, color: string): void {
  ctx.save();
  ctx.fillStyle = color;
  for (const [k, a] of [
    [2.2, 0.12],
    [1.6, 0.2],
    [1.0, 1],
  ] as [number, number][]) {
    ctx.globalAlpha = a;
    ctx.beginPath();
    ctx.arc(x, y, r0 * k, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

/** A simple gabled house: body, roof, door, lit window. */
function house(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  wall: string,
  roof: string
): void {
  ctx.fillStyle = wall;
  ctx.fillRect(x, y - h, w, h);
  ctx.fillStyle = roof;
  ctx.beginPath();
  ctx.moveTo(x - w * 0.12, y - h);
  ctx.lineTo(x + w / 2, y - h - w * 0.36);
  ctx.lineTo(x + w + w * 0.12, y - h);
  ctx.closePath();
  ctx.fill();
  // door
  ctx.fillStyle = WOOD_D;
  ctx.fillRect(x + w * 0.58, y - h * 0.5, w * 0.24, h * 0.5);
  // lit window
  ctx.fillStyle = WINDOW;
  ctx.fillRect(x + w * 0.16, y - h * 0.72, w * 0.26, h * 0.3);
}

/**
 * Paper grain over the finished scene — the "texture" that stops a gradient
 * reading as a plain CSS fill. Two speckles, ink and cream, at whisper alpha.
 */
function grain(ctx: Ctx, seed: number): void {
  const r = rng(seed);
  ctx.save();
  for (let i = 0; i < 1500; i++) {
    ctx.fillStyle = i < 950 ? "#4a3a2a" : "#ffffff";
    ctx.globalAlpha = 0.015 + r() * 0.035;
    ctx.fillRect(r() * BG_W, r() * BG_H, 1.7, 1.7);
  }
  ctx.restore();
}

// --- the fourteen stages ----------------------------------------------------
// Each takes `sx` (the monster's x) and `feet` (where its feet touch); the
// perch is drawn exactly there.

/**
 * m0, to Dog: the bakery — striped wallpaper, a mint wainscot and a tiled
 * floor. Everything that must READ is in the bottom band, because the bin
 * panel covers the middle of the wall; that is why an earlier draft's shelf
 * and framed picture had to go.
 */
function bakery(ctx: Ctx, sx: number, feet: number): void {
  // blush-and-cream striped wallpaper
  ctx.fillStyle = "#ffeaef";
  ctx.fillRect(0, 0, BG_W, BG_H);
  ctx.fillStyle = "#ffd9e2";
  for (let x = 0; x < BG_W; x += 44) ctx.fillRect(x, 0, 22, BG_H);
  // a scatter of little cherry motifs
  ctx.fillStyle = "#ef7a9b";
  for (let row = 0; row < 11; row++) {
    for (let col = 0; col < 5; col++) {
      const x = 40 + col * 80 + (row % 2 ? 40 : 0);
      ctx.beginPath();
      ctx.arc(x, 30 + row * 52, 3.6, 0, TAU);
      ctx.fill();
    }
  }

  const seam = feet - 6;
  // mint wainscot with a wooden cap rail
  ctx.fillStyle = WALL_MINT;
  ctx.fillRect(0, seam - 52, BG_W, 52);
  ctx.fillStyle = "#bfe0cd";
  for (let x = 10; x < BG_W; x += 44) ctx.fillRect(x, seam - 44, 30, 34);
  ctx.fillStyle = WOOD;
  ctx.fillRect(0, seam - 58, BG_W, 7);

  // terracotta tile floor with grout
  ctx.fillStyle = "#e0906f";
  ctx.fillRect(0, seam, BG_W, BG_H - seam);
  ctx.fillStyle = "#f0ad8b";
  let ty = seam + 4;
  let th = 16;
  let trow = 0;
  while (ty < BG_H) {
    for (let x = -30 + (trow % 2 ? 26 : 0); x < BG_W; x += 52) {
      ctx.fillRect(x, ty, 48, th - 4);
    }
    ty += th;
    th *= 1.22;
    trow++;
  }

  // the pet's rug
  ctx.fillStyle = "#ef7a9b";
  ctx.beginPath();
  ctx.ellipse(sx, feet + 6, 60, 14, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "#ffd9e2";
  ctx.beginPath();
  ctx.ellipse(sx, feet + 6, 44, 9, 0, 0, TAU);
  ctx.fill();

  // Floor props on the empty side: a flour sack, a rolling pin leaning on it,
  // and the food bowl.
  ctx.fillStyle = WALL_CREAM;
  ctx.beginPath();
  ctx.moveTo(306, feet + 16);
  ctx.quadraticCurveTo(302, feet - 22, 314, feet - 28);
  ctx.quadraticCurveTo(320, feet - 34, 328, feet - 28);
  ctx.quadraticCurveTo(340, feet - 22, 338, feet + 16);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#e3d0ae";
  ctx.fillRect(311, feet - 31, 20, 5);
  ctx.strokeStyle = "#e3d0ae";
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(308, feet - 6);
  ctx.quadraticCurveTo(322, feet - 12, 336, feet - 6);
  ctx.stroke();
  ctx.strokeStyle = WOOD;
  ctx.lineCap = "round";
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(352, feet + 14);
  ctx.lineTo(336, feet - 24);
  ctx.stroke();
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(336, feet - 24);
  ctx.lineTo(332, feet - 34);
  ctx.stroke();
  ctx.fillStyle = ROOF_TEAL;
  ctx.beginPath();
  ctx.moveTo(252, feet + 4);
  ctx.lineTo(286, feet + 4);
  ctx.lineTo(280, feet + 17);
  ctx.lineTo(258, feet + 17);
  ctx.closePath();
  ctx.fill();
}

/** m1, to Human: the garden — it hides behind the (foreground) fence. */
function garden(ctx: Ctx, _sx: number, feet: number): void {
  sky(ctx, SKY_DAY);
  glow(ctx, 330, 78, 24, "#ffe07a");
  cloud(ctx, 84, 126, 1.15, CLOUD_W, 0.95);
  cloud(ctx, 262, 188, 0.85, CLOUD_W, 0.8);
  cloud(ctx, 350, 250, 0.7, CLOUD_W, 0.65);

  // a hedge running along the back, two-tone
  ctx.fillStyle = LEAF_D;
  ctx.fillRect(0, feet - 46, BG_W, 30);
  ctx.fillStyle = LEAF;
  for (let x = -6; x < BG_W + 12; x += 26) {
    ctx.beginPath();
    ctx.arc(x, feet - 46, 15, 0, TAU);
    ctx.fill();
  }

  // the lawn
  ground(
    ctx,
    [
      [0, feet + 4],
      [150, feet - 2],
      [280, feet + 4],
      [400, feet],
    ],
    GRASS
  );
  ctx.fillStyle = GRASS_L;
  ctx.beginPath();
  ctx.ellipse(200, feet + 30, 150, 22, 0, 0, TAU);
  ctx.fill();

  // flowers — one bed in the monster's own pink (the blend-in gag) and two
  // in other colours so the bed isn't monochrome
  const flower = (fx: number, fy: number, fr: number, petal: string) => {
    ctx.strokeStyle = GRASS_D;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(fx, fy + fr);
    ctx.lineTo(fx, fy + fr + 14);
    ctx.stroke();
    ctx.fillStyle = petal;
    for (let p = 0; p < 5; p++) {
      const a = (p / 5) * TAU;
      ctx.beginPath();
      ctx.arc(fx + Math.cos(a) * fr, fy + Math.sin(a) * fr, fr * 0.74, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = WINDOW;
    ctx.beginPath();
    ctx.arc(fx, fy, fr * 0.62, 0, TAU);
    ctx.fill();
  };
  flower(64, feet - 12, 6, "#ef7a9b");
  flower(104, feet - 4, 5.5, "#ef7a9b");
  flower(158, feet - 10, 5.5, "#f2b3d0");
  flower(330, feet - 8, 6, "#a98ede");
  flower(368, feet - 2, 5, "#ffd166");

  // a butterfly, because the garden needed one moving thing
  ctx.fillStyle = "#ffd166";
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(196 + dir * 5, 300, 5, 7, dir * 0.5, 0, TAU);
    ctx.fill();
  }
}

/** m2, to Car: a colourful street — it is crossing at the left crosswalk. */
function street(ctx: Ctx, sx: number, feet: number): void {
  sky(ctx, SKY_DAY);
  cloud(ctx, 320, 96, 1.05, CLOUD_W, 0.9);
  cloud(ctx, 110, 164, 0.8, CLOUD_W, 0.7);

  const kerb = feet - 5;
  // a row of houses in four different colours — the point of this stage
  const row: [number, number, number, string, string][] = [
    [-14, 84, 92, WALL_MINT, ROOF_CORAL],
    [76, 78, 110, WALL_CREAM, ROOF_TEAL],
    [166, 72, 86, WALL_BLUSH, ROOF_GOLD],
    [250, 86, 104, WALL_MINT, ROOF_PLUM],
    [348, 76, 88, WALL_CREAM, ROOF_CORAL],
  ];
  for (const [hx, hw, hh, wall, roof] of row) house(ctx, hx, kerb, hw, hh, wall, roof);

  // pavement, kerb, road
  ctx.fillStyle = STONE;
  ctx.fillRect(0, kerb, BG_W, 10);
  ctx.fillStyle = STONE_D;
  ctx.fillRect(0, kerb + 10, BG_W, 4);
  ctx.fillStyle = "#8f8a86";
  ctx.fillRect(0, feet + 9, BG_W, BG_H - feet);

  // crosswalk under the monster — a short zebra band, not full-height columns
  ctx.fillStyle = "#f6f2ea";
  for (const x of [sx - 52, sx - 18, sx + 16, sx + 50]) {
    ctx.beginPath();
    ctx.moveTo(x, feet + 13);
    ctx.lineTo(x + 22, feet + 13);
    ctx.lineTo(x + 28, feet + 66);
    ctx.lineTo(x - 6, feet + 66);
    ctx.closePath();
    ctx.fill();
  }
  // centre dashes on the empty half of the road
  ctx.fillStyle = WINDOW;
  for (const x of [286, 344] as number[]) ctx.fillRect(x, feet + 82, 34, 5);

  // a parked car across the street — it IS the growing-to-Car stage
  const carY = feet + 30;
  ctx.fillStyle = "#e05a52";
  ctx.beginPath();
  ctx.moveTo(292, carY + 20);
  ctx.quadraticCurveTo(294, carY + 2, 312, carY);
  ctx.quadraticCurveTo(320, carY - 14, 340, carY - 14);
  ctx.quadraticCurveTo(360, carY - 14, 366, carY);
  ctx.quadraticCurveTo(382, carY + 2, 384, carY + 20);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#bfe8f5";
  ctx.beginPath();
  ctx.moveTo(326, carY - 1);
  ctx.quadraticCurveTo(330, carY - 11, 340, carY - 11);
  ctx.lineTo(340, carY - 1);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(346, carY - 11);
  ctx.quadraticCurveTo(356, carY - 11, 360, carY - 1);
  ctx.lineTo(346, carY - 1);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#3d3733";
  ctx.beginPath();
  ctx.arc(310, carY + 20, 8, 0, TAU);
  ctx.arc(366, carY + 20, 8, 0, TAU);
  ctx.fill();
  ctx.fillStyle = STONE;
  ctx.beginPath();
  ctx.arc(310, carY + 20, 3.4, 0, TAU);
  ctx.arc(366, carY + 20, 3.4, 0, TAU);
  ctx.fill();
}

/** m3, to House: seated on the ridge of the tall roof, right of centre. */
function rooftops(ctx: Ctx, sx: number, feet: number): void {
  sky(ctx, SKY_WARM);
  glow(ctx, 62, 92, 21, "#ffd98f");
  cloud(ctx, 158, 178, 1.1, CLOUD_W, 0.9);
  cloud(ctx, 340, 240, 0.75, CLOUD_W, 0.7);
  // two distant birds
  ctx.strokeStyle = "#6b5a4a";
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  for (const [bx, by, s] of [
    [110, 300, 1],
    [146, 322, 0.7],
  ] as [number, number, number][]) {
    ctx.beginPath();
    ctx.moveTo(bx - 8 * s, by);
    ctx.quadraticCurveTo(bx - 4 * s, by - 5 * s, bx, by);
    ctx.quadraticCurveTo(bx + 4 * s, by - 5 * s, bx + 8 * s, by);
    ctx.stroke();
  }

  // neighbouring roofs, lower and to the left — farther away, cooler colours
  ctx.fillStyle = ROOF_TEAL;
  ctx.beginPath();
  ctx.moveTo(-40, BG_H);
  ctx.lineTo(48, feet + 42);
  ctx.lineTo(150, BG_H);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = ROOF_PLUM;
  ctx.beginPath();
  ctx.moveTo(56, BG_H);
  ctx.lineTo(158, feet + 56);
  ctx.lineTo(266, BG_H);
  ctx.closePath();
  ctx.fill();

  // THE roof, its ridge under the monster; tile courses along the slope
  const roofPath = () => {
    ctx.beginPath();
    ctx.moveTo(104, BG_H);
    ctx.lineTo(sx, feet + 6);
    ctx.lineTo(464, BG_H);
    ctx.closePath();
  };
  roofPath();
  ctx.fillStyle = ROOF_CORAL;
  ctx.fill();
  ctx.save();
  roofPath();
  ctx.clip();
  ctx.strokeStyle = "#c9584a";
  ctx.lineWidth = 2.4;
  for (let i = 1; i <= 4; i++) {
    const dy = i * 28;
    ctx.beginPath();
    ctx.moveTo(sx - 90 - i * 24, feet + 6 + dy + 24);
    ctx.lineTo(sx, feet + 6 + dy);
    ctx.lineTo(sx + 90 + i * 24, feet + 6 + dy + 24);
    ctx.stroke();
  }
  ctx.restore();
  ctx.fillStyle = "#c9584a";
  ctx.fillRect(sx - 34, feet, 68, 8);

  // a dormer window poking through the right slope
  ctx.fillStyle = WALL_CREAM;
  ctx.fillRect(332, feet + 46, 30, 28);
  ctx.fillStyle = "#c9584a";
  ctx.beginPath();
  ctx.moveTo(328, feet + 46);
  ctx.lineTo(347, feet + 31);
  ctx.lineTo(366, feet + 46);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = WINDOW;
  ctx.fillRect(339, feet + 52, 16, 16);

  // chimney down the left slope, smoke curling
  ctx.fillStyle = STONE;
  ctx.fillRect(190, feet + 58, 22, 40);
  ctx.fillStyle = STONE_D;
  ctx.fillRect(186, feet + 52, 30, 9);
  ctx.strokeStyle = CLOUD_W;
  ctx.globalAlpha = 0.85;
  ctx.lineWidth = 6;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(201, feet + 44);
  ctx.quadraticCurveTo(213, feet + 24, 200, feet + 6);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

/** m4, to Building: on a parapet — and the tower across is taller. */
function skyline(ctx: Ctx, sx: number, feet: number): void {
  sky(ctx, SKY_WARM);
  // back rank, hazier and cooler
  ctx.fillStyle = "#a9bfd4";
  for (const [x, w, top] of [
    [20, 44, feet - 62],
    [86, 38, feet - 84],
    [258, 40, feet - 72],
    [330, 50, feet - 92],
  ] as [number, number, number][]) {
    ctx.fillRect(x, top, w, BG_H - top);
  }
  // near rank in real colours, with lit windows
  const wr = rng(7);
  const rank: [number, number, number, string][] = [
    [-6, 44, feet + 40, "#7f9bbd"],
    [52, 46, feet + 26, "#c98f7c"],
    [sx - 26, 52, feet + 2, "#e0b48c"], // ITS tower
    [206, 48, feet + 46, "#8fa8a0"],
    [258, 46, feet + 30, "#b08fae"],
  ];
  for (const [x, w, top, tone] of rank) {
    ctx.fillStyle = tone;
    ctx.fillRect(x, top, w, BG_H - top);
    ctx.fillStyle = WINDOW;
    for (let wy = top + 10; wy < BG_H - 8; wy += 16) {
      for (let wx = x + 8; wx < x + w - 8; wx += 13) {
        if (wr() < 0.45) {
          ctx.globalAlpha = 0.55 + wr() * 0.45;
          ctx.fillRect(wx, wy, 5, 7);
        }
      }
    }
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = "#c9995e";
  ctx.fillRect(sx - 32, feet - 4, 64, 8);

  // the joke: the tower across the way is taller — mast, light and all
  ctx.fillStyle = "#7e93b5";
  ctx.fillRect(306, feet - 68, 40, BG_H);
  ctx.fillStyle = WINDOW;
  for (let wy = feet - 56; wy < BG_H - 8; wy += 16) {
    for (let wx = 313; wx < 340; wx += 13) {
      if (wr() < 0.45) {
        ctx.globalAlpha = 0.55 + wr() * 0.45;
        ctx.fillRect(wx, wy, 5, 7);
      }
    }
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#5f7c9b";
  ctx.fillRect(302, feet - 72, 48, 7);
  ctx.strokeStyle = "#5f7c9b";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(326, feet - 72);
  ctx.lineTo(326, feet - 96);
  ctx.stroke();
  ctx.fillStyle = "#e8443c";
  ctx.beginPath();
  ctx.arc(326, feet - 99, 3.6, 0, TAU);
  ctx.fill();

  cloud(ctx, 250, feet - 112, 1.2, CLOUD_W, 0.85);
  cloud(ctx, 62, feet - 134, 0.9, CLOUD_W, 0.7);
}

/** m5, to Town: on the hilltop, the village down both slopes. */
function aboveTown(ctx: Ctx, sx: number, feet: number): void {
  sky(ctx, SKY_DAY);
  glow(ctx, 74, 86, 19, "#ffe07a");
  cloud(ctx, 300, 150, 1.0, CLOUD_W, 0.9);

  // far hills, then the near hill cresting under the monster
  ground(
    ctx,
    [
      [0, feet + 12],
      [110, feet - 2],
      [250, feet + 16],
      [400, feet + 2],
    ],
    GRASS_D
  );
  ground(
    ctx,
    [
      [0, feet + 44],
      [150, feet + 34],
      [sx, feet - 6],
      [330, feet + 30],
      [400, feet + 38],
    ],
    GRASS
  );

  // a footpath winding up to the crest it stands on
  ctx.strokeStyle = "#e2c9a0";
  ctx.lineWidth = 6;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(sx - 6, feet - 2);
  ctx.bezierCurveTo(sx - 40, feet + 18, sx + 20, feet + 34, sx - 30, feet + 62);
  ctx.stroke();

  // the village, roofs in three colours
  const roofs = [ROOF_CORAL, ROOF_TEAL, ROOF_GOLD, ROOF_PLUM];
  const spots: [number, number][] = [
    [70, feet + 30],
    [116, feet + 24],
    [158, feet + 32],
    [318, feet + 26],
    [352, feet + 34],
  ];
  spots.forEach(([tx, ty], i) => house(ctx, tx, ty + 16, 17, 16, WALL_CREAM, roofs[i % roofs.length]));

  // trees between the houses
  for (const [tx2, ty2, tw2] of [
    [96, feet + 34, 9],
    [186, feet + 30, 10],
    [296, feet + 32, 9],
  ] as [number, number, number][]) {
    ctx.fillStyle = WOOD_D;
    ctx.fillRect(tx2 - 1.8, ty2, 3.6, 9);
    ctx.fillStyle = LEAF;
    ctx.beginPath();
    ctx.ellipse(tx2, ty2, tw2, tw2 * 1.15, 0, 0, TAU);
    ctx.fill();
  }
}

/** m6, to City: a giant in the countryside, the city small on the horizon. */
function patchwork(ctx: Ctx, sx: number, feet: number): void {
  sky(ctx, SKY_DAY);
  cloud(ctx, 70, 140, 1.2, CLOUD_W, 0.9);
  cloud(ctx, 300, 200, 0.85, CLOUD_W, 0.75);

  const horizon = feet - 34;
  // the destination: a tiny city skyline on the horizon
  ctx.fillStyle = "#8fa4c4";
  for (const [x, w, h] of [
    [40, 11, 24],
    [55, 14, 38],
    [73, 10, 28],
    [87, 13, 46],
    [104, 11, 22],
    [119, 9, 16],
  ] as [number, number, number][]) {
    ctx.fillRect(x, horizon - h, w, h);
  }

  // The land: trapezoid fields whose side seams SLANT (columns spread toward
  // the viewer), stitched over with wavy hedgerows. Axis-aligned rows of
  // rectangles — two earlier attempts — read as brick courses no matter the
  // colours; the slant and the waver are what make it read as country.
  const xsRows = [
    [-8, 70, 170, 250, 330, 408],
    [-8, 65, 165, 255, 335, 408],
    [-8, 58, 158, 262, 342, 408],
    [-8, 50, 150, 270, 350, 408],
  ];
  const ysRows = [horizon, horizon + 26, horizon + 64, BG_H + 6];
  const tones = ["#8fc96c", "#c8d86a", "#6fb356", "#e0c46a", "#a3cf72"];
  for (let b = 0; b < 3; b++) {
    for (let c = 0; c < 5; c++) {
      ctx.fillStyle = tones[(b * 2 + c) % tones.length];
      ctx.beginPath();
      ctx.moveTo(xsRows[b][c], ysRows[b]);
      ctx.lineTo(xsRows[b][c + 1], ysRows[b]);
      ctx.lineTo(xsRows[b + 1][c + 1], ysRows[b + 1]);
      ctx.lineTo(xsRows[b + 1][c], ysRows[b + 1]);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.strokeStyle = LEAF_D;
  ctx.lineCap = "round";
  for (let b = 1; b < 3; b++) {
    ctx.lineWidth = 3 + b;
    ctx.beginPath();
    ctx.moveTo(-8, ysRows[b]);
    ctx.bezierCurveTo(100, ysRows[b] - 5 - b * 2, 260, ysRows[b] + 5 + b * 2, 408, ysRows[b] - 3);
    ctx.stroke();
  }
  for (let c = 1; c < 5; c++) {
    ctx.lineWidth = 3.6;
    ctx.beginPath();
    ctx.moveTo(xsRows[0][c], horizon + 2);
    ctx.bezierCurveTo(xsRows[1][c] + 5, ysRows[1], xsRows[2][c] - 5, ysRows[2], xsRows[3][c], BG_H);
    ctx.stroke();
  }
  ctx.fillStyle = LEAF_D;
  for (const [hx, hy, hr] of [
    [162, horizon + 27, 5],
    [258, horizon + 24, 4],
    [64, horizon + 62, 5.5],
    [340, horizon + 66, 5.5],
    [152, horizon + 110, 6.5],
  ] as [number, number, number][]) {
    ctx.beginPath();
    ctx.arc(hx, hy, hr, 0, TAU);
    ctx.fill();
  }

  // a lane, the river with banks and a bridge, farmhouses
  ctx.strokeStyle = "#e8d9ae";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(96, horizon + 4);
  ctx.bezierCurveTo(150, horizon + 30, 60, feet + 10, sx - 40, feet + 24);
  ctx.stroke();
  const riverPath = () => {
    ctx.beginPath();
    ctx.moveTo(330, horizon);
    ctx.bezierCurveTo(292, horizon + 50, 352, horizon + 96, 302, BG_H + 8);
  };
  ctx.strokeStyle = "#c8b98a";
  ctx.lineWidth = 19;
  riverPath();
  ctx.stroke();
  ctx.strokeStyle = WATER;
  ctx.lineWidth = 14;
  riverPath();
  ctx.stroke();
  ctx.strokeStyle = "#9fdcf2";
  ctx.lineWidth = 4;
  riverPath();
  ctx.stroke();
  ctx.fillStyle = WOOD;
  ctx.fillRect(296, horizon + 58, 40, 9);
  ctx.fillRect(294, horizon + 55, 5, 15);
  ctx.fillRect(333, horizon + 55, 5, 15);
  house(ctx, 176, horizon + 46, 20, 12, WALL_CREAM, ROOF_CORAL);
  house(ctx, 64, feet + 18, 24, 14, WALL_CREAM, ROOF_TEAL);
  house(ctx, 252, feet + 46, 26, 16, WALL_CREAM, ROOF_GOLD);

  // the meadow the giant stands in
  ctx.fillStyle = GRASS_L;
  ctx.beginPath();
  ctx.ellipse(sx, feet + 10, 62, 17, 0, 0, TAU);
  ctx.fill();
}

/** m7, to Country: standing on the curve of the world, haze below. */
function stratosphere(ctx: Ctx, sx: number, feet: number): void {
  sky(ctx, [
    [0, "#bcdcf2"],
    [0.4, "#6fa8d8"],
    [0.75, "#89b8dc"],
    [1, "#e8dcc0"],
  ]);
  stars(ctx, 31, 22, 0, 190);
  // The apex meets the feet: a quadratic only reaches halfway from its
  // endpoints to its control, B(0.5) = (P0 + 2C + P2)/4, hence feet-48.
  ctx.beginPath();
  ctx.moveTo(-4, BG_H + 4);
  ctx.lineTo(-4, feet + 48);
  ctx.quadraticCurveTo(sx, feet - 48, 404, feet + 48);
  ctx.lineTo(BG_W + 4, BG_H + 4);
  ctx.closePath();
  ctx.fillStyle = "#94b56f";
  ctx.fill();
  // land detail: field flecks and a river glint, fading into haze
  ctx.fillStyle = "#7ba15c";
  const hr = rng(41);
  for (let i = 0; i < 14; i++) {
    ctx.fillRect(hr() * BG_W, feet + 30 + hr() * 46, 26 + hr() * 34, 5);
  }
  ctx.strokeStyle = WATER;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(70, feet + 40);
  ctx.bezierCurveTo(140, feet + 60, 220, feet + 40, 320, feet + 74);
  ctx.stroke();
  // haze lying along the curve
  ctx.fillStyle = "#dceaf2";
  for (const [hx2, hy, hw, a] of [
    [-10, feet + 22, 190, 0.75],
    [150, feet + 10, 160, 0.6],
    [290, feet + 24, 130, 0.7],
  ] as [number, number, number, number][]) {
    ctx.globalAlpha = a;
    ctx.beginPath();
    ctx.ellipse(hx2 + hw / 2, hy, hw / 2, 8, 0, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  // thin high cirrus
  ctx.fillStyle = CLOUD_W;
  for (const [cx2, cy2, cw, a] of [
    [96, 452, 110, 0.6],
    [300, 494, 90, 0.5],
  ] as [number, number, number, number][]) {
    ctx.globalAlpha = a;
    ctx.beginPath();
    ctx.ellipse(cx2, cy2, cw / 2, 5, 0, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/** m8, to Continent: standing where the limb of the planet crests. */
function lowOrbit(ctx: Ctx, sx: number, feet: number): void {
  sky(ctx, [
    [0, "#b9cfe8"],
    [0.5, "#5f74a8"],
    [1, "#3b4a7a"],
  ]);
  stars(ctx, 53, 54, 0, 460);
  glow(ctx, 330, 100, 10, "#fff3c4");

  const apexY = feet;
  const edgeY = feet + 42;
  const limb = () => {
    ctx.beginPath();
    ctx.moveTo(-4, BG_H + 4);
    ctx.lineTo(-4, edgeY);
    ctx.quadraticCurveTo(sx, apexY - (edgeY - apexY), 404, edgeY);
    ctx.lineTo(BG_W + 4, BG_H + 4);
    ctx.closePath();
  };
  limb();
  ctx.fillStyle = "#2f86c4";
  ctx.fill();
  ctx.save();
  limb();
  ctx.clip();
  // one ragged coastline, an island so it isn't a stripe
  ctx.fillStyle = "#63b45f";
  ctx.beginPath();
  ctx.moveTo(-10, BG_H + 10);
  ctx.lineTo(-10, edgeY + 26);
  ctx.bezierCurveTo(60, edgeY + 4, 90, edgeY + 36, 150, edgeY + 18);
  ctx.bezierCurveTo(200, edgeY + 4, 224, edgeY + 42, 290, edgeY + 26);
  ctx.bezierCurveTo(340, edgeY + 14, 372, edgeY + 36, 410, edgeY + 24);
  ctx.lineTo(410, BG_H + 10);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#d9c98f";
  ctx.beginPath();
  ctx.ellipse(90, apexY + 30, 30, 10, -0.15, 0, TAU);
  ctx.ellipse(268, apexY + 42, 22, 8, 0.2, 0, TAU);
  ctx.fill();
  ctx.fillStyle = CLOUD_W;
  for (const [wx, wy, ww, a] of [
    [70, apexY + 44, 130, 0.6],
    [230, apexY + 30, 100, 0.55],
    [330, apexY + 58, 110, 0.5],
  ] as [number, number, number, number][]) {
    ctx.globalAlpha = a;
    ctx.beginPath();
    ctx.ellipse(wx, wy, ww / 2, 7, -0.06, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
  // the atmosphere rim
  ctx.save();
  ctx.strokeStyle = "#9fe0ff";
  for (const [lw, a, lift] of [
    [18, 0.3, -6],
    [5, 0.9, 0],
  ] as [number, number, number][]) {
    ctx.lineWidth = lw;
    ctx.globalAlpha = a;
    ctx.beginPath();
    ctx.moveTo(-4, edgeY + lift);
    ctx.quadraticCurveTo(sx, apexY - (edgeY - apexY) + lift, 404, edgeY + lift);
    ctx.stroke();
  }
  ctx.restore();
}

/** m9, to Planet: adrift high-right, standing on its own asteroid. */
function space(ctx: Ctx, sx: number, feet: number): void {
  sky(ctx, [
    [0, "#b9c6e8"],
    [0.45, "#5b5f9e"],
    [0.8, "#4a4382"],
    [1, "#8a80b8"],
  ]);
  stars(ctx, 67, 90, 0, BG_H);
  // a ringed neighbour, off on the other side
  const px = 100;
  const py = 158;
  const pr = 34;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(-0.28);
  ctx.strokeStyle = "#f0c98a";
  ctx.lineWidth = 5;
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.ellipse(0, 0, pr * 1.7, pr * 0.5, 0, 0, TAU);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#e8896a";
  ctx.beginPath();
  ctx.arc(0, 0, pr, 0, TAU);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, pr, 0, TAU);
  ctx.clip();
  ctx.fillStyle = "#d46f56";
  ctx.fillRect(-pr, -6, pr * 2, 9);
  ctx.fillRect(-pr, 12, pr * 2, 6);
  ctx.restore();
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.ellipse(0, 0, pr * 1.7, pr * 0.5, 0, Math.PI * 0.06, Math.PI * 0.94);
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = "#cfe0f5";
  ctx.beginPath();
  ctx.arc(168, 250, 7, 0, TAU);
  ctx.fill();

  // its asteroid — Little Prince style, craters and all
  ctx.fillStyle = "#8f7fa8";
  ctx.beginPath();
  ctx.ellipse(sx, feet + 12, 46, 14, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "#75658e";
  for (const [cx2, cy2, cr] of [
    [sx - 22, feet + 12, 5],
    [sx + 12, feet + 17, 3.8],
    [sx + 28, feet + 9, 3],
  ] as [number, number, number][]) {
    ctx.beginPath();
    ctx.ellipse(cx2, cy2, cr, cr * 0.6, 0, 0, TAU);
    ctx.fill();
  }
}

/** m10, to Solar System: its own planet, riding its own orbit, lower left. */
function solarSystem(ctx: Ctx, sx: number, feet: number): void {
  sky(ctx, [
    [0, "#b6c2e6"],
    [0.45, "#54589c"],
    [0.8, "#453f7e"],
    [1, "#847cb4"],
  ]);
  stars(ctx, 71, 95, 0, BG_H);
  const sunX = 316;
  const sunY = 140;
  glow(ctx, sunX, sunY, 28, "#ffcf4d");
  ctx.save();
  ctx.strokeStyle = "#cfd6f5";
  ctx.lineWidth = 1.6;
  const planets: [number, number, string, number][] = [
    [88, 2.6, "#e8896a", 5],
    [150, 4.3, "#5fb8c4", 7],
    [216, 1.2, "#c4a86a", 4.5],
  ];
  for (const [orbitR, angle, tone, prr] of planets) {
    ctx.globalAlpha = 0.28;
    ctx.beginPath();
    ctx.ellipse(sunX, sunY, orbitR, orbitR * 0.62, -0.35, 0, TAU);
    ctx.stroke();
    const ppx = sunX + Math.cos(angle) * orbitR;
    const ppy = sunY + Math.sin(angle) * orbitR * 0.62;
    ctx.globalAlpha = 1;
    ctx.fillStyle = tone;
    ctx.beginPath();
    ctx.arc(ppx, ppy, prr, 0, TAU);
    ctx.fill();
  }
  // the monster's own orbit: one great arc centred on the sun, through its planet
  const prR = 28;
  const pcx = sx;
  const pcy = feet + prR;
  ctx.globalAlpha = 0.32;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(sunX, sunY, Math.hypot(pcx - sunX, pcy - sunY), 0, TAU);
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = "#63b45f";
  ctx.beginPath();
  ctx.arc(pcx, pcy, prR, 0, TAU);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.arc(pcx, pcy, prR, 0, TAU);
  ctx.clip();
  ctx.fillStyle = "#2f86c4";
  ctx.fillRect(pcx - prR, pcy + 6, prR * 2, 9);
  ctx.fillStyle = "#4f9e4b";
  ctx.fillRect(pcx - prR, pcy + 15, prR * 2, 6);
  ctx.restore();
}

/** m11, to Universe: seated on the bright core of its own galaxy. */
function galaxies(ctx: Ctx, sx: number, feet: number): void {
  sky(ctx, [
    [0, "#b8bfe4"],
    [0.45, "#544a94"],
    [0.8, "#413672"],
    [1, "#8878b0"],
  ]);
  stars(ctx, 83, 130, 0, BG_H);
  const galaxy = (gx: number, gy: number, s: number, rot: number, boost = 1) => {
    ctx.save();
    ctx.translate(gx, gy);
    ctx.rotate(rot);
    ctx.scale(1, 0.55);
    ctx.fillStyle = "#8f6fc4";
    ctx.globalAlpha = Math.min(1, 0.55 * boost);
    ctx.beginPath();
    ctx.arc(0, 0, 34 * s, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#d8bff0";
    ctx.globalAlpha = Math.min(1, 0.6 * boost);
    for (const turn of [0, Math.PI]) {
      ctx.save();
      ctx.rotate(turn);
      ctx.beginPath();
      ctx.moveTo(3 * s, -8 * s);
      ctx.bezierCurveTo(24 * s, -14 * s, 36 * s, 4 * s, 21 * s, 28 * s);
      ctx.bezierCurveTo(29 * s, 6 * s, 20 * s, -3 * s, 1.5 * s, 6 * s);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 0.95;
    ctx.fillStyle = "#fff3c4";
    ctx.beginPath();
    ctx.ellipse(0, 0, 8 * s, 6 * s, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  };
  galaxy(84, 150, 0.8, -0.5, 1.25);
  galaxy(330, 250, 0.55, 0.6, 1.25);
  galaxy(60, 400, 0.4, 0.2, 1.25);
  galaxy(sx, feet - 4, 2.3, -0.12, 1.6);
}

/** m12, to Multiverse: inside its very own universe-bubble, to the left. */
function bubbles(ctx: Ctx, sx: number, feet: number): void {
  sky(ctx, [
    [0, "#bcbce4"],
    [0.45, "#5a4a96"],
    [0.8, "#4c3a7c"],
    [1, "#8f7cb8"],
  ]);
  stars(ctx, 97, 100, 0, BG_H);
  const bubble = (bx: number, by: number, r: number, tint: string) => {
    ctx.save();
    ctx.fillStyle = tint;
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.arc(bx, by, r, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 0.8;
    ctx.strokeStyle = "#e8dcff";
    ctx.lineWidth = 2.4;
    ctx.stroke();
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.arc(bx, by, r * 0.78, -2.4, -1.5);
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
  };
  for (const [bx, by, r, tint] of [
    [318, 140, 50, "#5fb8c4"],
    [74, 180, 40, "#c47ac4"],
    [332, 396, 26, "#e8a05c"],
    [58, 330, 20, "#6f8fd8"],
  ] as [number, number, number, string][]) {
    bubble(bx, by, r, tint);
    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = "#fff3c4";
    ctx.beginPath();
    ctx.ellipse(bx + r * 0.1, by + r * 0.12, r * 0.17, r * 0.1, -0.4, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
  // its own bubble; the glass front lives in the foreground layer
  bubble(sx, feet - 70, 96, "#7fd0d8");
}

/** m13, to Dimension: dead centre — the rings emanate from the monster. */
function dimension(ctx: Ctx, sx: number, feet: number): void {
  sky(ctx, [
    [0, "#bdb4e2"],
    [0.45, "#5b3f8e"],
    [0.8, "#4e3178"],
    [1, "#8a70ac"],
  ]);
  stars(ctx, 101, 70, 0, BG_H);
  // aurora ribbons
  ctx.save();
  for (const [tone, a, off, w] of [
    ["#4fd8c4", 0.22, 0, 44],
    ["#ff8fb8", 0.18, 84, 34],
    ["#7fb0ff", 0.16, 190, 30],
  ] as [string, number, number, number][]) {
    ctx.fillStyle = tone;
    ctx.globalAlpha = a;
    ctx.beginPath();
    ctx.moveTo(40 + off, -10);
    ctx.bezierCurveTo(110 + off, 200, -20 + off, 380, 70 + off, 730);
    ctx.lineTo(70 + off + w, 730);
    ctx.bezierCurveTo(-20 + off + w, 380, 110 + off + w, 200, 40 + off + w, -10);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  // rings widening from the monster
  const cy = feet - 66;
  ctx.save();
  ctx.strokeStyle = "#e8d4ff";
  for (let i = 0; i < 5; i++) {
    ctx.globalAlpha = 0.5 - i * 0.08;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(sx, cy, 112 + i * 40, 92 + i * 33, 0, 0, TAU);
    ctx.stroke();
  }
  ctx.restore();
}

const STAGES: ((ctx: Ctx, sx: number, feet: number) => void)[] = [
  bakery,
  garden,
  street,
  rooftops,
  skyline,
  aboveTown,
  patchwork,
  stratosphere,
  lowOrbit,
  space,
  solarSystem,
  galaxies,
  bubbles,
  dimension,
];

/**
 * Paint the stage for a milestone into a context scaled to `scale` device
 * pixels per world unit, then lay the paper grain over it.
 */
export function paintBg(ctx: Ctx, milestone: number, scale: number): void {
  const i = Math.min(Math.max(milestone, 0), BG_LAST);
  ctx.save();
  ctx.scale(scale, scale);
  STAGES[i](ctx, SPOTS[i].x, SPOTS[i].feet);
  grain(ctx, 7 + i);
  ctx.restore();
}

// --- the foreground layer ---------------------------------------------------

/**
 * A few stages put something IN FRONT of the monster — that occlusion is
 * what sells "in the scene" rather than "in front of a backdrop". Returns
 * false when the stage has no foreground, so no texture is made for it.
 */
export function paintBgFront(ctx: Ctx, milestone: number, scale: number): boolean {
  const i = Math.min(Math.max(milestone, 0), BG_LAST);
  const { x: sx, feet } = SPOTS[i];
  if (i === 1) {
    // the white picket fence the monster hides behind
    ctx.save();
    ctx.scale(scale, scale);
    ctx.fillStyle = "#fdfaf2";
    for (let x = 2; x < BG_W; x += 30) {
      ctx.beginPath();
      ctx.moveTo(x, feet - 24);
      ctx.lineTo(x + 8, feet - 32);
      ctx.lineTo(x + 16, feet - 24);
      ctx.lineTo(x + 16, feet + 24);
      ctx.lineTo(x, feet + 24);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = "#e8e2d4";
    ctx.fillRect(0, feet - 14, BG_W, 7);
    ctx.fillRect(0, feet + 12, BG_W, 7);
    ctx.restore();
    return true;
  }
  if (i === 12) {
    // the glass of its bubble: rim plus one diagonal sheen
    const bx = sx;
    const by = feet - 70;
    const r = 96;
    ctx.save();
    ctx.scale(scale, scale);
    ctx.strokeStyle = "#e8dcff";
    ctx.globalAlpha = 0.42;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(bx, by, r, 0, TAU);
    ctx.stroke();
    ctx.globalAlpha = 0.2;
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.arc(bx - r * 0.2, by + r * 0.15, r * 0.72, -2.1, -0.9);
    ctx.stroke();
    ctx.restore();
    return true;
  }
  return false;
}

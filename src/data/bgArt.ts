/**
 * The background environments — one per milestone, painted to canvas textures.
 *
 * THE CAMERA PULLS BACK AS THE MONSTER GROWS. That is the whole idea: the
 * monster never gets much bigger on screen, but the world behind it falls
 * away — a bakery wall, then a garden, then rooftops, then the curve of the
 * planet, then space — so its growth is told by everything else shrinking.
 *
 * EVERY STAGE PLACES THE MONSTER SOMEWHERE. Not centred — each scene has a
 * SPOT (see SPOTS) chosen to fit it: off by the wainscot in the bakery,
 * peeking over the garden fence, on the ridge of a roof, drifting high-right
 * on an asteroid. The scene draws its perch at that spot and the monster is
 * moved there, so the pair always agree. Some stages also paint a FOREGROUND
 * layer (paintBgFront) that sits in front of the monster — the garden fence
 * it hides behind, the glass of its universe-bubble — which is what turns
 * "standing in front of scenery" into "being inside the scene".
 *
 * There is deliberately no size caption any more: the background IS the
 * scale readout. A monster peeking over a fence says "person-sized"; the
 * same monster dwarfing a town says the rest.
 *
 * Style: these are BACKGROUNDS, so the rules are the opposite of refArt's
 * foreground rules. No outlines — an outlined shape jumps forward, and
 * scenery must recede. Gradient skies are allowed (a wash of light IS what a
 * sky looks like); scenery is flat silhouette layers in muted tones. Nothing
 * saturated: every colour is pulled toward the cream page so the food and UI
 * stay the loudest things on screen.
 *
 * Two hard constraints, checked in every painter:
 *  - The TOP ~150px carries the score and "GROWING TO" text in dark brown,
 *    so every sky stays light up there — even in deep space, which is why
 *    space here is dusty lavender rather than black.
 *  - The monster's spot must keep its whole body below the bin (floor 470)
 *    and its name label on screen, so feet lines live in 585..640 and x in
 *    96..300.
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

/** Cream star speckle, seeded so it's stable. Kept out of the top-centre HUD. */
function stars(ctx: Ctx, seed: number, count: number, yMin: number, yMax: number): void {
  const r = rng(seed);
  ctx.save();
  ctx.fillStyle = "#fff6e0";
  for (let i = 0; i < count; i++) {
    const x = r() * BG_W;
    const y = yMin + r() * (yMax - yMin);
    // dodge the score block — a star inside a numeral reads as dirt
    if (y < 130 && x > 120 && x < 280) continue;
    const big = r() < 0.15;
    ctx.globalAlpha = 0.25 + r() * (big ? 0.55 : 0.35);
    const s = big ? 1.9 : 1.1;
    ctx.fillRect(x, y, s, s);
  }
  ctx.restore();
}

/** A soft disc glow as stepped concentric circles — same trick as the aura. */
function glow(ctx: Ctx, x: number, y: number, r0: number, color: string): void {
  ctx.save();
  ctx.fillStyle = color;
  for (const [k, a] of [
    [2.1, 0.1],
    [1.55, 0.16],
    [1.0, 1],
  ] as [number, number][]) {
    ctx.globalAlpha = a;
    ctx.beginPath();
    ctx.arc(x, y, r0 * k, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * Paper grain over the finished scene — the "texture" that stops a gradient
 * reading as a plain CSS fill. Two speckles, ink and cream, at whisper alpha.
 */
function grain(ctx: Ctx, seed: number): void {
  const r = rng(seed);
  ctx.save();
  for (let i = 0; i < 1500; i++) {
    ctx.fillStyle = i < 950 ? "#6b4a33" : "#fff8e8";
    ctx.globalAlpha = 0.02 + r() * 0.04;
    ctx.fillRect(r() * BG_W, r() * BG_H, 1.7, 1.7);
  }
  ctx.restore();
}

// --- the fourteen stages ----------------------------------------------------
// Each takes `sx` (the monster's x) and `feet` (where its feet touch); the
// perch is drawn exactly there.

/** m0, to Dog: the bakery — wallpaper, wainscot, its rug by the wall. */
function bakery(ctx: Ctx, sx: number, feet: number): void {
  sky(ctx, [
    [0, "#fff3d6"],
    [1, "#ffe7bd"],
  ]);
  ctx.fillStyle = "#f0d9a9";
  ctx.globalAlpha = 0.5;
  for (let row = 0; row < 10; row++) {
    for (let col = 0; col < 8; col++) {
      const x = 28 + col * 50 + (row % 2 ? 25 : 0);
      ctx.beginPath();
      ctx.arc(x, 36 + row * 50, 3.2, 0, TAU);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  // a framed picture and a jar shelf — the wall needed something to be a wall
  ctx.fillStyle = "#c9a271";
  ctx.fillRect(296, 396, 62, 50);
  ctx.fillStyle = "#f7e5c2";
  ctx.fillRect(301, 401, 52, 40);
  ctx.fillStyle = "#e89bb2";
  ctx.beginPath();
  ctx.arc(322, 419, 7, 0, TAU);
  ctx.arc(333, 419, 7, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "#c9a271";
  ctx.fillRect(38, 428, 84, 6);
  for (const [jx, jw, jh] of [
    [48, 14, 18],
    [68, 18, 24],
    [92, 14, 15],
  ] as [number, number, number][]) {
    ctx.fillStyle = "#dfb98a";
    ctx.fillRect(jx, 428 - jh, jw, jh);
    ctx.fillStyle = "#b98d62";
    ctx.fillRect(jx - 1, 428 - jh - 3, jw + 2, 4);
  }
  const seam = feet - 6;
  ctx.fillStyle = "#f6dead";
  ctx.fillRect(0, seam - 44, BG_W, 44);
  ctx.fillStyle = "#d8b57e";
  ctx.fillRect(0, seam - 48, BG_W, 5);
  ctx.fillStyle = "#e8c890";
  for (let x = 14; x < BG_W; x += 46) ctx.fillRect(x, seam - 36, 30, 28);
  ctx.fillStyle = "#e5bd82";
  ctx.fillRect(0, seam, BG_W, BG_H - seam);
  ctx.fillStyle = "#c9995e";
  ctx.globalAlpha = 0.7;
  ctx.fillRect(0, seam, BG_W, 3);
  for (const x of [70, 215, 285, 350]) ctx.fillRect(x, seam + 5, 2, BG_H - seam);
  ctx.globalAlpha = 1;
  // the pet's rug
  ctx.fillStyle = "#f2c7d4";
  ctx.beginPath();
  ctx.ellipse(sx, feet + 5, 58, 13, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = "#e0a9bc";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.ellipse(sx, feet + 5, 46, 9.5, 0, 0, TAU);
  ctx.stroke();
  // its food bowl, off by the wall on the empty side
  ctx.fillStyle = "#d98da8";
  ctx.beginPath();
  ctx.moveTo(292, feet + 2);
  ctx.lineTo(324, feet + 2);
  ctx.lineTo(318, feet + 14);
  ctx.lineTo(298, feet + 14);
  ctx.closePath();
  ctx.fill();
}

/** m1, to Human: the garden — it hides behind the (foreground) fence,
 *  peeking over, so the scene itself needs nothing at its exact spot. */
function garden(ctx: Ctx, _sx: number, feet: number): void {
  sky(ctx, [
    [0, "#fff2d0"],
    [1, "#ffe2ae"],
  ]);
  glow(ctx, 330, 84, 22, "#ffd98f");
  cloud(ctx, 84, 128, 1.1, "#fff7e2", 0.9);
  cloud(ctx, 268, 190, 0.8, "#fff7e2", 0.7);
  // the lawn it stands on, behind the (foreground) fence
  ground(
    ctx,
    [
      [0, feet + 4],
      [150, feet - 2],
      [280, feet + 4],
      [400, feet],
    ],
    "#bcd08a"
  );
  // bushes along the back, two-tone so they read as bushes not blobs
  ctx.fillStyle = "#94b06c";
  ctx.beginPath();
  ctx.ellipse(60, feet - 2, 42, 22, 0, 0, TAU);
  ctx.ellipse(150, feet + 2, 34, 18, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "#aec886";
  ctx.beginPath();
  ctx.ellipse(52, feet - 10, 26, 13, -0.1, 0, TAU);
  ctx.ellipse(144, feet - 5, 20, 10, 0.1, 0, TAU);
  ctx.fill();
  // flowers in the monster's exact pink — the blend-in gag
  for (const [fx, fy, fr] of [
    [104, feet - 18, 5],
    [186, feet - 12, 5.5],
    [330, feet - 10, 4.5],
  ] as [number, number, number][]) {
    ctx.fillStyle = "#ef7a9b";
    for (let p = 0; p < 5; p++) {
      const a = (p / 5) * TAU;
      ctx.beginPath();
      ctx.arc(fx + Math.cos(a) * fr, fy + Math.sin(a) * fr, fr * 0.72, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = "#fff1d6";
    ctx.beginPath();
    ctx.arc(fx, fy, fr * 0.6, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "#9bb474";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(fx, fy + fr);
    ctx.lineTo(fx, fy + fr + 12);
    ctx.stroke();
  }
}

/** m2, to Car: the street — caught mid-crossing, left of centre. */
function street(ctx: Ctx, sx: number, feet: number): void {
  sky(ctx, [
    [0, "#ffefcd"],
    [1, "#ffddaa"],
  ]);
  cloud(ctx, 320, 100, 1.0, "#fff6df", 0.85);
  cloud(ctx, 120, 168, 0.75, "#fff6df", 0.6);
  const kerb = feet - 5;
  const houses: [number, number, number, number][] = [
    [-10, 78, kerb - 76, 0],
    [80, 92, kerb - 92, 1],
    [186, 74, kerb - 70, 0],
    [270, 96, kerb - 88, 1],
    [372, 70, kerb - 74, 0],
  ];
  for (const [hx, hw, hy, deep] of houses) {
    ctx.fillStyle = deep ? "#ecd2a2" : "#f4e0b8";
    ctx.fillRect(hx, hy, hw, kerb - hy);
    ctx.fillStyle = deep ? "#c9986a" : "#d6a877";
    ctx.beginPath();
    ctx.moveTo(hx - 6, hy);
    ctx.lineTo(hx + hw / 2, hy - 26);
    ctx.lineTo(hx + hw + 6, hy);
    ctx.closePath();
    ctx.fill();
    // a lit window and a front door each
    ctx.fillStyle = "#ffd98f";
    ctx.fillRect(hx + hw / 2 - 7, hy + 14, 14, 16);
    ctx.strokeStyle = "#c9a271";
    ctx.lineWidth = 1.6;
    ctx.strokeRect(hx + hw / 2 - 7, hy + 14, 14, 16);
    ctx.fillStyle = "#b98d62";
    ctx.fillRect(hx + hw - 22, kerb - 24, 13, 24);
  }
  ctx.fillStyle = "#b99e74";
  ctx.fillRect(0, kerb, BG_W, 5);
  ctx.fillStyle = "#cfb691";
  ctx.fillRect(0, feet, BG_W, BG_H - feet);
  // a parked car across the street — the very thing it is growing toward
  ctx.fillStyle = "#c97862";
  ctx.beginPath();
  ctx.moveTo(300, feet + 26);
  ctx.quadraticCurveTo(302, feet + 8, 318, feet + 6);
  ctx.quadraticCurveTo(326, feet - 6, 342, feet - 6);
  ctx.quadraticCurveTo(358, feet - 6, 364, feet + 6);
  ctx.quadraticCurveTo(378, feet + 8, 380, feet + 26);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#cfe4ea";
  ctx.beginPath();
  ctx.moveTo(330, feet + 5);
  ctx.quadraticCurveTo(334, feet - 3, 342, feet - 3);
  ctx.lineTo(342, feet + 5);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#7a5c48";
  ctx.beginPath();
  ctx.arc(316, feet + 26, 7, 0, TAU);
  ctx.arc(364, feet + 26, 7, 0, TAU);
  ctx.fill();
  // crosswalk under the monster — a short zebra band, not full-height columns
  ctx.fillStyle = "#fff3d6";
  ctx.globalAlpha = 0.55;
  for (const x of [sx - 52, sx - 18, sx + 16, sx + 50]) {
    ctx.beginPath();
    ctx.moveTo(x, feet + 4);
    ctx.lineTo(x + 22, feet + 4);
    ctx.lineTo(x + 28, feet + 62);
    ctx.lineTo(x - 6, feet + 62);
    ctx.closePath();
    ctx.fill();
  }
  // centre dashes on the empty half of the road
  for (const x of [286, 344] as number[]) {
    ctx.fillRect(x, feet + 58, 34, 5);
  }
  ctx.globalAlpha = 1;
}

/** m3, to House: seated on the ridge of the tall roof, right of centre. */
function rooftops(ctx: Ctx, sx: number, feet: number): void {
  sky(ctx, [
    [0, "#ffedca"],
    [1, "#ffd7a2"],
  ]);
  glow(ctx, 66, 96, 19, "#ffd98f");
  cloud(ctx, 150, 190, 1.15, "#fff5dd", 0.85);
  ctx.strokeStyle = "#b09070";
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
  // neighbouring roofs, lower and to the left — farther away
  ctx.fillStyle = "#e3c391";
  ctx.beginPath();
  ctx.moveTo(-40, BG_H);
  ctx.lineTo(48, feet + 42);
  ctx.lineTo(150, BG_H);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(56, BG_H);
  ctx.lineTo(158, feet + 56);
  ctx.lineTo(266, BG_H);
  ctx.closePath();
  ctx.fill();
  // THE roof, its ridge under the monster; tile courses along the slope
  ctx.fillStyle = "#cfa572";
  ctx.beginPath();
  ctx.moveTo(104, BG_H);
  ctx.lineTo(sx, feet + 6);
  ctx.lineTo(464, BG_H);
  ctx.closePath();
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(104, BG_H);
  ctx.lineTo(sx, feet + 6);
  ctx.lineTo(464, BG_H);
  ctx.closePath();
  ctx.clip();
  ctx.strokeStyle = "#b98d62";
  ctx.globalAlpha = 0.45;
  ctx.lineWidth = 2;
  for (let i = 1; i <= 3; i++) {
    const dy = i * 30;
    ctx.beginPath();
    ctx.moveTo(sx - 90 - i * 26, feet + 6 + dy + 26);
    ctx.lineTo(sx, feet + 6 + dy);
    ctx.lineTo(sx + 90 + i * 26, feet + 6 + dy + 26);
    ctx.stroke();
  }
  ctx.restore();
  ctx.fillStyle = "#b98d62";
  ctx.fillRect(sx - 34, feet, 68, 8);
  // a dormer window poking through the right slope
  ctx.fillStyle = "#f2e0b4";
  ctx.fillRect(332, feet + 44, 30, 26);
  ctx.fillStyle = "#b98d62";
  ctx.beginPath();
  ctx.moveTo(328, feet + 44);
  ctx.lineTo(347, feet + 30);
  ctx.lineTo(366, feet + 44);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#ffd98f";
  ctx.fillRect(339, feet + 50, 16, 15);
  // chimney down the left slope, smoke curling
  ctx.fillStyle = "#b98d62";
  ctx.fillRect(190, feet + 58, 22, 38);
  ctx.fillRect(186, feet + 52, 30, 9);
  ctx.strokeStyle = "#f4e3c4";
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(201, feet + 44);
  ctx.quadraticCurveTo(211, feet + 26, 200, feet + 10);
  ctx.stroke();
}

/** m4, to Building: on a parapet — and the tower across is taller. */
function skyline(ctx: Ctx, sx: number, feet: number): void {
  sky(ctx, [
    [0, "#ffe9c8"],
    [1, "#ffcf9e"],
  ]);
  ctx.fillStyle = "#e6c795";
  for (const [x, w, top] of [
    [20, 44, feet - 62],
    [86, 38, feet - 84],
    [258, 40, feet - 72],
    [330, 50, feet - 92],
  ] as [number, number, number][]) {
    ctx.fillRect(x, top, w, BG_H - top);
  }
  const wr = rng(7);
  const rank: [number, number, number][] = [
    [-6, 44, feet + 40],
    [52, 46, feet + 26],
    [sx - 26, 52, feet + 2], // ITS tower
    [206, 48, feet + 46],
    [258, 46, feet + 30],
  ];
  for (const [x, w, top] of rank) {
    ctx.fillStyle = "#c99e6d";
    ctx.fillRect(x, top, w, BG_H - top);
    ctx.fillStyle = "#ffe9b6";
    for (let wy = top + 10; wy < BG_H - 8; wy += 16) {
      for (let wx = x + 8; wx < x + w - 8; wx += 13) {
        if (wr() < 0.42) {
          ctx.globalAlpha = 0.9;
          ctx.fillRect(wx, wy, 5, 7);
        }
      }
    }
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = "#b98d62";
  ctx.fillRect(sx - 32, feet - 4, 64, 8);
  // the joke: the tower across the way is taller — mast, light and all
  ctx.fillStyle = "#c99e6d";
  ctx.fillRect(306, feet - 68, 40, BG_H);
  ctx.fillStyle = "#b98d62";
  ctx.fillRect(302, feet - 72, 48, 7);
  ctx.strokeStyle = "#b98d62";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(326, feet - 72);
  ctx.lineTo(326, feet - 96);
  ctx.stroke();
  ctx.fillStyle = "#e8756d";
  ctx.beginPath();
  ctx.arc(326, feet - 99, 3.4, 0, TAU);
  ctx.fill();
  cloud(ctx, 260, feet - 108, 1.2, "#fff3da", 0.9);
  cloud(ctx, 60, feet - 130, 0.9, "#fff3da", 0.75);
}

/** m5, to Town: on the hilltop, the village down both slopes. */
function aboveTown(ctx: Ctx, sx: number, feet: number): void {
  sky(ctx, [
    [0, "#fce4bc"],
    [1, "#f6c69c"],
  ]);
  glow(ctx, 74, 92, 17, "#ffdf9e");
  ground(
    ctx,
    [
      [0, feet + 12],
      [110, feet - 2],
      [250, feet + 16],
      [400, feet + 2],
    ],
    "#cdbb82"
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
    "#b3a06c"
  );
  // a footpath winding up to the crest it stands on
  ctx.strokeStyle = "#dcc99a";
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(sx - 6, feet - 2);
  ctx.bezierCurveTo(sx - 40, feet + 18, sx + 20, feet + 34, sx - 30, feet + 58);
  ctx.stroke();
  const tr = rng(11);
  for (const [tx, ty] of [
    [70, feet + 30],
    [116, feet + 24],
    [158, feet + 32],
    [318, feet + 26],
    [352, feet + 34],
  ] as [number, number][]) {
    const tw = 15 + tr() * 6;
    ctx.fillStyle = "#f4e0b4";
    ctx.fillRect(tx, ty, tw, 15);
    ctx.fillStyle = "#c9705a";
    ctx.beginPath();
    ctx.moveTo(tx - 2, ty);
    ctx.lineTo(tx + tw / 2, ty - 8);
    ctx.lineTo(tx + tw + 2, ty);
    ctx.closePath();
    ctx.fill();
    // one lit window each — the town is home to someone
    ctx.fillStyle = "#ffd98f";
    ctx.fillRect(tx + tw / 2 - 2.5, ty + 4, 5, 6);
  }
  // trees between the houses
  ctx.fillStyle = "#8fae6e";
  for (const [tx2, ty2, tw2] of [
    [96, feet + 34, 8],
    [186, feet + 30, 9],
    [296, feet + 32, 8],
  ] as [number, number, number][]) {
    ctx.beginPath();
    ctx.ellipse(tx2, ty2, tw2, tw2 * 1.1, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#a2794f";
    ctx.fillRect(tx2 - 1.5, ty2 + tw2, 3, 6);
    ctx.fillStyle = "#8fae6e";
  }
  cloud(ctx, 92, feet - 12, 1.3, "#fff3da", 0.92);
  cloud(ctx, 340, feet + 4, 0.85, "#fff3da", 0.8);
}

/**
 * m6, to City: a giant in the countryside. The first version was abstract —
 * random rectangles and a squiggle that the user rightly said "doesn't look
 * like anything". This one is a real landscape: the CITY it is growing
 * toward small on the horizon, hedged fields, farmhouses with red roofs,
 * tree clusters, and a proper river with banks and a little bridge.
 */
function patchwork(ctx: Ctx, sx: number, feet: number): void {
  sky(ctx, [
    [0, "#f7dcb4"],
    [1, "#eabf96"],
  ]);
  const horizon = feet - 34;
  // the destination: a tiny city skyline on the horizon
  ctx.fillStyle = "#b98d62";
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
  // The land: a quilt of trapezoid fields whose side seams SLANT (columns
  // spread outward toward the viewer), stitched over with wavy hedgerow
  // strokes. Axis-aligned rows of rectangles — both earlier attempts — read
  // as courses of brickwork no matter the colours; the slant and the waver
  // are what make it read as country seen from above.
  const xsRows = [
    [-8, 70, 170, 250, 330, 408],
    [-8, 65, 165, 255, 335, 408],
    [-8, 58, 158, 262, 342, 408],
    [-8, 50, 150, 270, 350, 408],
  ];
  const ysRows = [horizon, horizon + 26, horizon + 64, BG_H + 6];
  const tones = ["#d9c894", "#b3c583", "#e0d3a4", "#a8bd7a", "#cbb578"];
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
  ctx.strokeStyle = "#7f9c62";
  ctx.lineCap = "round";
  for (let b = 1; b < 3; b++) {
    ctx.lineWidth = 3 + b;
    ctx.beginPath();
    ctx.moveTo(-8, ysRows[b]);
    ctx.bezierCurveTo(
      100,
      ysRows[b] - 5 - b * 2,
      260,
      ysRows[b] + 5 + b * 2,
      408,
      ysRows[b] - 3
    );
    ctx.stroke();
  }
  for (let c = 1; c < 5; c++) {
    ctx.lineWidth = 3.6;
    ctx.beginPath();
    ctx.moveTo(xsRows[0][c], horizon + 2);
    ctx.bezierCurveTo(
      xsRows[1][c] + 5,
      ysRows[1],
      xsRows[2][c] - 5,
      ysRows[2],
      xsRows[3][c],
      BG_H
    );
    ctx.stroke();
  }
  // trees dotted along the hedgerows, where real hedgerow trees grow
  ctx.fillStyle = "#6f8c54";
  for (const [hx, hy, hr] of [
    [162, horizon + 27, 4.5],
    [258, horizon + 24, 3.8],
    [64, horizon + 62, 5],
    [340, horizon + 66, 5],
    [152, horizon + 110, 6],
  ] as [number, number, number][]) {
    ctx.beginPath();
    ctx.arc(hx, hy, hr, 0, TAU);
    ctx.fill();
  }
  // a lane winding from the horizon toward the clearing
  ctx.strokeStyle = "#e8d9ae";
  ctx.lineWidth = 6;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(96, horizon + 4);
  ctx.bezierCurveTo(150, horizon + 30, 60, feet + 10, sx - 40, feet + 24);
  ctx.stroke();
  // the river: banks first, water on top, and a bridge where the lane meets it
  ctx.lineCap = "round";
  const riverPath = () => {
    ctx.beginPath();
    ctx.moveTo(330, horizon);
    ctx.bezierCurveTo(292, horizon + 50, 352, horizon + 96, 302, BG_H + 8);
  };
  ctx.strokeStyle = "#9a8a5e";
  ctx.lineWidth = 19;
  riverPath();
  ctx.stroke();
  ctx.strokeStyle = "#8fb6c2";
  ctx.lineWidth = 14;
  riverPath();
  ctx.stroke();
  ctx.strokeStyle = "#b8d4da";
  ctx.lineWidth = 4;
  riverPath();
  ctx.stroke();
  // the bridge
  ctx.fillStyle = "#b98d62";
  ctx.fillRect(296, horizon + 58, 40, 9);
  ctx.fillRect(294, horizon + 55, 5, 15);
  ctx.fillRect(333, horizon + 55, 5, 15);
  // farmhouses with red roofs, and tree clusters
  for (const [hx, hy, hw] of [
    [176, horizon + 34, 20],
    [64, feet + 4, 24],
    [252, feet + 30, 26],
  ] as [number, number, number][]) {
    ctx.fillStyle = "#f2e0b4";
    ctx.fillRect(hx, hy, hw, hw * 0.62);
    ctx.fillStyle = "#c9705a";
    ctx.beginPath();
    ctx.moveTo(hx - 3, hy);
    ctx.lineTo(hx + hw / 2, hy - hw * 0.4);
    ctx.lineTo(hx + hw + 3, hy);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = "#8fae6e";
  for (const [tx, ty, tw] of [
    [148, horizon + 18, 9],
    [162, horizon + 24, 7],
    [222, feet + 2, 11],
    [240, feet + 10, 8],
    [90, feet + 44, 12],
    [110, feet + 52, 9],
  ] as [number, number, number][]) {
    ctx.beginPath();
    ctx.ellipse(tx, ty, tw, tw * 0.8, 0, 0, TAU);
    ctx.fill();
  }
  // the meadow the giant stands in
  ctx.fillStyle = "#dfd2a6";
  ctx.beginPath();
  ctx.ellipse(sx, feet + 10, 62, 17, 0, 0, TAU);
  ctx.fill();
  cloud(ctx, 70, horizon - 6, 1.5, "#fff1d8", 0.95);
  cloud(ctx, 230, horizon - 16, 1.1, "#fff1d8", 0.8);
  cloud(ctx, 356, horizon + 2, 1.3, "#fff1d8", 0.9);
}

/** m7, to Country: standing on the curve of the world, haze below. */
function stratosphere(ctx: Ctx, sx: number, feet: number): void {
  sky(ctx, [
    [0, "#d8c6e6"],
    [0.55, "#f2cfa8"],
    [1, "#f7ddb8"],
  ]);
  stars(ctx, 31, 26, 0, 210);
  // The apex meets the feet: a quadratic only reaches halfway from its
  // endpoints to its control, B(0.5) = (P0 + 2C + P2)/4, hence feet-48.
  ctx.beginPath();
  ctx.moveTo(-4, BG_H + 4);
  ctx.lineTo(-4, feet + 48);
  ctx.quadraticCurveTo(sx, feet - 48, 404, feet + 48);
  ctx.lineTo(BG_W + 4, BG_H + 4);
  ctx.closePath();
  ctx.fillStyle = "#c2b083";
  ctx.fill();
  ctx.fillStyle = "#bfae87";
  ctx.globalAlpha = 0.55;
  const hr = rng(41);
  for (let i = 0; i < 12; i++) {
    ctx.fillRect(hr() * BG_W, feet + 34 + hr() * 40, 26 + hr() * 34, 4.5);
  }
  ctx.fillStyle = "#f9e6c2";
  for (const [sx2, sy, sw, a] of [
    [-10, feet + 26, 190, 0.7],
    [150, feet + 14, 160, 0.55],
    [290, feet + 28, 130, 0.65],
  ] as [number, number, number, number][]) {
    ctx.globalAlpha = a;
    ctx.beginPath();
    ctx.ellipse(sx2 + sw / 2, sy, sw / 2, 7, 0, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#fbeccd";
  for (const [cx2, cy2, cw, a] of [
    [96, 466, 110, 0.5],
    [300, 502, 90, 0.4],
  ] as [number, number, number, number][]) {
    ctx.globalAlpha = a;
    ctx.beginPath();
    ctx.ellipse(cx2, cy2, cw / 2, 4.5, 0, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/** m8, to Continent: standing where the limb of the planet crests. */
function lowOrbit(ctx: Ctx, sx: number, feet: number): void {
  sky(ctx, [
    [0, "#c3b2da"],
    [1, "#e3c2ae"],
  ]);
  stars(ctx, 53, 44, 0, 420);
  glow(ctx, 330, 104, 9, "#efe3f2");
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
  ctx.fillStyle = "#8fb3ac";
  ctx.fill();
  ctx.save();
  limb();
  ctx.clip();
  ctx.fillStyle = "#c2b378";
  ctx.beginPath();
  ctx.moveTo(-10, BG_H + 10);
  ctx.lineTo(-10, edgeY + 26);
  ctx.bezierCurveTo(60, edgeY + 4, 90, edgeY + 36, 150, edgeY + 18);
  ctx.bezierCurveTo(200, edgeY + 4, 224, edgeY + 42, 290, edgeY + 26);
  ctx.bezierCurveTo(340, edgeY + 14, 372, edgeY + 36, 410, edgeY + 24);
  ctx.lineTo(410, BG_H + 10);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(90, apexY + 26, 26, 9, -0.15, 0, TAU);
  ctx.ellipse(298, apexY + 34, 18, 7, 0.2, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "#fff6e2";
  for (const [wx, wy, ww, a] of [
    [70, apexY + 44, 130, 0.5],
    [230, apexY + 34, 100, 0.45],
    [330, apexY + 56, 110, 0.4],
  ] as [number, number, number, number][]) {
    ctx.globalAlpha = a;
    ctx.beginPath();
    ctx.ellipse(wx, wy, ww / 2, 6, -0.06, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
  ctx.save();
  ctx.strokeStyle = "#ffe8c2";
  for (const [lw, a, lift] of [
    [16, 0.26, -5],
    [5, 0.85, 0],
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
    [0, "#cbbde0"],
    [1, "#cfb2c6"],
  ]);
  stars(ctx, 67, 70, 0, BG_H);
  // the ringed neighbour, off on the other side
  const px = 100;
  const py = 150;
  const pr = 34;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(-0.28);
  ctx.strokeStyle = "#e8d6ea";
  ctx.lineWidth = 5;
  ctx.globalAlpha = 0.7;
  ctx.beginPath();
  ctx.ellipse(0, 0, pr * 1.7, pr * 0.5, 0, 0, TAU);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#d4aec6";
  ctx.beginPath();
  ctx.arc(0, 0, pr, 0, TAU);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, pr, 0, TAU);
  ctx.clip();
  ctx.fillStyle = "#c39cb7";
  ctx.fillRect(-pr, -6, pr * 2, 9);
  ctx.fillRect(-pr, 12, pr * 2, 6);
  ctx.restore();
  ctx.globalAlpha = 0.7;
  ctx.beginPath();
  ctx.ellipse(0, 0, pr * 1.7, pr * 0.5, 0, Math.PI * 0.06, Math.PI * 0.94);
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = "#efe3f2";
  ctx.beginPath();
  ctx.arc(168, 238, 6, 0, TAU);
  ctx.fill();
  // its asteroid — Little Prince style, craters and all
  ctx.fillStyle = "#a08cb4";
  ctx.beginPath();
  ctx.ellipse(sx, feet + 12, 46, 14, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "#87749e";
  for (const [cx2, cy2, cr] of [
    [sx - 22, feet + 12, 4.5],
    [sx + 12, feet + 17, 3.5],
    [sx + 28, feet + 9, 2.8],
  ] as [number, number, number][]) {
    ctx.beginPath();
    ctx.ellipse(cx2, cy2, cr, cr * 0.6, 0, 0, TAU);
    ctx.fill();
  }
}

/** m10, to Solar System: its own planet, riding its own orbit, lower left. */
function solarSystem(ctx: Ctx, sx: number, feet: number): void {
  sky(ctx, [
    [0, "#c4b6dc"],
    [1, "#c4aac2"],
  ]);
  stars(ctx, 71, 80, 0, BG_H);
  const sunX = 316;
  const sunY = 140;
  glow(ctx, sunX, sunY, 27, "#ffd98f");
  ctx.save();
  ctx.strokeStyle = "#fff2d6";
  ctx.lineWidth = 1.6;
  const planets: [number, number, string, number][] = [
    [88, 2.6, "#d8b7c9", 5],
    [150, 4.3, "#a9c4c9", 7],
    [216, 1.2, "#cbbf92", 4.5],
  ];
  for (const [orbitR, angle, tone, prr] of planets) {
    ctx.globalAlpha = 0.18;
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
  // the monster's own orbit: one great arc centred on the sun, passing
  // exactly through its planet
  const prR = 28;
  const pcx = sx;
  const pcy = feet + prR;
  ctx.globalAlpha = 0.25;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(sunX, sunY, Math.hypot(pcx - sunX, pcy - sunY), 0, TAU);
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = "#cbbf92";
  ctx.beginPath();
  ctx.arc(pcx, pcy, prR, 0, TAU);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.arc(pcx, pcy, prR, 0, TAU);
  ctx.clip();
  ctx.fillStyle = "#b8ab7e";
  ctx.fillRect(pcx - prR, pcy + 6, prR * 2, 8);
  ctx.restore();
}

/** m11, to Universe: seated on the bright core of its own galaxy. */
function galaxies(ctx: Ctx, sx: number, feet: number): void {
  sky(ctx, [
    [0, "#c0b2da"],
    [1, "#bfa4c4"],
  ]);
  stars(ctx, 83, 120, 0, BG_H);
  const galaxy = (gx: number, gy: number, s: number, rot: number, boost = 1) => {
    ctx.save();
    ctx.translate(gx, gy);
    ctx.rotate(rot);
    ctx.scale(1, 0.55);
    ctx.fillStyle = "#cdb8dc";
    ctx.globalAlpha = Math.min(1, 0.5 * boost);
    ctx.beginPath();
    ctx.arc(0, 0, 34 * s, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#e8dcf0";
    ctx.globalAlpha = Math.min(1, 0.55 * boost);
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
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = "#fff6e0";
    ctx.beginPath();
    ctx.ellipse(0, 0, 8 * s, 6 * s, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  };
  galaxy(84, 150, 0.8, -0.5, 1.25);
  galaxy(330, 250, 0.55, 0.6, 1.25);
  galaxy(60, 400, 0.4, 0.2, 1.25);
  // ITS galaxy: boosted well past the neighbours so the seat reads
  galaxy(sx, feet - 4, 2.3, -0.12, 1.6);
}

/** m12, to Multiverse: inside its very own universe-bubble, to the left. */
function bubbles(ctx: Ctx, sx: number, feet: number): void {
  sky(ctx, [
    [0, "#b9abd4"],
    [1, "#b49cc2"],
  ]);
  stars(ctx, 97, 90, 0, BG_H);
  const bubble = (bx: number, by: number, r: number, tint: string) => {
    ctx.save();
    ctx.fillStyle = tint;
    ctx.globalAlpha = 0.24;
    ctx.beginPath();
    ctx.arc(bx, by, r, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 0.7;
    ctx.strokeStyle = "#ede2f4";
    ctx.lineWidth = 2.4;
    ctx.stroke();
    ctx.globalAlpha = 0.75;
    ctx.beginPath();
    ctx.arc(bx, by, r * 0.78, -2.4, -1.5);
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
  };
  for (const [bx, by, r, tint] of [
    [318, 140, 50, "#c2d8e2"],
    [74, 180, 40, "#d8c2e2"],
    [332, 396, 26, "#e2d0c2"],
    [312, 560, 20, "#c2d8e2"],
  ] as [number, number, number, string][]) {
    bubble(bx, by, r, tint);
    ctx.save();
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = "#fff6e0";
    ctx.beginPath();
    ctx.ellipse(bx + r * 0.1, by + r * 0.12, r * 0.16, r * 0.09, -0.4, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
  // and its own bubble, drawn around its spot. Its "contents" speck is the
  // monster itself; the glass front lives in the foreground layer.
  bubble(sx, feet - 70, 96, "#d8c2e2");
}

/** m13, to Dimension: dead centre — the rings emanate from the monster. */
function dimension(ctx: Ctx, sx: number, feet: number): void {
  sky(ctx, [
    [0, "#b3a7d0"],
    [1, "#ab94be"],
  ]);
  stars(ctx, 101, 60, 0, BG_H);
  ctx.save();
  for (const [tone, a, off, w] of [
    ["#9fc4d0", 0.2, 0, 44],
    ["#e0bd9e", 0.16, 84, 34],
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
  const cy = feet - 66;
  ctx.save();
  ctx.strokeStyle = "#e2d4f2";
  for (let i = 0; i < 5; i++) {
    ctx.globalAlpha = 0.45 - i * 0.07;
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
    // The garden fence the monster hides behind: pickets right across,
    // slightly deeper-toned than background wood so the layer reads nearer.
    ctx.save();
    ctx.scale(scale, scale);
    ctx.fillStyle = "#f3ddb0";
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
    ctx.fillStyle = "#e8ca94";
    ctx.fillRect(0, feet - 14, BG_W, 7);
    ctx.fillRect(0, feet + 12, BG_W, 7);
    ctx.restore();
    return true;
  }
  if (i === 12) {
    // The glass of its bubble, in front: the rim redrawn faintly plus one
    // diagonal sheen streak crossing the monster.
    const bx = sx;
    const by = feet - 70;
    const r = 96;
    ctx.save();
    ctx.scale(scale, scale);
    ctx.strokeStyle = "#ede2f4";
    ctx.globalAlpha = 0.3;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(bx, by, r, 0, TAU);
    ctx.stroke();
    ctx.globalAlpha = 0.14;
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.arc(bx - r * 0.2, by + r * 0.15, r * 0.72, -2.1, -0.9);
    ctx.stroke();
    ctx.restore();
    return true;
  }
  return false;
}

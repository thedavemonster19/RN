/**
 * The background environments — one per milestone, painted to canvas textures.
 *
 * THE CAMERA PULLS BACK AS THE MONSTER GROWS. That is the whole idea: the
 * monster never gets much bigger on screen, but the world behind it falls
 * away — a bakery wall, then a garden, then rooftops, then the curve of the
 * planet, then space — so its growth is told by everything else shrinking.
 *
 * EVERY STAGE BUILDS A PERCH. The monster always stands at x=200, and its
 * feet line at each milestone is exact (config.monsterFeetY — scale grows a
 * fixed step per level), so each scene places something deliberate under
 * those feet: a rug in the bakery, the ridge of a roof, a rooftop parapet, a
 * hilltop over the town, an asteroid, its own little planet on an orbit, the
 * core of a galaxy, the inside of a universe-bubble. Without this the
 * monster floated ambiguously over scenery — "is it standing on that roof?"
 * — and the scene read as a backdrop instead of a place it is IN.
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
 *    space here is dusty lavender rather than black. (It also keeps the calm,
 *    pastel feel — a pitch-black sky would be another game.)
 *  - The BOTTOM band (monster, name label, fed counter) keeps to quiet
 *    horizontal bands so dark text stays readable against it.
 *
 * Painted in the 400x720 world, baked lazily by GameScene at RENDER_SCALE
 * (only the current and next stage ever live in texture memory at once —
 * fourteen retina canvases at once would be ~70MB of GPU memory on a phone).
 */

import { MONSTER, monsterFeetY } from "../config";

type Ctx = CanvasRenderingContext2D;

const TAU = Math.PI * 2;
/** Where the monster stands — every perch is centred here. */
const PX = MONSTER.x;

export const BG_W = 400;
export const BG_H = 720;
/** Highest distinct stage; milestones beyond clamp to it. */
export const BG_LAST = 13;

export function bgKey(milestone: number): string {
  return `bg${Math.min(Math.max(milestone, 0), BG_LAST)}`;
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
 * shows no internal seams — the mistake that makes canvas clouds look like
 * three circles.
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
// Each takes `feet`: the world y where the monster's feet touch at this
// milestone. The perch goes exactly there.

/** m0, to Dog: the bakery — wallpaper, wainscot, and its own little rug. */
function bakery(ctx: Ctx, feet: number): void {
  sky(ctx, [
    [0, "#fff3d6"],
    [1, "#ffe7bd"],
  ]);
  // faint polka wallpaper, offset every other row
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
  // wainscot rail, panelled lower wall, then the floor AT the feet line
  const seam = feet - 6;
  ctx.fillStyle = "#f8e2b6";
  ctx.fillRect(0, seam - 44, BG_W, 44);
  ctx.fillStyle = "#e3c48e";
  ctx.fillRect(0, seam - 47, BG_W, 4);
  ctx.fillStyle = "#eccf9e";
  for (let x = 14; x < BG_W; x += 46) ctx.fillRect(x, seam - 36, 30, 28);
  ctx.fillStyle = "#e9c592";
  ctx.fillRect(0, seam, BG_W, BG_H - seam);
  ctx.fillStyle = "#d9ae74";
  ctx.globalAlpha = 0.55;
  ctx.fillRect(0, seam, BG_W, 2.5);
  for (const x of [70, 145, 285, 350]) ctx.fillRect(x, seam + 4, 2, BG_H - seam);
  ctx.globalAlpha = 1;
  // the pet's rug, centred under it
  ctx.fillStyle = "#f2c7d4";
  ctx.beginPath();
  ctx.ellipse(PX, feet + 5, 58, 13, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = "#e0a9bc";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.ellipse(PX, feet + 5, 46, 9.5, 0, 0, TAU);
  ctx.stroke();
}

/** m1, to Human: the garden — it stands on its own grassy knoll. */
function garden(ctx: Ctx, feet: number): void {
  sky(ctx, [
    [0, "#fff2d0"],
    [1, "#ffe2ae"],
  ]);
  glow(ctx, 330, 84, 22, "#ffd98f");
  cloud(ctx, 84, 128, 1.1, "#fff7e2", 0.9);
  cloud(ctx, 268, 190, 0.8, "#fff7e2", 0.7);
  // picket fence behind the lawn
  ctx.fillStyle = "#fbe9c4";
  for (let x = 6; x < BG_W; x += 30) {
    ctx.beginPath();
    ctx.moveTo(x, feet - 32);
    ctx.lineTo(x + 8, feet - 40);
    ctx.lineTo(x + 16, feet - 32);
    ctx.lineTo(x + 16, feet + 14);
    ctx.lineTo(x, feet + 14);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillRect(0, feet - 22, BG_W, 7);
  // bushes flanking the knoll
  ctx.fillStyle = "#b5cc8d";
  ctx.beginPath();
  ctx.ellipse(64, feet + 12, 42, 22, 0, 0, TAU);
  ctx.ellipse(340, feet + 8, 50, 26, 0, 0, TAU);
  ctx.fill();
  // the lawn rises into a knoll exactly under the monster
  ground(
    ctx,
    [
      [0, feet + 22],
      [110, feet + 16],
      [PX, feet - 4],
      [290, feet + 18],
      [400, feet + 14],
    ],
    "#c9d99e"
  );
  // flowers the same berry pink as the monster — the first "blend in" gag
  for (const [fx, fy, fr] of [
    [126, feet + 10, 5],
    [274, feet + 12, 5.5],
    [312, feet + 26, 4],
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
  }
}

/** m2, to Car: the street — caught mid-crossing on the crosswalk. */
function street(ctx: Ctx, feet: number): void {
  sky(ctx, [
    [0, "#ffefcd"],
    [1, "#ffddaa"],
  ]);
  cloud(ctx, 320, 100, 1.0, "#fff6df", 0.85);
  cloud(ctx, 120, 168, 0.75, "#fff6df", 0.6);
  // houses across the road, ending at the kerb
  const kerb = feet - 5;
  const houses: [number, number, number, number][] = [
    [-10, 78, kerb - 76, 0],
    [80, 92, kerb - 92, 1],
    [186, 74, kerb - 70, 0],
    [270, 96, kerb - 88, 1],
    [372, 70, kerb - 74, 0],
  ];
  for (const [hx, hw, hy, deep] of houses) {
    ctx.fillStyle = deep ? "#eed6ab" : "#f4e0b8";
    ctx.fillRect(hx, hy, hw, kerb - hy);
    ctx.fillStyle = deep ? "#d8ab7c" : "#e0b98c";
    ctx.beginPath();
    ctx.moveTo(hx - 6, hy);
    ctx.lineTo(hx + hw / 2, hy - 26);
    ctx.lineTo(hx + hw + 6, hy);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#fff3d6";
    ctx.globalAlpha = 0.8;
    ctx.fillRect(hx + hw / 2 - 7, hy + 14, 14, 16);
    ctx.globalAlpha = 1;
  }
  // the road surface starts AT the feet line, kerb just above it
  ctx.fillStyle = "#c8ad84";
  ctx.fillRect(0, kerb, BG_W, 5);
  ctx.fillStyle = "#d8c19c";
  ctx.fillRect(0, feet, BG_W, BG_H - feet);
  // crosswalk stripes under the monster — it's crossing the street
  ctx.fillStyle = "#fff3d6";
  ctx.globalAlpha = 0.55;
  for (const x of [148, 182, 216, 250]) {
    ctx.beginPath();
    ctx.moveTo(x, feet + 4);
    ctx.lineTo(x + 22, feet + 4);
    ctx.lineTo(x + 30, BG_H);
    ctx.lineTo(x - 8, BG_H);
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/** m3, to House: sitting right on the ridge of next door's roof. */
function rooftops(ctx: Ctx, feet: number): void {
  sky(ctx, [
    [0, "#ffedca"],
    [1, "#ffd7a2"],
  ]);
  glow(ctx, 66, 96, 19, "#ffd98f");
  cloud(ctx, 310, 156, 1.15, "#fff5dd", 0.85);
  // two distant birds
  ctx.strokeStyle = "#b09070";
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  for (const [bx, by, s] of [
    [140, 300, 1],
    [176, 322, 0.7],
  ] as [number, number, number][]) {
    ctx.beginPath();
    ctx.moveTo(bx - 8 * s, by);
    ctx.quadraticCurveTo(bx - 4 * s, by - 5 * s, bx, by);
    ctx.quadraticCurveTo(bx + 4 * s, by - 5 * s, bx + 8 * s, by);
    ctx.stroke();
  }
  // neighbouring roofs, lower — they're farther away
  ctx.fillStyle = "#e9cfa6";
  ctx.beginPath();
  ctx.moveTo(-30, BG_H);
  ctx.lineTo(56, feet + 44);
  ctx.lineTo(160, BG_H);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(250, BG_H);
  ctx.lineTo(346, feet + 38);
  ctx.lineTo(430, BG_H);
  ctx.closePath();
  ctx.fill();
  // THE roof: its ridge runs right under the monster's feet
  ctx.fillStyle = "#d9b586";
  ctx.beginPath();
  ctx.moveTo(20, BG_H);
  ctx.lineTo(PX, feet + 6);
  ctx.lineTo(380, BG_H);
  ctx.closePath();
  ctx.fill();
  // ridge cap — the actual seat
  ctx.fillStyle = "#c9a271";
  ctx.fillRect(PX - 34, feet, 68, 8);
  // chimney down the slope, smoke curling from it
  ctx.fillStyle = "#c9a271";
  ctx.fillRect(296, feet + 42, 22, 38);
  ctx.fillRect(292, feet + 36, 30, 9);
  ctx.strokeStyle = "#e8d1b2";
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(307, feet + 28);
  ctx.quadraticCurveTo(315, feet + 12, 306, feet - 2);
  ctx.stroke();
}

/** m4, to Building: on a tower top — and not even the tallest one. */
function skyline(ctx: Ctx, feet: number): void {
  sky(ctx, [
    [0, "#ffe9c8"],
    [1, "#ffcf9e"],
  ]);
  // back rank of towers
  ctx.fillStyle = "#ecd0a6";
  for (const [x, w, top] of [
    [20, 44, feet - 62],
    [86, 38, feet - 84],
    [258, 40, feet - 72],
    [330, 50, feet - 92],
  ] as [number, number, number][]) {
    ctx.fillRect(x, top, w, BG_H - top);
  }
  // near rank with lit windows; the monster's own tower is the centre one
  const wr = rng(7);
  const rank: [number, number, number][] = [
    [-6, 50, feet + 52],
    [100, 44, feet + 34],
    [PX - 26, 52, feet + 2], // ITS tower, parapet right under its feet
    [268, 50, feet + 44],
    [344, 52, feet + 24],
  ];
  for (const [x, w, top] of rank) {
    ctx.fillStyle = "#d6ae80";
    ctx.fillRect(x, top, w, BG_H - top);
    ctx.fillStyle = "#fff3d6";
    for (let wy = top + 10; wy < BG_H - 8; wy += 16) {
      for (let wx = x + 8; wx < x + w - 8; wx += 13) {
        if (wr() < 0.42) {
          ctx.globalAlpha = 0.75;
          ctx.fillRect(wx, wy, 5, 7);
        }
      }
    }
    ctx.globalAlpha = 1;
  }
  // its parapet cap
  ctx.fillStyle = "#c9a271";
  ctx.fillRect(PX - 32, feet - 4, 64, 8);
  // the joke: the tower one over is taller
  ctx.fillStyle = "#d6ae80";
  ctx.fillRect(306, feet - 68, 40, BG_H);
  ctx.fillStyle = "#c9a271";
  ctx.fillRect(302, feet - 72, 48, 7);
  cloud(ctx, 66, feet - 96, 1.2, "#fff3da", 0.9);
  cloud(ctx, 350, feet - 130, 0.9, "#fff3da", 0.75);
}

/** m5, to Town: on the hilltop, its village on the slopes below. */
function aboveTown(ctx: Ctx, feet: number): void {
  sky(ctx, [
    [0, "#fce4bc"],
    [1, "#f6c69c"],
  ]);
  glow(ctx, 344, 92, 17, "#ffdf9e");
  // far hills
  ground(
    ctx,
    [
      [0, feet + 12],
      [110, feet - 2],
      [250, feet + 16],
      [400, feet + 2],
    ],
    "#d8c793"
  );
  // the near hill rises to a crest exactly underfoot
  ground(
    ctx,
    [
      [0, feet + 44],
      [100, feet + 30],
      [PX, feet - 6],
      [300, feet + 34],
      [400, feet + 40],
    ],
    "#c6b17e"
  );
  // the village, scattered down both slopes — none under the monster
  const tr = rng(11);
  for (const [tx, ty] of [
    [58, feet + 30],
    [104, feet + 22],
    [140, feet + 34],
    [268, feet + 24],
    [306, feet + 34],
    [348, feet + 28],
  ] as [number, number][]) {
    const tw = 15 + tr() * 6;
    ctx.fillStyle = "#efd9ae";
    ctx.fillRect(tx, ty, tw, 15);
    ctx.fillStyle = "#c98f6e";
    ctx.beginPath();
    ctx.moveTo(tx - 2, ty);
    ctx.lineTo(tx + tw / 2, ty - 8);
    ctx.lineTo(tx + tw + 2, ty);
    ctx.closePath();
    ctx.fill();
  }
  // a cloud IN FRONT of the far hills — the altitude cue
  cloud(ctx, 92, feet - 12, 1.3, "#fff3da", 0.92);
  cloud(ctx, 330, feet + 6, 0.85, "#fff3da", 0.8);
}

/** m6, to City: giant over the patchwork, standing in a clearing. */
function patchwork(ctx: Ctx, feet: number): void {
  sky(ctx, [
    [0, "#f7dcb4"],
    [1, "#eec3a0"],
  ]);
  const horizon = feet - 34;
  ctx.fillStyle = "#cdbd8e";
  ctx.fillRect(0, horizon, BG_W, BG_H - horizon);
  const pr = rng(23);
  const tones = ["#d6c493", "#c3ad7c", "#cbcf9a", "#d9cda1"];
  let y = horizon;
  let rh = 16;
  while (y < BG_H) {
    let x = -8;
    while (x < BG_W) {
      const w = rh * (1.6 + pr() * 1.6);
      ctx.fillStyle = tones[(pr() * tones.length) | 0];
      ctx.globalAlpha = 0.9;
      ctx.fillRect(x, y, w - 1.5, rh - 1.5);
      x += w;
    }
    y += rh;
    rh *= 1.28; // nearer rows are deeper — a cheap, honest perspective
  }
  ctx.globalAlpha = 1;
  // the river, one soft ribbon, off to the side of the clearing
  ctx.strokeStyle = "#aac6cc";
  ctx.lineWidth = 9;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(316, horizon);
  ctx.bezierCurveTo(286, horizon + 44, 346, horizon + 80, 306, BG_H + 6);
  ctx.stroke();
  // the meadow it stands in — one continuous patch under its feet
  ctx.fillStyle = "#dfd2a6";
  ctx.beginPath();
  ctx.ellipse(PX, feet + 10, 62, 17, 0, 0, TAU);
  ctx.fill();
  // cloud deck lying across the horizon
  cloud(ctx, 70, horizon, 1.5, "#fff1d8", 0.95);
  cloud(ctx, 230, horizon - 12, 1.1, "#fff1d8", 0.8);
  cloud(ctx, 356, horizon + 6, 1.3, "#fff1d8", 0.9);
}

/** m7, to Country: standing on the curve of the world, haze below. */
function stratosphere(ctx: Ctx, feet: number): void {
  sky(ctx, [
    [0, "#d8c6e6"],
    [0.55, "#f2cfa8"],
    [1, "#f7ddb8"],
  ]);
  stars(ctx, 31, 26, 0, 210);
  // The ground curves away — its apex meets the feet. The control point sits
  // a full edge-drop above them because a quadratic only reaches HALFWAY from
  // its endpoints to its control: B(0.5) = (P0 + 2C + P2)/4.
  ctx.beginPath();
  ctx.moveTo(-4, BG_H + 4);
  ctx.lineTo(-4, feet + 48);
  ctx.quadraticCurveTo(PX, feet - 48, 404, feet + 48);
  ctx.lineTo(BG_W + 4, BG_H + 4);
  ctx.closePath();
  ctx.fillStyle = "#cdbd97";
  ctx.fill();
  // field flecks fading with distance, then haze lying along the curve
  ctx.fillStyle = "#bfae87";
  ctx.globalAlpha = 0.55;
  const hr = rng(41);
  for (let i = 0; i < 12; i++) {
    ctx.fillRect(hr() * BG_W, feet + 34 + hr() * 40, 26 + hr() * 34, 4.5);
  }
  ctx.fillStyle = "#f9e6c2";
  for (const [sx, sy, sw, a] of [
    [-10, feet + 26, 190, 0.7],
    [150, feet + 14, 160, 0.55],
    [290, feet + 28, 130, 0.65],
  ] as [number, number, number, number][]) {
    ctx.globalAlpha = a;
    ctx.beginPath();
    ctx.ellipse(sx + sw / 2, sy, sw / 2, 7, 0, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  // thin high cirrus, long flat streaks rather than puffs
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

/** m8, to Continent: standing on the limb of the planet itself. */
function lowOrbit(ctx: Ctx, feet: number): void {
  sky(ctx, [
    [0, "#c3b2da"],
    [1, "#e3c2ae"],
  ]);
  stars(ctx, 53, 44, 0, 420);
  glow(ctx, 58, 104, 9, "#efe3f2");
  // the limb: its apex is the monster's footing
  const apexY = feet;
  const edgeY = feet + 42;
  const limb = () => {
    ctx.beginPath();
    ctx.moveTo(-4, BG_H + 4);
    ctx.lineTo(-4, edgeY);
    ctx.quadraticCurveTo(PX, apexY - (edgeY - apexY), 404, edgeY);
    ctx.lineTo(BG_W + 4, BG_H + 4);
    ctx.closePath();
  };
  limb();
  ctx.fillStyle = "#a9c4bf";
  ctx.fill();
  ctx.save();
  limb();
  ctx.clip();
  // one ragged coastline along the limb, an island so it isn't a stripe
  ctx.fillStyle = "#cbbf92";
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
  ctx.ellipse(120, apexY + 22, 26, 9, -0.15, 0, TAU);
  ctx.ellipse(298, apexY + 30, 18, 7, 0.2, 0, TAU);
  ctx.fill();
  // weather streaks lying across the surface
  ctx.fillStyle = "#fff6e2";
  for (const [wx, wy, ww, a] of [
    [70, apexY + 40, 130, 0.5],
    [230, apexY + 28, 100, 0.45],
    [330, apexY + 52, 110, 0.4],
  ] as [number, number, number, number][]) {
    ctx.globalAlpha = a;
    ctx.beginPath();
    ctx.ellipse(wx, wy, ww / 2, 6, -0.06, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
  // the atmosphere rim: a bright line with a soft outer band above it
  ctx.save();
  ctx.strokeStyle = "#ffe8c2";
  for (const [lw, a, lift] of [
    [16, 0.18, -5],
    [5, 0.65, 0],
  ] as [number, number, number][]) {
    ctx.lineWidth = lw;
    ctx.globalAlpha = a;
    ctx.beginPath();
    ctx.moveTo(-4, edgeY + lift);
    ctx.quadraticCurveTo(PX, apexY - (edgeY - apexY) + lift, 404, edgeY + lift);
    ctx.stroke();
  }
  ctx.restore();
}

/** m9, to Planet: adrift, standing on its own little asteroid. */
function space(ctx: Ctx, feet: number): void {
  sky(ctx, [
    [0, "#cbbde0"],
    [1, "#cfb2c6"],
  ]);
  stars(ctx, 67, 70, 0, BG_H);
  // A neighbour planet with a ring. The ring is one full ellipse stroked
  // BEHIND the disc, then its front half restroked over it — the standard
  // way to ring a flat planet without gradients.
  const px = 300;
  const py = 168;
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
  // a flat band across the disc, a second tone that says "gas giant"
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
  // its small moon
  ctx.fillStyle = "#efe3f2";
  ctx.beginPath();
  ctx.arc(228, 252, 6, 0, TAU);
  ctx.fill();
  // the asteroid it rides — Little Prince style, craters and all
  ctx.fillStyle = "#b9a8c4";
  ctx.beginPath();
  ctx.ellipse(PX, feet + 12, 46, 14, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "#a394b4";
  for (const [cx2, cy2, cr] of [
    [PX - 22, feet + 12, 4.5],
    [PX + 12, feet + 17, 3.5],
    [PX + 28, feet + 9, 2.8],
  ] as [number, number, number][]) {
    ctx.beginPath();
    ctx.ellipse(cx2, cy2, cr, cr * 0.6, 0, 0, TAU);
    ctx.fill();
  }
}

/** m10, to Solar System: standing on its own planet, on its own orbit. */
function solarSystem(ctx: Ctx, feet: number): void {
  sky(ctx, [
    [0, "#c4b6dc"],
    [1, "#c4aac2"],
  ]);
  stars(ctx, 71, 80, 0, BG_H);
  glow(ctx, 84, 150, 27, "#ffd98f");
  ctx.save();
  ctx.strokeStyle = "#fff2d6";
  ctx.lineWidth = 1.6;
  const planets: [number, number, string, number][] = [
    [88, 0.55, "#d8b7c9", 5],
    [150, 2.2, "#a9c4c9", 7],
    [216, 4.1, "#cbbf92", 4.5],
  ];
  for (const [orbitR, angle, tone, pr] of planets) {
    ctx.globalAlpha = 0.18;
    ctx.beginPath();
    ctx.ellipse(84, 150, orbitR, orbitR * 0.62, -0.35, 0, TAU);
    ctx.stroke();
    const px = 84 + Math.cos(angle) * orbitR;
    const py = 150 + Math.sin(angle) * orbitR * 0.62;
    ctx.globalAlpha = 1;
    ctx.fillStyle = tone;
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, TAU);
    ctx.fill();
  }
  // the monster's own orbit sweeps down through the frame...
  ctx.globalAlpha = 0.25;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-30, 500);
  ctx.quadraticCurveTo(PX, feet + 28 + (feet + 28 - 550), 430, 550);
  ctx.stroke();
  ctx.restore();
  // ...and its planet rides that orbit, top surface at the feet line
  const prR = 28;
  ctx.fillStyle = "#cbbf92";
  ctx.beginPath();
  ctx.arc(PX, feet + prR, prR, 0, TAU);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.arc(PX, feet + prR, prR, 0, TAU);
  ctx.clip();
  ctx.fillStyle = "#b8ab7e";
  ctx.fillRect(PX - prR, feet + prR + 6, prR * 2, 8);
  ctx.restore();
}

/** m11, to Universe: seated on the bright core of its own galaxy. */
function galaxies(ctx: Ctx, feet: number): void {
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
    // the same broad two-arm sweep the old universe illustration used
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
  // neighbours, small and far
  galaxy(84, 150, 0.8, -0.5);
  galaxy(330, 250, 0.55, 0.6);
  galaxy(60, 400, 0.4, 0.2);
  // ITS galaxy: a grand spiral, boosted well past the neighbours so the seat
  // reads — at neighbour strength it vanished into the sky and the monster
  // looked adrift again. Core bright, right at its feet.
  galaxy(PX, feet - 4, 2.3, -0.12, 1.6);
}

/** m12, to Multiverse: inside its very own universe-bubble. */
function bubbles(ctx: Ctx, feet: number): void {
  sky(ctx, [
    [0, "#b9abd4"],
    [1, "#b49cc2"],
  ]);
  stars(ctx, 97, 90, 0, BG_H);
  const bubble = (bx: number, by: number, r: number, tint: string) => {
    ctx.save();
    ctx.fillStyle = tint;
    ctx.globalAlpha = 0.16;
    ctx.beginPath();
    ctx.arc(bx, by, r, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = "#ede2f4";
    ctx.lineWidth = 2.4;
    ctx.stroke();
    // a rim highlight arc, the classic soap-bubble cue
    ctx.globalAlpha = 0.75;
    ctx.beginPath();
    ctx.arc(bx, by, r * 0.78, -2.4, -1.5);
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
  };
  // neighbour universes, each holding a speck of contents
  for (const [bx, by, r, tint] of [
    [74, 180, 40, "#d8c2e2"],
    [318, 140, 50, "#c2d8e2"],
    [332, 396, 26, "#e2d0c2"],
    [58, 330, 20, "#c2d8e2"],
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
  // and the monster's own bubble, drawn around where it stands. ITS speck
  // of contents is the monster itself — the purest of the blend-in gags.
  bubble(PX, feet - 70, 96, "#d8c2e2");
}

/** m13, to Dimension: the monster IS the still point the rings come from. */
function dimension(ctx: Ctx, feet: number): void {
  sky(ctx, [
    [0, "#b3a7d0"],
    [1, "#ab94be"],
  ]);
  stars(ctx, 101, 60, 0, BG_H);
  // aurora ribbons, two soft bezier bands
  ctx.save();
  for (const [tone, a, off, w] of [
    ["#b8d0d8", 0.14, 0, 44],
    ["#e0c9b8", 0.11, 84, 34],
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
  // concentric rings widening FROM THE MONSTER — it is the centre of this
  // place. Radii start beyond its silhouette so no ring crosses its face.
  const cy = feet - 66;
  ctx.save();
  ctx.strokeStyle = "#e2d4f2";
  for (let i = 0; i < 5; i++) {
    ctx.globalAlpha = 0.32 - i * 0.05;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.ellipse(PX, cy, 112 + i * 40, 92 + i * 33, 0, 0, TAU);
    ctx.stroke();
  }
  ctx.restore();
}

const STAGES: ((ctx: Ctx, feet: number) => void)[] = [
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
  STAGES[i](ctx, monsterFeetY(i));
  grain(ctx, 7 + i);
  ctx.restore();
}

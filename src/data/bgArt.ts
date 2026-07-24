/**
 * The background environments — one per milestone, painted to canvas textures.
 *
 * THE CAMERA PULLS BACK AS THE MONSTER GROWS. That is the whole idea: the
 * monster never gets much bigger on screen, but the world behind it falls
 * away — a bakery wall, then a garden, then rooftops, then the curve of the
 * planet, then space — so its growth is told by everything else shrinking.
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

type Ctx = CanvasRenderingContext2D;

const TAU = Math.PI * 2;

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

/** m0, growing to Dog: the bakery — wallpaper, a wainscot rail, a wood floor. */
function bakery(ctx: Ctx): void {
  sky(ctx, [
    [0, "#fff3d6"],
    [1, "#ffe7bd"],
  ]);
  // faint polka wallpaper, offset every other row
  ctx.fillStyle = "#f0d9a9";
  ctx.globalAlpha = 0.5;
  for (let row = 0; row < 11; row++) {
    for (let col = 0; col < 8; col++) {
      const x = 28 + col * 50 + (row % 2 ? 25 : 0);
      ctx.beginPath();
      ctx.arc(x, 36 + row * 50, 3.2, 0, TAU);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  // wainscot: rail line, deeper lower wall, then the floor
  ctx.fillStyle = "#f8e2b6";
  ctx.fillRect(0, 566, BG_W, BG_H - 566);
  ctx.fillStyle = "#e3c48e";
  ctx.fillRect(0, 563, BG_W, 4);
  ctx.fillStyle = "#eccf9e";
  for (let x = 14; x < BG_W; x += 46) ctx.fillRect(x, 576, 30, 30);
  ctx.fillStyle = "#e9c592";
  ctx.fillRect(0, 614, BG_W, BG_H - 614);
  ctx.fillStyle = "#d9ae74";
  ctx.globalAlpha = 0.55;
  ctx.fillRect(0, 614, BG_W, 2.5);
  for (const x of [70, 175, 285, 370]) ctx.fillRect(x, 618, 2, BG_H - 618);
  ctx.globalAlpha = 1;
}

/** m1, to Human: the back garden — fence, bushes, a low sun. */
function garden(ctx: Ctx): void {
  sky(ctx, [
    [0, "#fff2d0"],
    [1, "#ffe2ae"],
  ]);
  glow(ctx, 330, 84, 22, "#ffd98f");
  cloud(ctx, 84, 128, 1.1, "#fff7e2", 0.9);
  cloud(ctx, 268, 190, 0.8, "#fff7e2", 0.7);
  // picket fence: rail plus pickets, gaps showing sky
  ctx.fillStyle = "#fbe9c4";
  for (let x = 6; x < BG_W; x += 30) {
    ctx.beginPath();
    ctx.moveTo(x, 566);
    ctx.lineTo(x + 8, 558);
    ctx.lineTo(x + 16, 566);
    ctx.lineTo(x + 16, 612);
    ctx.lineTo(x, 612);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillRect(0, 576, BG_W, 7);
  // grass with bushes peeking over it
  ctx.fillStyle = "#b5cc8d";
  ctx.beginPath();
  ctx.ellipse(60, 612, 42, 22, 0, 0, TAU);
  ctx.ellipse(344, 608, 50, 26, 0, 0, TAU);
  ctx.fill();
  ground(
    ctx,
    [
      [0, 604],
      [120, 598],
      [260, 606],
      [400, 600],
    ],
    "#c9d99e"
  );
}

/** m2, to Car: the street — a row of houses across the road. */
function street(ctx: Ctx): void {
  sky(ctx, [
    [0, "#ffefcd"],
    [1, "#ffddaa"],
  ]);
  cloud(ctx, 320, 100, 1.0, "#fff6df", 0.85);
  cloud(ctx, 120, 168, 0.75, "#fff6df", 0.6);
  // houses: flat fronts + roofs, drawn as silhouette tones, no outlines
  const houses: [number, number, number, number][] = [
    [-10, 78, 528, 0],
    [80, 92, 512, 1],
    [186, 74, 534, 0],
    [270, 96, 516, 1],
    [372, 70, 530, 0],
  ];
  for (const [hx, hw, hy, deep] of houses) {
    ctx.fillStyle = deep ? "#eed6ab" : "#f4e0b8";
    ctx.fillRect(hx, hy, hw, 604 - hy);
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
  // road with a soft curb and sparse centre dashes, kept clear of the label
  ctx.fillStyle = "#c8ad84";
  ctx.fillRect(0, 604, BG_W, 5);
  ctx.fillStyle = "#d8c19c";
  ctx.fillRect(0, 609, BG_W, BG_H - 609);
  ctx.fillStyle = "#fff3d6";
  ctx.globalAlpha = 0.55;
  for (const x of [24, 96, 288, 360]) ctx.fillRect(x, 682, 34, 5);
  ctx.globalAlpha = 1;
}

/** m3, to House: eye level with the rooftops next door. */
function rooftops(ctx: Ctx): void {
  sky(ctx, [
    [0, "#ffedca"],
    [1, "#ffd7a2"],
  ]);
  glow(ctx, 66, 96, 19, "#ffd98f");
  cloud(ctx, 300, 150, 1.15, "#fff5dd", 0.85);
  // two roof layers — the near one bigger, because we're standing among them
  ctx.fillStyle = "#e9cfa6";
  ctx.beginPath();
  ctx.moveTo(-8, 640);
  ctx.lineTo(60, 556);
  ctx.lineTo(150, 640);
  ctx.lineTo(210, 572);
  ctx.lineTo(300, 640);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#d9b586";
  ctx.beginPath();
  ctx.moveTo(96, 720);
  ctx.lineTo(230, 584);
  ctx.lineTo(408, 720);
  ctx.closePath();
  ctx.fill();
  // chimneys — one per roof rank. (The first draft put a TV aerial here,
  // which at thumbnail size read as a grave cross. Chimneys only.)
  ctx.fillStyle = "#c9a271";
  ctx.fillRect(288, 600, 22, 42);
  ctx.fillRect(284, 594, 30, 9);
  ctx.fillStyle = "#d9bd93";
  ctx.fillRect(112, 588, 14, 30);
  ctx.fillRect(109, 583, 20, 7);
  // two distant birds
  ctx.strokeStyle = "#b09070";
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  for (const [bx, by, s] of [
    [180, 330, 1],
    [214, 352, 0.7],
  ] as [number, number, number][]) {
    ctx.beginPath();
    ctx.moveTo(bx - 8 * s, by);
    ctx.quadraticCurveTo(bx - 4 * s, by - 5 * s, bx, by);
    ctx.quadraticCurveTo(bx + 4 * s, by - 5 * s, bx + 8 * s, by);
    ctx.stroke();
  }
  ground(
    ctx,
    [
      [0, 668],
      [200, 660],
      [400, 668],
    ],
    "#e5c99c"
  );
}

/** m4, to Building: the skyline, with clouds drifting at eye level. */
function skyline(ctx: Ctx): void {
  sky(ctx, [
    [0, "#ffe9c8"],
    [1, "#ffcf9e"],
  ]);
  // back rank of towers
  ctx.fillStyle = "#ecd0a6";
  for (const [x, w, top] of [
    [8, 44, 540],
    [66, 36, 512],
    [150, 48, 548],
    [232, 40, 520],
    [330, 52, 536],
  ] as [number, number, number][]) {
    ctx.fillRect(x, top, w, 656 - top);
  }
  // near rank, darker, with sparse lit windows
  const wr = rng(7);
  ctx.fillStyle = "#d6ae80";
  for (const [x, w, top] of [
    [-6, 52, 566],
    [96, 46, 550],
    [196, 54, 574],
    [296, 48, 558],
    [368, 44, 580],
  ] as [number, number, number][]) {
    ctx.fillRect(x, top, w, 668 - top);
    ctx.fillStyle = "#fff3d6";
    for (let wy = top + 10; wy < 650; wy += 16) {
      for (let wx = x + 8; wx < x + w - 8; wx += 13) {
        if (wr() < 0.42) {
          ctx.globalAlpha = 0.75;
          ctx.fillRect(wx, wy, 5, 7);
        }
      }
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#d6ae80";
  }
  cloud(ctx, 60, 500, 1.3, "#fff3da", 0.9);
  cloud(ctx, 330, 470, 1.0, "#fff3da", 0.75);
  ground(
    ctx,
    [
      [0, 664],
      [400, 664],
    ],
    "#e2c294"
  );
}

/** m5, to Town: looking down on the town from the first real height. */
function aboveTown(ctx: Ctx): void {
  sky(ctx, [
    [0, "#fce4bc"],
    [1, "#f6c69c"],
  ]);
  glow(ctx, 344, 92, 17, "#ffdf9e");
  // hills behind, town nestled in front
  ground(
    ctx,
    [
      [0, 586],
      [110, 566],
      [240, 590],
      [400, 570],
    ],
    "#d8c793"
  );
  // the town: a cluster of tiny gable fronts
  const tr = rng(11);
  for (let i = 0; i < 9; i++) {
    const tx = 52 + i * 36 + tr() * 10;
    const ty = 596 + (i % 3) * 9;
    const tw = 15 + tr() * 6;
    ctx.fillStyle = "#efd9ae";
    ctx.fillRect(tx, ty, tw, 17);
    ctx.fillStyle = "#c98f6e";
    ctx.beginPath();
    ctx.moveTo(tx - 2, ty);
    ctx.lineTo(tx + tw / 2, ty - 8);
    ctx.lineTo(tx + tw + 2, ty);
    ctx.closePath();
    ctx.fill();
  }
  ground(
    ctx,
    [
      [0, 646],
      [140, 638],
      [300, 650],
      [400, 642],
    ],
    "#c6b17e"
  );
  // a cloud slid IN FRONT of the hills — the one cue that says altitude
  cloud(ctx, 96, 574, 1.35, "#fff3da", 0.92);
  cloud(ctx, 316, 604, 0.9, "#fff3da", 0.8);
}

/** m6, to City: patchwork fields and a river, seen from high up. */
function patchwork(ctx: Ctx): void {
  sky(ctx, [
    [0, "#f7dcb4"],
    [1, "#eec3a0"],
  ]);
  // the land: rows of field patches, smaller toward the horizon
  ctx.fillStyle = "#cdbd8e";
  ctx.fillRect(0, 586, BG_W, BG_H - 586);
  const pr = rng(23);
  const tones = ["#d6c493", "#c3ad7c", "#cbcf9a", "#d9cda1"];
  let y = 586;
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
  // the river, one soft ribbon
  ctx.strokeStyle = "#aac6cc";
  ctx.lineWidth = 9;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(300, 586);
  ctx.bezierCurveTo(260, 630, 330, 664, 290, 726);
  ctx.stroke();
  // cloud deck lying across the horizon
  cloud(ctx, 70, 586, 1.5, "#fff1d8", 0.95);
  cloud(ctx, 230, 574, 1.1, "#fff1d8", 0.8);
  cloud(ctx, 356, 592, 1.3, "#fff1d8", 0.9);
}

/** m7, to Country: the stratosphere — haze below, the first stars above. */
function stratosphere(ctx: Ctx): void {
  sky(ctx, [
    [0, "#d8c6e6"],
    [0.55, "#f2cfa8"],
    [1, "#f7ddb8"],
  ]);
  stars(ctx, 31, 26, 0, 210);
  // the ground: a first hint of curvature, dissolving into haze
  ctx.beginPath();
  ctx.moveTo(-4, BG_H + 4);
  ctx.lineTo(-4, 668);
  ctx.quadraticCurveTo(200, 640, 404, 668);
  ctx.lineTo(BG_W + 4, BG_H + 4);
  ctx.closePath();
  ctx.fillStyle = "#cdbd97";
  ctx.fill();
  // field flecks fading with distance, then haze streaks lying ON the horizon
  ctx.fillStyle = "#bfae87";
  ctx.globalAlpha = 0.55;
  const hr = rng(41);
  for (let i = 0; i < 12; i++) {
    ctx.fillRect(hr() * BG_W, 672 + hr() * 44, 26 + hr() * 34, 4.5);
  }
  ctx.fillStyle = "#f9e6c2";
  for (const [sx, sy, sw, a] of [
    [-10, 660, 190, 0.7],
    [150, 650, 160, 0.55],
    [290, 662, 130, 0.65],
    [60, 644, 120, 0.4],
  ] as [number, number, number, number][]) {
    ctx.globalAlpha = a;
    ctx.beginPath();
    ctx.ellipse(sx + sw / 2, sy, sw / 2, 7, 0, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  // thin high cirrus, drawn as long flat streaks rather than puffs
  ctx.fillStyle = "#fbeccd";
  for (const [cx2, cy2, cw, a] of [
    [96, 486, 110, 0.5],
    [300, 522, 90, 0.4],
  ] as [number, number, number, number][]) {
    ctx.globalAlpha = a;
    ctx.beginPath();
    ctx.ellipse(cx2, cy2, cw / 2, 4.5, 0, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/** m8, to Continent: low orbit — the planet is visibly a ball now. */
function lowOrbit(ctx: Ctx): void {
  sky(ctx, [
    [0, "#c3b2da"],
    [1, "#e3c2ae"],
  ]);
  stars(ctx, 53, 44, 0, 420);
  glow(ctx, 58, 104, 9, "#efe3f2");
  // the limb of the planet: sea, land masses clipped to it, then the rim glow
  const limb = () => {
    ctx.beginPath();
    ctx.moveTo(-4, BG_H + 4);
    ctx.lineTo(-4, 648);
    ctx.quadraticCurveTo(200, 606, 404, 648);
    ctx.lineTo(BG_W + 4, BG_H + 4);
    ctx.closePath();
  };
  limb();
  ctx.fillStyle = "#a9c4bf";
  ctx.fill();
  ctx.save();
  limb();
  ctx.clip();
  // coastline drawn as one ragged landmass along the limb, not floating beans
  ctx.fillStyle = "#cbbf92";
  ctx.beginPath();
  ctx.moveTo(-10, 730);
  ctx.lineTo(-10, 690);
  ctx.bezierCurveTo(60, 668, 90, 700, 150, 682);
  ctx.bezierCurveTo(200, 668, 224, 706, 290, 690);
  ctx.bezierCurveTo(340, 678, 372, 700, 410, 688);
  ctx.lineTo(410, 730);
  ctx.closePath();
  ctx.fill();
  // an island and a peninsula so the coast doesn't read as a stripe
  ctx.beginPath();
  ctx.ellipse(120, 652, 26, 9, -0.15, 0, TAU);
  ctx.ellipse(298, 660, 18, 7, 0.2, 0, TAU);
  ctx.fill();
  // weather: soft cloud streaks lying across the surface
  ctx.fillStyle = "#fff6e2";
  for (const [wx, wy, ww, a] of [
    [70, 672, 130, 0.5],
    [230, 660, 100, 0.45],
    [330, 686, 110, 0.4],
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
    ctx.moveTo(-4, 646 + lift);
    ctx.quadraticCurveTo(200, 604 + lift, 404, 646 + lift);
    ctx.stroke();
  }
  ctx.restore();
}

/** m9, to Planet: open space, another world hanging in it. */
function space(ctx: Ctx): void {
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
}

/** m10, to Solar System: a sun with its family strung on faint orbits. */
function solarSystem(ctx: Ctx): void {
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
  ctx.restore();
}

/** m11, to Universe: a field of galaxies. */
function galaxies(ctx: Ctx): void {
  sky(ctx, [
    [0, "#c0b2da"],
    [1, "#bfa4c4"],
  ]);
  stars(ctx, 83, 120, 0, BG_H);
  const galaxy = (gx: number, gy: number, s: number, rot: number) => {
    ctx.save();
    ctx.translate(gx, gy);
    ctx.rotate(rot);
    ctx.scale(1, 0.55);
    ctx.fillStyle = "#cdb8dc";
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.arc(0, 0, 34 * s, 0, TAU);
    ctx.fill();
    // the same broad two-arm sweep the old universe illustration used
    ctx.fillStyle = "#e8dcf0";
    ctx.globalAlpha = 0.55;
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
  galaxy(120, 200, 1.15, -0.4);
  galaxy(322, 330, 0.7, 0.7);
  galaxy(60, 430, 0.45, 0.2);
}

/** m12, to Multiverse: universes as bubbles, drifting. */
function bubbles(ctx: Ctx): void {
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
    // a speck of contents so each bubble reads as holding something
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = "#fff6e0";
    ctx.beginPath();
    ctx.ellipse(bx + r * 0.1, by + r * 0.12, r * 0.16, r * 0.09, -0.4, 0, TAU);
    ctx.fill();
    ctx.restore();
  };
  bubble(108, 196, 58, "#d8c2e2");
  bubble(306, 150, 38, "#c2d8e2");
  bubble(252, 344, 30, "#e2d0c2");
  bubble(70, 396, 22, "#c2d8e2");
}

/** m13, to Dimension: past physical scale — rings and aurora, the odd one. */
function dimension(ctx: Ctx): void {
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
  // concentric rings widening from a bright still point — the "somewhere else"
  ctx.save();
  ctx.strokeStyle = "#e2d4f2";
  for (let i = 0; i < 5; i++) {
    ctx.globalAlpha = 0.34 - i * 0.055;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.ellipse(268, 250, 34 + i * 34, 27 + i * 27, 0, 0, TAU);
    ctx.stroke();
  }
  ctx.restore();
  glow(ctx, 268, 250, 8, "#fff6e0");
}

const STAGES: ((ctx: Ctx) => void)[] = [
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
  STAGES[i](ctx);
  grain(ctx, 7 + i);
  ctx.restore();
}

/**
 * The monster's BODY, painted to a canvas texture.
 *
 * Canvas rather than Phaser Graphics because the body must be ONE path with ONE
 * outline. Graphics has no bezier and no clipping, so the body could only be a
 * stack of overlapping ellipses — and overlapping primitives cannot share an
 * outline. Stroking each one draws the seams between them, which is exactly why
 * the old body read as shapes rather than a character.
 *
 * FLAT STYLE, matching the scale references in refArt.ts: no gradients, no
 * sheen, no soft contact shadow. Colour is flat and the form is carried by the
 * silhouette and the outline. Solid areas of a second tone are allowed where
 * they are a real feature (the belly, the blush) — never as shading on a curve.
 *
 * Only the body is a texture. The FACE stays as Graphics drawn on top, because
 * it swaps between expressions every time the monster eats or refuses — see
 * Monster.setFace.
 *
 * The painter works in the monster's own body coordinates (origin at its
 * centre, the same numbers the face is drawn with), so the two line up without
 * any conversion.
 */

type Ctx = CanvasRenderingContext2D;

/** Design box in body units, and where the body's origin sits inside it. */
export const BODY_ART = {
  w: 180,
  h: 200,
  ox: 90,
  oy: 112,
} as const;

const OUT = "#8a4a66"; // a deep berry outline — darker than the body, not black
const BODY = "#f28fac";
const FOOT = "#dd6a8d";
const BELLY = "#fff1d6";
const CREAM = "#fff6e4";
const CHERRY = "#e0537a";

function stroke(ctx: Ctx, w: number, color = OUT): void {
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.lineWidth = w;
  ctx.strokeStyle = color;
  ctx.stroke();
}

/** Smooth closed shape through control points (quadratics via midpoints). */
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

/** The mochi silhouette — one path, so it can carry one clean outline. */
const SHAPE: [number, number][] = [
  [-52, -34],
  [-30, -52],
  [0, -58],
  [30, -52],
  [52, -34],
  [62, -4],
  [58, 30],
  [34, 52],
  [0, 58],
  [-34, 52],
  [-58, 30],
  [-62, -4],
];

/** The cream belly — a real feature, so it gets its own flat tone. */
const BELLY_SHAPE: [number, number][] = [
  [-36, 6],
  [0, -4],
  [36, 6],
  [40, 28],
  [22, 46],
  [0, 50],
  [-22, 46],
  [-40, 28],
];

function paintMochi(ctx: Ctx): void {
  // feet, behind the body so only the part that peeks below shows
  for (const fx of [-28, 28]) {
    ctx.beginPath();
    ctx.ellipse(fx, 52, 19, 11, 0, 0, Math.PI * 2);
    ctx.fillStyle = FOOT;
    ctx.fill();
    stroke(ctx, 4);
  }

  // main body — one flat fill, one outline
  blob(ctx, SHAPE);
  ctx.fillStyle = BODY;
  ctx.fill();
  stroke(ctx, 4.5);

  // clipped to the body, so no detail crosses the outline
  ctx.save();
  blob(ctx, SHAPE);
  ctx.clip();

  blob(ctx, BELLY_SHAPE);
  ctx.fillStyle = BELLY;
  ctx.fill();

  // blush — flat ovals, no falloff
  ctx.fillStyle = FOOT;
  for (const bx of [-44, 44]) {
    ctx.beginPath();
    ctx.ellipse(bx, 4, 13, 8, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // belly outline drawn after the clip so it sits crisply on top
  blob(ctx, BELLY_SHAPE);
  stroke(ctx, 2.6, "#e09ab0");

  // piped cream swirl: three tapering coils, flat
  const coil = (cy: number, rx: number, ry: number) => {
    ctx.beginPath();
    ctx.ellipse(0, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = CREAM;
    ctx.fill();
    stroke(ctx, 3.4, "#d8a9bd");
  };
  coil(-58, 20, 11);
  coil(-68, 14, 9);
  coil(-76, 8.5, 7);

  // cherry
  ctx.beginPath();
  ctx.arc(0, -86, 7, 0, Math.PI * 2);
  ctx.fillStyle = CHERRY;
  ctx.fill();
  stroke(ctx, 3, "#9c2848");
}

/**
 * Paint the body into a canvas of BODY_ART.w x BODY_ART.h design units,
 * scaled up by `scale` device pixels per unit.
 */
export function paintMonsterBody(ctx: Ctx, scale: number): void {
  ctx.save();
  ctx.scale(scale, scale);
  ctx.translate(BODY_ART.ox, BODY_ART.oy);
  paintMochi(ctx);
  ctx.restore();
}

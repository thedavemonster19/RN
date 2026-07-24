/**
 * The monster's BODY, painted to a canvas texture.
 *
 * The body was built from a stack of overlapping Phaser ellipses, which is why
 * it read as shapes rather than a character: overlapping primitives cannot take
 * a single outline. Stroking each ellipse draws the seams between them; not
 * stroking at all leaves a flat silhouette with no edge. Canvas2D lets the
 * whole form be one path with one outline, plus real gradient shading.
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

/**
 * Paint the mochi body into a context already scaled so one unit is one body
 * unit, with the origin translated to the body's centre.
 */
function paintMochi(ctx: Ctx): void {
  // feet, behind the body so only the part that peeks below shows
  for (const fx of [-28, 28]) {
    ctx.beginPath();
    ctx.ellipse(fx, 52, 19, 11, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#d85a7e";
    ctx.fill();
    stroke(ctx, 4);
  }

  // main body, with a vertical gradient so it has weight at the bottom
  blob(ctx, SHAPE);
  const g = ctx.createLinearGradient(0, -58, 0, 58);
  g.addColorStop(0, "#f79ab6");
  g.addColorStop(0.55, "#ef7a9b");
  g.addColorStop(1, "#e06a8c");
  ctx.fillStyle = g;
  ctx.fill();
  stroke(ctx, 4.5);

  // everything below is clipped to the body, so no detail crosses the outline
  ctx.save();
  blob(ctx, SHAPE);
  ctx.clip();

  // broad sheen across the upper left, the single light source
  const sheen = ctx.createRadialGradient(-22, -34, 2, -22, -34, 52);
  sheen.addColorStop(0, "rgba(255,255,255,0.5)");
  sheen.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = sheen;
  ctx.fillRect(-70, -70, 140, 140);

  // contact shadow along the bottom edge
  const base = ctx.createLinearGradient(0, 22, 0, 60);
  base.addColorStop(0, "rgba(150,50,85,0)");
  base.addColorStop(1, "rgba(150,50,85,0.35)");
  ctx.fillStyle = base;
  ctx.fillRect(-70, 22, 140, 40);

  // cream belly
  blob(ctx, [
    [-36, 6],
    [0, -4],
    [36, 6],
    [40, 28],
    [22, 46],
    [0, 50],
    [-22, 46],
    [-40, 28],
  ]);
  ctx.fillStyle = "#fff1d6";
  ctx.fill();
  ctx.globalAlpha = 0.55;
  stroke(ctx, 2.4, "#e6b8c8");
  ctx.globalAlpha = 1;

  // blush, soft-edged rather than a flat oval
  for (const bx of [-44, 44]) {
    const bl = ctx.createRadialGradient(bx, 2, 1, bx, 2, 15);
    bl.addColorStop(0, "rgba(240,70,120,0.55)");
    bl.addColorStop(1, "rgba(240,70,120,0)");
    ctx.fillStyle = bl;
    ctx.beginPath();
    ctx.ellipse(bx, 2, 16, 11, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // piped cream swirl on top: three tapering coils plus a cherry
  const coil = (cy: number, rx: number, ry: number) => {
    ctx.beginPath();
    ctx.ellipse(0, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#fff6e4";
    ctx.fill();
    stroke(ctx, 3.4, "#d8a9bd");
  };
  coil(-58, 20, 11);
  coil(-68, 14, 9);
  coil(-76, 8.5, 7);
  // a soft shadow under each coil so they stack rather than overlap flatly
  ctx.save();
  ctx.globalAlpha = 0.25;
  ctx.fillStyle = "#c98fa6";
  ctx.beginPath();
  ctx.ellipse(0, -53, 17, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(0, -63, 12, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.restore();
  // cherry
  ctx.beginPath();
  ctx.arc(0, -86, 7, 0, Math.PI * 2);
  const ch = ctx.createRadialGradient(-2.5, -88.5, 0.5, 0, -86, 8);
  ch.addColorStop(0, "#f4718f");
  ch.addColorStop(1, "#c8365c");
  ctx.fillStyle = ch;
  ctx.fill();
  stroke(ctx, 3, "#9c2848");
  ctx.beginPath();
  ctx.arc(-2.4, -88.4, 1.9, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fill();
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

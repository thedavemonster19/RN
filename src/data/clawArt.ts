/**
 * The claw, painted to canvas textures.
 *
 * It used to be drawn with Graphics as two straight diagonal lines and a dot,
 * which read as chopsticks rather than machinery. A claw needs CURVES (real
 * prongs hook inward) and a single outline around each part, and Graphics has
 * neither bezier strokes nor a way to outline a compound shape — the same
 * reason the monster and the scale references became textures.
 *
 * Two pieces, because they move independently: the CARRIAGE rides the rail and
 * the HEAD hangs under it on a cable that stretches as the food size changes.
 *
 * Palette: warm machine cream with a brown outline, so it belongs to the
 * bakery scene rather than the pale blue it used to be — the old colour was
 * the only cool thing on the screen. The pivot bolts are amber, matching the
 * HUD's accent, so the moving parts read as moving parts.
 */

type Ctx = CanvasRenderingContext2D;

const TAU = Math.PI * 2;

const OUT = "#7a5c48"; // outline — a deep warm brown, never black
const METAL = "#efe1c8"; // the body of the machine
const METAL_D = "#d8c3a0"; // its shaded side face, one flat step darker
const BOLT = "#e8a13c"; // pivots and the grip pads

/** Design box for the claw head, origin at the cable attachment (top centre). */
export const CLAW_HEAD_ART = { w: 88, h: 68, ox: 44, oy: 14 } as const;
/** Design box for the carriage, origin ON the rail line. */
export const CLAW_CARRIAGE_ART = { w: 68, h: 36, ox: 34, oy: 10 } as const;

function stroke(ctx: Ctx, w: number, color = OUT): void {
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.lineWidth = w;
  ctx.strokeStyle = color;
  ctx.stroke();
}

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * One prong: out from the hub, bellying wide, then hooking back inward the way
 * a real claw closes. Drawn as a stroked path so the outline comes free — a
 * wide dark pass, then a narrower metal pass on the same path.
 *
 * Kept SHORT (33 design units tall) on purpose. A longer prong looked correct
 * in isolation but hung well below the food it was supposed to be holding,
 * because there are only ~58px between the rail and the top of the bin.
 */
function prong(ctx: Ctx, dir: number): void {
  ctx.beginPath();
  ctx.moveTo(dir * 8, 13);
  ctx.bezierCurveTo(dir * 28, 15, dir * 32, 28, dir * 24, 40);
  ctx.bezierCurveTo(dir * 22, 44, dir * 18, 46, dir * 14, 46);
  stroke(ctx, 12, OUT);
  stroke(ctx, 7, METAL);
  // the grip pad on the inside of the tip
  ctx.beginPath();
  ctx.arc(dir * 14, 45, 3.2, 0, TAU);
  ctx.fillStyle = BOLT;
  ctx.fill();
}

/** The claw head: a hub, two hooking prongs, and the pivot bolts. */
export function paintClawHead(ctx: Ctx, scale: number): void {
  ctx.save();
  ctx.scale(scale, scale);
  ctx.translate(CLAW_HEAD_ART.ox, CLAW_HEAD_ART.oy);

  // cable socket at the very top
  roundRect(ctx, -7, -6, 14, 12, 4);
  ctx.fillStyle = METAL_D;
  ctx.fill();
  stroke(ctx, 3.4);

  // the prongs hang BEHIND the hub so the hub caps their roots cleanly
  prong(ctx, -1);
  prong(ctx, 1);

  // hub: a rounded wedge, wider at the top
  const hub = () => {
    ctx.beginPath();
    ctx.moveTo(-17, 2);
    ctx.quadraticCurveTo(-19, 14, -11, 18);
    ctx.lineTo(11, 18);
    ctx.quadraticCurveTo(19, 14, 17, 2);
    ctx.quadraticCurveTo(0, -4, -17, 2);
    ctx.closePath();
  };
  hub();
  ctx.fillStyle = METAL;
  ctx.fill();
  stroke(ctx, 4);

  // a flat darker band across the hub — one step, no gradient
  ctx.save();
  hub();
  ctx.clip();
  ctx.fillStyle = METAL_D;
  ctx.fillRect(-22, 11, 44, 12);
  ctx.restore();

  // pivot bolts where the prongs meet the hub
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(dir * 10, 13, 3.8, 0, TAU);
    ctx.fillStyle = BOLT;
    ctx.fill();
    stroke(ctx, 2.4);
  }
  ctx.restore();
}

/**
 * The carriage: a flange that clips over the rail and a tapered body under it
 * housing the cable pulley.
 *
 * Deliberately WHEEL-LESS. Two wheels straddling the rail is what a real
 * trolley looks like, but at this size two circles poking above a rounded box
 * read unmistakably as ears — the claw looked like a bear. A flange bar reads
 * as "rides the rail" without the accident.
 */
export function paintClawCarriage(ctx: Ctx, scale: number): void {
  ctx.save();
  ctx.scale(scale, scale);
  ctx.translate(CLAW_CARRIAGE_ART.ox, CLAW_CARRIAGE_ART.oy);

  // the flange riding the rail
  roundRect(ctx, -25, -7, 50, 9, 4);
  ctx.fillStyle = METAL_D;
  ctx.fill();
  stroke(ctx, 3.4);

  // body, tapering down to the pulley
  ctx.beginPath();
  ctx.moveTo(-19, 0);
  ctx.lineTo(19, 0);
  ctx.quadraticCurveTo(21, 4, 14, 13);
  ctx.quadraticCurveTo(10, 17, 0, 17);
  ctx.quadraticCurveTo(-10, 17, -14, 13);
  ctx.quadraticCurveTo(-21, 4, -19, 0);
  ctx.closePath();
  ctx.fillStyle = METAL;
  ctx.fill();
  stroke(ctx, 4);

  // the pulley the cable runs over
  ctx.beginPath();
  ctx.arc(0, 10, 4.6, 0, TAU);
  ctx.fillStyle = BOLT;
  ctx.fill();
  stroke(ctx, 2.8);
  ctx.restore();
}

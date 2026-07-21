/**
 * The eight foods, drawn as vector art at runtime — one painter per tier.
 *
 * Drawn rather than loaded as sprites on purpose. Food spans 22px across at
 * tier 1 and 256px at tier 8, and the sprite is never scaled (scaling a Matter
 * image scales its collider too), so every tier needs its own texture at its
 * own exact size. A single source bitmap would either be soft at the top tiers
 * or enormous for the bottom ones; painting each at its true radius keeps all
 * eight crisp and keeps the build a single file with nothing to download.
 *
 * Every painter draws into a square canvas of side 2r, centred on (r, r), and
 * is clipped to a circle of radius r — which is exactly the physics collider,
 * so what you see is what collides. Detail is expressed as fractions of r, so
 * the same code reads correctly at 22px and at 256px.
 *
 * The tier order is the merge chain, and it doubles as a complexity ramp: the
 * simplest shape (a boiled sweet) is the smallest, the most detailed (a whole
 * cake) is the biggest, so no food is ever asked to show detail it has no room
 * for.
 */

type Ctx = CanvasRenderingContext2D;

const TAU = Math.PI * 2;

function circle(ctx: Ctx, x: number, y: number, rad: number): void {
  ctx.beginPath();
  ctx.arc(x, y, rad, 0, TAU);
  ctx.closePath();
}

function disc(ctx: Ctx, x: number, y: number, rad: number, color: string): void {
  circle(ctx, x, y, rad);
  ctx.fillStyle = color;
  ctx.fill();
}

function ellipse(
  ctx: Ctx,
  x: number,
  y: number,
  rx: number,
  ry: number,
  color: string
): void {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

/**
 * A pinwheel arm: a wedge that starts as a point at the centre and widens as it
 * twists out to the rim. Two spirals, one out and one back.
 */
function swirlArm(
  ctx: Ctx,
  c: number,
  rad: number,
  a0: number,
  twist: number,
  spread: number
): void {
  const N = 16;
  ctx.beginPath();
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const a = a0 + twist * t;
    const x = c + Math.cos(a) * rad * t;
    const y = c + Math.sin(a) * rad * t;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  for (let i = N; i >= 0; i--) {
    const t = i / N;
    const a = a0 + twist * t + spread * t;
    const x = c + Math.cos(a) * rad * t;
    const y = c + Math.sin(a) * rad * t;
    ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}

/** Scattered-but-fixed detail (chips, sprinkles, dots). Seeded so a given tier
 *  always looks the same rather than re-rolling on every launch. */
function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// --- tier 1: peppermint swirl ---------------------------------------------
function candy(ctx: Ctx, r: number): void {
  const c = r;
  disc(ctx, c, c, r, "#e04a52");
  disc(ctx, c, c, r * 0.88, "#fff7f6");
  ctx.fillStyle = "#e04a52";
  for (let i = 0; i < 6; i++) {
    swirlArm(ctx, c, r * 0.88, (i / 6) * TAU, 1.15, 0.42);
  }
  // the rim reads as the wrapper edge
  circle(ctx, c, c, r * 0.94);
  ctx.lineWidth = Math.max(1, r * 0.11);
  ctx.strokeStyle = "#e04a52";
  ctx.stroke();
}

// --- tier 2: macaron -------------------------------------------------------
function macaron(ctx: Ctx, r: number): void {
  const c = r;
  // Shells first, kept clear of each other vertically, then the filling painted
  // OVER the seam. Drawing the top shell last buried the filling entirely and
  // the whole thing read as a plain pink ball.
  ellipse(ctx, c, c + r * 0.5, r * 0.97, r * 0.52, "#ef94b4");
  ellipse(ctx, c, c - r * 0.34, r * 0.97, r * 0.68, "#f9aecb");

  // filling band across the middle, with the ruffled "feet" along its edges
  ctx.fillStyle = "#d4587f";
  ctx.fillRect(0, c + r * 0.06, r * 2, r * 0.3);
  ctx.fillStyle = "#f19ebd";
  for (let i = 0; i < 10; i++) {
    const x = (i / 9) * r * 2;
    ellipse(ctx, x, c + r * 0.06, r * 0.13, r * 0.09, "#f19ebd");
    ellipse(ctx, x + r * 0.1, c + r * 0.36, r * 0.13, r * 0.09, "#ef94b4");
  }

  // a broad soft sheen across the top dome
  ctx.save();
  ctx.globalAlpha = 0.5;
  ellipse(ctx, c - r * 0.3, c - r * 0.55, r * 0.4, r * 0.2, "#ffffff");
  ctx.restore();
}

// --- tier 3: chocolate chip cookie ----------------------------------------
function cookie(ctx: Ctx, r: number): void {
  const c = r;
  disc(ctx, c, c, r, "#d99a52");
  disc(ctx, c, c, r * 0.94, "#eab470");
  const rnd = seeded(9137);
  for (let i = 0; i < 11; i++) {
    const a = rnd() * TAU;
    const d = Math.sqrt(rnd()) * r * 0.72;
    const cr = r * (0.09 + rnd() * 0.08);
    disc(ctx, c + Math.cos(a) * d, c + Math.sin(a) * d, cr, "#54331d");
  }
  ctx.save();
  ctx.globalAlpha = 0.3;
  ellipse(ctx, c - r * 0.3, c - r * 0.42, r * 0.4, r * 0.2, "#ffffff");
  ctx.restore();
}

// --- tier 4: donut, baby blue frosting ------------------------------------
function donut(ctx: Ctx, r: number): void {
  const c = r;
  disc(ctx, c, c, r, "#e0a35c");
  disc(ctx, c, c, r * 0.95, "#f3bd76");

  // Frosting with a wavy outer edge, drawn as a single path so the drips read
  // as part of the icing rather than blobs sitting on top of it.
  ctx.beginPath();
  const N = 72;
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * TAU;
    const wob = 1 + Math.sin(a * 9) * 0.045 + Math.sin(a * 5 + 1.2) * 0.03;
    const rad = r * 0.86 * wob;
    const x = c + Math.cos(a) * rad;
    const y = c + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = "#8fd4ef";
  ctx.fill();
  // a lighter wash on the upper half so the icing looks domed
  ctx.save();
  ctx.globalAlpha = 0.5;
  ellipse(ctx, c - r * 0.16, c - r * 0.3, r * 0.6, r * 0.34, "#d6f1fb");
  ctx.restore();

  // sprinkles, kept clear of the hole
  const rnd = seeded(4421);
  const colors = ["#ffffff", "#ffd93d", "#ff8fb8", "#a8ff9e", "#ffb35c"];
  ctx.lineCap = "round";
  ctx.lineWidth = Math.max(1, r * 0.075);
  for (let i = 0; i < 16; i++) {
    const a = rnd() * TAU;
    const d = r * (0.42 + rnd() * 0.36);
    const x = c + Math.cos(a) * d;
    const y = c + Math.sin(a) * d;
    const t = rnd() * TAU;
    const len = r * 0.11;
    ctx.strokeStyle = colors[i % colors.length];
    ctx.beginPath();
    ctx.moveTo(x - Math.cos(t) * len, y - Math.sin(t) * len);
    ctx.lineTo(x + Math.cos(t) * len, y + Math.sin(t) * len);
    ctx.stroke();
  }

  // the hole, punched right through — the bin shows behind it
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  disc(ctx, c, c, r * 0.24, "#000");
  ctx.restore();
  // and a dough edge around it
  circle(ctx, c, c, r * 0.26);
  ctx.lineWidth = Math.max(1, r * 0.05);
  ctx.strokeStyle = "#e0a35c";
  ctx.stroke();
}

// --- tier 5: cinnamon roll -------------------------------------------------
function cinnamonRoll(ctx: Ctx, r: number): void {
  const c = r;
  disc(ctx, c, c, r, "#e3b070");
  disc(ctx, c, c, r * 0.95, "#f6d09a");

  // the cinnamon spiral, stroked as one long outward curve
  ctx.beginPath();
  const turns = 2.6;
  const N = 220;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const a = t * TAU * turns;
    const rad = r * 0.14 + t * r * 0.72;
    const x = c + Math.cos(a) * rad;
    const y = c + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.lineCap = "round";
  ctx.lineWidth = r * 0.2;
  ctx.strokeStyle = "#a55b28";
  ctx.stroke();

  // Icing on top: much thinner than the cinnamon and pushed further round the
  // spiral. At equal weights the white swallowed the brown and the whole roll
  // came out washed-out and pale.
  ctx.beginPath();
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const a = t * TAU * turns + 0.62;
    const rad = r * 0.14 + t * r * 0.72;
    const x = c + Math.cos(a) * rad;
    const y = c + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.lineWidth = r * 0.075;
  ctx.strokeStyle = "#fffaf0";
  ctx.stroke();
}

// --- tier 6: cream puff ----------------------------------------------------
function creamPuff(ctx: Ctx, r: number): void {
  const c = r;
  // A choux bun split across the middle: golden pastry above and below, with a
  // thick band of cream piped between them. The previous attempt stacked lobes
  // and crease strokes, which read as a pie with a gash across it.
  disc(ctx, c, c, r, "#e8ab63");

  // domed top, lifted so the cream sits proud of it
  ellipse(ctx, c, c - r * 0.3, r * 0.98, r * 0.68, "#f2c184");
  // a couple of soft swells so the top looks puffed rather than moulded
  ellipse(ctx, c - r * 0.4, c - r * 0.46, r * 0.4, r * 0.28, "#f7cf9a");
  ellipse(ctx, c + r * 0.3, c - r * 0.54, r * 0.36, r * 0.24, "#f7cf9a");

  // the cream band, scalloped along the top edge where it squeezes out
  ctx.fillStyle = "#fdf3d8";
  ctx.fillRect(0, c + r * 0.12, r * 2, r * 0.34);
  for (let i = 0; i < 9; i++) {
    const x = (i / 8) * r * 2;
    ellipse(ctx, x, c + r * 0.13, r * 0.15, r * 0.13, "#fdf3d8");
  }

  // pastry base below the cream
  ellipse(ctx, c, c + r * 0.78, r * 0.9, r * 0.4, "#eab876");

  ctx.save();
  ctx.globalAlpha = 0.35;
  ellipse(ctx, c - r * 0.32, c - r * 0.56, r * 0.3, r * 0.14, "#ffffff");
  ctx.restore();
}

// --- tier 7: cupcake, green frosting --------------------------------------
function cupcake(ctx: Ctx, r: number): void {
  const c = r;
  // Wrapper: a solid warm band across the bottom with strong ridges and a
  // defined top lip. At low contrast it vanished into the frosting and the
  // whole thing read as a green blob.
  disc(ctx, c, c, r, "#f0d3ac");
  ctx.fillStyle = "#f7e3c8";
  ctx.fillRect(0, c + r * 0.16, r * 2, r * 0.9);
  ctx.strokeStyle = "rgba(186,142,96,0.65)";
  ctx.lineWidth = Math.max(1, r * 0.05);
  for (let i = 1; i < 8; i++) {
    const x = (i / 8) * r * 2;
    ctx.beginPath();
    ctx.moveTo(x, c + r * 0.2);
    ctx.lineTo(x + (x - c) * 0.16, c + r * 1.0);
    ctx.stroke();
  }
  // the lip of the wrapper
  ctx.beginPath();
  ctx.moveTo(0, c + r * 0.18);
  ctx.lineTo(r * 2, c + r * 0.18);
  ctx.lineWidth = Math.max(1, r * 0.06);
  ctx.strokeStyle = "#e0c096";
  ctx.stroke();
  // frosting: three stacked swirls, widest at the base
  ellipse(ctx, c, c + r * 0.16, r * 0.95, r * 0.5, "#6fca63");
  ellipse(ctx, c - r * 0.06, c - r * 0.18, r * 0.76, r * 0.42, "#7fd873");
  ellipse(ctx, c + r * 0.04, c - r * 0.46, r * 0.54, r * 0.32, "#8fe283");
  ellipse(ctx, c - r * 0.02, c - r * 0.68, r * 0.3, r * 0.22, "#a1ea95");
  // highlights along the left of each swirl
  ctx.save();
  ctx.globalAlpha = 0.45;
  ellipse(ctx, c - r * 0.46, c - r * 0.02, r * 0.22, r * 0.13, "#d2f7cb");
  ellipse(ctx, c - r * 0.34, c - r * 0.34, r * 0.16, r * 0.1, "#d2f7cb");
  ctx.restore();
  // sugar beads
  const rnd = seeded(7717);
  for (let i = 0; i < 12; i++) {
    const a = rnd() * TAU;
    const d = Math.sqrt(rnd()) * r * 0.6;
    disc(ctx, c + Math.cos(a) * d, c - r * 0.2 + Math.sin(a) * d * 0.6, r * 0.05, "#ffffff");
  }
}

// --- tier 8: celebration cake ---------------------------------------------
function cake(ctx: Ctx, r: number): void {
  const c = r;
  // scalloped pink shell
  ctx.beginPath();
  const N = 200;
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * TAU;
    const rad = r * (0.97 + Math.sin(a * 16) * 0.03);
    const x = c + Math.cos(a) * rad;
    const y = c + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = "#f4a3c0";
  ctx.fill();

  disc(ctx, c, c, r * 0.88, "#f9c3d6");
  disc(ctx, c, c, r * 0.8, "#fdf4e6");

  // a ring of piped dots around the top edge
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU - Math.PI / 2;
    disc(ctx, c + Math.cos(a) * r * 0.63, c + Math.sin(a) * r * 0.63, r * 0.085, "#f4a3c0");
  }
  ctx.save();
  ctx.globalAlpha = 0.35;
  ellipse(ctx, c - r * 0.24, c - r * 0.3, r * 0.34, r * 0.18, "#ffffff");
  ctx.restore();
}

/** Painters in tier order — index 0 is tier 1. */
export const FOOD_PAINTERS: ((ctx: Ctx, r: number) => void)[] = [
  candy,
  macaron,
  cookie,
  donut,
  cinnamonRoll,
  creamPuff,
  cupcake,
  cake,
];

/**
 * Paint one tier's food into a 2r-square context, clipped to its collider
 * circle and finished with a soft rim so food that touches in a packed bin
 * still reads as separate pieces.
 */
export function paintFood(ctx: Ctx, tier: number, r: number): void {
  const painter = FOOD_PAINTERS[Math.max(0, Math.min(FOOD_PAINTERS.length - 1, tier - 1))];
  ctx.save();
  circle(ctx, r, r, r);
  ctx.clip();
  painter(ctx, r);
  ctx.restore();

  // Rim last, inside the clip radius, so it survives whatever the painter did.
  circle(ctx, r, r, r - Math.max(0.5, r * 0.03));
  ctx.lineWidth = Math.max(1, r * 0.055);
  ctx.strokeStyle = "rgba(60,30,60,0.28)";
  ctx.stroke();
}

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
 * SHAPE vs COLLIDER. Each food has its own silhouette — a cupcake is not a
 * circle — but every silhouette is INSCRIBED in the collider circle of radius
 * r, never poking outside it. The collider stays a circle deliberately: the
 * bin's difficulty is tuned around how densely circles pack, and swapping in
 * polygon colliders would change capacity and overflow behaviour. Inscribing
 * means the art can never overlap a neighbour, only ever leave a small gap.
 *
 * The tier order is the merge chain, and it doubles as a complexity ramp: the
 * simplest shape (a boiled sweet) is the smallest, the most detailed (a whole
 * cake) is the biggest, so no food is ever asked to show detail it has no room
 * for.
 */

type Ctx = CanvasRenderingContext2D;
type Path = () => void;

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

/** Fill a silhouette path. */
function fillPath(ctx: Ctx, path: Path, color: string): void {
  ctx.beginPath();
  path();
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

/** Run `detail` clipped to a silhouette, so nothing spills past the outline. */
function within(ctx: Ctx, path: Path, detail: () => void): void {
  ctx.save();
  ctx.beginPath();
  path();
  ctx.closePath();
  ctx.clip();
  detail();
  ctx.restore();
}

/** The dark outline that keeps food in a packed bin reading as separate pieces. */
function rim(ctx: Ctx, path: Path, r: number): void {
  ctx.beginPath();
  path();
  ctx.closePath();
  ctx.lineWidth = Math.max(1, r * 0.055);
  ctx.strokeStyle = "rgba(60,30,60,0.3)";
  ctx.lineJoin = "round";
  ctx.stroke();
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
    ctx.lineTo(c + Math.cos(a) * rad * t, c + Math.sin(a) * rad * t);
  }
  for (let i = N; i >= 0; i--) {
    const t = i / N;
    const a = a0 + twist * t + spread * t;
    ctx.lineTo(c + Math.cos(a) * rad * t, c + Math.sin(a) * rad * t);
  }
  ctx.closePath();
  ctx.fill();
}

/** A closed wobbly ring — a circle with gentle lobes, for hand-made edges. */
function lobedPath(
  ctx: Ctx,
  c: number,
  rad: number,
  lobes: number,
  depth: number,
  phase = 0
): Path {
  return () => {
    const N = 180;
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * TAU;
      const k = rad * (1 - depth + depth * Math.cos(a * lobes + phase) * 0.5 + depth * 0.5);
      ctx.lineTo(c + Math.cos(a) * k, c + Math.sin(a) * k);
    }
  };
}

// --- tier 1: peppermint swirl ---------------------------------------------
// Genuinely round — it is a boiled sweet, and it is the smallest food on
// screen, so it gets the shape that survives being 22px across.
function candy(ctx: Ctx, r: number): Path {
  const c = r;
  const path: Path = () => ctx.arc(c, c, r * 0.97, 0, TAU);
  fillPath(ctx, path, "#e04a52");
  within(ctx, path, () => {
    disc(ctx, c, c, r * 0.86, "#fff7f6");
    ctx.fillStyle = "#e04a52";
    for (let i = 0; i < 6; i++) swirlArm(ctx, c, r * 0.86, (i / 6) * TAU, 1.15, 0.42);
    ctx.save();
    ctx.globalAlpha = 0.5;
    ellipse(ctx, c - r * 0.3, c - r * 0.4, r * 0.3, r * 0.16, "#ffffff");
    ctx.restore();
  });
  return path;
}

// --- tier 2: macaron -------------------------------------------------------
// Squat and flat-sided: wider than it is tall, with two domed shells and a
// filling seam. A macaron read as a plain pink ball while it was a circle.
function macaron(ctx: Ctx, r: number): Path {
  const c = r;
  const halfW = r * 0.99;
  const halfH = r * 0.8;
  const path: Path = () => {
    // a rounded slab: flat-ish top and bottom, strongly rounded sides
    const k = r * 0.34;
    ctx.moveTo(c - halfW + k, c - halfH);
    ctx.lineTo(c + halfW - k, c - halfH);
    ctx.quadraticCurveTo(c + halfW, c - halfH, c + halfW, c - halfH + k);
    ctx.lineTo(c + halfW, c + halfH - k);
    ctx.quadraticCurveTo(c + halfW, c + halfH, c + halfW - k, c + halfH);
    ctx.lineTo(c - halfW + k, c + halfH);
    ctx.quadraticCurveTo(c - halfW, c + halfH, c - halfW, c + halfH - k);
    ctx.lineTo(c - halfW, c - halfH + k);
    ctx.quadraticCurveTo(c - halfW, c - halfH, c - halfW + k, c - halfH);
  };
  fillPath(ctx, path, "#f9aecb");
  within(ctx, path, () => {
    // bottom shell a shade deeper, then the filling band over the seam
    ctx.fillStyle = "#ef94b4";
    ctx.fillRect(0, c + r * 0.3, r * 2, r * 2);
    ctx.fillStyle = "#d4587f";
    ctx.fillRect(0, c + r * 0.04, r * 2, r * 0.28);
    // the ruffled "feet" along both edges of the filling
    for (let i = 0; i < 11; i++) {
      const x = (i / 10) * r * 2;
      ellipse(ctx, x, c + r * 0.04, r * 0.12, r * 0.08, "#f6a4c2");
      ellipse(ctx, x + r * 0.09, c + r * 0.32, r * 0.12, r * 0.08, "#ef94b4");
    }
    ctx.save();
    ctx.globalAlpha = 0.5;
    ellipse(ctx, c - r * 0.3, c - r * 0.5, r * 0.36, r * 0.16, "#ffffff");
    ctx.restore();
  });
  return path;
}

// --- tier 3: chocolate chip cookie ----------------------------------------
// A hand-baked edge rather than a compass circle, and the chips are PLACED,
// not scattered: a seeded random clustered them into a dense blot in one
// corner, which is what made the cookie look congested.
function cookie(ctx: Ctx, r: number): Path {
  const c = r;
  const path = lobedPath(ctx, c, r * 0.97, 9, 0.05);
  fillPath(ctx, path, "#d99a52");
  within(ctx, path, () => {
    disc(ctx, c, c, r * 0.92, "#eab470");
    // seven chips, spread by hand: angle, distance from centre, size
    const chips: [number, number, number][] = [
      [-0.34, -0.42, 0.13],
      [0.36, -0.3, 0.11],
      [0.02, -0.06, 0.14],
      [-0.52, 0.12, 0.1],
      [0.44, 0.28, 0.12],
      [-0.14, 0.46, 0.11],
      [0.16, 0.62, 0.08],
    ];
    for (const [dx, dy, size] of chips) {
      disc(ctx, c + dx * r, c + dy * r, size * r, "#54331d");
    }
    ctx.save();
    ctx.globalAlpha = 0.28;
    ellipse(ctx, c - r * 0.3, c - r * 0.55, r * 0.36, r * 0.16, "#ffffff");
    ctx.restore();
  });
  return path;
}

// --- tier 4: donut, baby blue frosting ------------------------------------
function donut(ctx: Ctx, r: number): Path {
  const c = r;
  const path = lobedPath(ctx, c, r * 0.97, 7, 0.035);
  fillPath(ctx, path, "#e0a35c");
  within(ctx, path, () => {
    disc(ctx, c, c, r * 0.93, "#f3bd76");

    // frosting with a drippy edge
    ctx.beginPath();
    const N = 72;
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * TAU;
      const wob = 1 + Math.sin(a * 9) * 0.045 + Math.sin(a * 5 + 1.2) * 0.03;
      const rad = r * 0.84 * wob;
      ctx.lineTo(c + Math.cos(a) * rad, c + Math.sin(a) * rad);
    }
    ctx.closePath();
    ctx.fillStyle = "#8fd4ef";
    ctx.fill();
    ctx.save();
    ctx.globalAlpha = 0.5;
    ellipse(ctx, c - r * 0.16, c - r * 0.3, r * 0.58, r * 0.32, "#d6f1fb");
    ctx.restore();

    // sprinkles
    const colors = ["#ffffff", "#ffd93d", "#ff8fb8", "#a8ff9e", "#ffb35c"];
    ctx.lineCap = "round";
    ctx.lineWidth = Math.max(1, r * 0.075);
    let s = 4421;
    const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
    for (let i = 0; i < 16; i++) {
      const a = rnd() * TAU;
      const d = r * (0.42 + rnd() * 0.34);
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

    // the hole, punched right through
    ctx.save();
    ctx.globalCompositeOperation = "destination-out";
    disc(ctx, c, c, r * 0.24, "#000");
    ctx.restore();
    circle(ctx, c, c, r * 0.26);
    ctx.lineWidth = Math.max(1, r * 0.05);
    ctx.strokeStyle = "#e0a35c";
    ctx.stroke();
  });
  return path;
}

// --- tier 5: cinnamon roll -------------------------------------------------
function cinnamonRoll(ctx: Ctx, r: number): Path {
  const c = r;
  const path = lobedPath(ctx, c, r * 0.97, 8, 0.055, 0.4);
  fillPath(ctx, path, "#e3b070");
  within(ctx, path, () => {
    disc(ctx, c, c, r * 0.92, "#f6d09a");

    const turns = 2.6;
    const N = 220;
    const spiral = (offset: number) => {
      ctx.beginPath();
      for (let i = 0; i <= N; i++) {
        const t = i / N;
        const a = t * TAU * turns + offset;
        const rad = r * 0.14 + t * r * 0.7;
        ctx.lineTo(c + Math.cos(a) * rad, c + Math.sin(a) * rad);
      }
    };
    ctx.lineCap = "round";
    spiral(0);
    ctx.lineWidth = r * 0.2;
    ctx.strokeStyle = "#a55b28";
    ctx.stroke();
    // Icing much thinner than the cinnamon and pushed round the spiral. At
    // equal weights the white swallowed the brown and the roll looked pale.
    spiral(0.62);
    ctx.lineWidth = r * 0.075;
    ctx.strokeStyle = "#fffaf0";
    ctx.stroke();
  });
  return path;
}

// --- tier 6: cream puff ----------------------------------------------------
// A bun: wide and slightly squat, domed on top, with cream squeezing out of
// the middle.
function creamPuff(ctx: Ctx, r: number): Path {
  const c = r;
  const path: Path = () => {
    ctx.ellipse(c, c, r * 0.99, r * 0.9, 0, 0, TAU);
  };
  fillPath(ctx, path, "#e8ab63");
  within(ctx, path, () => {
    ellipse(ctx, c, c - r * 0.3, r * 0.99, r * 0.66, "#f2c184");
    ellipse(ctx, c - r * 0.4, c - r * 0.44, r * 0.4, r * 0.26, "#f7cf9a");
    ellipse(ctx, c + r * 0.3, c - r * 0.52, r * 0.36, r * 0.22, "#f7cf9a");

    // the cream band, scalloped where it squeezes out
    ctx.fillStyle = "#fdf3d8";
    ctx.fillRect(0, c + r * 0.12, r * 2, r * 0.32);
    for (let i = 0; i < 9; i++) {
      ellipse(ctx, (i / 8) * r * 2, c + r * 0.13, r * 0.15, r * 0.12, "#fdf3d8");
    }

    ellipse(ctx, c, c + r * 0.74, r * 0.9, r * 0.36, "#eab876");
    ctx.save();
    ctx.globalAlpha = 0.32;
    ellipse(ctx, c - r * 0.32, c - r * 0.54, r * 0.28, r * 0.12, "#ffffff");
    ctx.restore();
  });
  return path;
}

// --- tier 7: cupcake, green frosting --------------------------------------
/**
 * A real cupcake shape: a tapered wrapper with the frosting piled ON TOP of
 * it, not embedded in it. Previously both were ellipses overlapping inside one
 * circle, so the frosting sat in the middle of the food rather than crowning
 * it — which is exactly what looked wrong.
 *
 * The whole silhouette is inscribed in the collider circle: at the wrapper's
 * base the circle is only ~0.5r wide, so the wrapper tapers to match instead
 * of being clipped square.
 */
function cupcake(ctx: Ctx, r: number): Path {
  const c = r;
  const wrapTop = c + r * 0.06; // where frosting meets wrapper
  const wrapBot = c + r * 0.86;
  const topHalf = r * 0.8;
  const botHalf = r * 0.46;

  const path: Path = () => {
    // frosting: three swirl bulges up the left, a peak, and back down the right
    ctx.moveTo(c - topHalf, wrapTop);
    ctx.bezierCurveTo(c - r * 0.95, c - r * 0.1, c - r * 0.78, c - r * 0.3, c - r * 0.6, c - r * 0.36);
    ctx.bezierCurveTo(c - r * 0.8, c - r * 0.52, c - r * 0.62, c - r * 0.72, c - r * 0.4, c - r * 0.72);
    ctx.bezierCurveTo(c - r * 0.46, c - r * 0.94, c - r * 0.1, c - r * 1.0, c + r * 0.04, c - r * 0.86);
    ctx.bezierCurveTo(c + r * 0.3, c - r * 0.98, c + r * 0.56, c - r * 0.78, c + r * 0.46, c - r * 0.6);
    ctx.bezierCurveTo(c + r * 0.76, c - r * 0.6, c + r * 0.84, c - r * 0.3, c + r * 0.66, c - r * 0.2);
    ctx.bezierCurveTo(c + r * 0.94, c - r * 0.14, c + r * 0.95, c - r * 0.02, c + topHalf, wrapTop);
    // wrapper: straight tapered sides and a slightly rounded base
    ctx.lineTo(c + botHalf, wrapBot);
    ctx.quadraticCurveTo(c, wrapBot + r * 0.14, c - botHalf, wrapBot);
    ctx.closePath();
  };

  // wrapper first, then frosting over it, each clipped to the silhouette
  fillPath(ctx, path, "#f7e3c8");
  within(ctx, path, () => {
    // wrapper ridges
    ctx.strokeStyle = "rgba(186,142,96,0.6)";
    ctx.lineWidth = Math.max(1, r * 0.05);
    for (let i = 1; i < 8; i++) {
      const t = i / 8;
      ctx.beginPath();
      ctx.moveTo(c - topHalf + t * topHalf * 2, wrapTop);
      ctx.lineTo(c - botHalf + t * botHalf * 2, wrapBot + r * 0.1);
      ctx.stroke();
    }

    // the frosting, filled as its own closed shape sitting on the wrapper lip
    ctx.beginPath();
    ctx.moveTo(c - topHalf, wrapTop);
    ctx.bezierCurveTo(c - r * 0.95, c - r * 0.1, c - r * 0.78, c - r * 0.3, c - r * 0.6, c - r * 0.36);
    ctx.bezierCurveTo(c - r * 0.8, c - r * 0.52, c - r * 0.62, c - r * 0.72, c - r * 0.4, c - r * 0.72);
    ctx.bezierCurveTo(c - r * 0.46, c - r * 0.94, c - r * 0.1, c - r * 1.0, c + r * 0.04, c - r * 0.86);
    ctx.bezierCurveTo(c + r * 0.3, c - r * 0.98, c + r * 0.56, c - r * 0.78, c + r * 0.46, c - r * 0.6);
    ctx.bezierCurveTo(c + r * 0.76, c - r * 0.6, c + r * 0.84, c - r * 0.3, c + r * 0.66, c - r * 0.2);
    ctx.bezierCurveTo(c + r * 0.94, c - r * 0.14, c + r * 0.95, c - r * 0.02, c + topHalf, wrapTop);
    ctx.closePath();
    ctx.fillStyle = "#6fca63";
    ctx.fill();

    // swirl shading: lighter bands following the piped coils
    ctx.save();
    ctx.clip();
    ellipse(ctx, c - r * 0.1, c - r * 0.24, r * 0.66, r * 0.2, "#7fd873");
    ellipse(ctx, c + r * 0.02, c - r * 0.56, r * 0.46, r * 0.16, "#8fe283");
    ellipse(ctx, c - r * 0.02, c - r * 0.82, r * 0.26, r * 0.12, "#a1ea95");
    ctx.globalAlpha = 0.4;
    ellipse(ctx, c - r * 0.46, c - r * 0.12, r * 0.18, r * 0.09, "#d2f7cb");
    ellipse(ctx, c - r * 0.3, c - r * 0.46, r * 0.14, r * 0.07, "#d2f7cb");
    ctx.globalAlpha = 1;
    // sugar beads
    const beads: [number, number][] = [
      [-0.3, -0.18], [0.16, -0.3], [-0.06, -0.5], [0.3, -0.06],
      [-0.44, -0.36], [0.04, -0.72], [0.34, -0.42], [-0.18, -0.06],
    ];
    for (const [dx, dy] of beads) disc(ctx, c + dx * r, c + dy * r, r * 0.05, "#ffffff");
    ctx.restore();

    // the wrapper's lip, drawn last so it reads in front of the frosting base
    ctx.beginPath();
    ctx.moveTo(c - topHalf, wrapTop);
    ctx.lineTo(c + topHalf, wrapTop);
    ctx.lineWidth = Math.max(1, r * 0.07);
    ctx.strokeStyle = "#e0c096";
    ctx.stroke();
  });
  return path;
}

// --- tier 8: celebration cake ---------------------------------------------
function cake(ctx: Ctx, r: number): Path {
  const c = r;
  const path = lobedPath(ctx, c, r * 0.97, 16, 0.05);
  fillPath(ctx, path, "#f4a3c0");
  within(ctx, path, () => {
    disc(ctx, c, c, r * 0.86, "#f9c3d6");
    disc(ctx, c, c, r * 0.78, "#fdf4e6");
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU - Math.PI / 2;
      disc(ctx, c + Math.cos(a) * r * 0.62, c + Math.sin(a) * r * 0.62, r * 0.085, "#f4a3c0");
    }
    ctx.save();
    ctx.globalAlpha = 0.35;
    ellipse(ctx, c - r * 0.24, c - r * 0.3, r * 0.32, r * 0.16, "#ffffff");
    ctx.restore();
  });
  return path;
}

/** Painters in tier order — index 0 is tier 1. Each returns its silhouette. */
const PAINTERS: ((ctx: Ctx, r: number) => Path)[] = [
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
 * Paint one tier's food into a 2r-square context and outline it, so food that
 * touches in a packed bin still reads as separate pieces.
 */
export function paintFood(ctx: Ctx, tier: number, r: number): void {
  const painter = PAINTERS[Math.max(0, Math.min(PAINTERS.length - 1, tier - 1))];
  // A safety clip at the collider radius: silhouettes are designed to sit
  // inside it, and this guarantees a stray control point can never draw art
  // that overlaps a neighbouring food.
  ctx.save();
  circle(ctx, r, r, r);
  ctx.clip();
  const silhouette = painter(ctx, r);
  rim(ctx, silhouette, r);
  ctx.restore();
}

/**
 * Central layout + theme constants for Monster Muncher.
 * Base resolution is a portrait phone canvas; Phaser's Scale.FIT letterboxes it
 * to any real device while keeping these coordinates stable.
 */
export const GAME = {
  WIDTH: 400,
  HEIGHT: 720,
} as const;

/**
 * How many device pixels to render each game pixel into.
 *
 * The game is authored in a 400x720 world and used to be rendered into a canvas
 * of exactly that size, then stretched to fill the screen — measured, every
 * game pixel was smeared across 2 device pixels here and 3 on a phone. That is
 * why the whole thing read as soft: not a font problem, a resolution one, and
 * no amount of text tuning could have fixed the artwork and shapes too.
 *
 * The canvas is now RENDER_SCALE times bigger and every camera is zoomed by the
 * same factor, so world coordinates stay 400x720 and no layout constant moves.
 * Capped at 3 — beyond that it is fill rate spent on detail no screen resolves.
 */
export const RENDER_SCALE = Math.min(
  Math.max(typeof window === "undefined" ? 1 : window.devicePixelRatio || 1, 1),
  3
);

/**
 * The UI typeface — Fredoka, embedded as a WOFF2 (see data/uiFont).
 *
 * The game used to borrow the OS rounded face, which is clean but generic and
 * looked like a system UI rather than a sweet shop. Fredoka is rounded and
 * chunky enough to belong with the pastries while staying readable at the 10px
 * labels this HUD is full of — the reason a heavier bakery script was not used.
 *
 * The system stack stays behind it so the game still renders if the embedded
 * face fails to decode.
 */
export const UI_FONT =
  'Fredoka, ui-rounded, "SF Pro Rounded", "Hiragino Maru Gothic ProN", "Varela Round", system-ui, -apple-system, sans-serif';

/** Glyph textures are rendered at this multiple. It must match RENDER_SCALE:
 *  lower and text is upscaled into the sharper canvas, higher is wasted memory. */
export const TEXT_RES = RENDER_SCALE;

/**
 * A warm bakery palette: cream paper, warm brown ink.
 *
 * The game was violet-on-near-black, which fought the food. The pastries are
 * warm pinks, golds and creams, and they read as objects sitting ON something
 * rather than glowing in the dark once the page behind them is warm too.
 *
 * Deliberately cream and honey rather than white: white is both clinical and,
 * at this size, glaring on a phone at night.
 *
 * INVERTED FROM THE OLD SCHEME, which is the thing to remember when adding UI.
 * `text` is now dark and panels are drawn with `ink` at low alpha; anything
 * still painting white-on-dark will vanish into the page.
 */
export const COLORS = {
  bgTop: 0xfff4da,
  bgBottom: 0xffdda6,
  screen: 0xfff4da,
  text: 0x4a3327,
  textMuted: 0x9b7a5f,
  teal: 0x17b39b,
  tealDeep: 0x0e8f7c,
  amber: 0xe89a1c,
  coral: 0xf2688f,
  danger: 0xd94860,
  gold: 0xd98324,
  /** Was a violet border accent; now the warm tan that edges cards. */
  violet: 0xd0a066,
  cardFill: 0xffe7bd,
  /**
   * The colour every panel fill, rule and outline is drawn in, at low alpha.
   * On the old dark scheme that role was played by plain white — which on
   * cream is invisible, so it is now a named warm brown instead of a literal
   * scattered through nine files.
   */
  ink: 0x6b4a33,
  /**
   * Full-screen wash behind a modal. LIGHT, not dark: on the old scheme this
   * was near-black at 0.9, and simply warming it turned every dialog into a
   * muddy brown pane with dark text sitting unreadably on top. A light theme
   * dims by washing OUT, and the modal card reads because it is a deeper
   * honey than the wash, not because the page behind it went black.
   */
  scrim: 0xfff0cc,
} as const;

/** Standard card/panel fills, bright enough to read as surfaces. */
export const PANEL_FILL = 0.12;
export const PANEL_STROKE = 0.3;

/**
 * The bin (play area) the pile of food lives in, in base coordinates.
 *
 * Sized so the tier-10 (272px across) just fits between the walls: big enough
 * to stage deep builds, but the pile still stacks and buries rather than
 * spreading into one reachable layer. Widening this further without re-running
 * the balance sim risks the wide-shallow failure mode where every pair is
 * reachable, merges never fail, and the game becomes unloseable.
 */
export const BIN = {
  left: 60,
  right: 340,
  floor: 470,
  /** Pile above this line (once settled) = overflow warning. */
  overflowLine: 150,
  railY: 92,
} as const;

/** Where the monster sits and receives food (it scales up as it grows).
 *  Kept high enough that a fully-grown monster's name label still clears the
 *  fed counter and the food-chain bar along the bottom. */
export const MONSTER = {
  x: 200,
  y: 560,
} as const;

/**
 * Matter's default gravity scale (0.001) is too weak here — high static
 * friction lets the pile jam into a floating arch instead of packing. But the
 * old 0.006 was the jitter: contacts that heavy never quite settle, and any
 * overlap resolves as a violent eject. 0.003 packs the pile while letting the
 * solver (with raised iteration counts in main.ts) actually converge.
 */
export const GRAVITY_SCALE = 0.003;

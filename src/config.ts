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
 * The UI typeface. `ui-rounded` is a CSS generic that resolves to SF Pro
 * Rounded on Apple devices — soft and friendly, matching the monster, and it
 * costs nothing because it ships with the OS (no webfont to download, which
 * matters for a single-file build). Everything after it is a graceful fallback.
 */
export const UI_FONT =
  'ui-rounded, "SF Pro Rounded", "Hiragino Maru Gothic ProN", "Varela Round", system-ui, -apple-system, sans-serif';

/**
 * Text is rendered at this multiple of its on-screen size, then scaled down.
 *
 * The game canvas is a fixed 400x720 that the browser then stretches to fill
 * the screen — on a phone with a 2-3x pixel ratio that's a big upscale, and
 * text rasterised at 1x came out soft and blurry. Rendering glyphs at 3x and
 * letting them scale down keeps them sharp on any display.
 */
export const TEXT_RES = 3;

/**
 * Bright, saturated palette. The old one was a muted navy that made everything
 * read as washed out and, frankly, dull. This keeps a dark base — the food
 * discs are vivid and need something to pop against — but pushes it to a
 * saturated violet-indigo and brightens every accent, so the UI feels lit
 * rather than grey.
 *
 * Panels sit at higher alpha too (see PANEL_*), which is what turns them from
 * faint smudges into actual cards.
 */
export const COLORS = {
  bgTop: 0x4c3fd6,
  bgBottom: 0x1b1352,
  screen: 0x140d3d,
  text: 0xffffff,
  textMuted: 0xc3c8f5,
  teal: 0x2ff0d6,
  tealDeep: 0x14b39a,
  amber: 0xffc93c,
  coral: 0xff6fa5,
  danger: 0xff4d6d,
  gold: 0xffd93d,
  violet: 0xa78bfa,
  cardFill: 0x2f2585,
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

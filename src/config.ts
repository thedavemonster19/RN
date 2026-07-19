/**
 * Central layout + theme constants for Monster Muncher.
 * Base resolution is a portrait phone canvas; Phaser's Scale.FIT letterboxes it
 * to any real device while keeping these coordinates stable.
 */
export const GAME = {
  WIDTH: 400,
  HEIGHT: 720,
} as const;

/** Clean-modern palette (matches the approved look-and-feel mockup). */
export const COLORS = {
  bgTop: 0x2a3366,
  bgBottom: 0x141733,
  screen: 0x0d1226,
  text: 0xeaf0ff,
  textMuted: 0x9aa3d0,
  teal: 0x37e0d0,
  tealDeep: 0x1a9f86,
  amber: 0xf7b955,
  coral: 0xf27a9b,
  danger: 0xe24b6a,
  gold: 0xffd66b,
  cardFill: 0x2a3366,
} as const;

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

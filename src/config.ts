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
 * Deliberately narrow and deep. A wide, shallow bin lets food spread into a
 * single layer where every pair is reachable, so merges never fail and the pile
 * can never grow — the game becomes unloseable. Cramped and tall means food
 * stacks and buries, and since the claw only reaches the top, a mistake down in
 * the pile is permanent. Failed merges are what make the pile climb.
 */
export const BIN = {
  left: 112,
  right: 288,
  floor: 470,
  /** Pile above this line (once settled) = overflow warning. */
  overflowLine: 150,
  railY: 92,
} as const;

/** Where the monster sits and receives food (it scales up as it grows). */
export const MONSTER = {
  x: 200,
  y: 588,
} as const;

/**
 * Matter's default gravity scale (0.001) is far too weak here — high static
 * friction lets the pile jam into a floating arch instead of packing. This
 * value makes food fall briskly and settle without tunnelling the floor.
 */
export const GRAVITY_SCALE = 0.006;

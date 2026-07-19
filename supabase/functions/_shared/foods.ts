// GENERATED — do not edit. Copied from src/data/foods.ts by scripts/sync-edge-shared.mjs.
// Edit the original and re-run `npm run sync:edge`.

/**
 * Food has a TYPE (its colour family) and a TIER (its size). Two foods merge
 * only when they match on BOTH — a berry never merges with a lime.
 *
 * The type axis is the whole point: the queue hands you every family, but the
 * monster only ever craves one, so the families it isn't asking for pile up as
 * half-built rubble that can't merge and can't be fed. That rubble is what the
 * bin fills with. With a single merge chain every food was immediately useful,
 * which made the bin mathematically unable to fill.
 *
 * COLOUR CARRIES BOTH AXES, because it's the only channel that scans fast in a
 * packed bin: the HUE tells you the family, the SHADE tells you the size. Every
 * merge visibly deepens the colour, which is the payoff that reads at a glance
 * — and size is then triple-encoded (shade + actual radius + position in chain).
 */
export interface FoodType {
  id: string;
  name: string;
  /** One colour per tier, pale → vivid. Index 0 is tier 1. */
  shades: number[];
}

/**
 * ONE chain, one vivid colour per tier — the readable look. Every merge flips
 * the colour outright, and size is what the colour *means*.
 *
 * We tried multiple families (colour = family, shade = size) as the difficulty
 * source: it worked on the numbers but played badly — the off-family food was
 * rubble you could only wait on, so difficulty felt like waiting, and two
 * visual axes at once read as clutter. Difficulty now comes from ASSEMBLY
 * pressure: cravings are BIG (tier 5+, growing with the monster), so you're
 * always coordinating a large merge tree while fat random drops (up to tier 4)
 * crash into it and fragment your staging.
 */
export const TYPES: FoodType[] = [
  {
    id: "food",
    name: "Food",
    shades: [
      0xf27a9b, // 1 berry pink
      0xe2504a, // 2 apple red
      0xf7b955, // 3 honey amber
      0x8ad155, // 4 lime green
      0x5b9be2, // 5 blueberry
      0x9b7bd4, // 6 plum
      0xffd66b, // 7 gold
      0xe8ecf5, // 8 ice — the run-defining monument
    ],
  },
];

/**
 * Radius climbs by √2 per tier, so a merged food covers the SAME area as the
 * two that made it (2·πr² = π(r√2)²). This matters more than it sounds: a 1.3x
 * step quietly destroyed ~15% of the pile's volume per merge, compounding to
 * ~50% by tier 5 — merging alone drained the bin faster than dropping filled
 * it. Conserving area means the only way volume leaves is the monster's mouth.
 *
 * Eight tiers. Ten forced tier 1 down to 12px across and the runs into
 * marathons (√2 over ten steps needs a huge capacity to hold the chain);
 * eight keeps tier 1 chunky at 22px while the ice tier-8 stays a near
 * bin-wide monument (128 tier-1s of material). Bigger food in the same bin =
 * far less capacity = shorter, tenser runs.
 */
export const TIER_RADII = [11, 16, 23, 32, 45, 64, 90, 128];

export const MAX_TIER = TIER_RADII.length;

/** The biggest tier the queue will ever hand you — everything above is earned.
 *  Fat drops are deliberate chaos: a random tier-4 crashing into your staged
 *  pairs is the Suika-style disruption that fragments a tidy pile. */
export const MAX_DROP_TIER = 4;
/**
 * The smallest tier the monster will ever ask for. Deliberately overlaps the
 * drop range: early on a lucky tier-3 or tier-4 can be fed straight off the
 * queue, which is a gentle on-ramp. The craving ramp (see GameState) pushes it
 * past MAX_DROP_TIER within a few milestones, so the overlap is a starter perk
 * rather than a permanent shortcut.
 */
export const MIN_CRAVING_TIER = 3;

function clampTier(tier: number): number {
  return Math.max(1, Math.min(MAX_TIER, tier));
}

export function tierRadius(tier: number): number {
  return TIER_RADII[clampTier(tier) - 1];
}

export function tierTexture(tier: number): string {
  return `food${clampTier(tier)}`;
}

/** The exact colour of a food: its family's hue, at its size's shade. */
export function foodColor(type: FoodType, tier: number): number {
  return type.shades[clampTier(tier) - 1];
}

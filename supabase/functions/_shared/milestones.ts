// GENERATED — do not edit. Copied from src/data/milestones.ts by scripts/sync-edge-shared.mjs.
// Edit the original and re-run `npm run sync:edge`.

/**
 * Endless size milestones the monster grows through. Past the named list it
 * keeps going with generated tiers, so the game never "ends" — you play for
 * score until a fail state.
 */
export const MILESTONES = [
  "Dog",
  "Human",
  "Car",
  "House",
  "Building",
  "Town",
  "City",
  "Country",
  "Continent",
  "Planet",
  "Solar System",
  "Universe",
  "Multiverse",
  "Dimension",
];

/**
 * Approximate real-world size of each milestone, for the metric readout.
 *
 * PARALLEL TO MILESTONES and to MILESTONE_METRES below — all three are indexed
 * the same way, so a change to one must change all three.
 *
 * Town and City were bumped (2 km -> 5 km, 20 km -> 50 km): a town spans a few
 * kilometres and a large metro forty or more, so the old figures undersold the
 * two milestones players spend the longest reaching. Building went 50 m -> 80 m
 * for the same reason.
 */
const SIZES = [
  "0.6 m",
  "1.8 m",
  "4.5 m",
  "9 m",
  "80 m",
  "5 km",
  "50 km",
  "2,000 km",
  "8,000 km",
  "12,742 km",
  "9 bn km",
  "93 bn ly",
  "∞",
  "∞",
];

/**
 * The same sizes in metres, for anything that needs to COMPUTE with them
 * (the scale reference sizes itself off the ratio between the monster and the
 * thing it is growing toward). Kept beside SIZES so the two cannot drift.
 */
export const MILESTONE_METRES = [
  0.6, 1.8, 4.5, 9, 80, 5e3, 5e4, 2e6, 8e6, 1.2742e7, 9e12, 8.8e26, 1e30, 1e33,
];

/** What the monster measures right now, in metres (0.3 m before the first). */
export function currentMetres(milestone: number): number {
  if (milestone <= 0) return 0.3;
  const i = milestone - 1;
  return i < MILESTONE_METRES.length
    ? MILESTONE_METRES[i]
    : MILESTONE_METRES[MILESTONE_METRES.length - 1];
}

/** The size of the thing it is growing TOWARD, in metres. */
export function targetMetres(milestone: number): number {
  return milestone < MILESTONE_METRES.length
    ? MILESTONE_METRES[milestone]
    : MILESTONE_METRES[MILESTONE_METRES.length - 1];
}

export function milestoneName(i: number): string {
  // Past the named ladder the names are generated — and the count restarts
  // at 1, so the first step beyond Dimension is "Titan Lv 1", not a "Titan
  // Lv 15" that leaks the internal milestone index. Becoming a Titan reads
  // as ascending to a new ladder, which is exactly what it is.
  return i < MILESTONES.length
    ? MILESTONES[i]
    : `Titan Lv ${i - MILESTONES.length + 1}`;
}

/** The monster's current size in metric — the tier it has actually reached. */
export function currentSize(milestone: number): string {
  if (milestone <= 0) return "0.3 m";
  const i = milestone - 1;
  return i < SIZES.length ? SIZES[i] : "∞";
}

/** Growth needed to reach milestone i — milestones sit well apart, more so late. */
export function growthReq(i: number): number {
  return 15 + Math.round(i * i);
}

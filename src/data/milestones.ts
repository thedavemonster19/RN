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

/** Approximate real-world size of each milestone, for the metric readout. */
const SIZES = [
  "0.6 m",
  "1.8 m",
  "4.5 m",
  "9 m",
  "50 m",
  "2 km",
  "20 km",
  "2,000 km",
  "8,000 km",
  "12,700 km",
  "9 bn km",
  "93 bn ly",
  "∞",
  "∞",
];

export function milestoneName(i: number): string {
  return i < MILESTONES.length ? MILESTONES[i] : `Titan Lv ${i + 1}`;
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

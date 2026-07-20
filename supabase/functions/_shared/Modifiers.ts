// GENERATED — do not edit. Copied from src/systems/Modifiers.ts by scripts/sync-edge-shared.mjs.
// Edit the original and re-run `npm run sync:edge`.

import { Rng, hashSeed } from "./Rng.ts";

/**
 * Daily-challenge modifiers — the thing that makes the daily feel different
 * from a normal run. Two are chosen deterministically from the date, so
 * everyone playing today gets the same twist, and (crucially) the verify-run
 * edge function can recompute exactly which ones were in force.
 *
 * DEPENDENCY-FREE on purpose, like GameState: this file is copied into the edge
 * function so the server derives the same modifiers the client did.
 *
 * Modifiers split into two kinds:
 *  - ECONOMY mods (double, feast, rush, bigdrops) change scoring or the food
 *    economy, so GameState applies them and the replay reproduces them.
 *  - FEEL mods (swing, floaty, windy, cramped) only change input, physics or
 *    the fail line. They never touch the score, so the replay ignores them —
 *    the server validates the event economy, not the physics.
 */
export type ModId =
  | "swing"
  | "double"
  | "floaty"
  | "feast"
  | "cramped"
  | "windy"
  | "rush"
  | "bigdrops";

export interface ModDef {
  id: ModId;
  name: string;
  desc: string;
  /** True if it changes score/economy (must be reproduced by the server). */
  economy: boolean;
}

export const MODS: Record<ModId, ModDef> = {
  swing: {
    id: "swing",
    name: "Swinging Claw",
    desc: "The claw sweeps side to side — tap to drop, timing is everything.",
    economy: false,
  },
  double: {
    id: "double",
    name: "Double Drop",
    desc: "Every food from the queue drops as two.",
    economy: true,
  },
  floaty: {
    id: "floaty",
    name: "Low Gravity",
    desc: "Food drifts down slow and light.",
    economy: false,
  },
  feast: {
    id: "feast",
    name: "Big Appetite",
    desc: "The monster craves larger food than usual.",
    economy: true,
  },
  cramped: {
    id: "cramped",
    name: "Cramped Bin",
    desc: "Less room before the bin overflows.",
    economy: false,
  },
  windy: {
    id: "windy",
    name: "Windy",
    desc: "A breeze pushes food across the bin.",
    economy: false,
  },
  rush: {
    id: "rush",
    name: "Impatient",
    desc: "Freshness fades faster — feed quickly for the bonus.",
    economy: true,
  },
  bigdrops: {
    id: "bigdrops",
    name: "Heavy Rain",
    desc: "The food you drop starts bigger.",
    economy: true,
  },
};

const POOL: ModId[] = [
  "swing",
  "double",
  "floaty",
  "feast",
  "cramped",
  "windy",
  "rush",
  "bigdrops",
];

/** How many modifiers a daily run gets. */
const PER_DAY = 2;

/**
 * The modifiers in force for a given daily key. Deterministic: a Fisher–Yates
 * shuffle seeded off the date (kept separate from the food seed so they don't
 * correlate), then the first PER_DAY.
 */
export function dailyModifiers(dailyKey: string): ModId[] {
  const rng = new Rng(hashSeed(dailyKey + ":mods"));
  const pool = POOL.slice();
  for (let i = pool.length - 1; i > 0; i--) {
    const j = rng.between(0, i);
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, PER_DAY).sort();
}

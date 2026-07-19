// GENERATED — do not edit. Copied from src/systems/Rng.ts by scripts/sync-edge-shared.mjs.
// Edit the original and re-run `npm run sync:edge`.

/**
 * A tiny deterministic PRNG (mulberry32). The daily challenge needs every
 * player to get the exact same sequence of food, which Math.random() can't
 * give us — so all gameplay randomness routes through one of these.
 *
 * Normal runs get a random seed, so they behave exactly as before.
 */
export class Rng {
  private state: number;

  constructor(seed: number) {
    // Avoid a zero state, which would make the generator degenerate.
    this.state = seed >>> 0 || 0x9e3779b9;
  }

  /** Float in [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Integer in [min, max], inclusive. */
  between(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length)];
  }
}

/** Today's date as YYYY-MM-DD in the player's own timezone. */
export function todayKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Stable 32-bit hash of a string — turns a date key into a seed. */
export function hashSeed(text: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

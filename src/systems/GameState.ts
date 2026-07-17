import Phaser from "phaser";
import {
  TYPES,
  FoodType,
  MAX_TIER,
  MAX_DROP_TIER,
  MIN_CRAVING_TIER,
} from "../data/foods";
import { growthReq } from "../data/milestones";

// Overflow is the only way to lose — the game is infinite and skill-based.
export type GameOverReason = "overflow";

/** A food, as a plain value: what the queue holds and what the monster wants. */
export interface Spec {
  type: FoodType;
  tier: number;
}

export interface FeedResult {
  /** The tier actually handed over. */
  tier: number;
  /** The tier the monster had asked for (what it pays out on). */
  wanted: number;
  /** True when the player hit the craving exactly rather than overshooting. */
  exact: boolean;
  points: number;
  growth: number;
  moodDelta: number;
  leveledUp: boolean;
}

/** How many upcoming cravings the player can plan against. */
const CRAVING_QUEUE_LEN = 3;
/** How many upcoming drops the player can plan against. */
const DROP_QUEUE_LEN = 4;

const START_MOOD = 80;
/** Hitting the craving on the nose delights it. */
const EXACT_MOOD = 10;
/** Overshooting works, but it's not what it asked for. */
const OVERSHOOT_MOOD = -14;

/**
 * Pure game logic: what the monster wants, the queue of food you get to drop,
 * score/growth/milestones, the streak, and mood. Knows nothing about rendering
 * or physics.
 *
 * The rules that carry the design:
 *  1. ASSEMBLY is the pressure. Cravings are big (tier 5 up, growing with the
 *     monster), so satisfying one means coordinating a large merge tree —
 *     dozens of drops' worth of material staged in the bin at once — while
 *     fat random drops (up to tier 4) keep crashing in and fragmenting it.
 *  2. It accepts the craved tier or BIGGER, but only ever pays for the tier it
 *     asked for. So a giant food is never dead weight, but spending it on a
 *     small craving is a real loss.
 *  3. Cravings always start above MAX_DROP_TIER, so a food straight out of the
 *     queue can never be fed — you always have to merge first.
 *
 * Mood is the precision meter: exact feeds raise it, overshoots lower it. It's
 * a score bonus and a face — never a fail state, and nothing drains it over
 * time, so the game stays unhurried.
 */
export class GameState extends Phaser.Events.EventEmitter {
  score = 0;
  growth = 0;
  milestone = 0;
  mood = START_MOOD;
  /** Cravings satisfied in a row — persistence. */
  combo = 0;
  /** What the monster wants right now. */
  craving: Spec;
  /** The next few cravings, oldest first. */
  cravingQueue: Spec[] = [];
  /** The next few foods you get to drop, oldest first. */
  dropQueue: Spec[] = [];
  /** One saved food, kept out of the bin until you want to spend it. */
  pocket: Spec | null = null;

  constructor() {
    super();
    this.craving = this.rollCraving();
    for (let i = 0; i < CRAVING_QUEUE_LEN; i++)
      this.cravingQueue.push(this.rollCraving());
    for (let i = 0; i < DROP_QUEUE_LEN; i++) this.dropQueue.push(this.rollDrop());
  }

  /**
   * The craved tier climbs with the monster — every milestone pushes it toward
   * the bin-wide tier 7. This IS the difficulty curve: a tier-6 is 32 tier-1s
   * of coordinated material staged at once, a tier-7 is 64.
   *
   * The band is always at least two tiers wide, including at milestone 0. A
   * single-tier band made every early craving identical, which killed the point
   * of starting low: the variety is what makes it interesting, since a small
   * ask might be feedable straight off the queue while the next one needs a
   * real build.
   */
  private rollCraving(): Spec {
    const m = this.milestone;
    const min = Math.min(MIN_CRAVING_TIER + Math.floor(m / 4), MAX_TIER);
    const max = Math.min(MIN_CRAVING_TIER + 1 + Math.floor(m / 2), MAX_TIER);
    return {
      type: Phaser.Utils.Array.GetRandom(TYPES),
      tier: Phaser.Math.Between(min, Math.max(min, max)),
    };
  }

  /**
   * Drops span tier 1 up to a fat tier 4 — small ones are staging material,
   * big ones are the chaos that wrecks it. Weighted toward small so placement
   * still feels controllable.
   */
  private rollDrop(): Spec {
    const r = Math.random();
    const tier = r < 0.4 ? 1 : r < 0.65 ? 2 : r < 0.85 ? 3 : MAX_DROP_TIER;
    return { type: Phaser.Utils.Array.GetRandom(TYPES), tier };
  }

  get growthProgress(): number {
    return Phaser.Math.Clamp(this.growth / growthReq(this.milestone), 0, 1);
  }

  /** Streak multiplier: escalates with satisfied cravings, capped so it stays sane. */
  get comboMult(): number {
    return Math.min(1 + this.combo * 0.3, 5);
  }

  /** A happy monster scores more — the mood bonus, 1x .. 2x. */
  get moodMult(): number {
    return 1 + this.mood / 100;
  }

  /** The food waiting at the front of the drop queue. */
  peekDrop(): Spec {
    return this.dropQueue[0];
  }

  /** Take the next food to drop and refill the queue. */
  takeDrop(): Spec {
    const spec = this.dropQueue.shift()!;
    this.dropQueue.push(this.rollDrop());
    this.emit("changed");
    return spec;
  }

  /** Save a built food for later. One slot only, so it can't be a dump valve. */
  stash(spec: Spec): boolean {
    if (this.pocket !== null) return false;
    this.pocket = spec;
    this.emit("changed");
    return true;
  }

  private advanceCraving(): void {
    this.craving = this.cravingQueue.shift()!;
    this.cravingQueue.push(this.rollCraving());
  }

  /** True if the monster would take this — right type, and big enough. */
  accepts(type: FoodType, tier: number): boolean {
    return type.id === this.craving.type.id && tier >= this.craving.tier;
  }

  /**
   * Feed a food. Returns null (and changes nothing) if the food is smaller
   * than what the monster wants — small food has to be merged up first, which
   * is what keeps the bin filling.
   */
  feed(type: FoodType, tier: number): FeedResult | null {
    if (!this.accepts(type, tier)) return null;

    const wanted = this.craving.tier;
    const exact = tier === wanted;

    // A satisfied craving is a satisfied craving, so the streak survives an
    // overshoot; mood is what tracks whether you're being precise about it.
    this.combo++;
    const moodDelta = exact ? EXACT_MOOD : OVERSHOOT_MOOD;
    this.mood = Phaser.Math.Clamp(this.mood + moodDelta, 0, 100);

    // Paid on what it ASKED for, never on what you handed over — that's what
    // makes spending a giant food on a small craving a real loss.
    const growth = wanted * 2;
    const points = Math.round(wanted * 40 * this.comboMult * this.moodMult) + 60;
    this.score += points;
    this.growth += growth;

    let leveledUp = false;
    while (this.growth >= growthReq(this.milestone)) {
      this.growth -= growthReq(this.milestone);
      this.milestone++;
      this.score += 180 + this.milestone * 30;
      leveledUp = true;
    }
    this.advanceCraving();

    const result: FeedResult = {
      tier,
      wanted,
      exact,
      points,
      growth,
      moodDelta,
      leveledUp,
    };
    this.emit("changed", result);
    return result;
  }

  /** Feed the pocketed food, if the monster will take it. */
  feedFromPocket(): FeedResult | null {
    const p = this.pocket;
    if (p === null || !this.accepts(p.type, p.tier)) return null;
    this.pocket = null;
    return this.feed(p.type, p.tier);
  }

  /** Score a merge. Chained merges (a cascade) pay escalating points. */
  addMergeScore(tier: number, chain: number): number {
    const points = Math.round(tier * 6 * (1 + (chain - 1) * 0.6));
    this.score += points;
    this.emit("changed");
    return points;
  }
}

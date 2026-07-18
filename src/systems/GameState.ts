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
  tier: number;
  points: number;
  /** The freshness bonus included in points (0 when the craving went stale). */
  fresh: number;
  growth: number;
  leveledUp: boolean;
}

/** How many upcoming cravings the player can plan against. One: with a 3-deep
 *  preview the panel read as repetitive noise, and one "next" is enough to
 *  decide whether to hold or spend a build. */
const CRAVING_QUEUE_LEN = 1;
/** How many upcoming drops the player can plan against. */
const DROP_QUEUE_LEN = 4;

/**
 * Pure game logic: what the monster wants, the queue of food you get to drop,
 * score/growth/milestones. Knows nothing about rendering or physics.
 *
 * The rules that carry the design:
 *  1. EXACT feeding only. The monster takes precisely the tier it craves —
 *     nothing smaller, nothing bigger. Too-big food is real dead weight until
 *     its tier comes up again, so the skill is stopping your merges at the
 *     right moment, not just growing things. (Mood and streak multipliers were
 *     removed with this: with no bonus knobs, score is a plain record of how
 *     far you got, which keeps leaderboard runs comparable.)
 *  2. ASSEMBLY is the pressure. Cravings are sizeable and climb with the
 *     monster, so satisfying one means coordinating a merge tree while fat
 *     random drops (up to tier 4) keep crashing in and fragmenting it.
 *  3. The danger line descends every milestone (see GameScene), so the room
 *     to stage a build shrinks as the asks grow.
 */
export class GameState extends Phaser.Events.EventEmitter {
  score = 0;
  growth = 0;
  milestone = 0;
  /** What the monster wants right now. */
  craving: Spec;
  /** The next few cravings, oldest first. */
  cravingQueue: Spec[] = [];
  /** The next few foods you get to drop, oldest first. */
  dropQueue: Spec[] = [];
  /** One saved food, held out of the bin until you drop it back in. */
  pocket: Spec | null = null;
  /** Drops taken since the current craving appeared — freshness decays on
   *  drops, never on time, so thinking is still free. */
  cravingAge = 0;

  constructor() {
    super();
    this.craving = this.rollCraving();
    for (let i = 0; i < CRAVING_QUEUE_LEN; i++)
      this.cravingQueue.push(this.rollCraving());
    for (let i = 0; i < DROP_QUEUE_LEN; i++) this.dropQueue.push(this.rollDrop());
  }

  /**
   * The craved tier climbs with the monster — every milestone pushes it toward
   * the bin-wide tier 10, and THIS ramp is the late-game difficulty: a tier-9
   * is 256 tier-1s of staged material, a tier-10 is 512. The band is always at
   * least two tiers wide, including at milestone 0: variety is the point of
   * starting low, since a small ask might be feedable straight off the queue
   * while the next needs a real build.
   */
  private rollCraving(): Spec {
    const m = this.milestone;
    const min = Math.min(MIN_CRAVING_TIER + Math.floor(m / 2), MAX_TIER - 1);
    const max = Math.min(MIN_CRAVING_TIER + 1 + Math.floor((2 * m) / 3), MAX_TIER);
    return {
      type: Phaser.Utils.Array.GetRandom(TYPES),
      tier: Phaser.Math.Between(min, Math.max(min, max)),
    };
  }

  /**
   * Drops span tier 1 up to a fat tier 4 — small ones are staging material,
   * big ones are the chaos that wrecks it. The weights are the inflow dial:
   * with the 10-tier bin's capacity, anything leaner than this made random
   * play effectively immortal.
   */
  private rollDrop(): Spec {
    const r = Math.random();
    const tier = r < 0.25 ? 1 : r < 0.5 ? 2 : r < 0.75 ? 3 : MAX_DROP_TIER;
    return { type: Phaser.Utils.Array.GetRandom(TYPES), tier };
  }

  get growthProgress(): number {
    return Phaser.Math.Clamp(this.growth / growthReq(this.milestone), 0, 1);
  }

  /** The food waiting at the front of the drop queue. */
  peekDrop(): Spec {
    return this.dropQueue[0];
  }

  /** Take the next food to drop and refill the queue. */
  takeDrop(): Spec {
    const spec = this.dropQueue.shift()!;
    this.dropQueue.push(this.rollDrop());
    this.cravingAge++;
    this.emit("changed");
    return spec;
  }

  /**
   * How many drops a tight build of this tier reasonably takes — the freshness
   * grace window. Scales with the ask: a tier-6 is a project, a tier-3 isn't.
   */
  private static freshGrace(tier: number): number {
    return Math.ceil(2 ** (tier - 1) / 3) + 2;
  }

  /**
   * 1 = full freshness bonus, 0 = gone stale. Full inside the grace window,
   * then fades linearly over two more windows. Only the BONUS decays — the
   * base pay never does, so a slow feed is fine, just not rewarded.
   */
  get freshness(): number {
    const grace = GameState.freshGrace(this.craving.tier);
    const over = Math.max(0, this.cravingAge - grace);
    return Phaser.Math.Clamp(1 - over / (grace * 2), 0, 1);
  }

  /** Save a built food for later. One slot only, so it can't be a dump valve. */
  stash(spec: Spec): boolean {
    if (this.pocket !== null) return false;
    this.pocket = spec;
    this.emit("changed");
    return true;
  }

  /** Take the pocketed food back (to drop into the bin). */
  takePocket(): Spec | null {
    const p = this.pocket;
    this.pocket = null;
    if (p) this.emit("changed");
    return p;
  }

  private advanceCraving(): void {
    this.craving = this.cravingQueue.shift()!;
    this.cravingQueue.push(this.rollCraving());
    this.cravingAge = 0;
  }

  /** True if the monster would take this — right type, exactly the right size. */
  accepts(type: FoodType, tier: number): boolean {
    return type.id === this.craving.type.id && tier === this.craving.tier;
  }

  /**
   * Feed a food. Returns null (and changes nothing) unless it is exactly what
   * the monster craves — too small must be merged up, too big is dead weight
   * until its tier is craved again. That strictness is the game.
   */
  feed(type: FoodType, tier: number): FeedResult | null {
    if (!this.accepts(type, tier)) return null;

    const growth = tier * 2;
    // Flat pay per craving, rising gently with the monster so late feeds
    // matter more, plus a freshness bonus for feeding within a tight number of
    // drops. No multipliers — score is a record, not a slot machine.
    const fresh = Math.round(tier * 40 * this.freshness);
    const points = tier * 40 + fresh + this.milestone * 20 + 60;
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

    const result: FeedResult = { tier, points, fresh, growth, leveledUp };
    this.emit("changed", result);
    return result;
  }

  /** Flat merge pay — building big is its own reward, no chain multipliers. */
  addMergeScore(tier: number): number {
    const points = tier * 8;
    this.score += points;
    this.emit("changed");
    return points;
  }
}

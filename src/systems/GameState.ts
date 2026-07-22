import {
  TYPES,
  FoodType,
  MAX_TIER,
  MAX_DROP_TIER,
  MIN_CRAVING_TIER,
} from "../data/foods";
import { growthReq } from "../data/milestones";
import { Rng, hashSeed } from "./Rng";
import { ModId, dailyModifiers } from "./Modifiers";
import { ModeId, modeMods } from "./Modes";

/** Local clamp — this module is deliberately dependency-free (see below). */
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

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

/**
 * The pocket is the ONLY counterplay to exact-only feeding — without it,
 * over-merged food is dead weight you can do nothing about. But free parking
 * for your biggest mistake is too safe: measured, permanently parking your
 * largest food extends a run ~35%.
 *
 * So it's priced BY SIZE. Every feed banks one charge; stashing costs charges
 * equal to the food's tier. Parking a tier-2 is nearly free, parking a huge
 * one is a real investment you must feed your way toward — which is exactly
 * where the "extra space for giant food" unfairness lived.
 *
 * A flat per-feed cooldown was tried first and measured as barely binding: the
 * single slot is already the limiter, since a parked food usually stays parked.
 */
const POCKET_CHARGE_CAP = MAX_TIER;
const POCKET_START_CHARGES = 3;

/** Undos per run — enough to rescue real misfires, too few to play by trial. */
const UNDOS_PER_RUN = 3;
/** How many upcoming drops the player can plan against. */
const DROP_QUEUE_LEN = 4;

/**
 * Pure game logic: what the monster wants, the queue of food you get to drop,
 * score/growth/milestones. Knows nothing about rendering or physics.
 *
 * DELIBERATELY DEPENDENCY-FREE. This exact file is re-run server-side to
 * validate submitted leaderboard runs (see Replay.ts and the verify-run edge
 * function), so the server scores a run with the same code the client did —
 * there is no second implementation to drift out of sync. Importing Phaser, or
 * anything touching the DOM, here would break that. Keep it pure.
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
export class GameState {
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
  /** Banked stash charges — one per feed, spent by size when you pocket. */
  pocketCharges = POCKET_START_CHARGES;
  /** Cravings satisfied this run. */
  totalFeeds = 0;
  /** Drops taken since the current craving appeared — freshness decays on
   *  drops, never on time, so thinking is still free. */
  cravingAge = 0;
  /** Run stats for the end-of-run summary. */
  totalDrops = 0;
  biggestTier = 0;
  /** Undos left this run — the panic button for a misfired drop. */
  undosLeft = UNDOS_PER_RUN;
  /** Drops taken since the bin was last emptied — sizes the clear bonus. */
  dropsSinceClear = 0;
  /** Set for a daily-challenge run: everyone gets this same food sequence. */
  readonly dailyKey: string | null;
  /**
   * The RNG seed. Exposed so a casual run can be submitted and replayed too:
   * the game is deterministic given seed + inputs, which is what lets the
   * all-time leaderboard be verified rather than self-reported.
   */
  readonly seed: number;
  /** The permanent mode being played. Daily runs are always "classic" here —
   *  their twists come from the date, not from a chosen mode. */
  readonly mode: ModeId;
  /** Active modifiers. For a daily run these come from the date; otherwise from
   *  the chosen mode. Either way they are DERIVED, never passed in, so the
   *  server reproduces the same set from the same inputs. */
  readonly mods: ModId[];

  private rng: Rng;

  /**
   * Pass a daily key to get a deterministic run everyone else also gets, a mode
   * to play a permanent twist, or a seed to reproduce a specific past run (how
   * the server replays a submitted one).
   *
   * A daily key wins over a mode: the daily's whole point is that everyone gets
   * the identical run, so letting a mode stack extra modifiers on top would
   * break that and hand the player a scoring advantage over the same board.
   */
  constructor(
    dailyKey: string | null = null,
    seed?: number,
    mode: ModeId = "classic"
  ) {
    this.dailyKey = dailyKey;
    this.mode = dailyKey ? "classic" : mode;
    this.mods = dailyKey ? dailyModifiers(dailyKey) : modeMods(mode);
    this.seed = dailyKey
      ? hashSeed(dailyKey)
      : seed ?? (Math.random() * 2 ** 32) >>> 0;
    this.rng = new Rng(this.seed);
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
  has(mod: ModId): boolean {
    return this.mods.includes(mod);
  }

  private rollCraving(): Spec {
    const m = this.milestone;
    // "Big Appetite" shifts the whole craving band up a tier — larger builds
    // demanded from the start.
    const bump = this.has("feast") ? 1 : 0;
    const min = Math.min(MIN_CRAVING_TIER + bump + Math.floor(m / 2), MAX_TIER - 1);
    const max = Math.min(
      MIN_CRAVING_TIER + 1 + bump + Math.floor((2 * m) / 3),
      MAX_TIER
    );
    return {
      type: this.rng.pick(TYPES),
      tier: this.rng.between(min, Math.max(min, max)),
    };
  }

  /**
   * Drops span tier 1 up to a fat tier 4 — small ones are staging material,
   * big ones are the chaos that wrecks it. The weights are the inflow dial:
   * with the 10-tier bin's capacity, anything leaner than this made random
   * play effectively immortal.
   */
  private rollDrop(): Spec {
    const r = this.rng.next();
    // "Heavy Rain" shifts the drop mix up — no tier-1 chaff, bigger pieces to
    // place and shove around.
    const tier = this.has("bigdrops")
      ? r < 0.34 ? 2 : r < 0.67 ? 3 : MAX_DROP_TIER
      : r < 0.25 ? 1 : r < 0.5 ? 2 : r < 0.75 ? 3 : MAX_DROP_TIER;
    return { type: this.rng.pick(TYPES), tier };
  }

  get growthProgress(): number {
    return clamp(this.growth / growthReq(this.milestone), 0, 1);
  }

  /** The food waiting at the front of the drop queue. */
  peekDrop(): Spec {
    return this.dropQueue[0];
  }

  /** Take the next food to drop and refill the queue. */
  private takeDrop(): Spec {
    const spec = this.dropQueue.shift()!;
    this.dropQueue.push(this.rollDrop());
    this.cravingAge++;
    this.totalDrops++;
    this.dropsSinceClear++;
    return spec;
  }

  /**
   * The food a single drop action produces: one normally, two under Double
   * Drop — and under Double Drop they are two SEPARATE queue draws, never two
   * copies. Two identical foods released together just fused in mid-air, which
   * read as a glitch rather than a modifier. If the pair would still match,
   * the second is nudged a tier so they can't merge with each other on the way
   * down. Deterministic, so the server reproduces it exactly.
   */
  takeDrops(): Spec[] {
    const first = this.takeDrop();
    if (!this.has("double")) return [first];
    const second = this.takeDrop();
    if (second.type.id === first.type.id && second.tier === first.tier) {
      second.tier =
        second.tier >= MAX_DROP_TIER ? second.tier - 1 : second.tier + 1;
    }
    return [first, second];
  }

  /**
   * Put a whole drop action back exactly as it was — including the freshness
   * tick, so an undo can't be used to farm the freshness bonus. Costs one undo
   * however many foods that action produced.
   */
  returnDrops(specs: Spec[]): void {
    for (let i = specs.length - 1; i >= 0; i--) {
      this.dropQueue.pop();
      this.dropQueue.unshift(specs[i]);
      if (this.cravingAge > 0) this.cravingAge--;
      this.totalDrops = Math.max(0, this.totalDrops - 1);
      if (this.dropsSinceClear > 0) this.dropsSinceClear--;
    }
    this.undosLeft--;
  }

  /**
   * Emptying the bin completely. Worth more the bigger the mess you cleared,
   * measured in drops since the last clear — otherwise the early game, where
   * the bin is nearly empty anyway, would hand out a flat jackpot every few
   * feeds. Floored so a lucky early clear is still a small treat, capped so it
   * can't eclipse the feeding it took to get there.
   */
  awardBinClear(): number {
    const points = clamp(this.dropsSinceClear * 40, 100, 1200);
    this.score += points;
    this.dropsSinceClear = 0;
    return points;
  }

  /** Track the biggest food ever built, for the run summary. */
  noteTier(tier: number): void {
    if (tier > this.biggestTier) this.biggestTier = tier;
  }

  /**
   * How many drops a tight build of this tier reasonably takes — the freshness
   * grace window. Scales with the ask: a tier-6 is a project, a tier-3 isn't.
   * "Impatient" roughly halves it, so the bonus fades under real time pressure.
   */
  private freshGrace(tier: number): number {
    const base = Math.ceil(2 ** (tier - 1) / 3) + 2;
    return this.has("rush") ? Math.ceil(base / 2) : base;
  }

  /**
   * 1 = full freshness bonus, 0 = gone stale. Full inside the grace window,
   * then fades linearly over two more windows. Only the BONUS decays — the
   * base pay never does, so a slow feed is fine, just not rewarded.
   */
  get freshness(): number {
    const grace = this.freshGrace(this.craving.tier);
    const over = Math.max(0, this.cravingAge - grace);
    return clamp(1 - over / (grace * 2), 0, 1);
  }

  /**
   * A little score for the act of dropping, so points tick up as you play and
   * not only when the monster is fed. Kept small on purpose: feeding a big
   * craving is worth hundreds, a drop is worth single digits, so the incentive
   * still points firmly at feeding.
   */
  dropScore(tier: number): number {
    return 2 + tier;
  }

  /** Award the drop bonus for one food entering the bin from the queue. */
  addDropScore(tier: number): void {
    this.score += this.dropScore(tier);
  }

  /** Reverse a drop bonus when that drop is undone. */
  removeDropScore(tier: number): void {
    this.score = Math.max(0, this.score - this.dropScore(tier));
  }

  /** How many foods a single queue-drop produces (two under Double Drop). */
  get dropCount(): number {
    return this.has("double") ? 2 : 1;
  }

  /** What pocketing this food costs — bigger food, bigger price. */
  stashCost(tier: number): number {
    return tier;
  }

  canStash(tier: number): boolean {
    return this.pocket === null && this.pocketCharges >= this.stashCost(tier);
  }

  /** Save a built food for later. Costs charges by size; one slot only. */
  stash(spec: Spec): boolean {
    if (!this.canStash(spec.tier)) return false;
    this.pocketCharges -= this.stashCost(spec.tier);
    this.pocket = spec;
    return true;
  }

  /** Take the pocketed food back (to drop into the bin). */
  takePocket(): Spec | null {
    const p = this.pocket;
    this.pocket = null;
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

    this.totalFeeds++;
    this.pocketCharges = Math.min(this.pocketCharges + 1, POCKET_CHARGE_CAP);

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
    return result;
  }

  /** Flat merge pay — building big is its own reward, no chain multipliers. */
  addMergeScore(tier: number): number {
    const points = tier * 8;
    this.score += points;
    return points;
  }
}

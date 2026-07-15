import Phaser from "phaser";
import { FOOD_TYPES, MEGA, FoodType } from "../data/foods";
import { growthReq } from "../data/milestones";

// Overflow is the only way to lose — the game is infinite and skill-based.
export type GameOverReason = "overflow";

/** The minimal shape feed() needs — a real Food or a pocketed type both fit. */
export interface Feedable {
  type: FoodType;
  mega: boolean;
}

export interface FeedResult {
  craved: boolean;
  mega: boolean;
  growth: number;
  points: number;
  moodDelta: number;
  leveledUp: boolean;
}

const START_MOOD = 80;
const CRAVED_MOOD = 18;
const WRONG_MOOD = -6;
const MEGA_MOOD = 10;
const QUEUE_LEN = 3; // how many upcoming cravings are previewed

/**
 * Pure game logic: mood, score, growth, milestones, the craving queue, the
 * combo/streak system, and the pocket. Knows nothing about rendering.
 */
export class GameState extends Phaser.Events.EventEmitter {
  mood = START_MOOD;
  score = 0;
  growth = 0;
  milestone = 0;
  /** Consecutive satisfied cravings (feeding the wanted food in a row). */
  combo = 0;
  /** A wrong feed consumes this instead of breaking the streak. */
  streakShield = false;
  craving: FoodType;
  /** The next few cravings, oldest first — lets the player plan ahead. */
  cravingQueue: FoodType[] = [];
  /** One stashed food type the player can feed later, or null. */
  pocket: FoodType | null = null;

  constructor() {
    super();
    this.craving = this.pickCraving();
    let prev = this.craving;
    for (let i = 0; i < QUEUE_LEN; i++) {
      const c = this.pickCraving(prev);
      this.cravingQueue.push(c);
      prev = c;
    }
  }

  /** Back-compat helper: the immediately-upcoming craving. */
  get nextCraving(): FoodType {
    return this.cravingQueue[0];
  }

  private pickCraving(prev?: FoodType): FoodType {
    if (Math.random() < 0.16 && (!prev || prev.id !== MEGA.id)) return MEGA;
    let c: FoodType;
    do {
      c = Phaser.Utils.Array.GetRandom(FOOD_TYPES);
    } while (prev && c.id === prev.id);
    return c;
  }

  private advanceCraving(): void {
    this.craving = this.cravingQueue.shift()!;
    const last = this.cravingQueue[this.cravingQueue.length - 1] ?? this.craving;
    this.cravingQueue.push(this.pickCraving(last));
  }

  get growthProgress(): number {
    return Phaser.Math.Clamp(this.growth / growthReq(this.milestone), 0, 1);
  }

  /** A happy monster scores more — the mood multiplier, 1x .. 2x. */
  get moodMult(): number {
    return 1 + this.mood / 100;
  }

  /** Streak multiplier: escalates with the combo, capped so it stays sane. */
  get comboMult(): number {
    return Math.min(1 + this.combo * 0.4, 6);
  }

  /** Stash a food type for later (one slot). Returns false if pocket is full. */
  stash(type: FoodType): boolean {
    if (this.pocket) return false;
    this.pocket = type;
    this.emit("changed");
    return true;
  }

  /** Feed the pocketed food (a free feed — no grab, no refill). */
  feedFromPocket(): FeedResult | null {
    if (!this.pocket) return null;
    const type = this.pocket;
    this.pocket = null;
    return this.feed({ type, mega: type.id === MEGA.id });
  }

  feed(food: Feedable): FeedResult {
    const craved = food.type.id === this.craving.id;

    if (craved) {
      this.combo++;
      if (this.combo % 4 === 0) this.streakShield = true; // earn a shield
    } else if (!food.mega) {
      if (this.streakShield) this.streakShield = false; // shield absorbs the break
      else this.combo = 0;
    }

    let growth = food.type.quality;
    let moodDelta: number;
    if (craved) {
      moodDelta = CRAVED_MOOD;
      if (!food.mega) growth = food.type.quality + 3;
      this.advanceCraving();
    } else if (food.mega) {
      moodDelta = MEGA_MOOD;
    } else {
      moodDelta = WRONG_MOOD;
    }
    this.mood = Phaser.Math.Clamp(this.mood + moodDelta, 0, 100);

    const points =
      Math.round(growth * 10 * this.comboMult * this.moodMult) +
      (craved ? 130 : 0) +
      (food.mega ? 250 : 0);
    this.score += points;
    this.growth += growth;

    let leveledUp = false;
    while (this.growth >= growthReq(this.milestone)) {
      this.growth -= growthReq(this.milestone);
      this.milestone++;
      this.score += 180 + this.milestone * 30;
      leveledUp = true;
    }

    const result: FeedResult = {
      craved,
      mega: food.mega,
      growth,
      points,
      moodDelta,
      leveledUp,
    };
    this.emit("changed", result);
    return result;
  }
}

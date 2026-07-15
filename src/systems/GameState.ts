import Phaser from "phaser";
import { FOOD_TYPES, MEGA, FoodType } from "../data/foods";
import { Food } from "../objects/FoodPile";
import { growthReq } from "../data/milestones";

// Overflow is the only way to lose — the game is infinite and skill-based.
export type GameOverReason = "overflow";

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

/**
 * Pure game logic: mood, score, growth, milestones, combos, and the current
 * craving. Knows nothing about rendering — the scene and HUD listen to it.
 */
export class GameState extends Phaser.Events.EventEmitter {
  mood = START_MOOD;
  score = 0;
  growth = 0;
  milestone = 0;
  /** Consecutive satisfied cravings (feeding the wanted food in a row). */
  combo = 0;
  craving: FoodType;
  /** What the monster will crave after the current one (shown as a preview). */
  nextCraving: FoodType;

  constructor() {
    super();
    this.craving = this.pickCraving();
    this.nextCraving = this.pickCraving(this.craving);
  }

  private pickCraving(prev?: FoodType): FoodType {
    // ~16% of the time the monster wants the big treat, so digging for a mega
    // pays off with the full craving reward.
    if (Math.random() < 0.16 && (!prev || prev.id !== MEGA.id)) return MEGA;
    let c: FoodType;
    do {
      c = Phaser.Utils.Array.GetRandom(FOOD_TYPES);
    } while (prev && c.id === prev.id);
    return c;
  }

  /** How full the bar toward the next milestone is, 0..1. */
  get growthProgress(): number {
    return Phaser.Math.Clamp(this.growth / growthReq(this.milestone), 0, 1);
  }

  /** A happy monster scores more — the mood multiplier, 1x .. 2x. */
  get moodMult(): number {
    return 1 + this.mood / 100;
  }

  feed(food: Food): FeedResult {
    // A mega can now satisfy a mega craving, so include it in the match.
    const craved = food.type.id === this.craving.id;
    // Combo builds from consecutive satisfied cravings; wrong food breaks it,
    // but an unwanted mega is still a treat and leaves the streak intact.
    if (craved) this.combo++;
    else if (!food.mega) this.combo = 0;

    let growth = food.type.quality;
    let moodDelta: number;
    if (craved) {
      moodDelta = CRAVED_MOOD;
      if (!food.mega) growth = food.type.quality + 3; // mega quality is already big
      // Advance the craving queue: next becomes current, pick a new next.
      this.craving = this.nextCraving;
      this.nextCraving = this.pickCraving(this.craving);
    } else if (food.mega) {
      moodDelta = MEGA_MOOD;
    } else {
      moodDelta = WRONG_MOOD;
    }
    this.mood = Phaser.Math.Clamp(this.mood + moodDelta, 0, 100);

    const comboMult = Math.max(1, Math.min(this.combo, 6));
    const points =
      Math.round(growth * 10 * comboMult * this.moodMult) +
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

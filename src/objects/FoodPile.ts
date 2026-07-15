import Phaser from "phaser";
import {
  FOOD_TYPES,
  MEGA,
  FOOD_RADIUS,
  MEGA_RADIUS,
  FoodType,
} from "../data/foods";
import { BIN } from "../config";

export interface Food {
  mo: Phaser.Physics.Matter.Image;
  type: FoodType;
  radius: number;
  mega: boolean;
}

/** A body counts as "settled" (grabbable / part of the pile) below this speed. */
const SETTLED_SPEED = 1.6;

/**
 * Collision padding: the physics body is a hair bigger than the visible disc,
 * so resting food keeps a thin gap between sprites — distinct balls that touch,
 * without a merged blob. Small so the pile still packs tightly.
 */
const BODY_PAD = 1;

/** The bin never gobbles below this many pieces, so there's always food to grab. */
const MIN_PILE = 10;

/**
 * Owns the physical pile of food inside the bin: spawning Matter bodies,
 * answering "what's grabbable in this column", and reporting the settled pile
 * height for overflow checks.
 */
export class FoodPile {
  private scene: Phaser.Scene;
  readonly items: Food[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  spawn(x: number, y: number, type: FoodType, mega = false): Food {
    const radius = mega ? MEGA_RADIUS : FOOD_RADIUS;
    // The texture is already the exact diameter, so we never scale the sprite
    // (scaling a Matter image shrinks its body). setCircle gives the body a
    // circle collider that matches the visual exactly.
    const mo = this.scene.matter.add.image(x, y, mega ? "mega" : "food");
    mo.setCircle(radius + BODY_PAD, {
      restitution: 0,
      // Light bodies + a little air drag so contacts resolve gently and the
      // pile bleeds off motion and sleeps, instead of the solver violently
      // shoving heavy overlapping bodies around every frame. High static
      // friction locks the load-bearing bottom row so it doesn't condense.
      friction: 0.5,
      frictionStatic: 0.9,
      frictionAir: 0.03,
      // Megas are lighter than normal food so they rest on top of the pile
      // instead of sinking and getting buried (a craved mega must stay grabbable).
      density: mega ? 0.0025 : 0.006,
    });
    // Sleep quickly after a nudge so re-settling can't visibly creep.
    (mo.body as MatterJS.BodyType).sleepThreshold = 30;
    mo.setTint(type.color);
    mo.setDepth(5);
    const food: Food = { mo, type, radius, mega };
    this.items.push(food);
    return food;
  }

  spawnRandomAt(x: number, y: number): Food {
    return this.spawn(x, y, Phaser.Utils.Array.GetRandom(FOOD_TYPES), false);
  }

  spawnMega(x: number, y: number): Food {
    return this.spawn(x, y, MEGA, true);
  }

  /** Topmost settled food whose x falls within the claw's column, or null. */
  grabTopAt(x: number, colHalf: number): Food | null {
    let best: Food | null = null;
    for (const f of this.items) {
      const b = f.mo.body as MatterJS.BodyType;
      const speed = Math.hypot(b.velocity.x, b.velocity.y);
      if (Math.abs(f.mo.x - x) < f.radius + colHalf && speed < SETTLED_SPEED) {
        if (!best || f.mo.y < best.mo.y) best = f;
      }
    }
    return best;
  }

  remove(f: Food): void {
    const i = this.items.indexOf(f);
    if (i >= 0) this.items.splice(i, 1);
    f.mo.destroy();
    // Food resting on the removed piece is asleep and won't notice its support
    // vanished — wake the pile so it falls to fill the gap instead of floating.
    this.wakeAll();
  }

  /** Wake every body so the pile re-settles (e.g. after food is removed). */
  private wakeAll(): void {
    // The raw Matter.js lib lives here at runtime but isn't in Phaser's types.
    const Sleeping = (
      Phaser.Physics.Matter as unknown as {
        Matter: { Sleeping: { set(b: MatterJS.BodyType, sleeping: boolean): void } };
      }
    ).Matter.Sleeping;
    for (const it of this.items) {
      Sleeping.set(it.mo.body as MatterJS.BodyType, false);
    }
  }

  /**
   * The monster "gobbles" n settled (non-mega) food chosen at RANDOM from
   * anywhere in the pile — the reward for satisfying a craving. Random (rather
   * than top-down) so it churns the whole pile instead of just clearing the
   * balls that were most recently dropped on top. Returns the cleared positions
   * so the scene can spark particles there.
   */
  gobble(n: number): { x: number; y: number }[] {
    const settled = this.items.filter((f) => {
      const b = f.mo.body as MatterJS.BodyType;
      return !f.mega && Math.hypot(b.velocity.x, b.velocity.y) < SETTLED_SPEED;
    });
    Phaser.Utils.Array.Shuffle(settled);
    // Never gobble the bin below a working minimum, so the player always has
    // food to grab instead of wasting empty drops to respawn a pile.
    const keepable = Math.max(0, this.items.length - MIN_PILE);
    const chosen = settled.slice(0, Math.min(n, keepable));
    const spots = chosen.map((f) => ({ x: f.mo.x, y: f.mo.y }));
    chosen.forEach((f) => this.remove(f));
    return spots;
  }

  /** Smallest y (highest point) among settled food — used for overflow. */
  settledTop(): number {
    let top: number = BIN.floor;
    for (const f of this.items) {
      const b = f.mo.body as MatterJS.BodyType;
      const speed = Math.hypot(b.velocity.x, b.velocity.y);
      if (speed < SETTLED_SPEED) top = Math.min(top, f.mo.y - f.radius);
    }
    return top;
  }

  count(): number {
    return this.items.length;
  }
}

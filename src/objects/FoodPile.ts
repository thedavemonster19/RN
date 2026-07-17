import Phaser from "phaser";
import {
  MAX_TIER,
  FoodType,
  foodColor,
  tierRadius,
  tierTexture,
} from "../data/foods";
import { BIN } from "../config";

export interface Food {
  mo: Phaser.Physics.Matter.Image;
  type: FoodType;
  tier: number;
  radius: number;
  /** Claimed by a merge this frame — ignore it for taps and further merges. */
  merging: boolean;
}

/** A body counts as "settled" (part of the pile) below this speed. */
const SETTLED_SPEED = 1.6;

/**
 * Collision padding: the physics body is a hair bigger than the visible disc,
 * so resting food keeps a thin gap between sprites — distinct balls that touch,
 * without a merged blob.
 */
const BODY_PAD = 1;

/** Extra slack on the merge test, so food that's merely touching still merges. */
const MERGE_SLACK = 3;

/**
 * Owns the physical pile of food in the bin: spawning Matter bodies, merging
 * matching food that touches (Suika-style), answering "what did the player
 * tap", and reporting the settled pile height for overflow.
 *
 * Merges are detected by a proximity sweep in update() rather than Matter's
 * collision events, so we never create/destroy bodies in the middle of a
 * physics step (and it also catches contacts that begin while bodies sleep).
 */
export class FoodPile {
  private scene: Phaser.Scene;
  readonly items: Food[] = [];

  /** Fired when two foods merge into the next tier up. */
  onMerge?: (x: number, y: number, type: FoodType, tier: number) => void;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  spawn(x: number, y: number, type: FoodType, tier: number): Food {
    const radius = tierRadius(tier);
    // The texture is already the exact diameter, so we never scale the sprite
    // (scaling a Matter image shrinks its body). setCircle gives the body a
    // collider that matches the visual exactly.
    const mo = this.scene.matter.add.image(x, y, tierTexture(tier));
    mo.setCircle(radius + BODY_PAD, {
      restitution: 0,
      // Light bodies + a little air drag so contacts resolve gently and the
      // pile bleeds off motion and sleeps, instead of the solver violently
      // shoving overlapping bodies around every frame.
      friction: 0.4,
      frictionStatic: 0.7,
      frictionAir: 0.02,
      density: 0.008,
    });
    // Sleep quickly after a nudge so re-settling can't visibly creep.
    (mo.body as MatterJS.BodyType).sleepThreshold = 24;
    mo.setTint(foodColor(type, tier));
    mo.setDepth(5);
    const food: Food = { mo, type, tier, radius, merging: false };
    this.items.push(food);
    return food;
  }

  /**
   * Merge pass. Food that matches on BOTH type and tier becomes one food of the
   * next tier; two at the top of the chain annihilate instead. Runs every frame
   * from the scene, and cascades naturally because a freshly-merged body gets
   * tested again on the following pass.
   */
  update(): void {
    for (let i = 0; i < this.items.length; i++) {
      const a = this.items[i];
      if (a.merging) continue;
      // Top-tier foods never merge (or pop). They used to annihilate, which
      // quietly incinerated 64 drops of volume for free and made the bin
      // unfillable. Now they're boulders: immovable until the monster takes
      // one, and feeding it shuts the mouth for a very long digestion —
      // letting the pile over-merge is the mistake that kills you.
      if (a.tier >= MAX_TIER) continue;
      for (let j = i + 1; j < this.items.length; j++) {
        const b = this.items[j];
        if (b.merging || b.tier !== a.tier || b.type.id !== a.type.id) continue;
        const dx = a.mo.x - b.mo.x;
        const dy = a.mo.y - b.mo.y;
        const reach = a.radius + b.radius + MERGE_SLACK;
        if (dx * dx + dy * dy > reach * reach) continue;

        a.merging = true;
        b.merging = true;
        const x = (a.mo.x + b.mo.x) / 2;
        const y = (a.mo.y + b.mo.y) / 2;
        const tier = a.tier;
        const type = a.type;
        this.destroy(a);
        this.destroy(b);

        this.spawn(x, y, type, tier + 1);
        this.onMerge?.(x, y, type, tier + 1);
        this.wakeAll();
        break; // `a` is gone — move on to the next food
      }
    }
  }

  /**
   * The food the player tapped: the topmost one under the point. Only what's
   * visible on the surface can be hit, so a buried food can't be plucked out —
   * you have to clear what's on top of it first.
   */
  foodAt(x: number, y: number): Food | null {
    let best: Food | null = null;
    for (const f of this.items) {
      if (f.merging) continue;
      const dx = f.mo.x - x;
      const dy = f.mo.y - y;
      if (dx * dx + dy * dy > f.radius * f.radius) continue;
      if (!best || f.mo.y < best.mo.y) best = f;
    }
    return best;
  }

  /** Take a food out of the pile (fed or pocketed) and let the pile re-settle. */
  remove(f: Food): void {
    this.destroy(f);
    this.wakeAll();
  }

  private destroy(f: Food): void {
    const i = this.items.indexOf(f);
    if (i >= 0) this.items.splice(i, 1);
    f.mo.destroy();
  }

  /**
   * Wake every body so the pile re-settles. Food resting on a piece that was
   * removed or merged is asleep and won't notice its support vanished — without
   * this it floats.
   */
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

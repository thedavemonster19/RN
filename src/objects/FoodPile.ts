import Phaser from "phaser";
import { MAX_TIER, FoodType, tierRadius, tierTexture } from "../data/foods";
import { BIN } from "../config";

export interface Food {
  mo: Phaser.Physics.Matter.Image;
  type: FoodType;
  tier: number;
  radius: number;
  /** Claimed by a merge this frame — ignore it for taps and further merges. */
  merging: boolean;
  /** Frames left of body grow-in (merged food inflates instead of appearing). */
  growing: number;
  /** Frames since it entered the world — see SETTLE_GRACE. */
  age: number;
  /** Consecutive frames spent below SETTLED_SPEED — see REST_FRAMES. */
  restFrames: number;
}

/** A body counts as "settled" (part of the pile) below this speed. */
const SETTLED_SPEED = 1.6;

/**
 * Frames a food must exist before it can count toward the pile height.
 *
 * A food spawns with zero velocity, so for its first frame it looks perfectly
 * "settled" — while sitting up at the rail, above the danger line. That made
 * the overflow warning flash on every single drop. Waiting a few frames lets
 * gravity get hold of it first.
 */
const SETTLE_GRACE = 8;

/**
 * Consecutive slow frames before a food counts as part of the pile.
 *
 * Instantaneous speed isn't enough: a food is momentarily motionless at the
 * apex of a bounce, and a piece shoved upward when a drop lands hangs still for
 * an instant at the top of its arc. Either would briefly register as a settled
 * food above the danger line and flash the overflow warning. Requiring a run of
 * quiet frames means only food that has genuinely come to rest counts.
 */
const REST_FRAMES = 6;

/**
 * Collision padding: the physics body is a hair bigger than the visible disc,
 * so resting food keeps a thin gap between sprites — distinct balls that touch,
 * without a merged blob.
 */
const BODY_PAD = 1;

/** Extra slack on the merge test, so food that's merely touching still merges. */
const MERGE_SLACK = 3;

/**
 * Frames over which a merged food's BODY inflates from GROW_START of its
 * radius to full size. A full-size body materialising inside a packed pile is
 * deeply overlapped with its neighbours, and Matter resolves deep overlap by
 * ejecting bodies — the "balls exploding upwards". Inflating pushes the
 * neighbours aside gradually instead. The sprite is full-size immediately;
 * only the collider grows.
 */
const GROW_FRAMES = 8;
const GROW_START = 0.55;

/**
 * Speed limits, in pixels per frame. These are the difference between food that
 * has weight and food that pings around like a pinball.
 *
 * MAX_SPEED is a terminal velocity. A drop falls ~380px from the rail, and
 * unclamped it arrived at 22px/frame (~1300px/s) — it didn't land on the pile so
 * much as detonate inside it. Capping the arrival speed is what makes a drop
 * read as heavy instead of frantic; it still accelerates normally, it just stops
 * gaining once it's moving fast enough to feel decisive.
 *
 * MAX_RISE is the one that actually fixes "they go flying". Food should fall
 * fast and never rocket upward, so the upward component is capped far harder
 * than the overall speed. Measured over 40 seeded fills, this cut the worst
 * upward launch from 8.2px/frame to 2.7 — while leaving the sideways shove
 * untouched at 52px (it was IDENTICAL across every upward cap tested, which is
 * the proof that launching and nudging are separable). That matters: shoving a
 * ball into place with a well-aimed drop is a real technique, so the fix had to
 * spend its damping on the vertical axis only.
 */
const MAX_SPEED = 16;
const MAX_RISE = 3;

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

  /** Bound so it can be removed again when the scene shuts down. */
  private readonly onAfterStep = () => this.clampSpeeds();
  /**
   * Held from construction rather than reached through `scene.matter` later:
   * by the time the scene's "shutdown" event fires, Phaser has already torn the
   * Matter plugin off the scene, so `scene.matter` is null and unhooking
   * through it throws — inside the shutdown sequence, which then never
   * finishes. That broke "Play again".
   */
  private readonly world: Phaser.Physics.Matter.World;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.world = scene.matter.world;
    // The speed limits MUST be applied after Matter integrates, not before.
    // Phaser runs scene.update() first and steps the physics world after it, so
    // clamping from update() always acted on the previous frame's velocities:
    // a collision could kick a food upward and it would move — and render — at
    // that speed for a full frame before being caught. Measured in the live
    // game, that leak let food reach 8.7px/frame upward against a cap of 3.
    this.world.on("afterupdate", this.onAfterStep);
    scene.events.once("shutdown", () => this.destroyPile());
    scene.events.once("destroy", () => this.destroyPile());
  }

  /** Drop the world listener so a restarted scene doesn't stack another one. */
  private destroyPile(): void {
    this.world?.off("afterupdate", this.onAfterStep);
  }

  /** (Re)build a food's circular collider at the given radius. setCircle
   *  recreates the body, so the material options and sleep tuning must be
   *  re-applied every time — this is the one place that knows them. */
  private setBody(mo: Phaser.Physics.Matter.Image, radius: number): void {
    mo.setCircle(radius + BODY_PAD, {
      // These are balls, and they should behave like it. The old values
      // (friction .4 / static .7) made the pile behave like sandbags: you
      // couldn't nudge a ball into position by dropping another one on it,
      // which is a real technique for lining up merges. Low friction lets them
      // roll and transmit a shove.
      //
      // Liveliness now comes from the low friction alone, not from bounce.
      // Zero, not a whisper. Even 0.06 meant every landing ended in a small
      // hop, and a bin full of small hops is exactly the "janky" read — food
      // that never quite commits to being at rest. Measured: dropping it to 0
      // cut the merge-time upward pop from 0.40 to 0.11px/frame and let the
      // pile settle in 27 frames instead of 38.
      restitution: 0,
      // Measured: at 0.4/0.7 (the old sandbag values) a dropped ball barely
      // moved its neighbour. At 0.06 it shoved it ~110px, clean across the bin
      // into the wall, which made stacking impossible. 0.12 lands at ~59px —
      // a decisive nudge you can aim with, that still comes to rest.
      friction: 0.12,
      // Static friction is what stops a RESTING pile from starting to slide;
      // kinetic friction (above) governs a ball that is already moving. Raising
      // only the static half calms the pile without costing the shove, which is
      // the whole reason kinetic stays low.
      //
      // Measured over 36 seeded runs: a merge used to disturb far-away food by
      // 4.50px on average (worst 44px), which is the "everything constantly
      // adjusting" look. At 0.6 that is 2.95px (worst 30px), resting jitter
      // falls from 0.11% to 0.00%, and the sideways shove is unchanged at
      // 51.6px. Raising kinetic friction instead would have worked too — 0.4
      // gave similar stability — but it halved the shove to 25px.
      frictionStatic: 0.6,
      frictionAir: 0.01,
      density: 0.0035,
    });
    // Sleep quickly once genuinely at rest, so a settled pile stops being
    // re-solved every frame — that constant re-solving is what reads as
    // rattling and squeezing.
    (mo.body as MatterJS.BodyType).sleepThreshold = 18;
  }

  spawn(
    x: number,
    y: number,
    type: FoodType,
    tier: number,
    growIn = false
  ): Food {
    const radius = tierRadius(tier);
    // The texture is already the exact diameter, so we never scale the sprite
    // (scaling a Matter image shrinks its body). setCircle gives the body a
    // collider that matches the visual exactly.
    const mo = this.scene.matter.add.image(x, y, tierTexture(tier));
    this.setBody(mo, growIn ? radius * GROW_START : radius);
    mo.setDepth(5);
    const food: Food = {
      mo,
      type,
      tier,
      radius,
      merging: false,
      growing: growIn ? GROW_FRAMES : 0,
      age: 0,
      restFrames: 0,
    };
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
    for (const f of this.items) {
      f.age++;
      const b = f.mo.body as MatterJS.BodyType;
      const speed = Math.hypot(b.velocity.x, b.velocity.y);
      // A sleeping body reports no velocity and is definitively at rest.
      f.restFrames = speed < SETTLED_SPEED || b.isSleeping ? f.restFrames + 1 : 0;
    }

    // Inflate freshly-merged bodies one step per frame. Rebuilding the collider
    // zeroes the body's velocity, which doubles as damping on the merge pop.
    for (const f of this.items) {
      if (f.growing <= 0) continue;
      f.growing--;
      const t = 1 - f.growing / GROW_FRAMES;
      this.setBody(f.mo, f.radius * (GROW_START + (1 - GROW_START) * t));
    }

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

        this.spawn(x, y, type, tier + 1, true);
        this.onMerge?.(x, y, type, tier + 1);
        this.wakeAll();
        break; // `a` is gone — move on to the next food
      }
    }
  }

  /**
   * Hold every food inside the speed limits (see MAX_SPEED / MAX_RISE).
   *
   * Sleeping bodies are skipped deliberately: they report no velocity anyway,
   * and calling setVelocity on one would wake it, which would keep the settled
   * pile permanently re-solving — the very rattling the sleeping is there to
   * stop.
   */
  private clampSpeeds(): void {
    for (const f of this.items) {
      // Defensive: this runs from a physics-world listener, so a pile belonging
      // to a scene that has gone away could in principle still be called. A
      // destroyed sprite has no body, and stepping over it is free.
      const b = f.mo?.body as MatterJS.BodyType | undefined;
      if (!b || b.isSleeping) continue;
      let { x: vx, y: vy } = b.velocity;
      const speed = Math.hypot(vx, vy);
      let clamped = false;
      if (speed > MAX_SPEED) {
        vx = (vx / speed) * MAX_SPEED;
        vy = (vy / speed) * MAX_SPEED;
        clamped = true;
      }
      // Negative y is upward.
      if (-vy > MAX_RISE) {
        vy = -MAX_RISE;
        clamped = true;
      }
      if (clamped) f.mo.setVelocity(vx, vy);
    }
  }

  /**
   * The food the player tapped: the topmost one under the point. Only what's
   * visible on the surface can be hit, so a buried food can't be plucked out —
   * you have to clear what's on top of it first.
   *
   * Hit-testing uses a floor of MIN_HIT so the smallest tiers stay tappable on
   * a phone — a tier-1 is only 12px across visually.
   */
  foodAt(x: number, y: number): Food | null {
    const MIN_HIT = 14;
    let best: Food | null = null;
    for (const f of this.items) {
      if (f.merging) continue;
      const hit = Math.max(f.radius, MIN_HIT);
      const dx = f.mo.x - x;
      const dy = f.mo.y - y;
      if (dx * dx + dy * dy > hit * hit) continue;
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

  /**
   * The highest food surface within a horizontal band around x — where a new
   * drop of radius r must spawn ABOVE. Spawning at the fixed rail height into
   * a pile that has grown up to meet it materialises the drop inside the top
   * food, and Matter answers deep overlap with a violent eject.
   */
  clearSpawnY(x: number, r: number, defaultY: number): number {
    let y = defaultY;
    for (const f of this.items) {
      if (Math.abs(f.mo.x - x) < f.radius + r) {
        y = Math.min(y, f.mo.y - f.radius - r - 4);
      }
    }
    return y;
  }

  /** Smallest y (highest point) among settled food — used for overflow. */
  settledTop(): number {
    let top: number = BIN.floor;
    for (const f of this.items) {
      if (f.age < SETTLE_GRACE) continue; // still on its way down
      if (f.restFrames < REST_FRAMES) continue; // bouncing or being jostled
      top = Math.min(top, f.mo.y - f.radius);
    }
    return top;
  }

  count(): number {
    return this.items.length;
  }
}

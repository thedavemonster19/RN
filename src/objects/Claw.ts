import Phaser from "phaser";
import { FoodPile, Food } from "./FoodPile";

/** What the scene decides to do with a just-grabbed piece. */
export type GrabResolution =
  | { stash: false }
  | { stash: true; x: number; y: number };

export interface ClawOpts {
  railY: number;
  floorY: number;
  aimMin: number;
  aimMax: number;
  colHalf: number;
  monster: { mouthX: number; mouthY: number };
  onEat: (food: Food) => void;
  /** Fires once the claw returns to idle after a dig (grabbed or not). */
  onCycleDone: () => void;
  /**
   * Called when a piece is grabbed. `wantStash` is the player's swipe intent;
   * the scene decides whether it can actually stash and returns the target.
   */
  resolveGrab: (food: Food, wantStash: boolean) => GrabResolution;
}

type ClawState = "idle" | "aim" | "descend" | "ascend" | "busy";

const DESCEND_SPEED = 640; // px/s
const ASCEND_SPEED = 780;
const TIP_OFFSET = 14;

/**
 * The claw: drag to aim while idle, release to drop. It descends, grabs the
 * topmost settled food in its column, lifts, and then either feeds it to the
 * monster (normal release) or flings it to the pocket (swipe-up release).
 * Kinematic so control feels crisp; the pile it digs into is the physics part.
 */
export class Claw {
  private scene: Phaser.Scene;
  private pile: FoodPile;
  private o: ClawOpts;
  private gfx: Phaser.GameObjects.Graphics;

  x: number;
  y: number;
  state: ClawState = "idle";
  private held: Food | null = null;
  private heldSprite?: Phaser.GameObjects.Image;
  private pendingStash = false;

  constructor(scene: Phaser.Scene, pile: FoodPile, o: ClawOpts) {
    this.scene = scene;
    this.pile = pile;
    this.o = o;
    this.x = (o.aimMin + o.aimMax) / 2;
    this.y = o.railY;
    this.gfx = scene.add.graphics().setDepth(10);
    this.draw();
  }

  press(x: number): void {
    if (this.state !== "idle") return;
    this.state = "aim";
    this.x = Phaser.Math.Clamp(x, this.o.aimMin, this.o.aimMax);
  }

  aim(x: number): void {
    if (this.state === "aim")
      this.x = Phaser.Math.Clamp(x, this.o.aimMin, this.o.aimMax);
  }

  /** Release the aim and drop. `stash` = the player swiped up (stash intent). */
  release(stash: boolean): void {
    if (this.state === "aim") {
      this.pendingStash = stash;
      this.state = "descend";
    }
  }

  update(delta: number): void {
    const s = delta / 1000;
    if (this.state === "descend") {
      this.y += DESCEND_SPEED * s;
      const target = this.pile.grabTopAt(this.x, this.o.colHalf);
      if (target && this.y + TIP_OFFSET >= target.mo.y - target.radius) {
        this.grab(target);
      } else if (this.y >= this.o.floorY - 22) {
        this.state = "ascend";
      }
    } else if (this.state === "ascend") {
      this.y -= ASCEND_SPEED * s;
      if (this.heldSprite && this.held) {
        this.heldSprite.setPosition(this.x, this.y + this.held.radius + 6);
      }
      if (this.y <= this.o.railY) {
        this.y = this.o.railY;
        if (this.held) {
          this.state = "busy";
          const r = this.o.resolveGrab(this.held, this.pendingStash);
          if (r.stash) this.animateStash(r.x, r.y);
          else this.deliver();
        } else {
          // Empty dig — still counts as a cycle (a refill drops).
          this.state = "idle";
          this.o.onCycleDone();
        }
      }
    }
    this.draw();
  }

  private finishCycle(): void {
    this.state = "idle";
    this.o.onCycleDone();
  }

  private grab(t: Food): void {
    this.held = t;
    const spr = this.scene.add
      .image(this.x, this.y + t.radius + 6, t.mega ? "mega" : "food")
      .setTint(t.type.color)
      .setDepth(11);
    this.heldSprite = spr;
    this.pile.remove(t);
    this.state = "ascend";
  }

  /** Fly the held piece to the pocket, then finish the cycle. */
  private animateStash(tx: number, ty: number): void {
    const spr = this.heldSprite!;
    this.held = null;
    this.heldSprite = undefined;
    this.scene.tweens.add({
      targets: spr,
      x: tx,
      y: ty,
      scale: 0.5,
      duration: 260,
      ease: "Quad.easeIn",
      onComplete: () => {
        spr.destroy();
        this.finishCycle();
      },
    });
  }

  /** Lob the held piece to the monster, feed it, then finish the cycle. */
  private deliver(): void {
    const spr = this.heldSprite!;
    const food = this.held!;
    this.held = null;
    this.heldSprite = undefined;

    const sx = spr.x;
    const sy = spr.y;
    const mx = this.o.monster.mouthX;
    const my = this.o.monster.mouthY;
    this.scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 620,
      ease: "Sine.easeInOut",
      onUpdate: (tw) => {
        const p = tw.getValue() ?? 0;
        spr.x = Phaser.Math.Linear(sx, mx, p);
        spr.y = Phaser.Math.Linear(sy, my, p) - Math.sin(p * Math.PI) * 80;
      },
      onComplete: () => {
        spr.destroy();
        this.o.onEat(food);
        this.finishCycle();
      },
    });
  }

  private draw(): void {
    const g = this.gfx;
    g.clear();
    const open = this.state === "idle" || this.state === "aim" ? 1 : 0.35;

    g.lineStyle(4, 0xffffff, 0.16);
    g.beginPath();
    g.moveTo(this.o.aimMin - 16, this.o.railY - 8);
    g.lineTo(this.o.aimMax + 16, this.o.railY - 8);
    g.strokePath();

    g.lineStyle(3, 0xcfd6ff, this.state === "aim" ? 0.8 : 0.45);
    g.beginPath();
    g.moveTo(this.x, this.o.railY - 8);
    g.lineTo(this.x, this.y);
    g.strokePath();

    g.lineStyle(4, 0xcfd6ff, 1);
    g.beginPath();
    g.moveTo(this.x - 3, this.y);
    g.lineTo(this.x - 12 * open - 5, this.y + 16);
    g.strokePath();
    g.beginPath();
    g.moveTo(this.x + 3, this.y);
    g.lineTo(this.x + 12 * open + 5, this.y + 16);
    g.strokePath();
    g.fillStyle(0xcfd6ff, 1);
    g.fillCircle(this.x, this.y - 2, 5);
  }
}

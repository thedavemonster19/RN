import Phaser from "phaser";
import { COLORS } from "../config";
import { tierRadius, tierTexture } from "../data/foods";
import { Spec } from "../systems/GameState";
import { CLAW_HEAD_ART, CLAW_CARRIAGE_ART } from "../data/clawArt";

/**
 * The claw: it holds the next food from the queue on the rail, and you aim it
 * left/right and release to drop.
 *
 * It deliberately cannot pick food back out of the bin and carry it around.
 * Free carrying let the player hand-sort the pile into guaranteed merges (and
 * drag food clean off the screen). Now your only control over merging is where
 * you choose to drop — everything after that is the pile's business.
 *
 * Three pieces: a CARRIAGE riding the rail, a CABLE, and the HEAD whose prongs
 * close around the waiting food. Carriage and head are painted textures (see
 * data/clawArt) because prongs need curves and a single outline; only the rail
 * and the cable are still Graphics, since they are literally straight lines.
 *
 * Purely visual/kinematic; the scene owns the rules.
 */
export class Claw {
  private scene: Phaser.Scene;
  private gfx: Phaser.GameObjects.Graphics;
  private railY: number;
  private aimMin: number;
  private aimMax: number;

  /** Where the claw sits on the rail. */
  x: number;
  /** The queued food waiting to be dropped. */
  private dispenser?: Phaser.GameObjects.Image;
  private head: Phaser.GameObjects.Image;
  private carriage: Phaser.GameObjects.Image;

  constructor(
    scene: Phaser.Scene,
    railY: number,
    aimMin: number,
    aimMax: number
  ) {
    this.scene = scene;
    this.railY = railY;
    this.aimMin = aimMin;
    this.aimMax = aimMax;
    this.x = (aimMin + aimMax) / 2;
    // The rail and cable sit behind the machinery.
    this.gfx = scene.add.graphics().setDepth(9);
    this.head = scene.add
      .image(this.x, railY, "clawHead")
      .setOrigin(CLAW_HEAD_ART.ox / CLAW_HEAD_ART.w, CLAW_HEAD_ART.oy / CLAW_HEAD_ART.h)
      .setDisplaySize(CLAW_HEAD_ART.w, CLAW_HEAD_ART.h)
      .setDepth(10);
    this.carriage = scene.add
      .image(this.x, railY - 8, "clawCarriage")
      .setOrigin(
        CLAW_CARRIAGE_ART.ox / CLAW_CARRIAGE_ART.w,
        CLAW_CARRIAGE_ART.oy / CLAW_CARRIAGE_ART.h
      )
      .setDisplaySize(CLAW_CARRIAGE_ART.w, CLAW_CARRIAGE_ART.h)
      .setDepth(12);
    this.draw();
  }

  /** Show which food is queued up to drop next. */
  setDispenser(spec: Spec): void {
    if (!this.dispenser) {
      this.dispenser = this.scene.add
        .image(0, 0, tierTexture(spec.tier))
        .setDepth(11);
    } else {
      this.dispenser.setTexture(tierTexture(spec.tier));
    }
    this.dispenser.setAlpha(1).setVisible(true);
    this.layout(spec);
  }

  /** Slide the claw (and the food it's about to drop) along the rail. */
  aim(x: number, spec: Spec): void {
    this.x = Phaser.Math.Clamp(x, this.aimMin, this.aimMax);
    this.layout(spec);
  }

  /**
   * Put every piece where the current food size says it goes: the food hangs
   * below the rail, and the head rides just above it with its prongs sized to
   * close around that food.
   */
  private layout(spec: Spec): void {
    const r = tierRadius(spec.tier);
    // Only ~58px exist between the rail and the top of the bin, so the food
    // hangs close under the rail and the claw grips it from above rather than
    // floating over it.
    const foodY = this.railY + 10 + r;
    this.dispenser?.setPosition(this.x, foodY);
    // The claw opens a little for bigger food: prongs belly out to ±32 design
    // units, so this keeps them just outside the food's own radius.
    const s = Phaser.Math.Clamp((r + 14) / 40, 0.6, 1.0);
    this.head
      .setDisplaySize(CLAW_HEAD_ART.w * s, CLAW_HEAD_ART.h * s)
      .setPosition(this.x, foodY - r - 6);
    this.carriage.setPosition(this.x, this.railY - 8);
    // Behind the carriage when it would poke out the top, in front otherwise —
    // keeps the hub tucked into the trolley rather than crossing it.
    this.head.setDepth(10);
    this.draw();
  }

  private draw(): void {
    const g = this.gfx;
    g.clear();

    // the rail
    g.lineStyle(5, COLORS.ink, 0.22);
    g.beginPath();
    g.moveTo(this.aimMin - 16, this.railY - 8);
    g.lineTo(this.aimMax + 16, this.railY - 8);
    g.strokePath();

    // the cable, from the carriage's pulley down to the head's socket
    g.lineStyle(3, 0x7a5c48, 1);
    g.beginPath();
    g.moveTo(this.x, this.railY + 4);
    g.lineTo(this.x, this.head.y);
    g.strokePath();
  }
}

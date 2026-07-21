import Phaser from "phaser";
import { tierRadius, tierTexture } from "../data/foods";
import { Spec } from "../systems/GameState";

/**
 * The claw: it holds the next food from the queue on the rail, and you aim it
 * left/right and release to drop.
 *
 * It deliberately cannot pick food back out of the bin and carry it around.
 * Free carrying let the player hand-sort the pile into guaranteed merges (and
 * drag food clean off the screen). Now your only control over merging is where
 * you choose to drop — everything after that is the pile's business.
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
    this.gfx = scene.add.graphics().setDepth(10);
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
    this.dispenser
      .setPosition(this.x, this.railY + 6 + tierRadius(spec.tier))
      .setVisible(true);
    this.draw();
  }

  /** Slide the claw (and the food it's about to drop) along the rail. */
  aim(x: number, spec: Spec): void {
    this.x = Phaser.Math.Clamp(x, this.aimMin, this.aimMax);
    this.dispenser?.setPosition(this.x, this.railY + 6 + tierRadius(spec.tier));
    this.draw();
  }

  private draw(): void {
    const g = this.gfx;
    g.clear();

    // the rail
    g.lineStyle(4, 0xffffff, 0.16);
    g.beginPath();
    g.moveTo(this.aimMin - 16, this.railY - 8);
    g.lineTo(this.aimMax + 16, this.railY - 8);
    g.strokePath();

    // the arm reaching down to the food it's about to drop
    const d = this.dispenser;
    const tipX = d && d.visible ? d.x : this.x;
    const tipY = d && d.visible ? d.y - 10 : this.railY + 6;

    g.lineStyle(3, 0xcfd6ff, 0.5);
    g.beginPath();
    g.moveTo(tipX, this.railY - 8);
    g.lineTo(tipX, tipY);
    g.strokePath();

    // the grabber
    g.lineStyle(4, 0xcfd6ff, 1);
    g.beginPath();
    g.moveTo(tipX - 3, tipY);
    g.lineTo(tipX - 17, tipY + 14);
    g.strokePath();
    g.beginPath();
    g.moveTo(tipX + 3, tipY);
    g.lineTo(tipX + 17, tipY + 14);
    g.strokePath();
    g.fillStyle(0xcfd6ff, 1);
    g.fillCircle(tipX, tipY - 2, 5);
  }
}

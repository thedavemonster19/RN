import Phaser from "phaser";
import { FOOD_RADIUS, MEGA_RADIUS } from "../data/foods";

/**
 * Generates placeholder textures at runtime, then hands off to the game.
 * Textures are made at the exact food diameter so the sprite never needs
 * scaling (scaling a Matter image also shrinks its body — the bug that made
 * food look "merged").
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super("Boot");
  }

  create() {
    this.makeDisc("food", FOOD_RADIUS);
    this.makeDisc("mega", MEGA_RADIUS);
    this.scene.start("Menu");
  }

  /** A white disc (tinted per food) with a soft dark rim so piled food reads. */
  private makeDisc(key: string, r: number) {
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(r, r, r - 2);
    g.lineStyle(3, 0x000000, 0.22);
    g.strokeCircle(r, r, r - 2);
    g.generateTexture(key, r * 2, r * 2);
    g.destroy();
  }
}

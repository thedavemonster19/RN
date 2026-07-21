import Phaser from "phaser";
import { TIER_RADII } from "../data/foods";
import { paintFood } from "../data/foodArt";

/**
 * Paints the food textures at runtime, then hands off to the game.
 *
 * One texture per tier, made at that tier's exact diameter so the sprite never
 * needs scaling (scaling a Matter image also shrinks its body — the bug that
 * made food look "merged"). The artwork itself lives in data/foodArt.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super("Boot");
  }

  create() {
    TIER_RADII.forEach((r, i) => this.makeFood(`food${i + 1}`, i + 1, r));
    this.scene.start("Menu");
  }

  /** One tier of food, painted into a canvas texture at its true size. */
  private makeFood(key: string, tier: number, r: number) {
    const size = r * 2;
    const tex = this.textures.createCanvas(key, size, size);
    if (!tex) return;
    const ctx = tex.getContext();
    ctx.clearRect(0, 0, size, size);
    paintFood(ctx, tier, r);
    tex.refresh();
  }
}

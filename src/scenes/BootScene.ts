import Phaser from "phaser";
import { TIER_RADII } from "../data/foods";
import { paintFood } from "../data/foodArt";
import { FOOD_SHEET, SHEET_CELL, SHEET_COLS } from "../data/foodSheet";

/**
 * Builds one food texture per tier, then hands off to the game.
 *
 * Each texture is made at that tier's exact diameter so the sprite is never
 * scaled — scaling a Matter image scales its collider too, which is the bug
 * that once made food look permanently "merged". So the artwork is resampled
 * into eight sizes here rather than one sprite being stretched at runtime.
 *
 * The sheet is decoded with a plain Image rather than through Phaser's loader.
 * Handing the loader a ~143KB data URI silently produced no texture at all and
 * fell through to the fallback art, with nothing on the console; decoding it
 * directly is both simpler and one less thing between the artwork and the
 * screen. If the decode ever does fail — WebP is the one format assumption we
 * make — we paint the vector art in data/foodArt instead, so the game still
 * has food rather than eight blank squares.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super("Boot");
  }

  create() {
    const img = new Image();
    img.onload = () => this.finish(img);
    img.onerror = () => this.finish(null);
    img.src = FOOD_SHEET;
  }

  private finish(sheet: HTMLImageElement | null): void {
    const usable = sheet && sheet.width > SHEET_CELL ? sheet : null;
    TIER_RADII.forEach((r, i) => this.makeFood(`food${i + 1}`, i + 1, r, usable));
    this.scene.start("Menu");
  }

  /** One tier of food, drawn into a canvas texture at its true size. */
  private makeFood(
    key: string,
    tier: number,
    r: number,
    sheet: HTMLImageElement | null
  ) {
    const size = r * 2;
    if (this.textures.exists(key)) this.textures.remove(key);
    const tex = this.textures.createCanvas(key, size, size);
    if (!tex) return;
    const ctx = tex.getContext();
    ctx.clearRect(0, 0, size, size);

    if (sheet) {
      const col = (tier - 1) % SHEET_COLS;
      const row = Math.floor((tier - 1) / SHEET_COLS);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(
        sheet,
        col * SHEET_CELL,
        row * SHEET_CELL,
        SHEET_CELL,
        SHEET_CELL,
        0,
        0,
        size,
        size
      );
    } else {
      paintFood(ctx, tier, r);
    }
    tex.refresh();
  }
}

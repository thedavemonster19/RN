import Phaser from "phaser";
import { TIER_RADII } from "../data/foods";
import { paintFood } from "../data/foodArt";
import { FOOD_SHEET, SHEET_CELL, SHEET_COLS } from "../data/foodSheet";
import { loadUiFont } from "../data/uiFont";

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
    const sheet = new Promise<HTMLImageElement | null>((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = FOOD_SHEET;
    });
    // The FONT has to be ready before any Text exists. Phaser rasterises a
    // Text to a texture the moment it is constructed, so a webfont that
    // arrives even one frame late leaves every label baked in the fallback
    // face — and nothing ever re-renders them. Both waits run together; a
    // failure of either resolves rather than rejects, so the game always boots.
    void Promise.all([sheet, loadUiFont()]).then(([img]) => this.finish(img));
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

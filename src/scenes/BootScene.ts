import Phaser from "phaser";
import { TIER_RADII } from "../data/foods";
import { paintFood } from "../data/foodArt";
import { FOOD_SHEET, SHEET_CELL, SHEET_COLS } from "../data/foodSheet";
import { loadUiFont } from "../data/uiFont";
import { REF_ART, paintRef, refKey } from "../data/refArt";
import { BODY_ART, paintMonsterBody } from "../data/monsterArt";

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
    this.makeScaleRefs();
    this.makeMonsterBody();
    this.scene.start("Menu");
  }

  /**
   * The monster's body, painted once at high resolution.
   *
   * 4x the design size: the body is shown up to ~171 design units wide and the
   * canvas renders at up to 3 device pixels per game pixel, so anything less is
   * soft on a phone. The face is NOT baked in — it changes per expression.
   */
  private makeMonsterBody(): void {
    const SCALE = 4;
    const key = "monsterBody";
    if (this.textures.exists(key)) this.textures.remove(key);
    const tex = this.textures.createCanvas(
      key,
      BODY_ART.w * SCALE,
      BODY_ART.h * SCALE
    );
    if (!tex) return;
    const ctx = tex.getContext();
    ctx.clearRect(0, 0, BODY_ART.w * SCALE, BODY_ART.h * SCALE);
    paintMonsterBody(ctx, SCALE);
    tex.refresh();
  }

  /**
   * Paint the scale-reference illustrations and crop each to its opaque bounds.
   *
   * Cropping is what makes the sizing honest: the sprite becomes the artwork
   * itself, so setting its display height sets the OBJECT's height. Without it a
   * short wide car and a tall narrow tower drawn in the same square box would
   * come out the same height on screen.
   *
   * Painted at 512 because the largest reference is shown ~142 game px tall and
   * the canvas renders at up to 3x device pixels — anything smaller is visibly
   * soft on a phone.
   */
  private makeScaleRefs(): void {
    const S = 512;
    const scratch = document.createElement("canvas");
    scratch.width = S;
    scratch.height = S;
    const sctx = scratch.getContext("2d", { willReadFrequently: true });
    if (!sctx) return;

    REF_ART.forEach((_art, i) => {
      sctx.clearRect(0, 0, S, S);
      paintRef(sctx, i, S);

      const data = sctx.getImageData(0, 0, S, S).data;
      let x0 = S;
      let y0 = S;
      let x1 = -1;
      let y1 = -1;
      for (let y = 0; y < S; y++) {
        for (let x = 0; x < S; x++) {
          if (data[(y * S + x) * 4 + 3] < 8) continue;
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
      if (x1 < 0) return; // painted nothing — leave the texture absent

      const w = x1 - x0 + 1;
      const h = y1 - y0 + 1;
      const key = refKey(i);
      if (this.textures.exists(key)) this.textures.remove(key);
      const tex = this.textures.createCanvas(key, w, h);
      if (!tex) return;
      tex.getContext().drawImage(scratch, x0, y0, w, h, 0, 0, w, h);
      tex.refresh();
    });
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

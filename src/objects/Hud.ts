import Phaser from "phaser";
import { GAME, COLORS } from "../config";
import { GameState, Spec } from "../systems/GameState";
import { milestoneName } from "../data/milestones";
import { MAX_TIER, foodColor, tierTexture } from "../data/foods";

const FONT = "system-ui, -apple-system, sans-serif";

/**
 * A HUD disc standing in for a food. Real discs range from 22px to 124px
 * across, which won't fit a side panel, so these are drawn on a squashed scale
 * that still reads bigger-tier-is-bigger. Colour is the food's type.
 */
function panelDiameter(tier: number): number {
  return 20 + ((tier - 1) / (MAX_TIER - 1)) * 24;
}

function paintDisc(img: Phaser.GameObjects.Image, spec: Spec): void {
  img.setTexture(tierTexture(spec.tier));
  img.setTint(foodColor(spec.type, spec.tier));
  img.setDisplaySize(panelDiameter(spec.tier), panelDiameter(spec.tier));
}

/**
 * On-canvas HUD: size/score header, mood + growth bars, what the monster WANTS
 * (type AND size, with the cravings queued behind it), the queue of food you
 * get to drop, the streak, and the overflow warning. Placeholder styling for
 * the art pass; reads everything live from GameState.
 */
export class Hud {
  private state: GameState;

  private sizeText: Phaser.GameObjects.Text;
  private scoreText: Phaser.GameObjects.Text;
  private comboText: Phaser.GameObjects.Text;
  private multText: Phaser.GameObjects.Text;
  private warnText: Phaser.GameObjects.Text;
  private bars: Phaser.GameObjects.Graphics;

  private wantDisc: Phaser.GameObjects.Image;
  private wantLabel: Phaser.GameObjects.Text;
  private cravingDiscs: Phaser.GameObjects.Image[] = [];
  private dropDiscs: Phaser.GameObjects.Image[] = [];

  /** Seconds left before overflow ends the game, or null when safe. */
  overflowCountdown: number | null = null;

  constructor(scene: Phaser.Scene, state: GameState) {
    this.state = state;
    const depth = 20;

    this.sizeText = scene.add
      .text(16, 18, "", { fontFamily: FONT, fontSize: "16px", color: "#eaf0ff" })
      .setDepth(depth);
    this.scoreText = scene.add
      .text(GAME.WIDTH - 16, 14, "", {
        fontFamily: FONT,
        fontSize: "24px",
        fontStyle: "500",
        color: "#eaf0ff",
      })
      .setOrigin(1, 0)
      .setDepth(depth);

    // Mood: how precisely you've been feeding. A bonus and a face, never a
    // fail state — nothing drains it over time, so the game stays unhurried.
    scene.add
      .text(16, 46, "MOOD", { fontFamily: FONT, fontSize: "10px", color: "#9aa3d0" })
      .setDepth(depth);
    this.multText = scene.add
      .text(GAME.WIDTH - 16, 44, "", {
        fontFamily: FONT,
        fontSize: "14px",
        fontStyle: "500",
        color: "#37e0d0",
      })
      .setOrigin(1, 0)
      .setDepth(depth);
    this.comboText = scene.add
      .text(GAME.WIDTH / 2, 76, "", {
        fontFamily: FONT,
        fontSize: "13px",
        color: "#ff9d5c",
      })
      .setOrigin(0.5)
      .setDepth(depth);
    this.warnText = scene.add
      .text(GAME.WIDTH / 2, 216, "", {
        fontFamily: FONT,
        fontSize: "15px",
        fontStyle: "500",
        color: "#ff6b7d",
      })
      .setOrigin(0.5, 1)
      .setDepth(depth)
      .setVisible(false);

    this.bars = scene.add.graphics().setDepth(depth);

    // WANTS panel (right): the exact food the monster will accept, and the
    // cravings queued behind it so the player can build toward them in advance.
    const px = GAME.WIDTH - 30;
    const panel = scene.add.graphics().setDepth(depth - 1);
    panel.fillStyle(0xffffff, 0.06);
    panel.fillRoundedRect(px - 26, 100, 52, 210, 12);
    scene.add
      .text(px, 108, "WANTS", { fontFamily: FONT, fontSize: "10px", color: "#9aa3d0" })
      .setOrigin(0.5)
      .setDepth(depth);
    this.wantDisc = scene.add.image(px, 140, "food1").setDepth(depth);
    this.wantLabel = scene.add
      .text(px, 140, "", {
        fontFamily: FONT,
        fontSize: "13px",
        fontStyle: "700",
        color: "#1b1f3d",
      })
      .setOrigin(0.5)
      .setDepth(depth + 1);
    scene.add
      .text(px, 172, "THEN", { fontFamily: FONT, fontSize: "10px", color: "#9aa3d0" })
      .setOrigin(0.5)
      .setDepth(depth);
    this.cravingDiscs = [200, 236, 272].map((qy) =>
      scene.add.image(px, qy, "food1").setAlpha(0.75).setDepth(depth)
    );

    // DROPS panel (left): the food you're about to drop, and what follows.
    const dx = 30;
    const dpanel = scene.add.graphics().setDepth(depth - 1);
    dpanel.fillStyle(0xffffff, 0.06);
    dpanel.fillRoundedRect(dx - 26, 200, 52, 150, 12);
    scene.add
      .text(dx, 208, "DROPS", { fontFamily: FONT, fontSize: "10px", color: "#9aa3d0" })
      .setOrigin(0.5)
      .setDepth(depth);
    this.dropDiscs = [236, 268, 298, 326].map((qy, i) =>
      scene.add
        .image(dx, qy, "food1")
        .setAlpha(i === 0 ? 1 : 0.6)
        .setDepth(depth)
    );
  }

  update(): void {
    const s = this.state;
    this.sizeText.setText(`Growing to: ${milestoneName(s.milestone)}`);
    this.scoreText.setText(`${s.score}`);
    this.multText.setText(`×${(s.comboMult * s.moodMult).toFixed(1)}`);
    this.comboText.setText(
      s.combo >= 2 ? `streak x${s.combo}  ·  ×${s.comboMult.toFixed(1)} score` : ""
    );

    paintDisc(this.wantDisc, s.craving);
    this.wantLabel.setText(`${s.craving.tier}`);
    s.cravingQueue.forEach((c, i) => {
      const d = this.cravingDiscs[i];
      if (d) paintDisc(d, c);
    });
    s.dropQueue.forEach((c, i) => {
      const d = this.dropDiscs[i];
      if (d) paintDisc(d, c);
    });

    if (this.overflowCountdown !== null) {
      this.warnText
        .setText(`Overflow! Clear the bin — ${this.overflowCountdown}`)
        .setVisible(true);
    } else {
      this.warnText.setVisible(false);
    }

    const g = this.bars;
    g.clear();

    // mood bar (the precision bonus gauge)
    const moodColor =
      s.mood > 60 ? COLORS.teal : s.mood > 30 ? COLORS.amber : COLORS.coral;
    g.fillStyle(0xffffff, 0.14);
    g.fillRoundedRect(58, 44, 190, 12, 6);
    g.fillStyle(moodColor, 1);
    g.fillRoundedRect(58, 44, Math.max(3, (190 * s.mood) / 100), 12, 6);

    // growth bar
    const bw = GAME.WIDTH - 32;
    g.fillStyle(0xffffff, 0.14);
    g.fillRoundedRect(16, 62, bw, 9, 4);
    g.fillStyle(COLORS.teal, 1);
    g.fillRoundedRect(16, 62, Math.max(3, bw * s.growthProgress), 9, 4);
  }
}

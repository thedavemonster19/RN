import Phaser from "phaser";
import { GAME, COLORS } from "../config";
import { GameState } from "../systems/GameState";
import { milestoneName } from "../data/milestones";
import { MEGA } from "../data/foods";

const FONT = "system-ui, -apple-system, sans-serif";

/**
 * On-canvas HUD: size/score header, a mood meter (which is also the score
 * multiplier), the growth bar, the craving thought bubble by the monster, and
 * the overflow warning. Placeholder styling for the art pass; reads everything
 * live from GameState.
 */
export class Hud {
  private state: GameState;

  private sizeText: Phaser.GameObjects.Text;
  private scoreText: Phaser.GameObjects.Text;
  private multText: Phaser.GameObjects.Text;
  private comboText: Phaser.GameObjects.Text;
  private warnText: Phaser.GameObjects.Text;
  private bars: Phaser.GameObjects.Graphics;
  private bubbleDisc: Phaser.GameObjects.Image;
  private queueDiscs: Phaser.GameObjects.Image[] = [];

  /** Seconds left before overflow ends the game, or null when safe. */
  overflowCountdown: number | null = null;

  constructor(scene: Phaser.Scene, state: GameState) {
    this.state = state;
    const depth = 20;

    this.sizeText = scene.add
      .text(16, 20, "", { fontFamily: FONT, fontSize: "18px", color: "#eaf0ff" })
      .setDepth(depth);
    this.scoreText = scene.add
      .text(GAME.WIDTH - 16, 18, "", {
        fontFamily: FONT,
        fontSize: "24px",
        fontStyle: "500",
        color: "#eaf0ff",
      })
      .setOrigin(1, 0)
      .setDepth(depth);

    scene.add
      .text(16, 54, "MOOD", { fontFamily: FONT, fontSize: "12px", color: "#9aa3d0" })
      .setDepth(depth);
    this.multText = scene.add
      .text(GAME.WIDTH - 16, 52, "", {
        fontFamily: FONT,
        fontSize: "15px",
        fontStyle: "500",
        color: "#37e0d0",
      })
      .setOrigin(1, 0)
      .setDepth(depth);
    this.comboText = scene.add
      .text(GAME.WIDTH / 2, 92, "", {
        fontFamily: FONT,
        fontSize: "14px",
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

    // Craving preview panel (right side) — what it wants now and the queue
    // ahead, Tetris-style, so the player can plan digs several moves out.
    const px = GAME.WIDTH - 34;
    const panel = scene.add.graphics().setDepth(depth - 1);
    panel.fillStyle(0xffffff, 0.06);
    panel.fillRoundedRect(px - 26, 100, 52, 208, 12);
    scene.add
      .text(px, 110, "WANTS", { fontFamily: FONT, fontSize: "10px", color: "#9aa3d0" })
      .setOrigin(0.5)
      .setDepth(depth);
    this.bubbleDisc = scene.add
      .image(px, 134, "food")
      .setTint(state.craving.color)
      .setDepth(depth);
    scene.add
      .text(px, 162, "NEXT", { fontFamily: FONT, fontSize: "10px", color: "#9aa3d0" })
      .setOrigin(0.5)
      .setDepth(depth);
    this.queueDiscs = [186, 218, 250].map((qy, i) =>
      scene.add
        .image(px, qy, "food")
        .setScale(0.62)
        .setTint(state.cravingQueue[i].color)
        .setDepth(depth)
    );
  }

  update(): void {
    const s = this.state;
    this.sizeText.setText(`Growing to: ${milestoneName(s.milestone)}`);
    this.scoreText.setText(`${s.score}`);
    this.multText.setText(`x${s.moodMult.toFixed(1)}`);
    this.comboText.setText(
      s.combo >= 2
        ? `streak x${s.combo}  ·  ×${s.comboMult.toFixed(1)} score${
            s.streakShield ? "  🛡" : ""
          }`
        : ""
    );
    // Show the big treat as a larger gold disc when it's what's wanted.
    const wantMega = s.craving.id === MEGA.id;
    this.bubbleDisc
      .setTexture(wantMega ? "mega" : "food")
      .setScale(wantMega ? 0.82 : 1)
      .setTint(s.craving.color);
    s.cravingQueue.forEach((c, i) => {
      const d = this.queueDiscs[i];
      if (!d) return;
      const m = c.id === MEGA.id;
      d.setTexture(m ? "mega" : "food")
        .setScale(m ? 0.5 : 0.62)
        .setTint(c.color);
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

    // mood bar (doubles as the score multiplier gauge)
    const moodColor =
      s.mood > 50 ? COLORS.teal : s.mood > 25 ? COLORS.amber : COLORS.danger;
    g.fillStyle(0xffffff, 0.14);
    g.fillRoundedRect(64, 50, 180, 15, 7);
    g.fillStyle(moodColor, 1);
    g.fillRoundedRect(64, 50, Math.max(3, (180 * s.mood) / 100), 15, 7);

    // growth bar (full width, taller)
    const bw = GAME.WIDTH - 32;
    g.fillStyle(0xffffff, 0.14);
    g.fillRoundedRect(16, 74, bw, 12, 6);
    g.fillStyle(COLORS.teal, 1);
    g.fillRoundedRect(16, 74, Math.max(3, bw * s.growthProgress), 12, 6);
  }
}

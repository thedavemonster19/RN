import Phaser from "phaser";
import { GAME } from "../config";
import { milestoneName } from "../data/milestones";
import { GameOverReason } from "../systems/GameState";

interface GameOverData {
  score: number;
  milestone: number;
  reason: GameOverReason;
}

export class GameOverScene extends Phaser.Scene {
  constructor() {
    super("GameOver");
  }

  create(data: GameOverData) {
    const { WIDTH, HEIGHT } = GAME;
    const font = "system-ui, -apple-system, sans-serif";

    this.add
      .rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x06081a, 0.86)
      .setOrigin(0.5);

    const reasonText = "The bin overflowed.";

    this.add
      .text(WIDTH / 2, HEIGHT / 2 - 90, "Game over", {
        fontFamily: font,
        fontSize: "30px",
        fontStyle: "500",
        color: "#ffffff",
      })
      .setOrigin(0.5);
    this.add
      .text(WIDTH / 2, HEIGHT / 2 - 48, reasonText, {
        fontFamily: font,
        fontSize: "14px",
        color: "#aeb6e6",
      })
      .setOrigin(0.5);
    this.add
      .text(WIDTH / 2, HEIGHT / 2 + 2, `Score ${data.score}`, {
        fontFamily: font,
        fontSize: "26px",
        fontStyle: "500",
        color: "#ffe08a",
      })
      .setOrigin(0.5);
    this.add
      .text(
        WIDTH / 2,
        HEIGHT / 2 + 40,
        `You reached ${milestoneName(data.milestone)} size`,
        { fontFamily: font, fontSize: "15px", color: "#aeb6e6" }
      )
      .setOrigin(0.5);

    const again = this.add
      .text(WIDTH / 2, HEIGHT / 2 + 110, "Tap to play again", {
        fontFamily: font,
        fontSize: "19px",
        fontStyle: "500",
        color: "#37e0d0",
      })
      .setOrigin(0.5);
    this.tweens.add({
      targets: again,
      alpha: 0.4,
      duration: 700,
      yoyo: true,
      repeat: -1,
    });

    // Small delay so the tap that ended the game doesn't instantly restart.
    this.time.delayedCall(400, () => {
      this.input.once("pointerdown", () => {
        this.scene.stop();
        this.scene.get("Game").scene.restart();
      });
    });
  }
}

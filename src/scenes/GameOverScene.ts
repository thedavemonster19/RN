import Phaser from "phaser";
import { GAME } from "../config";
import { milestoneName } from "../data/milestones";
import { GameOverReason } from "../systems/GameState";
import { Save } from "../systems/Save";
import { makeButton } from "../objects/Button";

const FONT = "system-ui, -apple-system, sans-serif";

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
    const name = Save.name || "Your monster";
    const isBest = Save.recordScore(data.score);

    this.add
      .rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x06081a, 0.86)
      .setOrigin(0.5);

    this.add
      .text(WIDTH / 2, HEIGHT / 2 - 130, "Game over", {
        fontFamily: FONT,
        fontSize: "30px",
        fontStyle: "500",
        color: "#ffffff",
      })
      .setOrigin(0.5);
    this.add
      .text(WIDTH / 2, HEIGHT / 2 - 92, "The bin overflowed.", {
        fontFamily: FONT,
        fontSize: "14px",
        color: "#aeb6e6",
      })
      .setOrigin(0.5);

    this.add
      .text(WIDTH / 2, HEIGHT / 2 - 42, `${data.score}`, {
        fontFamily: FONT,
        fontSize: "40px",
        fontStyle: "600",
        color: "#ffe08a",
      })
      .setOrigin(0.5);
    this.add
      .text(
        WIDTH / 2,
        HEIGHT / 2 - 6,
        isBest ? "New best!" : `Best  ${Save.best}`,
        {
          fontFamily: FONT,
          fontSize: "14px",
          fontStyle: isBest ? "600" : "400",
          color: isBest ? "#37e0d0" : "#9aa3d0",
        }
      )
      .setOrigin(0.5);

    this.add
      .text(
        WIDTH / 2,
        HEIGHT / 2 + 32,
        `${name} reached ${milestoneName(data.milestone)} size`,
        { fontFamily: FONT, fontSize: "15px", color: "#aeb6e6" }
      )
      .setOrigin(0.5);

    // Delay the buttons so the tap that ended the run can't hit one instantly.
    this.time.delayedCall(400, () => {
      makeButton(this, {
        x: WIDTH / 2,
        y: HEIGHT / 2 + 100,
        label: "Play again",
        primary: true,
        onClick: () => {
          this.scene.stop();
          this.scene.get("Game").scene.restart();
        },
      });
      makeButton(this, {
        x: WIDTH / 2,
        y: HEIGHT / 2 + 164,
        label: "Main menu",
        onClick: () => {
          this.scene.stop();
          this.scene.stop("Game");
          this.scene.start("Menu");
        },
      });
    });
  }
}

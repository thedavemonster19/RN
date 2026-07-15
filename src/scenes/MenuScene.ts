import Phaser from "phaser";
import { GAME, COLORS } from "../config";

export class MenuScene extends Phaser.Scene {
  constructor() {
    super("Menu");
  }

  create() {
    const { WIDTH, HEIGHT } = GAME;
    const font = "system-ui, -apple-system, sans-serif";

    const g = this.add.graphics();
    g.fillGradientStyle(
      COLORS.bgTop,
      COLORS.bgTop,
      COLORS.bgBottom,
      COLORS.bgBottom,
      1
    );
    g.fillRect(0, 0, WIDTH, HEIGHT);

    this.add
      .text(WIDTH / 2, HEIGHT / 2 - 120, "🦖", { fontSize: "72px" })
      .setOrigin(0.5);
    this.add
      .text(WIDTH / 2, HEIGHT / 2 - 30, "Monster Muncher", {
        fontFamily: font,
        fontSize: "32px",
        fontStyle: "500",
        color: "#eaf0ff",
      })
      .setOrigin(0.5);
    this.add
      .text(
        WIDTH / 2,
        HEIGHT / 2 + 16,
        "Dig for the food it craves.\nKeep it happy, keep the bin clear.",
        {
          fontFamily: font,
          fontSize: "15px",
          color: "#9aa3d0",
          align: "center",
          lineSpacing: 6,
        }
      )
      .setOrigin(0.5);

    const play = this.add
      .text(WIDTH / 2, HEIGHT / 2 + 110, "Tap to play", {
        fontFamily: font,
        fontSize: "20px",
        fontStyle: "500",
        color: "#37e0d0",
      })
      .setOrigin(0.5);
    this.tweens.add({
      targets: play,
      alpha: 0.4,
      duration: 700,
      yoyo: true,
      repeat: -1,
    });

    this.input.once("pointerdown", () => this.scene.start("Game"));
  }
}

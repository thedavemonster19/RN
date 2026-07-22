import Phaser from "phaser";
import { GAME, COLORS, UI_FONT, TEXT_RES } from "../config";
import { Monster } from "../objects/Monster";
import { makeButton } from "../objects/Button";
import { Save } from "../systems/Save";

const FONT = UI_FONT;

/**
 * Customisation — a live preview of your monster and, for now, a placeholder
 * for what you'll be able to change about it.
 *
 * Deliberately a shell: the preview and layout are real so that adding an
 * actual option later is a matter of dropping a row into `SOON`, wiring it to
 * a Save field, and reading that field in Monster.drawBody. Nothing here needs
 * rearranging first.
 */
export class CustomizeScene extends Phaser.Scene {
  private monster!: Monster;

  /** Planned options, listed so the page says something concrete. */
  private static SOON = [
    "Body colour",
    "Patterns and markings",
    "Hats and accessories",
    "Aura style",
  ];

  constructor() {
    super("Customize");
  }

  create() {
    const { WIDTH, HEIGHT } = GAME;

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
      .text(WIDTH / 2, 74, "Customize", {
        fontFamily: FONT,
        resolution: TEXT_RES,
        fontSize: "28px",
        fontStyle: "600",
        color: "#4a3327",
      })
      .setOrigin(0.5);

    // A live monster rather than a picture, so future options can be previewed
    // here the moment they exist.
    this.monster = new Monster(this, WIDTH / 2, 230);
    this.monster.setName(Save.name);
    // Show it wearing the best milestone it has ever reached — the aura is the
    // one thing you can already "own", and it's nice to see it off the clock.
    this.monster.setMilestone(Save.bestRun?.milestone ?? 0);

    const panelY = 340;
    const panel = this.add.graphics();
    panel.fillStyle(COLORS.ink, 0.12);
    panel.fillRoundedRect(36, panelY, WIDTH - 72, 210, 16);

    this.add
      .text(WIDTH / 2, panelY + 26, "COMING SOON", {
        fontFamily: FONT,
        resolution: TEXT_RES,
        fontSize: "10px",
        color: "#9b7a5f",
      })
      .setOrigin(0.5);

    CustomizeScene.SOON.forEach((label, i) => {
      const y = panelY + 62 + i * 34;
      this.add
        .text(62, y, label, {
          fontFamily: FONT,
        resolution: TEXT_RES,
          fontSize: "14px",
          color: "#6d5443",
        })
        .setOrigin(0, 0.5);
      this.add
        .text(WIDTH - 62, y, "—", {
          fontFamily: FONT,
        resolution: TEXT_RES,
          fontSize: "14px",
          color: "#ab8d74",
        })
        .setOrigin(1, 0.5);
    });

    this.add
      .text(
        WIDTH / 2,
        panelY + 236,
        "Your aura already changes colour\nevery time your monster grows.",
        {
          fontFamily: FONT,
        resolution: TEXT_RES,
          fontSize: "11px",
          color: "#ab8d74",
          align: "center",
          lineSpacing: 4,
        }
      )
      .setOrigin(0.5);

    makeButton(this, {
      x: WIDTH / 2,
      y: HEIGHT - 74,
      label: "Back",
      onClick: () => this.scene.start("Menu"),
    });
  }
}

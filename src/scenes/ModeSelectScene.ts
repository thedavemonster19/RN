import Phaser from "phaser";
import { GAME, COLORS, UI_FONT, TEXT_RES } from "../config";
import { makeButton } from "../objects/Button";
import { MODES, ModeId } from "../systems/Modes";
import { Save } from "../systems/Save";
import { GameScene } from "./GameScene";

const FONT = UI_FONT;

/** Row geometry. Nine modes have to fit between the title and the Back button
 *  on a 720px-tall screen, so rows are compact and tightly packed. */
const ROW_TOP = 128;
const ROW_H = 54;
const ROW_GAP = 4;

/**
 * Pick a permanent mode before starting a run.
 *
 * Every mode is one of the daily challenge's modifiers made permanent, plus
 * Classic. Each has its own leaderboard — see the note in systems/Modes about
 * why they are not pooled.
 *
 * The whole row is the tap target rather than a small button on it: these are
 * list items on a phone, and a 54px-tall row is a comfortable thumb target
 * where a 24px button would not be.
 */
export class ModeSelectScene extends Phaser.Scene {
  constructor() {
    super("ModeSelect");
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
      .text(WIDTH / 2, 62, "Choose a mode", {
        fontFamily: FONT,
        resolution: TEXT_RES,
        fontSize: "26px",
        fontStyle: "600",
        color: "#ffffff",
      })
      .setOrigin(0.5);
    this.add
      .text(WIDTH / 2, 92, "Each mode keeps its own leaderboard", {
        fontFamily: FONT,
        resolution: TEXT_RES,
        fontSize: "12px",
        color: "#c3c8f5",
      })
      .setOrigin(0.5);

    MODES.forEach((mode, i) => this.drawRow(mode.id, i));

    makeButton(this, {
      x: WIDTH / 2,
      y: HEIGHT - 46,
      label: "Back",
      onClick: () => this.scene.start("Menu"),
    });
  }

  private drawRow(id: ModeId, index: number): void {
    const { WIDTH } = GAME;
    const mode = MODES[index];
    const y = ROW_TOP + index * (ROW_H + ROW_GAP);
    const left = 26;
    const w = WIDTH - 52;

    const card = this.add.graphics();
    const paint = (hover: boolean) => {
      card.clear();
      card.fillStyle(COLORS.cardFill, 1);
      card.fillRoundedRect(left, y, w, ROW_H, 14);
      card.fillStyle(0xffffff, hover ? 0.14 : 0.07);
      card.fillRoundedRect(left + 3, y + 2, w - 6, ROW_H * 0.45, 11);
      card.lineStyle(2, COLORS.violet, hover ? 0.9 : 0.45);
      card.strokeRoundedRect(left, y, w, ROW_H, 14);
    };
    paint(false);

    this.add
      .text(left + 16, y + 17, mode.name, {
        fontFamily: FONT,
        resolution: TEXT_RES,
        fontSize: "16px",
        fontStyle: "600",
        color: "#ffffff",
      })
      .setOrigin(0, 0.5);
    this.add
      .text(left + 16, y + 37, mode.desc, {
        fontFamily: FONT,
        resolution: TEXT_RES,
        fontSize: "11px",
        color: "#c3c8f5",
        wordWrap: { width: w - 96 },
      })
      .setOrigin(0, 0.5);

    // This device's best in the mode, so the list shows progress at a glance.
    const best = Save.modeBest(id);
    if (best > 0) {
      this.add
        .text(left + w - 14, y + ROW_H / 2, best.toLocaleString("en-US"), {
          fontFamily: FONT,
          resolution: TEXT_RES,
          fontSize: "13px",
          fontStyle: "600",
          color: "#ffd93d",
        })
        .setOrigin(1, 0.5);
    }

    const zone = this.add
      .zone(left + w / 2, y + ROW_H / 2, w, ROW_H)
      .setInteractive({ useHandCursor: true });
    zone.on("pointerover", () => paint(true));
    zone.on("pointerout", () => paint(false));
    zone.on("pointerdown", () => this.start(id));
  }

  private start(mode: ModeId): void {
    // Starting a run discards any suspended one, exactly as "New game" does.
    GameScene.hasActiveRun = false;
    this.scene.stop("Game");
    this.scene.start("Game", { mode });
  }
}

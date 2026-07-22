import Phaser from "phaser";
import { GAME, COLORS, UI_FONT, TEXT_RES } from "../config";
import { makeButton } from "../objects/Button";
import { MODES, ModeId } from "../systems/Modes";
import { Save } from "../systems/Save";
import { GameScene } from "./GameScene";

const FONT = UI_FONT;

/**
 * Pick a permanent mode before starting a run — ONE mode on screen at a time,
 * stepped with the arrows.
 *
 * A list of all nine was tried first and read as a wall: nine cards of equal
 * weight, none of which looked like the thing you were supposed to pick. A
 * single card gives the mode room for its name, its twist and your best score,
 * and makes Classic the obvious default simply by being what you land on.
 *
 * Classic is always index 0, so the screen opens on the plain game.
 */
export class ModeSelectScene extends Phaser.Scene {
  private index = 0;
  /** Everything that changes when you step modes, cleared and redrawn. */
  private cardBits: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super("ModeSelect");
  }

  create() {
    const { WIDTH, HEIGHT } = GAME;
    this.index = 0;
    this.cardBits = [];

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
      .text(WIDTH / 2, 76, "Choose a mode", {
        fontFamily: FONT,
        resolution: TEXT_RES,
        fontSize: "26px",
        fontStyle: "600",
        color: "#4a3327",
      })
      .setOrigin(0.5);
    this.add
      .text(WIDTH / 2, 106, "Each mode keeps its own leaderboard", {
        fontFamily: FONT,
        resolution: TEXT_RES,
        fontSize: "12px",
        color: "#9b7a5f",
      })
      .setOrigin(0.5);

    // Arrows sit outside the card and never move, so stepping feels like the
    // card changing rather than the whole screen redrawing.
    this.arrow(34, -1, "‹");
    this.arrow(WIDTH - 34, 1, "›");

    makeButton(this, {
      x: WIDTH / 2,
      y: HEIGHT - 150,
      label: "Play",
      primary: true,
      onClick: () => this.start(MODES[this.index].id),
    });
    makeButton(this, {
      x: WIDTH / 2,
      y: HEIGHT - 84,
      label: "Back",
      onClick: () => this.scene.start("Menu"),
    });

    this.drawCard();
  }

  private arrow(x: number, dir: number, glyph: string): void {
    const y = 300;
    const hit = this.add
      .circle(x, y, 24, COLORS.ink, 0.1)
      .setStrokeStyle(2, COLORS.violet, 0.6)
      .setInteractive({ useHandCursor: true });
    hit.on("pointerover", () => hit.setFillStyle(COLORS.ink, 0.2));
    hit.on("pointerout", () => hit.setFillStyle(COLORS.ink, 0.1));
    hit.on("pointerdown", () => this.step(dir));
    this.add
      .text(x, y - 2, glyph, {
        fontFamily: FONT,
        resolution: TEXT_RES,
        fontSize: "26px",
        fontStyle: "600",
        color: "#4a3327",
      })
      .setOrigin(0.5);
  }

  private step(dir: number): void {
    this.index = (this.index + dir + MODES.length) % MODES.length;
    this.drawCard();
  }

  private drawCard(): void {
    const { WIDTH } = GAME;
    this.cardBits.forEach((o) => o.destroy());
    this.cardBits = [];

    const mode = MODES[this.index];
    const left = 74;
    const w = WIDTH - 148;
    const top = 176;
    const h = 248;

    const card = this.add.graphics();
    card.fillStyle(COLORS.ink, 0.22);
    card.fillRoundedRect(left, top + 4, w, h, 20);
    card.fillStyle(COLORS.cardFill, 1);
    card.fillRoundedRect(left, top, w, h, 20);
    card.fillStyle(0xffffff, 0.09);
    card.fillRoundedRect(left + 4, top + 3, w - 8, h * 0.4, 17);
    card.lineStyle(2, COLORS.violet, 0.7);
    card.strokeRoundedRect(left, top, w, h, 20);
    this.cardBits.push(card);

    this.cardBits.push(
      this.add
        .text(WIDTH / 2, top + 52, mode.name, {
          fontFamily: FONT,
          resolution: TEXT_RES,
          fontSize: "22px",
          fontStyle: "600",
          color: "#4a3327",
          align: "center",
          wordWrap: { width: w - 32 },
        })
        .setOrigin(0.5)
    );
    this.cardBits.push(
      this.add
        .text(WIDTH / 2, top + 116, mode.desc, {
          fontFamily: FONT,
          resolution: TEXT_RES,
          fontSize: "13px",
          color: "#6d5443",
          align: "center",
          lineSpacing: 5,
          wordWrap: { width: w - 44 },
        })
        .setOrigin(0.5)
    );

    const best = Save.modeBest(mode.id);
    this.cardBits.push(
      this.add
        .text(WIDTH / 2, top + 186, best > 0 ? best.toLocaleString("en-US") : "—", {
          fontFamily: FONT,
          resolution: TEXT_RES,
          fontSize: "26px",
          fontStyle: "600",
          color: "#d98324",
        })
        .setOrigin(0.5)
    );
    this.cardBits.push(
      this.add
        .text(WIDTH / 2, top + 212, "YOUR BEST", {
          fontFamily: FONT,
          resolution: TEXT_RES,
          fontSize: "10px",
          color: "#9b7a5f",
        })
        .setOrigin(0.5)
    );

    // Position dots: which of the nine you're on, without a scrollbar.
    const dotY = top + h + 30;
    const spacing = 18;
    const startX = WIDTH / 2 - ((MODES.length - 1) * spacing) / 2;
    MODES.forEach((_, i) => {
      const dot = this.add.circle(
        startX + i * spacing,
        dotY,
        i === this.index ? 5 : 3.5,
        i === this.index ? COLORS.teal : COLORS.ink,
        i === this.index ? 1 : 0.32
      );
      this.cardBits.push(dot);
    });
  }

  private start(mode: ModeId): void {
    // Starting a run discards any suspended one, exactly as "New game" does.
    GameScene.hasActiveRun = false;
    this.scene.stop("Game");
    this.scene.start("Game", { mode });
  }
}

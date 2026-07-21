import Phaser from "phaser";
import { GAME, COLORS, UI_FONT, TEXT_RES } from "../config";
import { Monster } from "../objects/Monster";
import { makeButton, Button } from "../objects/Button";
import { openNameEntry } from "../objects/NameEntry";
import { Save } from "../systems/Save";
import { todayKey } from "../systems/Rng";
import { dailyModifiers, MODS } from "../systems/Modifiers";
import { GameScene } from "./GameScene";

const FONT = UI_FONT;

/**
 * The main menu — the hub the game hangs off. Deliberately a blank slate: the
 * buttons are a vertical stack driven by BUTTON_TOP/BUTTON_GAP, so adding
 * another entry later is one more makeButton call, not a layout rewrite.
 *
 * Account management lives in Profile rather than here, to keep this list to
 * the four things you actually came to do.
 */
export class MenuScene extends Phaser.Scene {
  private monster!: Monster;
  private buttons: Button[] = [];
  private bestText!: Phaser.GameObjects.Text;
  private bestLabel!: Phaser.GameObjects.Text;
  private nameText!: Phaser.GameObjects.Text;

  /** Five 54px-tall buttons plus the daily-twist footer have to clear
   *  GAME.HEIGHT (720): stack ends at TOP + 4·GAP + 27 = 659, footer text
   *  centres at 700 — clear of each other, with 6px between buttons. */
  private static BUTTON_TOP = 404;
  private static BUTTON_GAP = 60;

  constructor() {
    super("Menu");
  }

  create() {
    const { WIDTH, HEIGHT } = GAME;
    this.buttons = [];

    const g = this.add.graphics();
    g.fillGradientStyle(
      COLORS.bgTop,
      COLORS.bgTop,
      COLORS.bgBottom,
      COLORS.bgBottom,
      1
    );
    g.fillRect(0, 0, WIDTH, HEIGHT);

    // Best score leads: it's the number the player is here to beat.
    this.bestText = this.add
      .text(WIDTH / 2, 40, "", {
        fontFamily: FONT,
        resolution: TEXT_RES,
        fontSize: "34px",
        fontStyle: "600",
        color: "#ffd93d",
      })
      .setOrigin(0.5, 0);
    this.bestLabel = this.add
      .text(WIDTH / 2, 24, "", {
        fontFamily: FONT,
        resolution: TEXT_RES,
        fontSize: "10px",
        color: "#c3c8f5",
      })
      .setOrigin(0.5, 0);

    this.add
      .text(WIDTH / 2, 102, "Monster Muncher", {
        fontFamily: FONT,
        resolution: TEXT_RES,
        fontSize: "24px",
        fontStyle: "500",
        color: "#ffffff",
      })
      .setOrigin(0.5);

    // The monster is the star of the home screen, so give it room. It wears
    // the aura earned by the best run, but at a fixed size so the layout below
    // it is predictable. Its own label is hidden — the tappable name replaces it.
    this.monster = new Monster(this, WIDTH / 2, 244);
    this.monster.setMilestone(Save.bestRun?.milestone ?? 0);
    this.monster.setLabelVisible(false);
    this.monster.showAt(0.85);

    this.createNameButton();
    this.stackButtons();
    this.refreshBest();

    // First run: there's nothing to play as yet, so name it before anything else.
    if (!Save.named) this.promptName(true);
  }

  private stackButtons(): void {
    const { WIDTH } = GAME;
    const top = MenuScene.BUTTON_TOP;
    const gap = MenuScene.BUTTON_GAP;
    this.buttons.forEach((b) => b.destroy());

    // If a run is paused in the background, the top button resumes it rather
    // than throwing it away.
    const resuming = GameScene.hasActiveRun;
    const rows: Parameters<typeof makeButton>[1][] = [
      {
        x: WIDTH / 2,
        y: top,
        label: resuming ? "Continue" : "New game",
        primary: true,
        onClick: () => (resuming ? this.resumeGame() : this.startGame(null)),
      },
      {
        x: WIDTH / 2,
        y: top + gap,
        label: "Daily challenge",
        onClick: () => this.startGame(todayKey()),
      },
      // (a caption naming today's modifiers is drawn under this button below)
      {
        x: WIDTH / 2,
        y: top + gap * 2,
        label: "Leaderboard",
        onClick: () => this.scene.start("Leaderboard"),
      },
      {
        x: WIDTH / 2,
        y: top + gap * 3,
        label: "Profile",
        onClick: () => this.scene.start("Profile"),
      },
      {
        x: WIDTH / 2,
        y: top + gap * 4,
        label: "Customize",
        onClick: () => this.scene.start("Customize"),
      },
    ];
    this.buttons = rows.map((r) => makeButton(this, r));

    // Name today's daily twist in a footer, so the modifiers are known before
    // committing to a run without crowding the button stack.
    const mods = dailyModifiers(todayKey())
      .map((id) => MODS[id].name)
      .join("  ·  ");
    this.add
      .text(GAME.WIDTH / 2, GAME.HEIGHT - 20, `Daily twist:  ${mods}`, {
        fontFamily: FONT,
        resolution: TEXT_RES,
        fontSize: "11px",
        color: "#c3c8f5",
      })
      .setOrigin(0.5)
      .setDepth(5);
  }

  /** Wake the paused Game scene right where the player left it. */
  private resumeGame(): void {
    this.scene.switch("Game");
  }

  /**
   * The monster's name, sitting under it and tappable. A name attached to the
   * thing it names is more discoverable than a "Rename" entry buried in a
   * menu — you tap what you want to change.
   */
  private createNameButton(): void {
    const { WIDTH } = GAME;
    const y = 338;
    this.nameText = this.add
      .text(WIDTH / 2, y, "", {
        fontFamily: FONT,
        resolution: TEXT_RES,
        fontSize: "24px",
        fontStyle: "600",
        color: "#ffffff",
      })
      .setOrigin(0.5);
    this.add
      .text(WIDTH / 2, y + 22, "tap to rename", {
        fontFamily: FONT,
        resolution: TEXT_RES,
        fontSize: "10px",
        color: "#a6adde",
      })
      .setOrigin(0.5);

    // A zone rather than making the text interactive, so the tap target stays
    // a comfortable size even for a short name.
    this.add
      .zone(WIDTH / 2, y + 4, 240, 56)
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => this.promptName(false));

    this.refreshName();
  }

  private refreshName(): void {
    this.nameText.setText(Save.name || "Name me");
  }

  private promptName(forced: boolean): void {
    openNameEntry(this, {
      forced,
      onSaved: (name) => {
        this.monster.setName(name);
        this.refreshName();
        this.stackButtons();
      },
    });
  }

  /** dailyKey non-null = the shared daily seed everyone gets today. */
  private startGame(dailyKey: string | null): void {
    // Never start unnamed — the name is on the HUD and the game-over card.
    if (!Save.named) {
      this.promptName(true);
      return;
    }
    // Starting a fresh run: fully stop any paused game first, so scene.start
    // re-runs create() rather than waking the old one, and clear the run flag
    // so a half-finished game isn't silently abandoned as "in progress".
    GameScene.hasActiveRun = false;
    this.scene.stop("Game");
    this.scene.start("Game", dailyKey ? { dailyKey } : {});
  }

  private refreshBest(): void {
    const has = Save.best > 0;
    this.bestLabel.setText(has ? "BEST SCORE" : "");
    this.bestText.setText(has ? Save.best.toLocaleString("en-US") : "");
  }
}

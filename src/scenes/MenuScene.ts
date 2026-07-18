import Phaser from "phaser";
import { GAME, COLORS } from "../config";
import { Monster } from "../objects/Monster";
import { makeButton, Button } from "../objects/Button";
import { openNameEntry } from "../objects/NameEntry";
import { Save } from "../systems/Save";
import { todayKey } from "../systems/Rng";

const FONT = "system-ui, -apple-system, sans-serif";

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

  private static BUTTON_TOP = 404;
  private static BUTTON_GAP = 64;

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

    this.add
      .text(WIDTH / 2, 96, "Monster Muncher", {
        fontFamily: FONT,
        fontSize: "32px",
        fontStyle: "500",
        color: "#eaf0ff",
      })
      .setOrigin(0.5);
    this.add
      .text(WIDTH / 2, 132, "Drop food, merge it up,\nfeed it what it wants.", {
        fontFamily: FONT,
        fontSize: "14px",
        color: "#9aa3d0",
        align: "center",
        lineSpacing: 5,
      })
      .setOrigin(0.5);

    // The actual monster, so the name on screen is attached to the thing it
    // names rather than being an abstract setting.
    this.monster = new Monster(this, WIDTH / 2, 276);
    this.monster.setName(Save.name);

    this.stackButtons();

    this.bestText = this.add
      .text(WIDTH / 2, HEIGHT - 46, "", {
        fontFamily: FONT,
        fontSize: "13px",
        color: "#9aa3d0",
      })
      .setOrigin(0.5);
    this.refreshBest();

    // First run: there's nothing to play as yet, so name it before anything else.
    if (!Save.named) this.promptName(true);
  }

  private stackButtons(): void {
    const { WIDTH } = GAME;
    const top = MenuScene.BUTTON_TOP;
    const gap = MenuScene.BUTTON_GAP;
    this.buttons.forEach((b) => b.destroy());
    this.buttons = [
      makeButton(this, {
        x: WIDTH / 2,
        y: top,
        label: "Play",
        primary: true,
        onClick: () => this.startGame(null),
      }),
      makeButton(this, {
        x: WIDTH / 2,
        y: top + gap,
        label: "Daily challenge",
        onClick: () => this.startGame(todayKey()),
      }),
      makeButton(this, {
        x: WIDTH / 2,
        y: top + gap * 2,
        label: "Leaderboard",
        onClick: () => this.scene.start("Leaderboard"),
      }),
      makeButton(this, {
        x: WIDTH / 2,
        y: top + gap * 3,
        label: "Profile",
        onClick: () => this.scene.start("Profile"),
      }),
    ];
  }

  private promptName(forced: boolean): void {
    openNameEntry(this, {
      forced,
      onSaved: (name) => {
        this.monster.setName(name);
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
    this.scene.start("Game", dailyKey ? { dailyKey } : {});
  }

  private refreshBest(): void {
    this.bestText.setText(
      Save.best > 0 ? `Best  ${Save.best.toLocaleString("en-US")}` : ""
    );
  }
}

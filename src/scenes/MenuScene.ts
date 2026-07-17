import Phaser from "phaser";
import { GAME, COLORS } from "../config";
import { Monster } from "../objects/Monster";
import { makeButton, Button } from "../objects/Button";
import { Save, NAME_MAX, cleanName, suggestName } from "../systems/Save";

const FONT = "system-ui, -apple-system, sans-serif";

/**
 * The main menu — the hub the game hangs off. Deliberately a blank slate: the
 * buttons are a vertical stack driven by BUTTON_TOP/BUTTON_GAP, so adding
 * "Leaderboard" or "How to play" later is one more makeButton call, not a
 * layout rewrite.
 */
export class MenuScene extends Phaser.Scene {
  private monster!: Monster;
  private buttons: Button[] = [];
  private bestText!: Phaser.GameObjects.Text;

  /** Where the button stack starts, and how far apart the buttons sit. */
  private static BUTTON_TOP = 452;
  private static BUTTON_GAP = 68;

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
    this.monster = new Monster(this, WIDTH / 2, 300);
    this.monster.setName(Save.name);

    this.stackButtons();

    this.bestText = this.add
      .text(WIDTH / 2, HEIGHT - 56, "", {
        fontFamily: FONT,
        fontSize: "14px",
        color: "#9aa3d0",
      })
      .setOrigin(0.5);
    this.refreshBest();

    // First run: there's nothing to play as yet, so name it before anything else.
    if (!Save.named) this.openNameEntry(true);
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
        onClick: () => this.startGame(),
      }),
      makeButton(this, {
        x: WIDTH / 2,
        y: top + gap,
        label: Save.named ? "Rename" : "Name your monster",
        onClick: () => this.openNameEntry(false),
      }),
    ];
  }

  private startGame(): void {
    // Never start unnamed — the name is on the HUD and the game-over card.
    if (!Save.named) {
      this.openNameEntry(true);
      return;
    }
    this.scene.start("Game");
  }

  private refreshBest(): void {
    this.bestText.setText(Save.best > 0 ? `Best  ${Save.best}` : "");
  }

  /**
   * Name entry, using a real DOM <input> so the player gets their platform
   * keyboard. `forced` hides the cancel button on first run, where there's no
   * previous name to fall back to.
   */
  private openNameEntry(forced: boolean): void {
    const { WIDTH, HEIGHT } = GAME;
    const depth = 50;
    const cy = HEIGHT / 2 - 40;

    const shade = this.add
      .rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x06081a, 0.92)
      .setDepth(depth)
      .setInteractive();
    const panel = this.add.graphics().setDepth(depth + 1);
    panel.fillStyle(0xffffff, 0.06);
    panel.fillRoundedRect(WIDTH / 2 - 150, cy - 100, 300, 236, 18);
    panel.lineStyle(1.5, 0xffffff, 0.14);
    panel.strokeRoundedRect(WIDTH / 2 - 150, cy - 100, 300, 236, 18);

    const title = this.add
      .text(WIDTH / 2, cy - 66, "Name your monster", {
        fontFamily: FONT,
        fontSize: "19px",
        fontStyle: "600",
        color: "#eaf0ff",
      })
      .setOrigin(0.5)
      .setDepth(depth + 2);
    const hint = this.add
      .text(WIDTH / 2, cy - 42, `up to ${NAME_MAX} characters`, {
        fontFamily: FONT,
        fontSize: "12px",
        color: "#9aa3d0",
      })
      .setOrigin(0.5)
      .setDepth(depth + 2);

    const el = document.createElement("input");
    el.type = "text";
    el.maxLength = NAME_MAX;
    el.value = Save.name;
    el.placeholder = suggestName();
    el.setAttribute("autocomplete", "off");
    el.setAttribute("autocorrect", "off");
    el.setAttribute("autocapitalize", "words");
    el.setAttribute("spellcheck", "false");
    el.style.cssText = [
      "width: 232px",
      "padding: 12px 14px",
      "font-size: 18px",
      "font-weight: 600",
      "text-align: center",
      `font-family: ${FONT}`,
      "color: #eaf0ff",
      "background: rgba(255,255,255,0.10)",
      "border: 1.5px solid rgba(255,255,255,0.25)",
      "border-radius: 12px",
      "outline: none",
    ].join(";");
    const input = this.add.dom(WIDTH / 2, cy - 2, el).setDepth(depth + 2);
    el.focus();
    el.select();

    const cleanup = () => {
      shade.destroy();
      panel.destroy();
      title.destroy();
      hint.destroy();
      input.destroy();
      save.destroy();
      cancel?.destroy();
    };

    const commit = () => {
      // An empty field takes the placeholder, so the player can never end up
      // with a nameless monster by mashing OK.
      Save.name = cleanName(el.value) || el.placeholder;
      this.monster.setName(Save.name);
      cleanup();
      this.stackButtons();
    };

    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter") commit();
    });

    const save = makeButton(this, {
      x: WIDTH / 2,
      y: cy + 56,
      label: "Save",
      primary: true,
      width: 232,
      depth: depth + 2,
    onClick: commit,
    });

    let cancel: Button | undefined;
    if (!forced) {
      cancel = makeButton(this, {
        x: WIDTH / 2,
        y: cy + 116,
        label: "Cancel",
        width: 232,
        depth: depth + 2,
        onClick: cleanup,
      });
    }
  }
}

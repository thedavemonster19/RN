import Phaser from "phaser";
import { GAME, COLORS, UI_FONT, TEXT_RES } from "../config";
import { makeButton, Button } from "../objects/Button";
import { Cloud, LeaderboardRow } from "../systems/Cloud";
import { todayKey } from "../systems/Rng";
import { dailyModifiers, MODS } from "../systems/Modifiers";
import { Save } from "../systems/Save";
import { MODES, ModeId, modeName } from "../systems/Modes";

const FONT = UI_FONT;

type Tab = "daily" | "all";

/**
 * Standings, in two views: today's daily challenge and the all-time board.
 *
 * Every score here has been re-derived server-side by the verify-run edge
 * function — the client submits an event log plus the run's seed, never a
 * score, and clients cannot write to the score tables at all. Both views only
 * expose rows flagged verified.
 */
export class LeaderboardScene extends Phaser.Scene {
  private tab: Tab = "daily";
  /** Which mode's all-time board is showing. Ignored on the daily tab — the
   *  daily has one shared board, since everyone plays the identical run. */
  private mode: ModeId = "classic";
  private modeUi: Phaser.GameObjects.GameObject[] = [];
  private rowObjects: Phaser.GameObjects.GameObject[] = [];
  private tabButtons: Button[] = [];
  private status!: Phaser.GameObjects.Text;
  private subtitle!: Phaser.GameObjects.Text;

  constructor() {
    super("Leaderboard");
  }

  create(data: { tab?: Tab; mode?: ModeId }) {
    const { WIDTH, HEIGHT } = GAME;
    this.tab = data?.tab ?? "daily";
    this.mode = data?.mode ?? "classic";
    this.rowObjects = [];
    this.tabButtons = [];
    this.modeUi = [];

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
      .text(WIDTH / 2, 62, "Leaderboard", {
        fontFamily: FONT,
        resolution: TEXT_RES,
        fontSize: "26px",
        fontStyle: "600",
        color: "#ffffff",
      })
      .setOrigin(0.5);
    this.subtitle = this.add
      .text(WIDTH / 2, 90, "", {
        fontFamily: FONT,
        resolution: TEXT_RES,
        fontSize: "11px",
        color: "#c3c8f5",
        align: "center",
        lineSpacing: 3,
      })
      .setOrigin(0.5);

    this.status = this.add
      .text(WIDTH / 2, 260, "", {
        fontFamily: FONT,
        resolution: TEXT_RES,
        fontSize: "13px",
        color: "#c3c8f5",
        align: "center",
        lineSpacing: 6,
        wordWrap: { width: WIDTH - 80 },
      })
      .setOrigin(0.5);

    makeButton(this, {
      x: WIDTH / 2,
      y: HEIGHT - 74,
      label: "Back",
      onClick: () => this.scene.start("Menu"),
    });

    this.drawTabs();
    this.drawModePicker();
    this.refresh();
  }

  private drawTabs(): void {
    const { WIDTH } = GAME;
    this.tabButtons.forEach((b) => b.destroy());
    this.tabButtons = [
      makeButton(this, {
        x: WIDTH / 2 - 82,
        y: 132,
        label: "Today",
        primary: this.tab === "daily",
        width: 150,
        onClick: () => this.switchTab("daily"),
      }),
      makeButton(this, {
        x: WIDTH / 2 + 82,
        y: 132,
        label: "All time",
        primary: this.tab === "all",
        width: 150,
        onClick: () => this.switchTab("all"),
      }),
    ];
  }

  private switchTab(tab: Tab): void {
    if (this.tab === tab) return;
    this.scene.restart({ tab, mode: this.mode });
  }

  /**
   * Mode picker for the all-time tab: one board per mode, stepped with arrows.
   *
   * Arrows rather than a row of buttons because there are nine modes and the
   * screen is 400px wide — nine tabs would be unreadable, and a scrolling list
   * would fight the leaderboard rows below for the same gesture.
   */
  private drawModePicker(): void {
    const { WIDTH } = GAME;
    this.modeUi.forEach((o) => o.destroy());
    this.modeUi = [];
    if (this.tab !== "all") return;

    // Clear of the tab buttons above: those sit at y=132 and are 54 tall, so
    // they end at 159 — an 18px-radius arrow centred any higher overlaps them.
    const y = 190;
    const step = (dir: number) => {
      const i = MODES.findIndex((m) => m.id === this.mode);
      const next = MODES[(i + dir + MODES.length) % MODES.length];
      this.scene.restart({ tab: this.tab, mode: next.id });
    };

    const label = this.add
      .text(WIDTH / 2, y, modeName(this.mode), {
        fontFamily: FONT,
        resolution: TEXT_RES,
        fontSize: "15px",
        fontStyle: "600",
        color: "#2ff0d6",
      })
      .setOrigin(0.5);
    this.modeUi.push(label);

    for (const [dx, dir, glyph] of [
      [-118, -1, "‹"],
      [118, 1, "›"],
    ] as [number, number, string][]) {
      const hit = this.add
        .circle(WIDTH / 2 + dx, y, 18, 0xffffff, 0.1)
        .setStrokeStyle(1, 0xffffff, 0.28)
        .setInteractive({ useHandCursor: true });
      hit.on("pointerdown", () => step(dir));
      const txt = this.add
        .text(WIDTH / 2 + dx, y - 1, glyph, {
          fontFamily: FONT,
          resolution: TEXT_RES,
          fontSize: "20px",
          fontStyle: "600",
          color: "#ffffff",
        })
        .setOrigin(0.5);
      this.modeUi.push(hit, txt);
    }
  }

  /** Not `load` — that's Phaser's LoaderPlugin on Scene. */
  private refresh(): void {
    if (this.tab === "daily") {
      const mods = dailyModifiers(todayKey())
        .map((id) => MODS[id].name)
        .join("  ·  ");
      this.subtitle.setText(`${todayKey()}\n${mods}`);
    } else {
      this.subtitle.setText("Best verified run, every player");
    }

    if (!Cloud.enabled) {
      const mine =
        this.tab === "daily" ? Save.dailyBest(todayKey()) : Save.best;
      this.status.setText(
        mine
          ? `Not connected yet.\n\nYour best: ${mine.toLocaleString("en-US")}`
          : "Not connected yet.\n\nAdd your Supabase keys to compare\nscores with other players."
      );
      return;
    }

    this.status.setText("Loading…");
    void this.fetchRows();
  }

  /** Not called `load` on the instance — that name is Phaser's LoaderPlugin. */
  private async fetchRows(): Promise<void> {
    const rows =
      this.tab === "daily"
        ? await Cloud.leaderboard(todayKey())
        : await Cloud.allTimeLeaderboard(this.mode);
    if (!this.scene.isActive()) return; // player left while it loaded
    if (rows.length === 0) {
      this.status.setText(
        this.tab === "daily"
          ? "Nobody has posted a score today.\nBe first."
          : `No verified runs in ${modeName(this.mode)} yet.\nPlay one while signed in.`
      );
      return;
    }
    this.status.setVisible(false);
    this.renderRows(rows);
  }

  private renderRows(rows: LeaderboardRow[]): void {
    const { WIDTH } = GAME;
    // The all-time tab carries a mode picker at y=190 (arrows reach 208), so
    // rows have to start below it. They used to start at 186 and sat straight
    // on top of it — invisible while the board was empty, obvious the moment
    // there were real scores to draw.
    const top = this.tab === "all" ? 226 : 190;
    const me = Save.name;
    // 11 rows, not 12: the last row must stay clear of the Back button at
    // HEIGHT-74, and the all-time tab starts 36px lower.
    rows.slice(0, 11).forEach((row, i) => {
      const y = top + i * 34;
      const mine = row.monster === me;
      const bg = this.add.graphics();
      bg.fillStyle(0xffffff, mine ? 0.1 : i % 2 === 0 ? 0.04 : 0);
      bg.fillRoundedRect(30, y - 14, WIDTH - 60, 28, 8);
      this.rowObjects.push(bg);

      const rank = this.add
        .text(46, y, `${i + 1}`, {
          fontFamily: FONT,
        resolution: TEXT_RES,
          fontSize: "13px",
          fontStyle: "600",
          color: i < 3 ? "#ffd93d" : "#c3c8f5",
        })
        .setOrigin(0, 0.5);
      const name = this.add
        .text(78, y, row.username, {
          fontFamily: FONT,
        resolution: TEXT_RES,
          fontSize: "14px",
          color: mine ? "#2ff0d6" : "#ffffff",
        })
        .setOrigin(0, 0.5);
      const score = this.add
        .text(WIDTH - 46, y, row.score.toLocaleString("en-US"), {
          fontFamily: FONT,
        resolution: TEXT_RES,
          fontSize: "14px",
          fontStyle: "600",
          color: "#ffffff",
        })
        .setOrigin(1, 0.5);
      this.rowObjects.push(rank, name, score);
    });

    this.add
      .text(
        WIDTH / 2,
        top + Math.min(rows.length, 12) * 34 + 18,
        "Every score replayed and verified on the server.",
        { fontFamily: FONT,
        resolution: TEXT_RES, fontSize: "10px", color: "#a6adde" }
      )
      .setOrigin(0.5);
  }
}

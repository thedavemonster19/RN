import Phaser from "phaser";
import { GAME, COLORS } from "../config";
import { makeButton, Button } from "../objects/Button";
import { Cloud, LeaderboardRow } from "../systems/Cloud";
import { todayKey } from "../systems/Rng";
import { dailyModifiers, MODS } from "../systems/Modifiers";
import { Save } from "../systems/Save";

const FONT = "system-ui, -apple-system, sans-serif";

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
  private rowObjects: Phaser.GameObjects.GameObject[] = [];
  private tabButtons: Button[] = [];
  private status!: Phaser.GameObjects.Text;
  private subtitle!: Phaser.GameObjects.Text;

  constructor() {
    super("Leaderboard");
  }

  create(data: { tab?: Tab }) {
    const { WIDTH, HEIGHT } = GAME;
    this.tab = data?.tab ?? "daily";
    this.rowObjects = [];
    this.tabButtons = [];

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
        fontSize: "26px",
        fontStyle: "600",
        color: "#eaf0ff",
      })
      .setOrigin(0.5);
    this.subtitle = this.add
      .text(WIDTH / 2, 90, "", {
        fontFamily: FONT,
        fontSize: "11px",
        color: "#9aa3d0",
        align: "center",
        lineSpacing: 3,
      })
      .setOrigin(0.5);

    this.status = this.add
      .text(WIDTH / 2, 260, "", {
        fontFamily: FONT,
        fontSize: "13px",
        color: "#9aa3d0",
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
    this.scene.restart({ tab });
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
        : await Cloud.allTimeLeaderboard();
    if (!this.scene.isActive()) return; // player left while it loaded
    if (rows.length === 0) {
      this.status.setText(
        this.tab === "daily"
          ? "Nobody has posted a score today.\nBe first."
          : "No verified runs yet.\nPlay a game while signed in."
      );
      return;
    }
    this.status.setVisible(false);
    this.renderRows(rows);
  }

  private renderRows(rows: LeaderboardRow[]): void {
    const { WIDTH } = GAME;
    const top = 186;
    const me = Save.name;
    rows.slice(0, 12).forEach((row, i) => {
      const y = top + i * 34;
      const mine = row.monster === me;
      const bg = this.add.graphics();
      bg.fillStyle(0xffffff, mine ? 0.1 : i % 2 === 0 ? 0.04 : 0);
      bg.fillRoundedRect(30, y - 14, WIDTH - 60, 28, 8);
      this.rowObjects.push(bg);

      const rank = this.add
        .text(46, y, `${i + 1}`, {
          fontFamily: FONT,
          fontSize: "13px",
          fontStyle: "600",
          color: i < 3 ? "#ffe08a" : "#9aa3d0",
        })
        .setOrigin(0, 0.5);
      const name = this.add
        .text(78, y, row.username, {
          fontFamily: FONT,
          fontSize: "14px",
          color: mine ? "#37e0d0" : "#eaf0ff",
        })
        .setOrigin(0, 0.5);
      const score = this.add
        .text(WIDTH - 46, y, row.score.toLocaleString("en-US"), {
          fontFamily: FONT,
          fontSize: "14px",
          fontStyle: "600",
          color: "#eaf0ff",
        })
        .setOrigin(1, 0.5);
      this.rowObjects.push(rank, name, score);
    });

    this.add
      .text(
        WIDTH / 2,
        top + Math.min(rows.length, 12) * 34 + 18,
        "Every score replayed and verified on the server.",
        { fontFamily: FONT, fontSize: "10px", color: "#6f78a8" }
      )
      .setOrigin(0.5);
  }
}

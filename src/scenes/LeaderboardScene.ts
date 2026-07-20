import Phaser from "phaser";
import { GAME, COLORS } from "../config";
import { makeButton } from "../objects/Button";
import { Cloud, LeaderboardRow } from "../systems/Cloud";
import { todayKey } from "../systems/Rng";
import { Save } from "../systems/Save";

const FONT = "system-ui, -apple-system, sans-serif";

/**
 * Today's daily-challenge standings.
 *
 * Every score here has been re-derived server-side by the verify-run edge
 * function: the client submits its event log, never a score, and the server
 * replays the run from the day's seed to work out the number itself. Clients
 * have no write access to the scores table at all, so the function cannot be
 * bypassed, and the view only exposes rows flagged verified.
 */
export class LeaderboardScene extends Phaser.Scene {
  constructor() {
    super("Leaderboard");
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
      .text(WIDTH / 2, 74, "Daily challenge", {
        fontFamily: FONT,
        fontSize: "26px",
        fontStyle: "600",
        color: "#eaf0ff",
      })
      .setOrigin(0.5);
    this.add
      .text(WIDTH / 2, 104, todayKey(), {
        fontFamily: FONT,
        fontSize: "12px",
        color: "#9aa3d0",
      })
      .setOrigin(0.5);

    const status = this.add
      .text(WIDTH / 2, 200, "", {
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
      y: HEIGHT - 90,
      label: "Back",
      onClick: () => this.scene.start("Menu"),
    });

    if (!Cloud.enabled) {
      const mine = Save.dailyBest(todayKey());
      status.setText(
        mine
          ? `Not connected yet.\n\nYour score today: ${mine.toLocaleString("en-US")}`
          : "Not connected yet.\n\nAdd your Supabase keys to compare\nscores with other players."
      );
      return;
    }

    status.setText("Loading…");
    void this.fetchRows(status);
  }

  /** Not called `load` — that name is Phaser's own LoaderPlugin on Scene. */
  private async fetchRows(status: Phaser.GameObjects.Text): Promise<void> {
    const rows = await Cloud.leaderboard(todayKey());
    if (rows.length === 0) {
      status.setText("Nobody has posted a score today.\nBe first.");
      return;
    }
    status.setVisible(false);
    this.renderRows(rows);
  }

  private renderRows(rows: LeaderboardRow[]): void {
    const { WIDTH } = GAME;
    const top = 150;
    rows.slice(0, 12).forEach((row, i) => {
      const y = top + i * 34;
      if (i % 2 === 0) {
        const bg = this.add.graphics();
        bg.fillStyle(0xffffff, 0.04);
        bg.fillRoundedRect(30, y - 14, WIDTH - 60, 28, 8);
      }
      this.add
        .text(46, y, `${i + 1}`, {
          fontFamily: FONT,
          fontSize: "13px",
          fontStyle: "600",
          color: i < 3 ? "#ffe08a" : "#9aa3d0",
        })
        .setOrigin(0, 0.5);
      this.add
        .text(78, y, row.username, {
          fontFamily: FONT,
          fontSize: "14px",
          color: "#eaf0ff",
        })
        .setOrigin(0, 0.5);
      this.add
        .text(WIDTH - 46, y, row.score.toLocaleString("en-US"), {
          fontFamily: FONT,
          fontSize: "14px",
          fontStyle: "600",
          color: "#eaf0ff",
        })
        .setOrigin(1, 0.5);
    });

    const footY = top + Math.min(rows.length, 12) * 34 + 22;
    this.add
      .text(WIDTH / 2, footY, "Every score replayed and verified on the server.", {
        fontFamily: FONT,
        fontSize: "10px",
        color: "#6f78a8",
      })
      .setOrigin(0.5);

    // Signed out is the most likely reason a player's own run is missing here,
    // so say so instead of leaving them to wonder.
    if (!Cloud.signedIn) {
      const mine = Save.dailyBest(todayKey());
      this.add
        .text(
          WIDTH / 2,
          footY + 26,
          mine
            ? `Your score today: ${mine.toLocaleString("en-US")} — sign in to post it`
            : "Sign in to post your score here",
          { fontFamily: FONT, fontSize: "12px", color: "#ff9d5c" }
        )
        .setOrigin(0.5);
      makeButton(this, {
        x: WIDTH / 2,
        y: footY + 78,
        label: "Sign in",
        onClick: () => this.scene.start("Account"),
      });
    }
  }
}

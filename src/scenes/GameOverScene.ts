import Phaser from "phaser";
import { GAME, COLORS } from "../config";
import { milestoneName } from "../data/milestones";
import { GameOverReason } from "../systems/GameState";
import { Save } from "../systems/Save";
import { makeButton } from "../objects/Button";
import { tierTexture } from "../data/foods";
import { Cloud } from "../systems/Cloud";
import { ReplayEvent } from "../systems/Replay";

const FONT = "system-ui, -apple-system, sans-serif";

interface GameOverData {
  score: number;
  milestone: number;
  reason: GameOverReason;
  feeds: number;
  drops: number;
  biggestTier: number;
  dailyKey: string | null;
  events: ReplayEvent[];
}

export class GameOverScene extends Phaser.Scene {
  constructor() {
    super("GameOver");
  }

  create(data: GameOverData) {
    const { WIDTH, HEIGHT } = GAME;
    const name = Save.name || "Your monster";
    const run = {
      score: data.score,
      milestone: data.milestone,
      feeds: data.feeds,
      drops: data.drops,
      biggestTier: data.biggestTier,
    };
    const isBest = Save.recordRun(run, data.dailyKey);

    // The dimming overlay goes down FIRST so everything after it draws on top.
    // It used to be added late, which silently hid the sync status behind it —
    // a daily run that never posted looked like it had just done nothing.
    this.add
      .rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x06081a, 0.9)
      .setOrigin(0.5);

    // A daily run that never reaches the leaderboard is the single most
    // confusing outcome here, so the result is always reported rather than
    // silently dropped. Still fire-and-forget: nothing blocks this screen.
    const syncNote = this.add
      .text(WIDTH / 2, 92, "", {
        fontFamily: FONT,
        fontSize: "12px",
        color: "#9aa3d0",
        align: "center",
        wordWrap: { width: WIDTH - 60 },
      })
      .setOrigin(0.5)
      .setDepth(10);

    if (data.dailyKey) syncNote.setText("Checking sign-in…");
    // Wait for the stored session to load before deciding — otherwise a quick
    // game-over can conclude "signed out" while the session is still loading.
    void Cloud.ready.then(() => {
      if (!Cloud.signedIn) {
        if (data.dailyKey) {
          syncNote
            .setText("Not posted — sign in to join the leaderboard")
            .setColor("#ff9d5c");
        } else {
          syncNote.setText("");
        }
        return;
      }
      void Cloud.pushProgress(Save.name, Save.best, Save.bestRun, Save.runs);
      if (!data.dailyKey) {
        syncNote.setText("");
        return;
      }
      syncNote.setText("Posting to leaderboard…");
      void Cloud.submitDaily(data.dailyKey, run, data.events).then((r) => {
        if (r.ok && r.verified) {
          syncNote.setText("Verified and posted to the leaderboard").setColor("#37e0d0");
        } else {
          syncNote
            .setText(`Not posted: ${r.error ?? "unknown error"}`)
            .setColor("#ff9d5c");
        }
      });
    });

    const top = 120;
    this.add
      .text(WIDTH / 2, top, data.dailyKey ? "Daily challenge over" : "Game over", {
        fontFamily: FONT,
        fontSize: "26px",
        fontStyle: "500",
        color: "#ffffff",
      })
      .setOrigin(0.5);
    this.add
      .text(WIDTH / 2, top + 30, "The bin overflowed.", {
        fontFamily: FONT,
        fontSize: "13px",
        color: "#aeb6e6",
      })
      .setOrigin(0.5);

    this.add
      .text(WIDTH / 2, top + 74, data.score.toLocaleString("en-US"), {
        fontFamily: FONT,
        fontSize: "44px",
        fontStyle: "600",
        color: "#ffe08a",
      })
      .setOrigin(0.5);
    this.add
      .text(
        WIDTH / 2,
        top + 108,
        isBest ? "New best!" : `Best  ${Save.best.toLocaleString("en-US")}`,
        {
          fontFamily: FONT,
          fontSize: "13px",
          fontStyle: isBest ? "600" : "400",
          color: isBest ? "#37e0d0" : "#9aa3d0",
        }
      )
      .setOrigin(0.5);

    // Run summary — what actually happened, not just the number.
    const rowY = top + 152;
    const panel = this.add.graphics();
    panel.fillStyle(0xffffff, 0.05);
    panel.fillRoundedRect(WIDTH / 2 - 140, rowY - 26, 280, 84, 14);

    const cols = [
      { label: "FED", value: `${data.feeds}` },
      { label: "DROPS", value: `${data.drops}` },
      { label: "SIZE", value: milestoneName(data.milestone) },
    ];
    cols.forEach((c, i) => {
      const cx = WIDTH / 2 - 92 + i * 92;
      this.add
        .text(cx, rowY - 12, c.value, {
          fontFamily: FONT,
          fontSize: "19px",
          fontStyle: "600",
          color: "#eaf0ff",
        })
        .setOrigin(0.5);
      this.add
        .text(cx, rowY + 10, c.label, {
          fontFamily: FONT,
          fontSize: "10px",
          color: "#9aa3d0",
        })
        .setOrigin(0.5);
    });

    // Biggest food built, shown as the actual disc — the trophy of the run.
    if (data.biggestTier > 0) {
      this.add
        .text(WIDTH / 2 - 34, rowY + 40, "BIGGEST", {
          fontFamily: FONT,
          fontSize: "10px",
          color: "#9aa3d0",
        })
        .setOrigin(0.5);
      const disc = this.add.image(WIDTH / 2 + 22, rowY + 40, tierTexture(data.biggestTier));
      disc.setDisplaySize(22, 22);
      disc.setTint(COLORS.gold);
      this.add
        .text(WIDTH / 2 + 46, rowY + 40, `#${data.biggestTier}`, {
          fontFamily: FONT,
          fontSize: "13px",
          fontStyle: "600",
          color: "#eaf0ff",
        })
        .setOrigin(0.5);
    }

    this.add
      .text(WIDTH / 2, rowY + 78, `${name} reached ${milestoneName(data.milestone)} size`, {
        fontFamily: FONT,
        fontSize: "13px",
        color: "#aeb6e6",
      })
      .setOrigin(0.5);

    // Delay the buttons so the tap that ended the run can't hit one instantly.
    this.time.delayedCall(400, () => {
      makeButton(this, {
        x: WIDTH / 2,
        y: rowY + 132,
        label: "Play again",
        primary: true,
        onClick: () => {
          this.scene.stop();
          this.scene.stop("Game");
          this.scene.start("Game", data.dailyKey ? { dailyKey: data.dailyKey } : {});
        },
      });
      makeButton(this, {
        x: WIDTH / 2,
        y: rowY + 196,
        label: "Main menu",
        onClick: () => {
          this.scene.stop();
          this.scene.stop("Game");
          this.scene.start("Menu");
        },
      });
    });
  }
}

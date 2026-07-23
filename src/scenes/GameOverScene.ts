import Phaser from "phaser";
import { GAME, COLORS, UI_FONT, TEXT_RES } from "../config";
import { milestoneName } from "../data/milestones";
import { GameOverReason } from "../systems/GameState";
import { Save } from "../systems/Save";
import { ModeId } from "../systems/Modes";
import { makeButton } from "../objects/Button";
import { Cloud } from "../systems/Cloud";
import { ReplayEvent } from "../systems/Replay";

const FONT = UI_FONT;

interface GameOverData {
  score: number;
  milestone: number;
  reason: GameOverReason;
  feeds: number;
  drops: number;
  biggestTier: number;
  dailyKey: string | null;
  /** The permanent mode this run was played in. */
  mode: ModeId;
  /** The run's RNG seed, so the server can replay a casual run too. */
  seed: number;
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
    const isBest = Save.recordRun(run, data.dailyKey, data.mode);

    // The dimming overlay goes down FIRST so everything after it draws on top.
    // It used to be added late, which silently hid the sync status behind it —
    // a daily run that never posted looked like it had just done nothing.
    this.add
      .rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, COLORS.scrim, 0.94)
      .setOrigin(0.5);

    // A daily run that never reaches the leaderboard is the single most
    // confusing outcome here, so the result is always reported rather than
    // silently dropped. Still fire-and-forget: nothing blocks this screen.
    const syncNote = this.add
      .text(WIDTH / 2, 92, "", {
        fontFamily: FONT,
        resolution: TEXT_RES,
        fontSize: "12px",
        color: "#9b7a5f",
        align: "center",
        wordWrap: { width: WIDTH - 60 },
      })
      .setOrigin(0.5)
      .setDepth(10);

    syncNote.setText("Checking sign-in…");
    // Wait for the stored session to load before deciding — otherwise a quick
    // game-over can conclude "signed out" while the session is still loading.
    void Cloud.ready.then(() => {
      if (!Cloud.signedIn) {
        syncNote
          .setText("Not posted — sign in to join the leaderboards")
          .setColor("#c2670f");
        return;
      }
      void Cloud.pushProgress(Save.name, Save.best, Save.bestRun, Save.runs);
      // EVERY run is submitted now, not just dailies: a casual run carries its
      // seed, so the server can replay it for the all-time board too.
      syncNote.setText("Posting to leaderboard…");
      void Cloud.submitRun(data.dailyKey, data.mode, data.seed, run, data.events).then((r) => {
        if (r.ok && r.verified) {
          syncNote
            .setText(
              data.dailyKey
                ? "Verified — posted to today's board"
                : "Verified — counted for all-time"
            )
            .setColor("#d98324");
        } else {
          syncNote
            .setText(`Not posted: ${r.error ?? "unknown error"}`)
            .setColor("#c2670f");
        }
      });
    });

    const top = 120;
    this.add
      .text(WIDTH / 2, top, data.dailyKey ? "Daily challenge over" : "Game over", {
        fontFamily: FONT,
        resolution: TEXT_RES,
        fontSize: "26px",
        fontStyle: "500",
        color: "#4a3327",
      })
      .setOrigin(0.5);
    this.add
      .text(WIDTH / 2, top + 30, "The bin overflowed.", {
        fontFamily: FONT,
        resolution: TEXT_RES,
        fontSize: "13px",
        color: "#6d5443",
      })
      .setOrigin(0.5);

    this.add
      .text(WIDTH / 2, top + 74, data.score.toLocaleString("en-US"), {
        fontFamily: FONT,
        resolution: TEXT_RES,
        fontSize: "44px",
        fontStyle: "600",
        color: "#d98324",
      })
      .setOrigin(0.5);
    this.add
      .text(
        WIDTH / 2,
        top + 108,
        isBest ? "New best!" : `Best  ${Save.best.toLocaleString("en-US")}`,
        {
          fontFamily: FONT,
        resolution: TEXT_RES,
          fontSize: "13px",
          fontStyle: isBest ? "600" : "400",
          color: isBest ? "#d98324" : "#9b7a5f",
        }
      )
      .setOrigin(0.5);

    // Run summary — what actually happened, not just the number. The panel is
    // sized to the single stat row now that the "biggest food" trophy is gone
    // (it wasn't telling the player anything the SIZE column didn't).
    const rowY = top + 152;
    const panel = this.add.graphics();
    panel.fillStyle(COLORS.ink, 0.12);
    panel.fillRoundedRect(WIDTH / 2 - 140, rowY - 26, 280, 56, 14);

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
        resolution: TEXT_RES,
          fontSize: "19px",
          fontStyle: "600",
          color: "#4a3327",
        })
        .setOrigin(0.5);
      this.add
        .text(cx, rowY + 10, c.label, {
          fontFamily: FONT,
        resolution: TEXT_RES,
          fontSize: "10px",
          color: "#9b7a5f",
        })
        .setOrigin(0.5);
    });

    this.add
      .text(WIDTH / 2, rowY + 58, `${name} reached ${milestoneName(data.milestone)} size`, {
        fontFamily: FONT,
        resolution: TEXT_RES,
        fontSize: "13px",
        color: "#6d5443",
      })
      .setOrigin(0.5);

    // Delay the buttons so the tap that ended the run can't hit one instantly.
    this.time.delayedCall(400, () => {
      makeButton(this, {
        x: WIDTH / 2,
        y: rowY + 112,
        label: "Play again",
        primary: true,
        onClick: () => {
          this.scene.stop();
          this.scene.stop("Game");
          this.scene.start("Game", data.dailyKey ? { dailyKey: data.dailyKey } : { mode: data.mode });
        },
      });
      makeButton(this, {
        x: WIDTH / 2,
        y: rowY + 176,
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

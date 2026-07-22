import Phaser from "phaser";
import { GAME, COLORS, UI_FONT, TEXT_RES } from "../config";
import { milestoneName } from "../data/milestones";
import { Save } from "../systems/Save";
import { makeButton } from "../objects/Button";
import { openNameEntry } from "../objects/NameEntry";
import { tierTexture } from "../data/foods";
import { todayKey } from "../systems/Rng";
import { Cloud } from "../systems/Cloud";

const FONT = UI_FONT;

/**
 * Your monster's record. Local-only for now: everything here comes from
 * localStorage, so it survives reloads on this device but doesn't follow you
 * anywhere. Accounts (and the shared leaderboard) need a backend — see the
 * notes in the project memory before wiring one up.
 */
export class ProfileScene extends Phaser.Scene {
  private bestValue!: Phaser.GameObjects.Text;

  constructor() {
    super("Profile");
  }

  /**
   * Replace the device-local best with the account's, once it arrives.
   *
   * Deliberately async and non-blocking: the screen renders immediately from
   * the local save and corrects itself a moment later, so a slow network never
   * leaves the profile blank.
   */
  private async syncAccountBest(): Promise<void> {
    await Cloud.ready;
    await Cloud.pullProgress();
    if (!this.scene.isActive()) return;
    const best = Save.best;
    this.bestValue.setText(best ? best.toLocaleString("en-US") : "—");
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
      .text(WIDTH / 2, 74, Save.name || "Your monster", {
        fontFamily: FONT,
        resolution: TEXT_RES,
        fontSize: "28px",
        fontStyle: "600",
        color: "#4a3327",
      })
      .setOrigin(0.5);
    this.add
      .text(WIDTH / 2, 106, `${Save.runs} run${Save.runs === 1 ? "" : "s"} played`, {
        fontFamily: FONT,
        resolution: TEXT_RES,
        fontSize: "12px",
        color: "#9b7a5f",
      })
      .setOrigin(0.5);

    const best = Save.bestRun;
    const panelY = 150;
    const panel = this.add.graphics();
    panel.fillStyle(COLORS.ink, 0.12);
    panel.fillRoundedRect(36, panelY, WIDTH - 72, best ? 190 : 96, 16);

    this.add
      .text(WIDTH / 2, panelY + 22, "BEST RUN", {
        fontFamily: FONT,
        resolution: TEXT_RES,
        fontSize: "10px",
        color: "#9b7a5f",
      })
      .setOrigin(0.5);

    if (!best) {
      this.add
        .text(WIDTH / 2, panelY + 58, "No runs yet — go feed something.", {
          fontFamily: FONT,
        resolution: TEXT_RES,
          fontSize: "13px",
          color: "#6d5443",
        })
        .setOrigin(0.5);
    } else {
      this.add
        .text(WIDTH / 2, panelY + 56, best.score.toLocaleString("en-US"), {
          fontFamily: FONT,
        resolution: TEXT_RES,
          fontSize: "40px",
          fontStyle: "600",
          color: "#d98324",
        })
        .setOrigin(0.5);

      const rows: [string, string][] = [
        ["Size reached", milestoneName(best.milestone)],
        ["Cravings fed", `${best.feeds}`],
        ["Food dropped", `${best.drops}`],
      ];
      rows.forEach(([label, value], i) => {
        const y = panelY + 96 + i * 24;
        this.add
          .text(58, y, label, { fontFamily: FONT,
        resolution: TEXT_RES, fontSize: "13px", color: "#9b7a5f" })
          .setOrigin(0, 0.5);
        this.add
          .text(WIDTH - 58, y, value, {
            fontFamily: FONT,
        resolution: TEXT_RES,
            fontSize: "13px",
            fontStyle: "600",
            color: "#4a3327",
          })
          .setOrigin(1, 0.5);
      });

      const y = panelY + 168;
      this.add
        .text(58, y, "Biggest food", { fontFamily: FONT,
        resolution: TEXT_RES, fontSize: "13px", color: "#9b7a5f" })
        .setOrigin(0, 0.5);
      const disc = this.add.image(WIDTH - 96, y, tierTexture(best.biggestTier || 1));
      disc.setDisplaySize(20, 20);
      this.add
        .text(WIDTH - 58, y, `#${best.biggestTier}`, {
          fontFamily: FONT,
        resolution: TEXT_RES,
          fontSize: "13px",
          fontStyle: "600",
          color: "#4a3327",
        })
        .setOrigin(1, 0.5);
    }

    // The two numbers that actually rank you, side by side.
    const key = todayKey();
    const todayScore = Save.dailyBest(key);
    const statsY = panelY + (best ? 222 : 128);
    this.bestValue = this.add
      .text(WIDTH / 2 - 78, statsY, Save.best ? Save.best.toLocaleString("en-US") : "—", {
        fontFamily: FONT,
        resolution: TEXT_RES,
        fontSize: "22px",
        fontStyle: "600",
        color: "#d98324",
      })
      .setOrigin(0.5);
    this.add
      .text(WIDTH / 2 - 78, statsY + 24, "ALL-TIME BEST", {
        fontFamily: FONT,
        resolution: TEXT_RES,
        fontSize: "10px",
        color: "#9b7a5f",
      })
      .setOrigin(0.5);
    this.add
      .text(WIDTH / 2 + 78, statsY, todayScore ? todayScore.toLocaleString("en-US") : "—", {
        fontFamily: FONT,
        resolution: TEXT_RES,
        fontSize: "22px",
        fontStyle: "600",
        color: "#d98324",
      })
      .setOrigin(0.5);
    this.add
      .text(WIDTH / 2 + 78, statsY + 24, "TODAY'S DAILY", {
        fontFamily: FONT,
        resolution: TEXT_RES,
        fontSize: "10px",
        color: "#9b7a5f",
      })
      .setOrigin(0.5);

    // The local save is per-DEVICE, so showing it as "all-time best" made the
    // same account read differently on a second device. When signed in, take
    // the number from the account and fold it back into this device's save.
    if (Cloud.signedIn) void this.syncAccountBest();

    this.add
      .text(
        WIDTH / 2,
        HEIGHT - 232,
        Cloud.signedIn
          ? "Signed in — progress syncs to your account."
          : Cloud.enabled
            ? "Saved on this device. Sign in to sync."
            : "Progress is saved on this device only.",
        {
          fontFamily: FONT,
        resolution: TEXT_RES,
          fontSize: "11px",
          color: "#ab8d74",
          align: "center",
          lineSpacing: 4,
        }
      )
      .setOrigin(0.5);

    makeButton(this, {
      x: WIDTH / 2,
      y: HEIGHT - 186,
      label: "Rename monster",
      onClick: () =>
        openNameEntry(this, { forced: false, onSaved: () => this.scene.restart() }),
    });
    makeButton(this, {
      x: WIDTH / 2,
      y: HEIGHT - 122,
      label: Cloud.signedIn ? "Account" : "Sign in",
      onClick: () => this.scene.start("Account"),
    });
    makeButton(this, {
      x: WIDTH / 2,
      y: HEIGHT - 58,
      label: "Back",
      onClick: () => this.scene.start("Menu"),
    });
  }
}

import Phaser from "phaser";
import { GAME, COLORS } from "../config";
import { milestoneName } from "../data/milestones";
import { Save } from "../systems/Save";
import { makeButton } from "../objects/Button";
import { openNameEntry } from "../objects/NameEntry";
import { tierTexture } from "../data/foods";
import { todayKey } from "../systems/Rng";
import { Cloud } from "../systems/Cloud";

const FONT = "system-ui, -apple-system, sans-serif";

/**
 * Your monster's record. Local-only for now: everything here comes from
 * localStorage, so it survives reloads on this device but doesn't follow you
 * anywhere. Accounts (and the shared leaderboard) need a backend — see the
 * notes in the project memory before wiring one up.
 */
export class ProfileScene extends Phaser.Scene {
  constructor() {
    super("Profile");
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
        fontSize: "28px",
        fontStyle: "600",
        color: "#eaf0ff",
      })
      .setOrigin(0.5);
    this.add
      .text(WIDTH / 2, 106, `${Save.runs} run${Save.runs === 1 ? "" : "s"} played`, {
        fontFamily: FONT,
        fontSize: "12px",
        color: "#9aa3d0",
      })
      .setOrigin(0.5);

    const best = Save.bestRun;
    const panelY = 150;
    const panel = this.add.graphics();
    panel.fillStyle(0xffffff, 0.05);
    panel.fillRoundedRect(36, panelY, WIDTH - 72, best ? 190 : 96, 16);

    this.add
      .text(WIDTH / 2, panelY + 22, "BEST RUN", {
        fontFamily: FONT,
        fontSize: "10px",
        color: "#9aa3d0",
      })
      .setOrigin(0.5);

    if (!best) {
      this.add
        .text(WIDTH / 2, panelY + 58, "No runs yet — go feed something.", {
          fontFamily: FONT,
          fontSize: "13px",
          color: "#aeb6e6",
        })
        .setOrigin(0.5);
    } else {
      this.add
        .text(WIDTH / 2, panelY + 56, best.score.toLocaleString("en-US"), {
          fontFamily: FONT,
          fontSize: "40px",
          fontStyle: "600",
          color: "#ffe08a",
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
          .text(58, y, label, { fontFamily: FONT, fontSize: "13px", color: "#9aa3d0" })
          .setOrigin(0, 0.5);
        this.add
          .text(WIDTH - 58, y, value, {
            fontFamily: FONT,
            fontSize: "13px",
            fontStyle: "600",
            color: "#eaf0ff",
          })
          .setOrigin(1, 0.5);
      });

      const y = panelY + 168;
      this.add
        .text(58, y, "Biggest food", { fontFamily: FONT, fontSize: "13px", color: "#9aa3d0" })
        .setOrigin(0, 0.5);
      const disc = this.add.image(WIDTH - 76, y, tierTexture(best.biggestTier || 1));
      disc.setDisplaySize(20, 20);
      disc.setTint(COLORS.gold);
      this.add
        .text(WIDTH - 58, y, `#${best.biggestTier}`, {
          fontFamily: FONT,
          fontSize: "13px",
          fontStyle: "600",
          color: "#eaf0ff",
        })
        .setOrigin(1, 0.5);
    }

    // The two numbers that actually rank you, side by side.
    const key = todayKey();
    const todayScore = Save.dailyBest(key);
    const statsY = panelY + (best ? 222 : 128);
    const cols: [string, string][] = [
      ["ALL-TIME BEST", Save.best ? Save.best.toLocaleString("en-US") : "—"],
      ["TODAY'S DAILY", todayScore ? todayScore.toLocaleString("en-US") : "—"],
    ];
    cols.forEach(([label, value], i) => {
      const cx = WIDTH / 2 + (i === 0 ? -78 : 78);
      this.add
        .text(cx, statsY, value, {
          fontFamily: FONT,
          fontSize: "22px",
          fontStyle: "600",
          color: "#ffe08a",
        })
        .setOrigin(0.5);
      this.add
        .text(cx, statsY + 24, label, {
          fontFamily: FONT,
          fontSize: "10px",
          color: "#9aa3d0",
        })
        .setOrigin(0.5);
    });

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
          fontSize: "11px",
          color: "#6f78a8",
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

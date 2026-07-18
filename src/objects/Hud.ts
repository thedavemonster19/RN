import Phaser from "phaser";
import { GAME, COLORS } from "../config";
import { GameState, Spec } from "../systems/GameState";
import { milestoneName } from "../data/milestones";
import { MAX_TIER, foodColor, tierTexture } from "../data/foods";

const FONT = "system-ui, -apple-system, sans-serif";

/**
 * A HUD disc standing in for a food. Real discs range from 22px to 124px
 * across, which won't fit a side panel, so these are drawn on a squashed scale
 * that still reads bigger-tier-is-bigger. Colour is the food's type.
 */
function panelDiameter(tier: number): number {
  return 20 + ((tier - 1) / (MAX_TIER - 1)) * 24;
}

function paintDisc(img: Phaser.GameObjects.Image, spec: Spec): void {
  img.setTexture(tierTexture(spec.tier));
  img.setTint(foodColor(spec.type, spec.tier));
  img.setDisplaySize(panelDiameter(spec.tier), panelDiameter(spec.tier));
}

/**
 * On-canvas HUD: size/score header, the growth bar, the exact food the monster
 * WANTS (with the cravings queued behind it), the queue of food you get to
 * drop, and the overflow warning. Placeholder styling for the art pass; reads
 * everything live from GameState.
 */
export class Hud {
  private state: GameState;

  private sizeText: Phaser.GameObjects.Text;
  private scoreText: Phaser.GameObjects.Text;
  private warnText: Phaser.GameObjects.Text;
  private bars: Phaser.GameObjects.Graphics;

  private wantDisc: Phaser.GameObjects.Image;
  private wantLabel: Phaser.GameObjects.Text;
  private cravingDiscs: Phaser.GameObjects.Image[] = [];
  private dropDiscs: Phaser.GameObjects.Image[] = [];
  private chainDiscs: Phaser.GameObjects.Image[] = [];
  private fedText: Phaser.GameObjects.Text;

  /** Seconds left before overflow ends the game, or null when safe. */
  overflowCountdown: number | null = null;

  constructor(scene: Phaser.Scene, state: GameState) {
    this.state = state;
    const depth = 20;

    // Header: the score is the hero, the milestone is a quiet caption beneath
    // it, and the growth bar is a slim rule under both. One centred column
    // reads cleaner than the old score-right / label-left split.
    this.scoreText = scene.add
      .text(GAME.WIDTH / 2, 16, "", {
        fontFamily: FONT,
        fontSize: "34px",
        fontStyle: "600",
        color: "#eaf0ff",
      })
      .setOrigin(0.5, 0)
      .setDepth(depth);
    this.sizeText = scene.add
      .text(GAME.WIDTH / 2, 56, "", {
        fontFamily: FONT,
        fontSize: "11px",
        color: "#9aa3d0",
      })
      .setOrigin(0.5, 0)
      .setDepth(depth);

    this.warnText = scene.add
      .text(GAME.WIDTH / 2, 216, "", {
        fontFamily: FONT,
        fontSize: "15px",
        fontStyle: "500",
        color: "#ff6b7d",
      })
      .setOrigin(0.5, 1)
      .setDepth(depth)
      .setVisible(false);

    this.bars = scene.add.graphics().setDepth(depth);

    // WANTS panel (right): the exact food the monster will accept, and the one
    // coming after it — enough to plan a hold-or-spend, without the repetitive
    // stack of lookahead discs.
    const px = GAME.WIDTH - 30;
    const panel = scene.add.graphics().setDepth(depth - 1);
    panel.fillStyle(0xffffff, 0.06);
    panel.fillRoundedRect(px - 26, 100, 52, 134, 12);
    scene.add
      .text(px, 108, "WANTS", { fontFamily: FONT, fontSize: "10px", color: "#9aa3d0" })
      .setOrigin(0.5)
      .setDepth(depth);
    this.wantDisc = scene.add.image(px, 140, "food1").setDepth(depth);
    this.wantLabel = scene.add
      .text(px, 140, "", {
        fontFamily: FONT,
        fontSize: "13px",
        fontStyle: "700",
        color: "#1b1f3d",
      })
      .setOrigin(0.5)
      .setDepth(depth + 1);
    scene.add
      .text(px, 180, "THEN", { fontFamily: FONT, fontSize: "10px", color: "#9aa3d0" })
      .setOrigin(0.5)
      .setDepth(depth);
    this.cravingDiscs = [206].map((qy) =>
      scene.add.image(px, qy, "food1").setAlpha(0.75).setDepth(depth)
    );

    // DROPS panel (left): the food you're about to drop, and what follows.
    const dx = 30;
    const dpanel = scene.add.graphics().setDepth(depth - 1);
    dpanel.fillStyle(0xffffff, 0.06);
    dpanel.fillRoundedRect(dx - 26, 200, 52, 150, 12);
    scene.add
      .text(dx, 208, "DROPS", { fontFamily: FONT, fontSize: "10px", color: "#9aa3d0" })
      .setOrigin(0.5)
      .setDepth(depth);
    this.dropDiscs = [236, 268, 298, 326].map((qy, i) =>
      scene.add
        .image(dx, qy, "food1")
        .setAlpha(i === 0 ? 1 : 0.6)
        .setDepth(depth)
    );

    // The food chain, tier 1 → 10 left to right along the bottom — the whole
    // merge ladder at a glance, with the currently craved tier lit up. Doubles
    // as the tutorial: you can read "what merges into what" without being told.
    const chainY = GAME.HEIGHT - 20;
    const chainLeft = 24;
    const chainStep = (GAME.WIDTH - 76 - chainLeft) / (MAX_TIER - 1);
    this.chainDiscs = [];
    for (let t = 1; t <= MAX_TIER; t++) {
      const d = scene.add
        .image(chainLeft + (t - 1) * chainStep, chainY, tierTexture(t))
        .setDepth(depth);
      const dia = 10 + t * 2; // display size only — real radii wouldn't fit
      d.setDisplaySize(dia, dia);
      this.chainDiscs.push(d);
    }
    this.fedText = scene.add
      .text(GAME.WIDTH / 2, GAME.HEIGHT - 46, "", {
        fontFamily: FONT,
        fontSize: "11px",
        color: "#9aa3d0",
      })
      .setOrigin(0.5)
      .setDepth(depth);
  }

  update(): void {
    const s = this.state;
    this.sizeText.setText(`GROWING TO ${milestoneName(s.milestone).toUpperCase()}`);
    // Thousands separators: scores run to five figures and read as a wall of
    // digits without them.
    this.scoreText.setText(s.score.toLocaleString("en-US"));
    this.fedText.setText(
      s.totalFeeds === 1 ? "1 fed" : `${s.totalFeeds} fed`
    );
    paintDisc(this.wantDisc, s.craving);
    this.wantLabel.setText(`${s.craving.tier}`);
    this.chainDiscs.forEach((d, i) => {
      const tier = i + 1;
      d.setTint(foodColor(s.craving.type, tier));
      d.setAlpha(tier === s.craving.tier ? 1 : 0.4);
    });
    s.cravingQueue.forEach((c, i) => {
      const d = this.cravingDiscs[i];
      if (d) paintDisc(d, c);
    });
    s.dropQueue.forEach((c, i) => {
      const d = this.dropDiscs[i];
      if (d) paintDisc(d, c);
    });

    if (this.overflowCountdown !== null) {
      this.warnText
        .setText(`Overflow! Clear the bin — ${this.overflowCountdown}`)
        .setVisible(true);
    } else {
      this.warnText.setVisible(false);
    }

    const g = this.bars;
    g.clear();

    // Growth: a slim inset rule under the header rather than a full-bleed
    // slab, so it supports the score instead of competing with it.
    const bw = 200;
    const bx = (GAME.WIDTH - bw) / 2;
    g.fillStyle(0xffffff, 0.12);
    g.fillRoundedRect(bx, 74, bw, 5, 2.5);
    g.fillStyle(COLORS.teal, 1);
    g.fillRoundedRect(bx, 74, Math.max(4, bw * s.growthProgress), 5, 2.5);

    // Freshness: the little fuse under the craving. Full = full bonus; it
    // burns down as you take drops, and empty just means base pay.
    const px = GAME.WIDTH - 30;
    const f = s.freshness;
    g.fillStyle(0xffffff, 0.14);
    g.fillRoundedRect(px - 20, 166, 40, 5, 2);
    if (f > 0) {
      g.fillStyle(f > 0.6 ? COLORS.teal : f > 0.25 ? COLORS.amber : COLORS.coral, 1);
      g.fillRoundedRect(px - 20, 166, Math.max(3, 40 * f), 5, 2);
    }
  }
}

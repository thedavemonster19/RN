import Phaser from "phaser";
import { GAME, COLORS, UI_FONT, TEXT_RES } from "../config";
import { GameState, Spec } from "../systems/GameState";
import { milestoneName } from "../data/milestones";
import { MAX_TIER, tierTexture } from "../data/foods";

const FONT = UI_FONT;

/**
 * The bonus bar's strip, in the gap between the bin floor (470) and a
 * fully-grown monster. Clearance is tight at BOTH ends: the monster's leaf
 * sprout reaches ~485 (not the 490 of BODY_HALF), and a large food resting on
 * the bin floor has square sprite bounds that reach the floor line at 470. Deliberately the full width of the bin so it
 * reads as belonging to the play area rather than to the side panels.
 */
const HUD_BONUS = { x: 106, y: 475, w: 234, h: 9 } as const;

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
      .text(GAME.WIDTH / 2, 10, "", {
        fontFamily: FONT,
        resolution: TEXT_RES,
        fontSize: "34px",
        fontStyle: "600",
        color: "#4a3327",
      })
      .setOrigin(0.5, 0)
      .setDepth(depth);
    // y=56 put this INSIDE the score's box: a 34px line renders ~44px tall, so
    // the score occupied 10-54 and the caption was overlapping its descenders.
    this.sizeText = scene.add
      .text(GAME.WIDTH / 2, 56, "", {
        fontFamily: FONT,
        resolution: TEXT_RES,
        fontSize: "11px",
        color: "#9b7a5f",
      })
      .setOrigin(0.5, 0)
      .setDepth(depth);

    this.warnText = scene.add
      .text(GAME.WIDTH / 2, 216, "", {
        fontFamily: FONT,
        resolution: TEXT_RES,
        fontSize: "15px",
        fontStyle: "500",
        color: "#d43a55",
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
    panel.fillStyle(COLORS.ink, 0.13);
    panel.fillRoundedRect(px - 26, 100, 52, 134, 12);
    scene.add
      .text(px, 108, "WANTS", { fontFamily: FONT,
        resolution: TEXT_RES, fontSize: "10px", color: "#9b7a5f" })
      .setOrigin(0.5)
      .setDepth(depth);
    // No tier number stamped on it: the food's own artwork already says which
    // one it is, and the chain along the bottom shows where that sits in the
    // ladder. The digit was a third encoding of the same fact, printed over
    // the art it was describing.
    this.wantDisc = scene.add.image(px, 140, "food1").setDepth(depth);
    scene.add
      .text(px, 180, "THEN", { fontFamily: FONT,
        resolution: TEXT_RES, fontSize: "10px", color: "#9b7a5f" })
      .setOrigin(0.5)
      .setDepth(depth);
    this.cravingDiscs = [206].map((qy) =>
      scene.add.image(px, qy, "food1").setAlpha(0.9).setDepth(depth)
    );

    // DROPS panel (left): the food you're about to drop, and what follows.
    const dx = 30;
    const dpanel = scene.add.graphics().setDepth(depth - 1);
    dpanel.fillStyle(COLORS.ink, 0.13);
    dpanel.fillRoundedRect(dx - 26, 200, 52, 150, 12);
    scene.add
      .text(dx, 208, "DROPS", { fontFamily: FONT,
        resolution: TEXT_RES, fontSize: "10px", color: "#9b7a5f" })
      .setOrigin(0.5)
      .setDepth(depth);
    this.dropDiscs = [236, 268, 298, 326].map((qy, i) =>
      scene.add
        .image(dx, qy, "food1")
        .setAlpha(i === 0 ? 1 : 0.82)
        .setDepth(depth)
    );

    // Label for the bonus strip, left of the bar rather than above it: the
    // band between the bin floor and the monster is only ~16px tall.
    scene.add
      .text(HUD_BONUS.x - 8, HUD_BONUS.y + HUD_BONUS.h / 2, "BONUS", {
        fontFamily: FONT,
        resolution: TEXT_RES,
        fontSize: "10px",
        fontStyle: "600",
        color: "#9b7a5f",
      })
      .setOrigin(1, 0.5)
      .setDepth(depth);

    // The food chain, tier 1 → 10 left to right along the bottom — the whole
    // merge ladder at a glance, with the currently craved tier lit up. Doubles
    // as the tutorial: you can read "what merges into what" without being told.
    const chainY = GAME.HEIGHT - 22;
    const chainLeft = 26;
    const chainStep = (GAME.WIDTH - 76 - chainLeft) / (MAX_TIER - 1);
    this.chainDiscs = [];
    for (let t = 1; t <= MAX_TIER; t++) {
      const d = scene.add
        .image(chainLeft + (t - 1) * chainStep, chainY, tierTexture(t))
        .setDepth(depth);
      // Display size only — the real radii (11px to 128px) would never fit.
      // Sized up from 10+2t: the ladder is the closest thing the game has to a
      // tutorial, and at the old size it read as decoration.
      const dia = 15 + t * 2.8;
      d.setDisplaySize(dia, dia);
      this.chainDiscs.push(d);
    }
    this.fedText = scene.add
      .text(GAME.WIDTH / 2, GAME.HEIGHT - 54, "", {
        fontFamily: FONT,
        resolution: TEXT_RES,
        fontSize: "11px",
        color: "#9b7a5f",
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
    this.chainDiscs.forEach((d, i) => {
      const tier = i + 1;
      d.setTexture(tierTexture(tier));
      d.setAlpha(tier === s.craving.tier ? 1 : 0.7);
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
    g.fillStyle(COLORS.ink, 0.12);
    g.fillRoundedRect(bx, 74, bw, 5, 2.5);
    g.fillStyle(COLORS.teal, 1);
    g.fillRoundedRect(bx, 74, Math.max(4, bw * s.growthProgress), 5, 2.5);

    // Bonus (freshness): full = full bonus, and it burns down as you take
    // drops. It used to be a 40x5px sliver tucked inside the 52px-wide WANTS
    // column, which is why it was easy to miss entirely. It now gets its own
    // strip in the gap between the bin floor and the monster — the widest
    // empty band on the screen, and directly in the path between the food and
    // the mouth, which is where you are already looking.
    const f = s.freshness;
    const fx = HUD_BONUS.x;
    const fw = HUD_BONUS.w;
    g.fillStyle(COLORS.ink, 0.18);
    g.fillRoundedRect(fx, HUD_BONUS.y, fw, HUD_BONUS.h, HUD_BONUS.h / 2);
    if (f > 0) {
      g.fillStyle(f > 0.6 ? COLORS.teal : f > 0.25 ? COLORS.amber : COLORS.coral, 1);
      g.fillRoundedRect(fx, HUD_BONUS.y, Math.max(HUD_BONUS.h, fw * f), HUD_BONUS.h, HUD_BONUS.h / 2);
    }
  }
}

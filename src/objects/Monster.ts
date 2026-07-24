import Phaser from "phaser";
import { COLORS, UI_FONT, TEXT_RES } from "../config";
import { milestoneName, currentMetres, targetMetres } from "../data/milestones";
import { refKey } from "../data/refArt";
import { BODY_ART } from "../data/monsterArt";

/** Scale at the starting (newborn) size, and how big it's allowed to get.
 *  Kept modest so the wider bin and the food-chain bar have room to breathe. */
const BASE_SCALE = 0.4;
/**
 * The mochi's cherry sits at body y=-83. At the old cap of 1.1 that put its top
 * at 560 - 83*1.1 = 469 — INSIDE the bin, whose floor is 470, so the hat poked
 * through the bin's bottom edge. 0.95 keeps the whole monster clear of it while
 * still nearly doubling its size over a run.
 */
const MAX_SCALE = 0.95;
/** Half the drawn body height, for placing the size label below. */
const BODY_HALF = 64;
/** The lowest the name/size label may sit before it collides with the fed
 *  counter and the food-chain bar. */
const LABEL_MAX_Y = 646;

type Face = "happy" | "eating" | "refuse";

/**
 * Which monster to draw.
 *
 * "mochi" is the bakery redesign: a strawberry-milk dumpling with a piped cream
 * swirl and simple dot eyes. Its BODY is a painted texture (data/monsterArt) so
 * it can carry one clean outline and real shading; only the face is drawn here,
 * since that changes per expression. "classic" is the original teal sprout-blob,
 * still fully drawn with Graphics below — switching back is this one word.
 */
const MONSTER_STYLE: "mochi" | "classic" = "mochi";

/** Eye/mouth ink — warm brown to sit in the cream-and-brown theme, not navy. */
const INK = 0x4a3327;

/** Total drawn height of the monster in body units (cherry top to feet). */
const BODY_SPAN = 144;

/**
 * One aura colour per size milestone, cycling once it runs off the end. Warm
 * bakery tones now — honey, berry, caramel — so a level-up reads as a visible
 * change of state without clashing with the cream page.
 */
const AURA_COLORS = [
  0xf7c948, 0xf29ab0, 0xe8a15a, 0xef7a9b, 0xd98324, 0xd85a7e, 0xc9a24a,
  0xb56d8a,
];

/**
 * The monster: a soft bakery blob drawn rather than emoji'd, so its
 * expressions are part of the artwork instead of a character floating above
 * its head. See MONSTER_STYLE for the two designs.
 *
 * The look leans on the usual shorthand for "cute": a squat rounded body,
 * oversized simple eyes with a single highlight, and blush.
 */
export class Monster {
  private scene: Phaser.Scene;
  readonly x: number;
  readonly y: number;
  private container: Phaser.GameObjects.Container;
  private aura: Phaser.GameObjects.Graphics;
  private auraPulse?: Phaser.Tweens.Tween;
  private face: Phaser.GameObjects.Graphics;
  private sizeLabel: Phaser.GameObjects.Text;
  /** A fixed-size figure the monster is compared against — see drawScaleRef. */
  private scaleRef?: Phaser.GameObjects.Image;
  private scaleRefLabel?: Phaser.GameObjects.Text;
  private baseScale = BASE_SCALE;
  private monsterName = "";
  private sizeText = "";

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene;
    this.x = x;
    this.y = y;

    // The aura sits behind the body inside the same container, so it scales
    // with the monster automatically.
    this.aura = scene.add.graphics();
    // The mochi body is a pre-painted texture (see data/monsterArt): a single
    // silhouette with one outline and real shading, which overlapping Graphics
    // ellipses could never carry. The classic style still draws with Graphics.
    const body: Phaser.GameObjects.GameObject =
      MONSTER_STYLE === "mochi"
        ? scene.add
            .image(0, 0, "monsterBody")
            .setOrigin(BODY_ART.ox / BODY_ART.w, BODY_ART.oy / BODY_ART.h)
            .setDisplaySize(BODY_ART.w, BODY_ART.h)
        : (() => {
            const g = scene.add.graphics();
            this.drawBody(g);
            return g;
          })();
    this.face = scene.add.graphics();

    this.container = scene.add
      .container(x, y, [this.aura, body, this.face])
      .setDepth(1)
      .setScale(this.baseScale);

    this.drawAura(0);

    this.sizeLabel = scene.add
      .text(x, y, "0.3 m", {
        fontFamily: UI_FONT,
        resolution: TEXT_RES,
        fontSize: "17px",
        fontStyle: "500",
        color: "#4a3327",
      })
      .setOrigin(0.5)
      .setDepth(2);

    this.setFace("happy");
    this.layoutLabels();

    // The scale reference is off by default (the menu doesn't want it); a scene
    // that shows the monster growing turns it on.
    this.buildScaleRef();
    this.setScaleRefVisible(false);
  }

  /** Show or hide the scale reference beside the monster. */
  setScaleRefVisible(visible: boolean): void {
    this.scaleRef?.setVisible(visible);
    this.scaleRefLabel?.setVisible(visible);
  }

  /**
   * A soft halo whose colour marks the current milestone and whose reach grows
   * with it. Drawn as a few nested rings at low alpha rather than a real blur,
   * which Graphics can't do — cheap, and it reads as a glow at these sizes.
   */
  private drawAura(milestone: number): void {
    const g = this.aura;
    g.clear();
    if (milestone <= 0) return; // a newborn has nothing to show off yet

    const color = AURA_COLORS[(milestone - 1) % AURA_COLORS.length];
    // Reach grows with milestone but flattens, so late levels don't swamp the
    // screen. Rings fade outward.
    const spread = 62 + Math.min(milestone, 10) * 7;
    const rings = 5;
    for (let i = rings; i >= 1; i--) {
      const t = i / rings;
      g.fillStyle(color, 0.1 * (1 - t) + 0.03);
      g.fillEllipse(0, 6, spread * 2 * t, spread * 1.85 * t);
    }
  }

  /**
   * The thing the monster is measured against, standing on its ground line.
   *
   * A single fixed baker only works while the monster is person-sized — once
   * it's a Town there is no sense in comparing it to a man. So the REFERENCE
   * swaps up a ladder as the monster levels (baker → house → tower → town →
   * planet → galaxy) while each one is drawn at the same modest footprint. The
   * monster visibly outgrows each reference, then the reference is replaced by
   * something far bigger and the chase starts again — which is what keeps the
   * sense of scale going long after the sprite has hit its size cap.
   *
   * Drawn OUTSIDE the scaling container so it never scales with the monster.
   */
  private buildScaleRef(): void {
    // Bottom-centre origin so the artwork stands ON the ground line whatever
    // its height.
    this.scaleRef = this.scene.add
      .image(this.x - 150, this.y + 58, refKey(0))
      .setOrigin(0.5, 1)
      .setDepth(0);
    this.scaleRefLabel = this.scene.add
      .text(this.x - 150, this.y + 70, "", {
        fontFamily: UI_FONT,
        resolution: TEXT_RES,
        fontSize: "8px",
        color: "#9b7a5f",
      })
      .setOrigin(0.5)
      .setDepth(0)
      .setName("scaleRefLabel");
    this.drawScaleRef(0);
  }

  /**
   * Draw the thing the monster is growing TOWARD, beside it, sized from the
   * real-world ratio between them.
   *
   * The reference is indexed by milestone, so it is always exactly what the HUD
   * announces — a City when it says GROWING TO CITY. The previous version chose
   * from a shorter list by size, which skipped Country and Continent outright
   * and stood a planet beside a monster only growing to a City.
   *
   * The ratio is LOG-COMPRESSED rather than literal. Real ratios here run from
   * about 3x (Dog to Human) to 60,000x (Building to Town) — the large ones
   * cannot be drawn beside a 140px monster at all. Compressing log10 into a
   * 1.25x..2.4x band keeps the ORDER honest: the monster is always smaller than
   * what it is chasing, and a huge leap looks bigger than a small one.
   */
  private drawScaleRef(milestone: number): void {
    const img = this.scaleRef;
    if (!img) return;

    const m = Math.max(0, milestone);
    img.setTexture(refKey(m));

    const monsterScale = Math.min(BASE_SCALE + m * 0.09, MAX_SCALE);
    const monsterPx = BODY_SPAN * monsterScale;
    const trueRatio = Math.max(1, targetMetres(m) / currentMetres(m));
    const compressed = 1.25 + 1.15 * Math.min(1, Math.log10(trueRatio) / 3);
    // Capped at 142: the gap between the bin floor (470) and the shared ground
    // line (y+58 = 618) is 148px, and a taller reference would poke into the
    // bin. It still exceeds the monster's own max of ~137px.
    const heightPx = Math.max(38, Math.min(monsterPx * compressed, 142));

    // Keep the artwork's own aspect — the texture is cropped to its bounds, so
    // a car stays short and wide and a tower tall and narrow.
    const src = img.texture.getSourceImage() as { width: number; height: number };
    const aspect = src && src.height ? src.width / src.height : 1;
    img.setDisplaySize(heightPx * aspect, heightPx);
    img.setPosition(this.x - 150, this.y + 58);

    this.scaleRefLabel?.setText(milestoneName(m).toLowerCase());
  }

  /**
   * The classic body, drawn with Graphics. The mochi body is NOT here — it is a
   * pre-painted texture (data/monsterArt), because a single outline and real
   * shading are impossible across a stack of overlapping Graphics ellipses.
   */
  private drawBody(g: Phaser.GameObjects.Graphics): void {
    this.drawBodyClassic(g);
  }

  /** Eyes and mouth, redrawn per expression. */
  private setFace(mood: Face): void {
    if (MONSTER_STYLE === "classic") return this.setFaceClassic(mood);
    return this.setFaceMochi(mood);
  }

  // --- bakery redesign: a strawberry-milk mochi dumpling --------------------

  /** Simple dot eyes  /** Simple dot eyes and a tiny mouth — deliberately minimal and cute. */
  private setFaceMochi(mood: Face): void {
    const g = this.face;
    g.clear();
    const eyeY = -14;
    const eyeX = 22;

    if (mood === "eating") {
      // happy upturned arcs and a small open mouth mid-bite
      g.lineStyle(4, INK, 1);
      for (const sx of [-1, 1]) {
        g.beginPath();
        g.arc(sx * eyeX, eyeY + 3, 9, Phaser.Math.DegToRad(200), Phaser.Math.DegToRad(340));
        g.strokePath();
      }
      g.fillStyle(INK, 1);
      g.fillEllipse(0, 14, 20, 17);
      return;
    }

    if (mood === "refuse") {
      // squeezed-shut eyes and a flat, unimpressed line
      g.lineStyle(4, INK, 1);
      for (const sx of [-1, 1]) {
        g.beginPath();
        g.arc(sx * eyeX, eyeY - 2, 9, Phaser.Math.DegToRad(20), Phaser.Math.DegToRad(160));
        g.strokePath();
      }
      g.beginPath();
      g.moveTo(-9, 12);
      g.lineTo(9, 12);
      g.strokePath();
      return;
    }

    // happy: two simple dot eyes with a single bright highlight, and a small
    // contented mouth. The dots are the whole charm — no iris, no shine stack.
    g.fillStyle(INK, 1);
    g.fillCircle(-eyeX, eyeY, 8);
    g.fillCircle(eyeX, eyeY, 8);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(-eyeX - 3, eyeY - 3, 2.6);
    g.fillCircle(eyeX - 3, eyeY - 3, 2.6);
    g.lineStyle(3.5, INK, 1);
    g.beginPath();
    g.arc(0, 8, 9, Phaser.Math.DegToRad(25), Phaser.Math.DegToRad(155));
    g.strokePath();
  }

  // --- the original teal sprout-blob, kept so it can be switched back -------

  private drawBodyClassic(g: Phaser.GameObjects.Graphics): void {
    g.fillStyle(COLORS.tealDeep, 1);
    g.fillEllipse(-30, 50, 34, 18);
    g.fillEllipse(30, 50, 34, 18);

    g.fillStyle(COLORS.tealDeep, 1);
    g.fillEllipse(0, 12, 124, 108);

    g.fillStyle(COLORS.teal, 1);
    g.fillEllipse(0, 8, 116, 100);
    g.fillEllipse(0, -20, 96, 84);

    g.fillStyle(0xd8fbef, 1);
    g.fillEllipse(0, 26, 68, 52);

    g.fillStyle(COLORS.tealDeep, 1);
    g.fillRect(-2, -62, 4, 12);
    g.fillEllipse(11, -66, 26, 14);

    g.fillStyle(0xff7ba8, 0.92);
    g.fillEllipse(-41, 6, 20, 11);
    g.fillEllipse(41, 6, 20, 11);
  }

  private setFaceClassic(mood: Face): void {
    const g = this.face;
    g.clear();
    const eyeY = -20;

    if (mood === "happy") {
      g.fillStyle(INK, 1);
      g.fillCircle(-24, eyeY, 14);
      g.fillCircle(24, eyeY, 14);
      g.fillStyle(0xffffff, 1);
      g.fillCircle(-29, eyeY - 5, 5);
      g.fillCircle(19, eyeY - 5, 5);
      g.fillCircle(-20, eyeY + 4, 2.5);
      g.fillCircle(28, eyeY + 4, 2.5);
      g.lineStyle(3.5, INK, 1);
      g.beginPath();
      g.arc(0, 6, 11, Phaser.Math.DegToRad(20), Phaser.Math.DegToRad(160));
      g.strokePath();
      return;
    }

    if (mood === "eating") {
      g.lineStyle(4, INK, 1);
      g.beginPath();
      g.arc(-24, eyeY + 4, 13, Phaser.Math.DegToRad(200), Phaser.Math.DegToRad(340));
      g.strokePath();
      g.beginPath();
      g.arc(24, eyeY + 4, 13, Phaser.Math.DegToRad(200), Phaser.Math.DegToRad(340));
      g.strokePath();
      g.fillStyle(INK, 1);
      g.fillEllipse(0, 12, 26, 22);
      return;
    }

    g.lineStyle(4, INK, 1);
    g.beginPath();
    g.arc(-24, eyeY - 4, 13, Phaser.Math.DegToRad(20), Phaser.Math.DegToRad(160));
    g.strokePath();
    g.beginPath();
    g.arc(24, eyeY - 4, 13, Phaser.Math.DegToRad(20), Phaser.Math.DegToRad(160));
    g.strokePath();
    g.beginPath();
    g.moveTo(-10, 10);
    g.lineTo(10, 10);
    g.strokePath();
  }

  /**
   * Keep the size label below the (growing) body — but never so low that a
   * fully-grown monster pushes it into the HUD along the bottom of the screen.
   */
  private layoutLabels(): void {
    const halfH = BODY_HALF * this.container.scaleY;
    this.sizeLabel.setY(Math.min(this.y + halfH + 22, LABEL_MAX_Y));
  }

  eat(): void {
    this.setFace("eating");
    this.scene.tweens.add({
      targets: this.container,
      scaleX: this.baseScale * 1.12,
      scaleY: this.baseScale * 0.9,
      duration: 110,
      yoyo: true,
      ease: "Quad.easeOut",
      onComplete: () => this.setFace("happy"),
    });
  }

  /** Grow when a milestone is reached — scale tracks how big it's meant to be. */
  grow(milestone: number): void {
    this.baseScale = Math.min(BASE_SCALE + milestone * 0.09, MAX_SCALE);
    this.scene.tweens.add({
      targets: this.container,
      scale: this.baseScale,
      duration: 320,
      ease: "Back.easeOut",
      onUpdate: () => this.layoutLabels(),
    });

    // New size, new colour: flare the aura bright for a beat, then settle into
    // a slow breathing loop so the level-up is felt and then lives on quietly.
    this.drawAura(milestone);
    this.drawScaleRef(milestone);
    this.auraPulse?.remove();
    this.aura.setAlpha(0);
    this.scene.tweens.add({
      targets: this.aura,
      alpha: { from: 0, to: 1.6 },
      duration: 260,
      ease: "Quad.easeOut",
      yoyo: true,
      onComplete: () => this.startAuraBreathing(),
    });
  }

  /** A slow, low-contrast pulse so the aura is alive without being noisy. */
  private startAuraBreathing(): void {
    this.auraPulse?.remove();
    this.aura.setAlpha(1);
    this.auraPulse = this.scene.tweens.add({
      targets: this.aura,
      alpha: { from: 0.75, to: 1.12 },
      duration: 1900,
      ease: "Sine.easeInOut",
      yoyo: true,
      repeat: -1,
    });
  }

  /** Restore the aura for a milestone without replaying the level-up flare —
   *  used when a scene rebuilds the monster mid-run. */
  setMilestone(milestone: number): void {
    this.baseScale = Math.min(BASE_SCALE + milestone * 0.09, MAX_SCALE);
    this.container.setScale(this.baseScale);
    this.drawAura(milestone);
    this.drawScaleRef(milestone);
    if (milestone > 0) this.startAuraBreathing();
    this.layoutLabels();
  }

  /** Anything but the exact craving gets a head shake. */
  refuse(): void {
    this.setFace("refuse");
    this.scene.tweens.add({
      targets: this.container,
      x: { from: this.x - 5, to: this.x + 5 },
      duration: 55,
      yoyo: true,
      repeat: 3,
      onComplete: () => {
        this.container.x = this.x;
        this.setFace("happy");
      },
    });
  }

  /** Hide the built-in label where the scene draws its own (e.g. the menu's
   *  tappable name). */
  setLabelVisible(visible: boolean): void {
    this.sizeLabel.setVisible(visible);
  }

  /**
   * Pin the monster to an exact on-screen scale, ignoring its milestone size.
   *
   * Absolute rather than a multiplier on purpose: a showcase screen needs a
   * predictable footprint to lay out around. Multiplying by the milestone
   * scale meant a well-grown monster overflowed its slot and covered the text
   * beneath it.
   */
  showAt(scale: number): void {
    this.container.setScale(scale);
    this.layoutLabels();
  }

  /** Half the drawn body height at the current scale — for laying out around it. */
  get displayHalfHeight(): number {
    return BODY_HALF * this.container.scaleY;
  }

  /** The player's name for it — shown wherever the monster is. */
  setName(name: string): void {
    this.monsterName = name;
    this.refreshLabel();
  }

  setSize(label: string): void {
    this.sizeText = label;
    this.refreshLabel();
  }

  /** "Blobby · 4.5 m", or just whichever half we actually have. */
  private refreshLabel(): void {
    this.sizeLabel.setText(
      [this.monsterName, this.sizeText].filter(Boolean).join("  ·  ")
    );
  }

  get mouthX(): number {
    return this.x;
  }
  get mouthY(): number {
    return this.y - BODY_HALF * this.baseScale * 0.2;
  }
}

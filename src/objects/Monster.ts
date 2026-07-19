import Phaser from "phaser";
import { COLORS } from "../config";

/** Scale at the starting (newborn) size, and how big it's allowed to get.
 *  Kept modest so the wider bin and the food-chain bar have room to breathe. */
const BASE_SCALE = 0.4;
const MAX_SCALE = 1.1;
/** Half the drawn body height, for placing the size label below. */
const BODY_HALF = 64;
/** The lowest the name/size label may sit before it collides with the fed
 *  counter and the food-chain bar. */
const LABEL_MAX_Y = 646;

type Face = "happy" | "eating" | "refuse";

/**
 * One aura colour per size milestone, cycling once it runs off the end. Ordered
 * to feel like it's heating up as the monster grows — teal, green, gold, coral,
 * violet, blue — so a level-up reads as a visible change of state.
 */
const AURA_COLORS = [
  0x37e0d0, 0x8ad155, 0xffd66b, 0xf7b955, 0xf27a9b, 0xe05ac8, 0x9b7bd4,
  0x5b9be2,
];

/**
 * The monster: a soft, round-but-not-spherical blob — a wide sitting body with
 * a slightly narrower head bulge, little foot nubs and a leaf tuft. Drawn
 * rather than emoji'd so its expressions are part of the artwork instead of a
 * character floating above its head.
 *
 * Cues borrowed on purpose: Ditto's amorphous squish, Rowlet's big dark eyes
 * with a bright highlight, Snom's tuft and blush, Wooper's wide simple mouth.
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
    const body = scene.add.graphics();
    this.drawBody(body);
    this.face = scene.add.graphics();

    this.container = scene.add
      .container(x, y, [this.aura, body, this.face])
      .setDepth(1)
      .setScale(this.baseScale);

    this.drawAura(0);

    this.sizeLabel = scene.add
      .text(x, y, "0.3 m", {
        fontFamily: "system-ui, -apple-system, sans-serif",
        fontSize: "17px",
        fontStyle: "500",
        color: "#eaf0ff",
      })
      .setOrigin(0.5)
      .setDepth(2);

    this.setFace("happy");
    this.layoutLabels();
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

  /** The blob itself — everything that never changes with mood. */
  private drawBody(g: Phaser.GameObjects.Graphics): void {
    // feet nubs, tucked under so they read as "sitting"
    g.fillStyle(COLORS.tealDeep, 1);
    g.fillEllipse(-30, 50, 34, 18);
    g.fillEllipse(30, 50, 34, 18);

    // a soft rim under the body gives it weight
    g.fillStyle(COLORS.tealDeep, 1);
    g.fillEllipse(0, 12, 124, 108);

    // main body: wide at the bottom, narrower up top — egg-ish, not a ball
    g.fillStyle(COLORS.teal, 1);
    g.fillEllipse(0, 8, 116, 100);
    g.fillEllipse(0, -20, 96, 84);

    // pale belly patch
    g.fillStyle(0xd8fbef, 1);
    g.fillEllipse(0, 26, 68, 52);

    // a little sprout: stem plus one leaf, off to one side so it reads as a
    // sprig rather than a pair of ears
    g.fillStyle(COLORS.tealDeep, 1);
    g.fillRect(-2, -62, 4, 12);
    g.fillEllipse(11, -66, 26, 14);

    // Blush. Nearly opaque on purpose: a translucent pink averages with the
    // bright teal underneath and comes out grey, which read as smudges.
    g.fillStyle(0xff7ba8, 0.92);
    g.fillEllipse(-41, 6, 20, 11);
    g.fillEllipse(41, 6, 20, 11);
  }

  /** Eyes and mouth, redrawn per expression. */
  private setFace(mood: Face): void {
    const g = this.face;
    g.clear();
    const eyeY = -20;

    if (mood === "happy") {
      g.fillStyle(0x1b1f3d, 1);
      g.fillCircle(-24, eyeY, 14);
      g.fillCircle(24, eyeY, 14);
      g.fillStyle(0xffffff, 1);
      g.fillCircle(-29, eyeY - 5, 5);
      g.fillCircle(19, eyeY - 5, 5);
      g.fillCircle(-20, eyeY + 4, 2.5);
      g.fillCircle(28, eyeY + 4, 2.5);
      // small contented mouth
      g.lineStyle(3.5, 0x1b1f3d, 1);
      g.beginPath();
      g.arc(0, 6, 11, Phaser.Math.DegToRad(20), Phaser.Math.DegToRad(160));
      g.strokePath();
      return;
    }

    if (mood === "eating") {
      // happy closed arcs, open round mouth
      g.lineStyle(4, 0x1b1f3d, 1);
      g.beginPath();
      g.arc(-24, eyeY + 4, 13, Phaser.Math.DegToRad(200), Phaser.Math.DegToRad(340));
      g.strokePath();
      g.beginPath();
      g.arc(24, eyeY + 4, 13, Phaser.Math.DegToRad(200), Phaser.Math.DegToRad(340));
      g.strokePath();
      g.fillStyle(0x1b1f3d, 1);
      g.fillEllipse(0, 12, 26, 22);
      return;
    }

    // refuse: squeezed-shut eyes and a flat, unimpressed mouth
    g.lineStyle(4, 0x1b1f3d, 1);
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

import Phaser from "phaser";
import { COLORS, UI_FONT, TEXT_RES } from "../config";

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
 * Which monster to draw.
 *
 * "mochi" is the bakery redesign: a soft strawberry-milk dumpling with a cream
 * swirl on top and simple dot eyes. "classic" is the original teal sprout-blob.
 * Both are fully implemented below, so switching back is this one word — the
 * old design is kept, not deleted, exactly so it can be restored.
 */
const MONSTER_STYLE: "mochi" | "classic" = "mochi";

/** Eye/mouth ink — warm brown to sit in the cream-and-brown theme, not navy. */
const INK = 0x4a3327;

/** Muted tones for the scale references, so they never upstage the monster. */
const REF_DARK = 0x8a6b52;
const REF_LIGHT = 0xc4a184;

type ScaleRef = {
  /** Used while `milestone < upTo`. */
  upTo: number;
  name: string;
  draw: (g: Phaser.GameObjects.Graphics, x: number, gy: number) => void;
};

/**
 * The comparison ladder, smallest first. Each is drawn at roughly the same
 * height so swapping one for the next doesn't jolt the layout — the JUMP is in
 * what the thing represents, not in how big it's painted.
 */
const SCALE_REFS: ScaleRef[] = [
  {
    upTo: 2,
    name: "baker",
    draw: (g, x, gy) => {
      g.fillStyle(REF_DARK, 1);
      g.fillRect(x - 6, gy - 12, 4, 12);
      g.fillRect(x + 2, gy - 12, 4, 12);
      g.fillStyle(COLORS.plate, 1);
      g.fillRoundedRect(x - 11, gy - 34, 22, 24, 6);
      g.lineStyle(1.5, COLORS.ink, 0.4);
      g.strokeRoundedRect(x - 11, gy - 34, 22, 24, 6);
      g.fillStyle(0xe8b98a, 1);
      g.fillCircle(x, gy - 40, 8);
      g.fillStyle(0xfffaf0, 1);
      g.fillEllipse(x, gy - 52, 20, 12);
      g.fillEllipse(x - 6, gy - 56, 10, 10);
      g.fillEllipse(x + 6, gy - 56, 10, 10);
      g.fillEllipse(x, gy - 58, 11, 11);
      g.fillRect(x - 11, gy - 50, 22, 6);
    },
  },
  {
    upTo: 4,
    name: "house",
    draw: (g, x, gy) => {
      g.fillStyle(COLORS.plate, 1);
      g.fillRect(x - 16, gy - 26, 32, 26);
      g.lineStyle(1.5, COLORS.ink, 0.35);
      g.strokeRect(x - 16, gy - 26, 32, 26);
      // roof
      g.fillStyle(REF_DARK, 1);
      g.fillTriangle(x - 21, gy - 26, x + 21, gy - 26, x, gy - 46);
      // door + window
      g.fillStyle(REF_DARK, 1);
      g.fillRect(x - 4, gy - 14, 8, 14);
      g.fillStyle(REF_LIGHT, 1);
      g.fillRect(x + 6, gy - 22, 7, 7);
    },
  },
  {
    upTo: 6,
    name: "tower",
    draw: (g, x, gy) => {
      g.fillStyle(COLORS.plate, 1);
      g.fillRect(x - 11, gy - 54, 22, 54);
      g.lineStyle(1.5, COLORS.ink, 0.35);
      g.strokeRect(x - 11, gy - 54, 22, 54);
      // window grid
      g.fillStyle(REF_LIGHT, 1);
      for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 2; c++) {
          g.fillRect(x - 7 + c * 9, gy - 49 + r * 10, 5, 6);
        }
      }
      // spire
      g.fillStyle(REF_DARK, 1);
      g.fillRect(x - 1.5, gy - 64, 3, 10);
    },
  },
  {
    upTo: 8,
    name: "town",
    draw: (g, x, gy) => {
      const bar = (bxx: number, w: number, h: number) => {
        g.fillStyle(COLORS.plate, 1);
        g.fillRect(bxx, gy - h, w, h);
        g.lineStyle(1.2, COLORS.ink, 0.3);
        g.strokeRect(bxx, gy - h, w, h);
        g.fillStyle(REF_LIGHT, 1);
        for (let r = 0; r < Math.floor(h / 11); r++) {
          g.fillRect(bxx + 3, gy - h + 4 + r * 11, w - 6, 4);
        }
      };
      bar(x - 22, 12, 30);
      bar(x - 8, 14, 46);
      bar(x + 8, 13, 24);
    },
  },
  {
    upTo: 10,
    name: "planet",
    draw: (g, x, gy) => {
      const cy = gy - 26;
      g.fillStyle(REF_LIGHT, 1);
      g.fillCircle(x, cy, 20);
      // a couple of continents
      g.fillStyle(REF_DARK, 1);
      g.fillEllipse(x - 6, cy - 5, 14, 8);
      g.fillEllipse(x + 7, cy + 6, 11, 7);
      // ring
      g.lineStyle(2.5, REF_DARK, 0.75);
      g.strokeEllipse(x, cy + 3, 54, 16);
    },
  },
  {
    upTo: Infinity,
    name: "galaxy",
    draw: (g, x, gy) => {
      const cy = gy - 28;
      g.fillStyle(REF_LIGHT, 0.5);
      g.fillEllipse(x, cy, 52, 22);
      // two spiral arms as tapering dot trails
      g.fillStyle(REF_DARK, 1);
      for (const dir of [1, -1]) {
        for (let i = 0; i < 9; i++) {
          const t = i / 8;
          const a = dir * (t * Math.PI * 1.25);
          const rad = 4 + t * 23;
          g.fillCircle(
            x + Math.cos(a) * rad * dir,
            cy + Math.sin(a) * rad * 0.42,
            2.6 - t * 1.6
          );
        }
      }
      g.fillStyle(0xfffaf0, 1);
      g.fillCircle(x, cy, 4);
    },
  },
];

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
  private scaleRef?: Phaser.GameObjects.Graphics;
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
    // A little scalloped plate under it — a bakery doily that scales WITH the
    // monster, so its growth reads as a size against a familiar object rather
    // than just a number ticking up. Behind the body, in front of the aura.
    const plate = scene.add.graphics();
    this.drawPlate(plate);
    const body = scene.add.graphics();
    this.drawBody(body);
    this.face = scene.add.graphics();

    this.container = scene.add
      .container(x, y, [this.aura, plate, body, this.face])
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
    this.scaleRef = this.scene.add.graphics().setDepth(0);
    this.scaleRefLabel = this.scene.add
      .text(this.x - 124, this.y + 70, "", {
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

  /** Pick and draw the reference for a milestone. */
  private drawScaleRef(milestone: number): void {
    const g = this.scaleRef;
    if (!g) return;
    g.clear();
    // Ground shared with the monster: its feet at full scale reach ~+58.
    const gy = this.y + 58;
    // Left of the plate with clearance even at MAX monster scale, where the
    // doily's left edge reaches ~x-106.
    const bx = this.x - 124;

    // faint shadow on the shared ground, under whichever reference is drawn
    g.fillStyle(COLORS.ink, 0.12);
    g.fillEllipse(bx, gy + 2, 34, 8);

    const step = SCALE_REFS.findIndex((r) => milestone < r.upTo);
    const ref = SCALE_REFS[step === -1 ? SCALE_REFS.length - 1 : step];
    ref.draw(g, bx, gy);
    this.scaleRefLabel?.setText(ref.name);
  }

  /** A round scalloped doily plate the monster sits on. */
  private drawPlate(g: Phaser.GameObjects.Graphics): void {
    const cy = 58; // just under the feet
    // scalloped tan edge
    g.fillStyle(COLORS.violet, 1);
    const scallops = 22;
    const rx = 96;
    const ry = 26;
    for (let i = 0; i < scallops; i++) {
      const a = (i / scallops) * Math.PI * 2;
      g.fillCircle(Math.cos(a) * rx, cy + Math.sin(a) * ry, 7);
    }
    g.fillStyle(COLORS.violet, 1);
    g.fillEllipse(0, cy, rx * 2, ry * 2);
    // cream face of the plate
    g.fillStyle(COLORS.plate, 1);
    g.fillEllipse(0, cy, rx * 2 - 14, ry * 2 - 12);
    // a faint inner ring
    g.lineStyle(2, COLORS.violet, 0.5);
    g.strokeEllipse(0, cy - 1, rx * 2 - 42, ry * 2 - 34);
  }

  /** The blob itself — everything that never changes with mood. */
  private drawBody(g: Phaser.GameObjects.Graphics): void {
    if (MONSTER_STYLE === "classic") return this.drawBodyClassic(g);
    return this.drawBodyMochi(g);
  }

  /** Eyes and mouth, redrawn per expression. */
  private setFace(mood: Face): void {
    if (MONSTER_STYLE === "classic") return this.setFaceClassic(mood);
    return this.setFaceMochi(mood);
  }

  // --- bakery redesign: a strawberry-milk mochi dumpling --------------------

  /**
   * A soft, squat dumpling — a little wider than tall, the way a piped blob of
   * dough settles. Strawberry-milk pink with a cream belly and a small cream
   * swirl piped on top, so it reads as something from the same case as the
   * food it eats.
   */
  private drawBodyMochi(g: Phaser.GameObjects.Graphics): void {
    // little rounded feet peeking out, so it reads as sitting
    g.fillStyle(COLORS.berryDeep, 1);
    g.fillEllipse(-26, 52, 30, 16);
    g.fillEllipse(26, 52, 30, 16);

    // a soft deeper rim under the body gives it weight
    g.fillStyle(COLORS.berryDeep, 1);
    g.fillEllipse(0, 16, 128, 104);

    // main body: broad and low, rounded like set dough
    g.fillStyle(COLORS.berry, 1);
    g.fillEllipse(0, 10, 120, 96);
    g.fillEllipse(0, -14, 104, 84);

    // a top highlight, the sheen on a glazed bun
    g.fillStyle(0xf7a6bd, 1);
    g.fillEllipse(-14, -34, 56, 30);

    // cream belly patch
    g.fillStyle(COLORS.plate, 1);
    g.fillEllipse(0, 28, 74, 52);

    // a cream swirl piped on top instead of the old leaf sprout
    g.fillStyle(COLORS.plate, 1);
    g.fillEllipse(0, -58, 26, 16);
    g.fillEllipse(0, -66, 18, 12);
    g.fillEllipse(0, -72, 10, 8);
    // a cherry dot to finish it
    g.fillStyle(COLORS.berryDeep, 1);
    g.fillCircle(0, -78, 5);

    // blush — nearly opaque so it doesn't average to grey over the pink
    g.fillStyle(0xf94d7d, 0.5);
    g.fillEllipse(-42, 4, 18, 11);
    g.fillEllipse(42, 4, 18, 11);
  }

  /** Simple dot eyes and a tiny mouth — deliberately minimal and cute. */
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

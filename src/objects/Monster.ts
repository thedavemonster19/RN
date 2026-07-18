import Phaser from "phaser";
import { COLORS } from "../config";

/** Scale at the starting (newborn) size, and how big it's allowed to get.
 *  Kept modest so the wider bin and the food-chain bar have room to breathe. */
const BASE_SCALE = 0.4;
const MAX_SCALE = 1.1;
/** Half the drawn body height, for placing the face above and label below. */
const BODY_HALF = 64;

/**
 * Placeholder monster: a friendly vector blob that visibly scales up as it
 * grows, so its on-screen size tracks the metric size shown beneath it. It's
 * anchored so the face floats above and the size reads below, both following
 * the body as it grows. The clean-modern art pass replaces the graphics.
 */
export class Monster {
  private scene: Phaser.Scene;
  readonly x: number;
  readonly y: number;
  private container: Phaser.GameObjects.Container;
  private face: Phaser.GameObjects.Text;
  private sizeLabel: Phaser.GameObjects.Text;
  private baseScale = BASE_SCALE;
  private monsterName = "";
  private sizeText = "";

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene;
    this.x = x;
    this.y = y;

    const g = scene.add.graphics();
    g.fillStyle(COLORS.tealDeep, 1);
    g.fillEllipse(0, 4, 120, 128);
    g.fillStyle(COLORS.teal, 1);
    g.fillEllipse(0, -4, 104, 112);
    g.fillStyle(0xd8fbef, 1);
    g.fillEllipse(0, 18, 68, 66);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(-24, -20, 16);
    g.fillCircle(24, -20, 16);
    g.fillStyle(0x1b1f3d, 1);
    g.fillCircle(-20, -16, 7);
    g.fillCircle(28, -16, 7);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(-22, -19, 2.5);
    g.fillCircle(26, -19, 2.5);

    this.container = scene.add
      .container(x, y, [g])
      .setDepth(1)
      .setScale(this.baseScale);

    this.face = scene.add
      .text(x, y, "🙂", { fontSize: "18px" })
      .setOrigin(0.5)
      .setDepth(2);

    this.sizeLabel = scene.add
      .text(x, y, "0.3 m", {
        fontFamily: "system-ui, -apple-system, sans-serif",
        fontSize: "17px",
        fontStyle: "500",
        color: "#eaf0ff",
      })
      .setOrigin(0.5)
      .setDepth(2);

    this.layoutLabels();
  }

  /** Keep the face above and the size label below the (growing) body. */
  private layoutLabels(): void {
    const halfH = BODY_HALF * this.container.scaleY;
    this.face.setY(this.y - halfH - 12);
    this.sizeLabel.setY(this.y + halfH + 16);
  }

  eat(): void {
    this.scene.tweens.add({
      targets: this.container,
      scaleX: this.baseScale * 1.1,
      scaleY: this.baseScale * 0.92,
      duration: 90,
      yoyo: true,
      ease: "Quad.easeOut",
    });
  }

  /** Grow when a milestone is reached — scale tracks how big it's meant to be. */
  grow(milestone: number): void {
    this.baseScale = Math.min(BASE_SCALE + milestone * 0.12, MAX_SCALE);
    this.scene.tweens.add({
      targets: this.container,
      scale: this.baseScale,
      duration: 320,
      ease: "Back.easeOut",
      onUpdate: () => this.layoutLabels(),
    });
  }

  /** Anything but the exact craving gets a head shake. */
  refuse(): void {
    this.face.setText("😖");
    this.scene.tweens.add({
      targets: this.container,
      x: { from: this.x - 5, to: this.x + 5 },
      duration: 55,
      yoyo: true,
      repeat: 3,
      onComplete: () => {
        this.container.x = this.x;
        this.face.setText("🙂");
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
    return this.y - BODY_HALF * this.baseScale * 0.5;
  }
}

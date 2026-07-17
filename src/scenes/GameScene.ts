import Phaser from "phaser";
import { GAME, BIN, COLORS, MONSTER, GRAVITY_SCALE } from "../config";
import { FoodPile, Food } from "../objects/FoodPile";
import { FoodType, foodColor, tierRadius, tierTexture } from "../data/foods";
import { Claw } from "../objects/Claw";
import { Monster } from "../objects/Monster";
import { Hud } from "../objects/Hud";
import { GameState, GameOverReason, FeedResult } from "../systems/GameState";
import { Save } from "../systems/Save";
import { milestoneName, currentSize } from "../data/milestones";

const FONT = "system-ui, -apple-system, sans-serif";

/** A press that moves less than this is a tap (= feed it). */
const TAP_SLOP = 12;
/** Dragging up at least this far off a food pockets it. */
const SWIPE_UP = 55;
/** Merges within this window of each other count as one cascade. */
const CASCADE_WINDOW = 800;

/** A finger resting on a food, before we know what it meant. */
type Press = { food: Food; x: number; y: number };

export class GameScene extends Phaser.Scene {
  private pile!: FoodPile;
  private claw!: Claw;
  private monster!: Monster;
  private hud!: Hud;
  private state!: GameState;
  private pocketDisc!: Phaser.GameObjects.Image;

  private aiming = false;
  private press: Press | null = null;

  private over = false;
  private inputReady = false;
  private binGfx!: Phaser.GameObjects.Graphics;
  /** Timestamp the pile first crossed the line; null when it's below. */
  private overflowSince: number | null = null;
  private static OVERFLOW_GRACE = 3000;

  private mergeChain = 0;
  private lastMergeAt = -Infinity;

  private static POCKET_X = 30;
  private static POCKET_Y = 140;

  constructor() {
    super("Game");
  }

  create(): void {
    this.over = false;
    this.aiming = false;
    this.press = null;
    this.mergeChain = 0;
    this.lastMergeAt = -Infinity;
    this.overflowSince = null;
    // Ignore the tap that dismissed the menu so it can't trigger a first drop.
    this.inputReady = false;
    this.time.delayedCall(150, () => (this.inputReady = true));

    const gravity = this.matter.world.localWorld.gravity;
    if (gravity) gravity.scale = GRAVITY_SCALE;

    this.drawBackground();
    this.createBinWalls();
    this.binGfx = this.add.graphics().setDepth(-1);

    this.state = new GameState();
    this.drawBin();
    this.pile = new FoodPile(this);
    this.monster = new Monster(this, MONSTER.x, MONSTER.y);
    this.monster.setName(Save.name);
    this.monster.setSize(currentSize(this.state.milestone));
    this.monster.setMood(this.state.mood);
    this.hud = new Hud(this, this.state);

    // Merging is where the skill shows: a well-aimed drop can set off a chain.
    this.pile.onMerge = (x, y, type, tier) => this.handleMerge(x, y, type, tier);

    // The bin starts empty — every piece in it is one the player chose to drop.
    this.claw = new Claw(this, BIN.railY, BIN.left + 22, BIN.right - 22);
    this.claw.setDispenser(this.state.peekDrop());

    this.bindInput();
    this.createPocketUI();
    this.createHelpButton();
    this.hud.update();
  }

  /**
   * One finger, told apart by what you touched and what you did:
   *  - empty space → aim the queued food, release to DROP it
   *  - tap a food  → FEED it
   *  - swipe up off a food → POCKET it
   * Food is never carried around, so it can never leave the bin.
   */
  private bindInput(): void {
    const ready = () => !this.over && this.inputReady;

    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      if (!ready() || this.aiming || this.press) return;
      const hit = this.pile.foodAt(p.x, p.y);
      if (hit) {
        this.press = { food: hit, x: p.x, y: p.y };
      } else if (p.x >= BIN.left && p.x <= BIN.right && p.y < BIN.floor) {
        this.aiming = true;
        this.claw.aim(p.x, this.state.peekDrop());
      }
    });

    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      if (!ready() || !p.isDown) return;
      if (this.aiming) this.claw.aim(p.x, this.state.peekDrop());
    });

    this.input.on("pointerup", (p: Phaser.Input.Pointer) => {
      if (!ready()) return;
      if (this.aiming) {
        this.aiming = false;
        this.dropQueued();
      } else if (this.press) {
        this.resolvePress(p);
      }
    });
  }

  /** Drop the queued food where the claw is aimed, and load the next one. */
  private dropQueued(): void {
    // A cascade means "merges set off by ONE drop". Without this reset the
    // chain is only time-based, so a player dropping quickly could keep the
    // counter climbing across unrelated merges and farm the escalating bonus.
    this.mergeChain = 0;
    this.lastMergeAt = -Infinity;
    const spec = this.state.takeDrop();
    this.pile.spawn(
      this.claw.x,
      BIN.railY + 6 + tierRadius(spec.tier),
      spec.type,
      spec.tier
    );
    this.claw.setDispenser(this.state.peekDrop());
  }

  private resolvePress(p: Phaser.Input.Pointer): void {
    const { food, x, y } = this.press!;
    this.press = null;
    // It may have merged away while the finger was down.
    if (!this.pile.items.includes(food) || food.merging) return;

    if (y - p.y > SWIPE_UP) {
      this.pocketFood(food);
    } else if (Phaser.Math.Distance.Between(x, y, p.x, p.y) < TAP_SLOP) {
      this.feedFood(food);
    }
    // Any other drag does nothing — the pile is not yours to rearrange.
  }

  /** Lift a food out of the pile into a sprite we can fly somewhere. */
  private pluck(food: Food): Phaser.GameObjects.Image {
    const { x, y } = food.mo;
    const { type, tier } = food;
    this.pile.remove(food);
    return this.add
      .image(x, y, tierTexture(tier))
      .setTint(foodColor(type, tier))
      .setDepth(12);
  }

  /**
   * The monster takes its craved type at that tier or bigger. Anything else it
   * refuses, and the food stays exactly where it was — a refusal never disturbs
   * the pile you've built.
   */
  private feedFood(food: Food): void {
    if (!this.state.accepts(food.type, food.tier)) {
      this.monster.refuse();
      this.floatText(food.mo.x, food.mo.y - 20, "too small!", "#ff6b7d");
      return;
    }
    const { type, tier } = food;
    this.animateFeed(this.pluck(food), type, tier);
  }

  private pocketFood(food: Food): void {
    if (!this.state.stash({ type: food.type, tier: food.tier })) {
      this.floatText(food.mo.x, food.mo.y - 20, "pocket full", "#9aa3d0");
      return;
    }
    this.animateToPocket(this.pluck(food));
  }

  private animateFeed(
    spr: Phaser.GameObjects.Image,
    type: FoodType,
    tier: number
  ): void {
    const sx = spr.x;
    const sy = spr.y;
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 520,
      ease: "Sine.easeInOut",
      onUpdate: (tw) => {
        const t = (tw.getValue() ?? 0) as number;
        spr.x = Phaser.Math.Linear(sx, this.monster.mouthX, t);
        spr.y =
          Phaser.Math.Linear(sy, this.monster.mouthY, t) -
          Math.sin(t * Math.PI) * 70;
      },
      onComplete: () => {
        spr.destroy();
        const result = this.state.feed(type, tier);
        if (result) this.applyFeed(result, type);
      },
    });
  }

  private animateToPocket(spr: Phaser.GameObjects.Image): void {
    this.tweens.add({
      targets: spr,
      x: GameScene.POCKET_X,
      y: GameScene.POCKET_Y + 8,
      scale: 0.5,
      duration: 260,
      ease: "Quad.easeIn",
      onComplete: () => spr.destroy(),
    });
  }

  private applyFeed(result: FeedResult, type: FoodType): void {
    const color = foodColor(type, result.tier);
    this.monster.eat();
    this.monster.setMood(this.state.mood);
    this.burst(this.monster.mouthX, this.monster.mouthY, color, 12);
    this.floatText(
      this.monster.mouthX,
      this.monster.mouthY - 30,
      `+${result.points}`,
      "#ffe08a"
    );
    // Spending a big food on a small craving is legal but wasteful — say so,
    // otherwise the player never learns why their score is lagging.
    if (!result.exact) {
      this.floatText(
        this.monster.mouthX,
        this.monster.mouthY - 54,
        `wanted a ${result.wanted}!`,
        "#ff9d5c"
      );
    }
    if (result.leveledUp) {
      this.monster.grow(this.state.milestone);
      this.monster.setSize(currentSize(this.state.milestone));
      this.drawBin(); // the danger line just crept down
      this.celebrate();
    }
  }

  private handleMerge(x: number, y: number, type: FoodType, tier: number): void {
    const now = this.time.now;
    this.mergeChain =
      now - this.lastMergeAt < CASCADE_WINDOW ? this.mergeChain + 1 : 1;
    this.lastMergeAt = now;
    this.state.addMergeScore(tier, this.mergeChain);
    this.burst(x, y, foodColor(type, tier), 6);
    if (this.mergeChain >= 3) {
      this.floatText(x, y - 16, `chain x${this.mergeChain}`, "#ff9d5c");
    }
  }

  /**
   * The endgame: the danger line creeps DOWN as the monster grows, so the bin
   * effectively shrinks while the cravings demand more and more staged
   * material. Early on a tier-7 build fits comfortably; later there physically
   * isn't room to stage one plus the incoming drops — that squeeze is what
   * finally ends a good run. Capped so some bin always remains.
   */
  private lineY(): number {
    return Math.min(BIN.overflowLine + this.state.milestone * 14, BIN.floor - 120);
  }

  update(time: number): void {
    if (this.over) return;
    this.pile.update();

    // Overflow: the moment settled food crosses the line, start a grace
    // countdown. Clear the pile back under the line to cancel it.
    const crossed = this.pile.settledTop() < this.lineY();
    if (crossed) {
      if (this.overflowSince === null) this.overflowSince = time;
      const remaining = GameScene.OVERFLOW_GRACE - (time - this.overflowSince);
      this.hud.overflowCountdown = Math.max(0, Math.ceil(remaining / 1000));
      if (remaining <= 0) this.gameOver("overflow");
    } else {
      this.overflowSince = null;
      this.hud.overflowCountdown = null;
    }
    this.refreshPocket();
    this.hud.update();
  }

  /** Show the pocketed food, lit up when the monster will actually take it. */
  private refreshPocket(): void {
    const p = this.state.pocket;
    this.pocketDisc.setVisible(p !== null);
    if (p === null) return;
    this.pocketDisc.setTexture(tierTexture(p.tier));
    this.pocketDisc.setTint(foodColor(p.type, p.tier));
    this.pocketDisc.setDisplaySize(28, 28);
    this.pocketDisc.setAlpha(this.state.accepts(p.type, p.tier) ? 1 : 0.55);
  }

  /** The pocket slot — tap it to feed the saved food. */
  private createPocketUI(): void {
    const px = GameScene.POCKET_X;
    const py = GameScene.POCKET_Y;
    const panel = this.add.graphics().setDepth(19);
    panel.fillStyle(0xffffff, 0.06);
    panel.fillRoundedRect(px - 26, py - 30, 52, 74, 12);
    panel.lineStyle(1.5, 0xffffff, 0.18);
    panel.strokeCircle(px, py + 8, 15);
    this.add
      .text(px, py - 18, "POCKET", {
        fontFamily: FONT,
        fontSize: "10px",
        color: "#9aa3d0",
      })
      .setOrigin(0.5)
      .setDepth(20);
    this.pocketDisc = this.add
      .image(px, py + 8, "food1")
      .setDepth(21)
      .setVisible(false)
      .setInteractive({ useHandCursor: true });
    this.pocketDisc.on("pointerdown", () => this.eatFromPocket());
  }

  private eatFromPocket(): void {
    if (this.over || this.press) return;
    const p = this.state.pocket;
    if (!p) return;
    const result = this.state.feedFromPocket();
    if (result) this.applyFeed(result, p.type);
    else this.monster.refuse();
  }

  private createHelpButton(): void {
    const bx = GAME.WIDTH - 26;
    const by = GAME.HEIGHT - 26;
    const btn = this.add
      .circle(bx, by, 16, 0xffffff, 0.08)
      .setStrokeStyle(1, 0xffffff, 0.25)
      .setDepth(30)
      .setInteractive({ useHandCursor: true });
    this.add
      .text(bx, by, "?", {
        fontFamily: FONT,
        fontSize: "18px",
        fontStyle: "500",
        color: "#9aa3d0",
      })
      .setOrigin(0.5)
      .setDepth(31);
    btn.on("pointerdown", () => this.showHelp());
  }

  private showHelp(): void {
    const { WIDTH, HEIGHT } = GAME;
    const lines = [
      "Drag to aim, release to DROP.",
      "",
      "Two foods the same that touch",
      "MERGE into the next one up.",
      "",
      "TAP a food to feed it — what it WANTS",
      "or bigger, but it only pays for the",
      "size it asked for, so hit it exactly.",
      "",
      "It only wants BIG food, and bigger",
      "as it grows — keep a build going",
      "before the bin fills up.",
      "",
      "Swipe UP off a food to POCKET it.",
      "Keep the pile under the red line.",
    ];
    const shade = this.add
      .rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x06081a, 0.9)
      .setDepth(40)
      .setInteractive();
    const txt = this.add
      .text(WIDTH / 2, HEIGHT / 2 - 30, lines.join("\n"), {
        fontFamily: FONT,
        fontSize: "15px",
        color: "#eaf0ff",
        align: "center",
        lineSpacing: 5,
      })
      .setOrigin(0.5)
      .setDepth(41);
    const tap = this.add
      .text(WIDTH / 2, HEIGHT / 2 + 190, "tap to close", {
        fontFamily: FONT,
        fontSize: "14px",
        color: "#37e0d0",
      })
      .setOrigin(0.5)
      .setDepth(41);
    shade.on("pointerdown", () => {
      shade.destroy();
      txt.destroy();
      tap.destroy();
    });
  }

  private celebrate(): void {
    this.cameras.main.shake(220, 0.008);
    const label = this.add
      .text(
        GAME.WIDTH / 2,
        260,
        `As big as a ${milestoneName(this.state.milestone - 1)}!`,
        { fontFamily: FONT, fontSize: "22px", fontStyle: "500", color: "#ffe08a" }
      )
      .setOrigin(0.5)
      .setDepth(30);
    this.tweens.add({
      targets: label,
      y: 220,
      alpha: 0,
      scale: 1.2,
      duration: 1200,
      ease: "Cubic.easeOut",
      onComplete: () => label.destroy(),
    });
  }

  private floatText(x: number, y: number, msg: string, color: string): void {
    const t = this.add
      .text(x, y, msg, {
        fontFamily: FONT,
        fontSize: "15px",
        fontStyle: "600",
        color,
      })
      .setOrigin(0.5)
      .setDepth(30);
    this.tweens.add({
      targets: t,
      y: y - 34,
      alpha: 0,
      duration: 700,
      ease: "Cubic.easeOut",
      onComplete: () => t.destroy(),
    });
  }

  private burst(x: number, y: number, color: number, count: number): void {
    const emitter = this.add.particles(x, y, "food1", {
      speed: { min: 60, max: 190 },
      angle: { min: 200, max: 340 },
      scale: { start: 0.3, end: 0 },
      lifespan: 520,
      quantity: count,
      tint: color,
      emitting: false,
    });
    emitter.setDepth(15);
    emitter.explode(count);
    this.time.delayedCall(700, () => emitter.destroy());
  }

  private gameOver(reason: GameOverReason): void {
    if (this.over) return;
    this.over = true;
    this.scene.launch("GameOver", {
      score: this.state.score,
      milestone: this.state.milestone,
      reason,
    });
    this.scene.pause();
  }

  private drawBackground(): void {
    const g = this.add.graphics().setDepth(-10);
    g.fillGradientStyle(
      COLORS.bgTop,
      COLORS.bgTop,
      COLORS.bgBottom,
      COLORS.bgBottom,
      1
    );
    g.fillRect(0, 0, GAME.WIDTH, GAME.HEIGHT);
  }

  private createBinWalls(): void {
    const t = 60; // thick enough that fast-falling food can't tunnel through
    const midY = (BIN.railY + BIN.floor) / 2;
    const wallH = BIN.floor - BIN.railY + 300;
    this.matter.add.rectangle(
      (BIN.left + BIN.right) / 2,
      BIN.floor + t / 2,
      BIN.right - BIN.left + t * 2,
      t,
      { isStatic: true }
    );
    this.matter.add.rectangle(BIN.left - t / 2, midY + 40, t, wallH, {
      isStatic: true,
    });
    this.matter.add.rectangle(BIN.right + t / 2, midY + 40, t, wallH, {
      isStatic: true,
    });
  }

  /** Redrawn on every level-up, because the danger line creeps down. */
  private drawBin(): void {
    const g = this.binGfx;
    const line = this.lineY();
    g.clear();
    g.fillStyle(0xffffff, 0.04);
    g.fillRoundedRect(
      BIN.left,
      line - 8,
      BIN.right - BIN.left,
      BIN.floor - line + 20,
      18
    );
    g.lineStyle(1, 0xffffff, 0.12);
    g.strokeRoundedRect(
      BIN.left,
      line - 8,
      BIN.right - BIN.left,
      BIN.floor - line + 20,
      18
    );
    g.lineStyle(1.5, COLORS.danger, 0.5);
    for (let x = BIN.left + 6; x < BIN.right - 6; x += 12) {
      g.beginPath();
      g.moveTo(x, line);
      g.lineTo(x + 6, line);
      g.strokePath();
    }
  }
}

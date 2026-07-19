import Phaser from "phaser";
import { GAME, BIN, COLORS, MONSTER, GRAVITY_SCALE } from "../config";
import { FoodPile, Food } from "../objects/FoodPile";
import { FoodType, foodColor, tierRadius, tierTexture } from "../data/foods";
import { Claw } from "../objects/Claw";
import { Monster } from "../objects/Monster";
import { Hud } from "../objects/Hud";
import { GameState, GameOverReason, FeedResult, Spec } from "../systems/GameState";
import { Save } from "../systems/Save";
import { Ev, ReplayEvent } from "../systems/Replay";
import { milestoneName, currentSize } from "../data/milestones";

const FONT = "system-ui, -apple-system, sans-serif";

/** A press that moves less than this is a tap (= feed it). */
const TAP_SLOP = 12;
/** Dragging up at least this far off a food pockets it. */
const SWIPE_UP = 55;

/** A finger resting on a food, before we know what it meant. */
type Press = { food: Food; x: number; y: number };

export class GameScene extends Phaser.Scene {
  /**
   * Is there a run the player could still come back to? Set when a game
   * starts, cleared when it ends, so the menu knows whether to offer
   * "Continue" or "New game". A static flag rather than scene-state probing
   * because a paused scene and a finished scene look identical from outside.
   */
  static hasActiveRun = false;

  private pile!: FoodPile;
  private claw!: Claw;
  private monster!: Monster;
  private hud!: Hud;
  private state!: GameState;
  private pocketDisc!: Phaser.GameObjects.Image;
  private pocketStatus!: Phaser.GameObjects.Text;

  private aiming = false;
  private press: Press | null = null;
  /** A food taken back out of the pocket, riding the claw as the next drop. */
  private pocketLoad: Spec | null = null;

  private over = false;
  private inputReady = false;
  private binGfx!: Phaser.GameObjects.Graphics;
  /** Redrawn every frame: the bin edge glowing as the pile nears the line. */
  private dangerGfx!: Phaser.GameObjects.Graphics;
  /** Every economic action this run, for server-side verification. */
  private replayLog: ReplayEvent[] = [];
  /** The last food dropped, while it's still undoable. */
  private lastDrop: { food: Food; spec: Spec; fromPocket: boolean } | null = null;
  private undoLabel!: Phaser.GameObjects.Text;
  /** Timestamp the pile first crossed the line; null when it's below. */
  private overflowSince: number | null = null;
  private static OVERFLOW_GRACE = 3000;

  private static POCKET_X = 30;
  private static POCKET_Y = 140;

  constructor() {
    super("Game");
  }

  /** Set by the menu: a daily-challenge run shares its seed with everyone. */
  private dailyKey: string | null = null;

  init(data: { dailyKey?: string }): void {
    this.dailyKey = data?.dailyKey ?? null;
  }

  create(): void {
    GameScene.hasActiveRun = true;
    this.over = false;
    this.aiming = false;
    this.press = null;
    this.pocketLoad = null;
    this.lastDrop = null;
    this.replayLog = [];
    this.overflowSince = null;
    // Ignore the tap that dismissed the menu so it can't trigger a first drop.
    this.inputReady = false;
    this.time.delayedCall(150, () => (this.inputReady = true));

    const gravity = this.matter.world.localWorld.gravity;
    if (gravity) gravity.scale = GRAVITY_SCALE;

    this.drawBackground();
    this.createBinWalls();
    this.binGfx = this.add.graphics().setDepth(-1);

    this.state = new GameState(this.dailyKey);
    this.dangerGfx = this.add.graphics().setDepth(0);
    this.drawBin();
    this.pile = new FoodPile(this);
    this.monster = new Monster(this, MONSTER.x, MONSTER.y);
    this.monster.setName(Save.name);
    this.monster.setSize(currentSize(this.state.milestone));
    this.hud = new Hud(this, this.state);

    // Merging is where the skill shows: a well-aimed drop can set off a chain.
    this.pile.onMerge = (x, y, type, tier) => this.handleMerge(x, y, type, tier);

    // The bin starts empty — every piece in it is one the player chose to drop.
    this.claw = new Claw(this, BIN.railY, BIN.left + 22, BIN.right - 22);
    this.claw.setDispenser(this.state.peekDrop());

    this.bindInput();
    this.createPocketUI();
    this.createUndoButton();
    this.createHelpButton();
    this.createLeaveButton();
    this.hud.update();
  }

  /**
   * One finger, told apart by what you touched and what you did:
   *  - anywhere on screen → aim the queued food, release to DROP it
   *  - tap a food         → FEED it
   *  - swipe up off a food → POCKET it
   * Aiming works from the whole screen (the claw clamps to the rail), so your
   * thumb never has to sit inside the bin. Buttons still win: when the press
   * lands on an interactive object (pocket, help), we leave it alone.
   */
  private bindInput(): void {
    const ready = () => !this.over && this.inputReady;

    this.input.on(
      "pointerdown",
      (p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
        if (!ready() || this.aiming || this.press || over.length > 0) return;
        const hit = this.pile.foodAt(p.x, p.y);
        if (hit) {
          this.press = { food: hit, x: p.x, y: p.y };
        } else {
          this.aiming = true;
          this.claw.aim(p.x, this.currentDrop());
        }
      }
    );

    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      if (!ready() || !p.isDown) return;
      if (this.aiming) this.claw.aim(p.x, this.currentDrop());
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

  /** What the claw is about to drop: a re-loaded pocket food, or the queue. */
  private currentDrop(): Spec {
    return this.pocketLoad ?? this.state.peekDrop();
  }

  /**
   * Drop the current food where the claw is aimed. A pocket-loaded food goes
   * back into the bin without consuming the queue — returning your stash is
   * never a fresh drop.
   */
  private dropQueued(): void {
    const fromPocket = this.pocketLoad !== null;
    const spec = this.pocketLoad ?? this.state.takeDrop();
    this.pocketLoad = null;
    const r = tierRadius(spec.tier);
    // Never spawn inside a pile that has grown up to the rail — that overlap
    // is what used to fire food upwards.
    const y = this.pile.clearSpawnY(this.claw.x, r, BIN.railY + 6 + r);
    const food = this.pile.spawn(this.claw.x, y, spec.type, spec.tier);
    this.state.noteTier(spec.tier);
    this.replayLog.push([Ev.Drop, fromPocket ? 1 : 0]);
    this.lastDrop = { food, spec, fromPocket };
    this.claw.setDispenser(this.currentDrop());
  }

  /**
   * Take back the last drop. Only works while that exact food is still sitting
   * in the bin unmerged — once it has combined with something, the board has
   * moved on and there's nothing unambiguous to undo.
   */
  private undoDrop(): void {
    if (this.over || this.aiming || this.press) return;
    if (this.state.undosLeft <= 0) {
      this.floatText(GAME.WIDTH / 2, BIN.floor - 30, "no undos left", "#9aa3d0");
      return;
    }
    const last = this.lastDrop;
    if (!last || !this.pile.items.includes(last.food) || last.food.merging) {
      this.floatText(GAME.WIDTH / 2, BIN.floor - 30, "too late to undo", "#9aa3d0");
      return;
    }
    this.replayLog.push([Ev.Undo, 0]);
    this.pile.remove(last.food);
    if (last.fromPocket) {
      // It came out of the pocket, so it goes back there — not into the queue,
      // which would launder a stashed food into free drops.
      this.state.pocket = last.spec;
      this.state.undosLeft--;
    } else {
      this.state.returnDrop(last.spec);
    }
    this.lastDrop = null;
    this.claw.setDispenser(this.currentDrop());
    this.refreshUndo();
    this.floatText(GAME.WIDTH / 2, BIN.floor - 30, "undone", "#37e0d0");
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
   * The monster takes EXACTLY the food it craves. Anything else it refuses,
   * and the food stays where it was — a refusal never disturbs the pile.
   */
  private feedFood(food: Food): void {
    if (!this.state.accepts(food.type, food.tier)) {
      this.monster.refuse();
      const want = this.state.craving.tier;
      this.floatText(
        food.mo.x,
        food.mo.y - 20,
        food.tier < want ? "too small!" : "too big!",
        "#ff6b7d"
      );
      return;
    }
    const { type, tier } = food;
    this.replayLog.push([Ev.Feed, tier]);
    this.animateFeed(this.pluck(food), type, tier);
  }

  private pocketFood(food: Food): void {
    if (!this.state.stash({ type: food.type, tier: food.tier })) {
      const msg =
        this.state.pocket !== null
          ? "pocket full"
          : `needs ${this.state.stashCost(food.tier)}`;
      this.floatText(food.mo.x, food.mo.y - 20, msg, "#9aa3d0");
      return;
    }
    this.replayLog.push([Ev.Stash, food.tier]);
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
    this.burst(this.monster.mouthX, this.monster.mouthY, color, 12);
    this.floatText(
      this.monster.mouthX,
      this.monster.mouthY - 30,
      `+${result.points}`,
      "#ffe08a"
    );
    if (result.fresh >= result.tier * 20) {
      this.floatText(this.monster.mouthX, this.monster.mouthY - 54, "fresh!", "#37e0d0");
    }
    if (result.leveledUp) {
      this.monster.grow(this.state.milestone);
      this.monster.setSize(currentSize(this.state.milestone));
      this.drawBin(); // the danger line just crept down
      this.celebrate();
    }
  }

  private handleMerge(x: number, y: number, type: FoodType, tier: number): void {
    // `tier` is the tier produced; the log records the tier consumed.
    this.replayLog.push([Ev.Merge, tier - 1]);
    this.state.addMergeScore(tier);
    this.state.noteTier(tier);
    // The merged food is gone or changed, so the previous drop is no longer
    // something we can cleanly take back.
    this.lastDrop = null;
    this.burst(x, y, foodColor(type, tier), 6);
  }

  /** A small undo button with its remaining charges. */
  private createUndoButton(): void {
    const bx = 30;
    const by = GAME.HEIGHT - 78;
    const btn = this.add
      .circle(bx, by, 20, 0xffffff, 0.08)
      .setStrokeStyle(1, 0xffffff, 0.25)
      .setDepth(30)
      .setInteractive({ useHandCursor: true });
    this.add
      .text(bx, by - 4, "↩", { fontFamily: FONT, fontSize: "19px", color: "#eaf0ff" })
      .setOrigin(0.5)
      .setDepth(31);
    this.undoLabel = this.add
      .text(bx, by + 22, "", { fontFamily: FONT, fontSize: "10px", color: "#9aa3d0" })
      .setOrigin(0.5)
      .setDepth(31);
    btn.on("pointerdown", () => this.undoDrop());
    this.refreshUndo();
  }

  private refreshUndo(): void {
    this.undoLabel.setText(`UNDO ${this.state.undosLeft}`);
  }

  /**
   * The bin edge glows and breathes as the pile climbs toward the line, so the
   * danger is felt in peripheral vision instead of only announced in text.
   */
  private drawDanger(time: number): void {
    const g = this.dangerGfx;
    g.clear();
    const line = this.lineY();
    const top = this.pile.settledTop();
    // 0 at a comfortable distance, 1 right at the line.
    const proximity = Phaser.Math.Clamp(1 - (top - line) / 150, 0, 1);
    if (proximity <= 0.02) return;

    const pulse = 0.55 + 0.45 * Math.sin(time / (150 - proximity * 90));
    const alpha = proximity * proximity * pulse;
    const h = BIN.floor - line + 20;
    g.lineStyle(3, COLORS.danger, alpha * 0.85);
    g.strokeRoundedRect(BIN.left, line - 8, BIN.right - BIN.left, h, 18);
    g.lineStyle(9, COLORS.danger, alpha * 0.22);
    g.strokeRoundedRect(BIN.left, line - 8, BIN.right - BIN.left, h, 18);
  }

  /**
   * The danger line creeps DOWN as the monster grows — a gentle squeeze on top
   * of the real late-game pressure, which is the craving ramp demanding
   * enormous staged builds (a tier-10 is 512 tier-1s of material). The cap
   * matters: it leaves just enough depth that a tier-10 physically fits below
   * the line, so a big ask is always brutal but never impossible.
   */
  private lineY(): number {
    return Math.min(BIN.overflowLine + this.state.milestone * 6, BIN.floor - 262);
  }

  update(time: number): void {
    if (this.over) return;
    this.pile.update();
    this.drawDanger(time);

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

  /** Show the pocketed food, or how close the next stash charge is. */
  private refreshPocket(): void {
    const p = this.state.pocket;
    this.pocketDisc.setVisible(p !== null);
    if (p !== null) {
      this.pocketDisc.setTexture(tierTexture(p.tier));
      this.pocketDisc.setTint(foodColor(p.type, p.tier));
      this.pocketDisc.setDisplaySize(28, 28);
      this.pocketStatus.setText("tap to use").setColor("#37e0d0");
      return;
    }
    // Charges banked. Bigger food costs more, so this is a budget, not a flag.
    this.pocketStatus
      .setText(`⚡${this.state.pocketCharges}`)
      .setColor(this.state.pocketCharges > 0 ? "#37e0d0" : "#9aa3d0");
  }

  /** The pocket slot — tap it to load the saved food back onto the claw. */
  private createPocketUI(): void {
    const px = GameScene.POCKET_X;
    const py = GameScene.POCKET_Y;
    const panel = this.add.graphics().setDepth(19);
    panel.fillStyle(0xffffff, 0.06);
    panel.fillRoundedRect(px - 26, py - 30, 52, 86, 12);
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
    this.pocketStatus = this.add
      .text(px, py + 38, "", { fontFamily: FONT, fontSize: "9px", color: "#9aa3d0" })
      .setOrigin(0.5)
      .setDepth(20);
    this.pocketDisc = this.add
      .image(px, py + 8, "food1")
      .setDepth(21)
      .setVisible(false)
      .setInteractive({ useHandCursor: true });
    this.pocketDisc.on("pointerdown", () => this.loadPocket());
  }

  /**
   * Tapping the pocket puts its food on the claw as the next drop — it returns
   * to the BIN (where you aim it), never straight into the monster's mouth.
   * The queued drop simply waits its turn.
   */
  private loadPocket(): void {
    if (this.over || this.press || this.aiming || this.pocketLoad) return;
    const p = this.state.takePocket();
    if (!p) return;
    this.pocketLoad = p;
    this.claw.setDispenser(p);
    this.floatText(this.claw.x, BIN.railY + 34, "from pocket", "#9aa3d0");
  }

  /**
   * Step out to the menu without losing the run. `scene.switch` puts this
   * scene to sleep rather than stopping it, so the pile, score and event log
   * are all still here when the player picks "Continue".
   */
  private createLeaveButton(): void {
    const bx = 26;
    const by = 26;
    const btn = this.add
      .circle(bx, by, 16, 0xffffff, 0.08)
      .setStrokeStyle(1, 0xffffff, 0.25)
      .setDepth(30)
      .setInteractive({ useHandCursor: true });
    this.add
      .text(bx, by - 1, "‹", {
        fontFamily: FONT,
        fontSize: "22px",
        fontStyle: "600",
        color: "#9aa3d0",
      })
      .setOrigin(0.5)
      .setDepth(31);
    btn.on("pointerdown", () => {
      if (this.over) return;
      this.scene.switch("Menu");
    });
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
      "TAP a food to feed it — it eats",
      "EXACTLY what it WANTS, nothing",
      "smaller, nothing bigger.",
      "",
      "It asks for bigger food as it grows —",
      "build precisely, and don't let your",
      "pile over-merge past the ask.",
      "",
      "Feed within a few drops for a FRESH",
      "bonus (the fuse under WANTS).",
      "",
      "Swipe UP off a food to POCKET it.",
      "Tap the pocket to load it back onto",
      "the claw and drop it where you want.",
      "",
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
    GameScene.hasActiveRun = false;
    this.scene.launch("GameOver", {
      score: this.state.score,
      milestone: this.state.milestone,
      reason,
      feeds: this.state.totalFeeds,
      drops: this.state.totalDrops,
      biggestTier: this.state.biggestTier,
      dailyKey: this.state.dailyKey,
      events: this.replayLog,
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

import Phaser from "phaser";
import { GAME, BIN, COLORS, MONSTER, GRAVITY_SCALE } from "../config";
import { FoodPile, Food } from "../objects/FoodPile";
import { MEGA, FOOD_TYPES, FoodType } from "../data/foods";
import { Claw } from "../objects/Claw";
import { Monster } from "../objects/Monster";
import { Hud } from "../objects/Hud";
import { GameState, GameOverReason, FeedResult } from "../systems/GameState";
import { milestoneName, currentSize } from "../data/milestones";

const FONT = "system-ui, -apple-system, sans-serif";

export class GameScene extends Phaser.Scene {
  private pile!: FoodPile;
  private claw!: Claw;
  private monster!: Monster;
  private hud!: Hud;
  private state!: GameState;
  private pocketDisc!: Phaser.GameObjects.Image;
  private pressY = 0; // where a drag started, to detect a swipe-up (stash)
  private static POCKET_X = 34;
  private static POCKET_Y = 156;
  private over = false;
  private overflowArmed = false;
  private inputReady = false;
  /** Timestamp the pile first crossed the line; null when it's below. */
  private overflowSince: number | null = null;
  private static OVERFLOW_GRACE = 3000;

  // Difficulty: food dropped per pickup grows with the monster's milestone,
  // capped so it never becomes unmanageable instantly.
  private static BASE_DROP = 4;
  private static MILESTONES_PER_DROP = 2; // +1 dropped every N milestones
  private static MAX_DROP = 9; // keeps climbing so difficulty never plateaus

  // A satisfied craving gobbles the current drop count + the streak (so it
  // always matches "more in" with "more out" and cravings stay maintainable),
  // capped so a huge streak can't nuke the whole bin.
  private static GOBBLE_CAP = 12;

  constructor() {
    super("Game");
  }

  create(): void {
    this.over = false;
    this.overflowArmed = false;
    // Let the opening pile fall and settle before overflow can end the game.
    this.time.delayedCall(1600, () => (this.overflowArmed = true));
    // Ignore the tap that dismissed the menu so it can't trigger a first dig.
    this.inputReady = false;
    this.time.delayedCall(150, () => (this.inputReady = true));

    const gravity = this.matter.world.localWorld.gravity;
    if (gravity) gravity.scale = GRAVITY_SCALE;

    this.drawBackground();
    this.createBinWalls();
    this.drawBin();

    this.state = new GameState();
    this.pile = new FoodPile(this);
    this.monster = new Monster(this, MONSTER.x, MONSTER.y);
    this.monster.setSize(currentSize(this.state.milestone));
    this.hud = new Hud(this, this.state);

    // Seed the pile in a non-overlapping grid so it starts already settled
    // (spawning food on top of itself is what made the pile churn).
    const cx = (BIN.left + BIN.right) / 2;
    this.pile.spawnMega(cx, BIN.floor - 26);
    const cols = 6;
    const sx = 42;
    const sy = 36;
    for (let i = 0; i < 22; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      this.pile.spawnRandomAt(
        BIN.left + 45 + col * sx,
        BIN.floor - 78 - row * sy
      );
    }

    this.claw = new Claw(this, this.pile, {
      railY: BIN.railY,
      floorY: BIN.floor,
      aimMin: BIN.left + 24,
      aimMax: BIN.right - 24,
      colHalf: 4,
      // Pass the monster itself so delivery tracks its mouth as it grows.
      monster: this.monster,
      onEat: (food) => this.handleFeed(food),
      onCycleDone: () => this.dropRefill(),
      // A swipe-up stashes into the pocket (if free); otherwise feed.
      resolveGrab: (food, wantStash) => {
        if (wantStash && this.state.stash(food.type)) {
          return { stash: true, x: GameScene.POCKET_X, y: GameScene.POCKET_Y + 6 };
        }
        return { stash: false };
      },
    });

    // Drag to aim, release to feed; a swipe-up release stashes instead.
    // (press/aim/release self-guard on the claw's state, so mid-animation
    // taps are ignored.)
    const ready = () => !this.over && this.inputReady;
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      // Only start a grab when tapping over the bin — taps on the pocket / side
      // panels / help button must not also trigger the claw.
      if (!ready() || p.x < BIN.left || p.x > BIN.right) return;
      this.pressY = p.y;
      this.claw.press(p.x);
    });
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      if (ready() && p.isDown) this.claw.aim(p.x);
    });
    this.input.on("pointerup", (p: Phaser.Input.Pointer) => {
      if (!ready()) return;
      const stash = this.pressY - p.y > 55; // swiped up = stash intent
      this.claw.release(stash);
    });

    this.createPocketUI();
    this.createHelpButton();
    this.hud.update();
  }

  update(time: number, delta: number): void {
    if (this.over) return;
    this.claw.update(delta);
    this.refreshPocket();

    // Overflow: the moment settled food crosses the line, start a 3s grace
    // countdown. Clear the pile back under the line to cancel it.
    const crossed =
      this.overflowArmed && this.pile.settledTop() < BIN.overflowLine;
    if (crossed) {
      if (this.overflowSince === null) this.overflowSince = time;
      const remaining =
        GameScene.OVERFLOW_GRACE - (time - this.overflowSince);
      this.hud.overflowCountdown = Math.max(0, Math.ceil(remaining / 1000));
      if (remaining <= 0) this.gameOver("overflow");
    } else {
      this.overflowSince = null;
      this.hud.overflowCountdown = null;
    }
    this.hud.update();
  }

  private handleFeed(food: Food): void {
    this.applyFeedResult(this.state.feed(food), food.type.color);
  }

  /** Feed the stashed food (free — no grab, no refill). */
  private eatFromPocket(): void {
    const type = this.state.pocket;
    if (this.over || !type) return;
    const result = this.state.feedFromPocket();
    if (result) this.applyFeedResult(result, type.color);
  }

  /** Show the pocketed food in its slot (tinted), or hide the slot. */
  private refreshPocket(): void {
    const p = this.state.pocket;
    this.pocketDisc.setVisible(!!p);
    if (p) {
      const mega = p.id === MEGA.id;
      this.pocketDisc
        .setTexture(mega ? "mega" : "food")
        .setScale(mega ? 0.7 : 1)
        .setTint(p.color);
    }
  }

  private applyFeedResult(result: FeedResult, color: number): void {
    this.monster.eat();
    this.monster.setMood(this.state.mood);
    this.burst(this.monster.mouthX, this.monster.mouthY, color, 12);

    if (result.craved) {
      // Gobble = current drop count + streak: scales with milestone (more in,
      // more out, so cravings keep the bin maintainable) and rewards streaks.
      const n = Math.min(
        this.dropCount() + this.state.combo,
        GameScene.GOBBLE_CAP
      );
      const cleared = this.pile.gobble(n);
      cleared.forEach((c) => this.burst(c.x, c.y, COLORS.teal, 6));
    }
    if (result.leveledUp) {
      this.monster.grow(this.state.milestone);
      this.monster.setSize(currentSize(this.state.milestone));
      this.celebrate();
    }
  }

  /**
   * Refill after the claw's dig cycle finishes (never mid-descent, so it can't
   * intercept the piece you aimed for). Three in per pickup vs three out per
   * satisfied craving = a give-and-take: keep up with cravings and the bin
   * stays balanced; ignore them and it climbs toward overflow.
   */
  /**
   * A dropped food's type, quietly biased toward what the monster wants now and
   * next (skipping mega, which is spawned separately) so both are usually
   * reachable — an assist that still leaves ~60% of drops random.
   */
  private favoredType(): FoodType {
    const m = this.state.milestone;
    const cur = this.state.craving;
    const nxt = this.state.nextCraving;
    // The find-help fades a little each milestone, so higher tiers lean more on
    // luck — but never to zero, there's always a slight nudge toward the wanted
    // food (current, then next).
    const curChance = Math.max(0.04, 0.14 - m * 0.012);
    const nextChance = curChance + Math.max(0.02, 0.09 - m * 0.008);
    const r = Math.random();
    if (r < curChance && cur.id !== MEGA.id) return cur;
    if (r < nextChance && nxt.id !== MEGA.id) return nxt;
    return Phaser.Utils.Array.GetRandom(FOOD_TYPES);
  }

  /** A "?" button that pops a short how-to-play overlay. */
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
      "Drag to aim the claw, release to grab",
      "and FEED the monster the piece.",
      "",
      "Swipe UP as you release to STASH it",
      "in your pocket instead — tap the pocket",
      "to feed it later.",
      "",
      "Feed the food it WANTS (top-right) to grow.",
      "Plan with the queue below it.",
      "Keep the bin under the red line.",
    ];
    const shade = this.add
      .rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x06081a, 0.9)
      .setDepth(40)
      .setInteractive();
    const txt = this.add
      .text(WIDTH / 2, HEIGHT / 2 - 40, lines.join("\n"), {
        fontFamily: FONT,
        fontSize: "16px",
        color: "#eaf0ff",
        align: "center",
        lineSpacing: 6,
      })
      .setOrigin(0.5)
      .setDepth(41);
    const tap = this.add
      .text(WIDTH / 2, HEIGHT / 2 + 150, "tap to close", {
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

  /** The pocket slot (left side) — tap it to feed the stashed food. */
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
      .image(px, py + 8, "food")
      .setDepth(21)
      .setVisible(false)
      .setInteractive({ useHandCursor: true });
    this.pocketDisc.on("pointerdown", () => this.eatFromPocket());
  }

  /** Food dropped per pickup, rising with milestone up to the cap. */
  private dropCount(): number {
    return Math.min(
      GameScene.BASE_DROP +
        Math.floor(this.state.milestone / GameScene.MILESTONES_PER_DROP),
      GameScene.MAX_DROP
    );
  }

  private dropRefill(): void {
    this.time.delayedCall(200, () => {
      if (this.over) return;
      // Drop count scales with milestone (capped), quietly biased toward the
      // current craving (~40%) so the wanted food is usually reachable.
      const cravingIsMega = this.state.craving.id === MEGA.id;
      // While a mega is craved, ease the pressure: drop far fewer normal foods
      // so the bin doesn't fill (you can't gobble until you feed the mega) and
      // the mega on top doesn't get buried — no more instant-game-over spiral.
      const drops = cravingIsMega ? 2 : this.dropCount();
      for (let k = 0; k < drops; k++) {
        // Stagger well above the diameter so the falling refills don't spawn
        // inside one another (which would make them explode apart).
        this.pile.spawn(
          Phaser.Math.Between(BIN.left + 30, BIN.right - 30),
          BIN.railY - 30 - k * 42,
          this.favoredType(),
          false
        );
      }
      // While the monster craves a mega, keep TWO available and drop them ABOVE
      // the normal food so they land on top and stay grabbable — otherwise a
      // mega craving buries its own treat and spirals into a game over.
      // Outside a mega craving, let one drop in occasionally as a bonus grab.
      const megaCount = this.pile.items.filter((f) => f.mega).length;
      if (cravingIsMega ? megaCount < 2 : Math.random() < 0.22) {
        this.pile.spawnMega(
          Phaser.Math.Between(BIN.left + 40, BIN.right - 40),
          BIN.railY - 30 - drops * 42
        );
      }
    });
  }

  private celebrate(): void {
    this.cameras.main.shake(220, 0.008);
    const label = this.add
      .text(
        GAME.WIDTH / 2,
        260,
        `As big as a ${milestoneName(this.state.milestone - 1)}!`,
        {
          fontFamily: "system-ui, -apple-system, sans-serif",
          fontSize: "22px",
          fontStyle: "500",
          color: "#ffe08a",
        }
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

  private burst(x: number, y: number, color: number, count: number): void {
    const emitter = this.add.particles(x, y, "food", {
      speed: { min: 60, max: 190 },
      angle: { min: 200, max: 340 },
      scale: { start: 0.18, end: 0 },
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

  private drawBin(): void {
    const g = this.add.graphics().setDepth(-1);
    g.fillStyle(0xffffff, 0.04);
    g.fillRoundedRect(
      BIN.left,
      BIN.overflowLine - 8,
      BIN.right - BIN.left,
      BIN.floor - BIN.overflowLine + 20,
      18
    );
    g.lineStyle(1, 0xffffff, 0.12);
    g.strokeRoundedRect(
      BIN.left,
      BIN.overflowLine - 8,
      BIN.right - BIN.left,
      BIN.floor - BIN.overflowLine + 20,
      18
    );
    g.lineStyle(1.5, COLORS.danger, 0.5);
    for (let x = BIN.left + 6; x < BIN.right - 6; x += 12) {
      g.beginPath();
      g.moveTo(x, BIN.overflowLine);
      g.lineTo(x + 6, BIN.overflowLine);
      g.strokePath();
    }
  }
}

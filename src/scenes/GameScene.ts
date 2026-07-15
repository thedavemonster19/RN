import Phaser from "phaser";
import { GAME, BIN, COLORS, MONSTER, GRAVITY_SCALE } from "../config";
import { FoodPile, Food } from "../objects/FoodPile";
import { MEGA, FOOD_TYPES, FoodType } from "../data/foods";
import { Claw } from "../objects/Claw";
import { Monster } from "../objects/Monster";
import { Hud } from "../objects/Hud";
import { GameState, GameOverReason } from "../systems/GameState";
import { milestoneName, currentSize } from "../data/milestones";

export class GameScene extends Phaser.Scene {
  private pile!: FoodPile;
  private claw!: Claw;
  private monster!: Monster;
  private hud!: Hud;
  private state!: GameState;
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
    });

    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      if (!this.over && this.inputReady) this.claw.press(p.x);
    });
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      if (!this.over && this.inputReady && p.isDown) this.claw.aim(p.x);
    });
    this.input.on("pointerup", () => {
      if (!this.over && this.inputReady) this.claw.release();
    });

    this.hud.update();
  }

  update(time: number, delta: number): void {
    if (this.over) return;
    this.claw.update(delta);

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
    const result = this.state.feed(food);
    this.monster.eat();
    this.monster.setMood(this.state.mood);
    this.burst(this.monster.mouthX, this.monster.mouthY, food.type.color, 12);

    if (result.craved) {
      // The higher the craving streak, the more the monster gobbles (capped),
      // Gobble = current drop count + streak: it scales with milestone (more in,
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
    const curChance = Math.max(0.06, 0.18 - m * 0.011);
    const nextChance = curChance + Math.max(0.03, 0.12 - m * 0.007);
    const r = Math.random();
    if (r < curChance && cur.id !== MEGA.id) return cur;
    if (r < nextChance && nxt.id !== MEGA.id) return nxt;
    return Phaser.Utils.Array.GetRandom(FOOD_TYPES);
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

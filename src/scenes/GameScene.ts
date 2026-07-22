import Phaser from "phaser";
import { GAME, BIN, COLORS, MONSTER, GRAVITY_SCALE, UI_FONT, TEXT_RES } from "../config";
import { FoodPile, Food } from "../objects/FoodPile";
import { FoodType, foodColor, tierRadius, tierTexture } from "../data/foods";
import { Claw } from "../objects/Claw";
import { Monster } from "../objects/Monster";
import { Hud } from "../objects/Hud";
import { GameState, GameOverReason, FeedResult, Spec } from "../systems/GameState";
import { Save } from "../systems/Save";
import { Ev, ReplayEvent } from "../systems/Replay";
import { MODS } from "../systems/Modifiers";
import { ModeId } from "../systems/Modes";
import { makeButton } from "../objects/Button";
import { milestoneName, currentSize } from "../data/milestones";

const FONT = UI_FONT;

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
  /**
   * True while a food is arcing into the monster's mouth.
   *
   * Feeding has to be one-at-a-time. The arc takes ~520ms, and the craving
   * advances the moment a feed lands — so a second tap during the flight would
   * arrive to find a different craving, get rejected, and the food would be
   * destroyed for nothing. (Measured: 56 taps produced only 7 real feeds.)
   */
  private feeding = false;

  private over = false;
  private inputReady = false;
  private binGfx!: Phaser.GameObjects.Graphics;
  /** Redrawn every frame: the bin edge glowing as the pile nears the line. */
  private dangerGfx!: Phaser.GameObjects.Graphics;
  /** Every economic action this run, for server-side verification. */
  private replayLog: ReplayEvent[] = [];
  /** The last drop, while it's still undoable. `foods` holds both pieces under
   *  Double Drop. */
  private lastDrop: { foods: Food[]; specs: Spec[]; fromPocket: boolean } | null = null;
  private undoLabel!: Phaser.GameObjects.Text;
  /** Swinging-Claw modifier: the rail position oscillates and the claw follows. */
  private swingPhase = 0;
  /** Timestamp the pile first crossed the line; null when it's below. */
  private overflowSince: number | null = null;
  private static OVERFLOW_GRACE = 3000;

  private static POCKET_X = 30;
  private static POCKET_Y = 140;

  constructor() {
    super("Game");
  }

  /** Streak field for the Windy mode, drawn behind the food. */
  private windGfx?: Phaser.GameObjects.Graphics;
  private windStreaks: { x: number; t: number; speed: number; thick: number }[] = [];

  /** Set by the menu: a daily-challenge run shares its seed with everyone. */
  private dailyKey: string | null = null;
  /** The permanent mode picked on the mode-select screen. */
  private mode: ModeId = "classic";

  init(data: { dailyKey?: string; mode?: ModeId }): void {
    this.dailyKey = data?.dailyKey ?? null;
    this.mode = data?.mode ?? "classic";
  }

  create(): void {
    GameScene.hasActiveRun = true;
    this.over = false;
    this.aiming = false;
    this.press = null;
    this.pocketLoad = null;
    this.lastDrop = null;
    // Must reset: a run that ended mid-arc would otherwise leave the next game
    // permanently unable to feed.
    this.feeding = false;
    this.replayLog = [];
    this.overflowSince = null;
    // Ignore the tap that dismissed the menu so it can't trigger a first drop.
    this.inputReady = false;
    this.time.delayedCall(150, () => (this.inputReady = true));

    this.state = new GameState(this.dailyKey, undefined, this.mode);

    // Physics-only modifiers land on the world before anything spawns.
    const gravity = this.matter.world.localWorld.gravity;
    if (gravity) {
      // Moon Bounce halves gravity; Heavy Rain does the opposite, so the big
      // food it hands you lands with real weight instead of merely being large.
      const g = this.state.has("floaty")
        ? GRAVITY_SCALE * 0.5
        : this.state.has("bigdrops")
          ? GRAVITY_SCALE * 1.7
          : GRAVITY_SCALE;
      gravity.scale = g;
      gravity.x = 0; // wind is applied per-frame in update()
    }

    this.drawBackground();
    this.createBinWalls();
    this.binGfx = this.add.graphics().setDepth(-1);

    this.dangerGfx = this.add.graphics().setDepth(0);
    this.drawBin();
    if (this.state.has("windy")) {
      this.windGfx = this.add.graphics().setDepth(1);
      this.windStreaks = Array.from({ length: 22 }, (_, i) => ({
        x: BIN.left + ((i * 71) % (BIN.right - BIN.left)),
        t: ((i * 37) % 100) / 100,
        speed: 0.6 + ((i * 13) % 10) / 10,
        thick: 1 + ((i * 7) % 3) * 0.6,
      }));
    } else {
      this.windGfx = undefined;
      this.windStreaks = [];
    }

    this.pile = new FoodPile(this);
    // Springy food is the POINT of Moon Bounce: half gravity on its own just
    // read as "slow", which is why it was the least distinctive twist. Set
    // after the pile exists — setting it before threw on the first run.
    this.pile.bounce = this.state.has("floaty") ? 0.52 : 0;
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
    if (this.state.mods.length) this.createModifierBanner();
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
        const hit = this.pile.foodAt(p.worldX, p.worldY);
        if (hit) {
          this.press = { food: hit, x: p.worldX, y: p.worldY };
        } else if (this.state.has("swing")) {
          // Swinging Claw: you don't aim, you time it — a tap drops wherever
          // the auto-swinging claw happens to be.
          this.dropQueued();
        } else {
          this.aiming = true;
          this.claw.aim(p.worldX, this.currentDrop());
        }
      }
    );

    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      if (!ready() || !p.isDown) return;
      if (this.aiming) this.claw.aim(p.worldX, this.currentDrop());
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
    // Under Double Drop this is two DIFFERENT foods, drawn separately, so they
    // can't fuse with each other on the way down. A pocketed food is never
    // doubled — that would duplicate a stashed piece for free.
    const specs = fromPocket ? [this.pocketLoad!] : this.state.takeDrops();
    this.pocketLoad = null;

    const foods: Food[] = [];
    specs.forEach((spec, k) => {
      this.state.noteTier(spec.tier);
      const r = tierRadius(spec.tier);
      // Two foods land well apart so each can be aimed at a different spot.
      const spread = specs.length === 1 ? 0 : (k === 0 ? -1 : 1) * 46;
      const x = Phaser.Math.Clamp(this.claw.x + spread, BIN.left + r, BIN.right - r);
      // Never spawn inside a pile that has grown up to the rail — that overlap
      // is what used to fire food upwards.
      const y = this.pile.clearSpawnY(x, r, BIN.railY + 6 + r);
      foods.push(this.pile.spawn(x, y, spec.type, spec.tier));
      // Points for the act of dropping — small, so feeding still dominates.
      // Pocket-returns aren't new food, so they don't score (and can't be
      // farmed by stash/unstash).
      if (!fromPocket) this.state.addDropScore(spec.tier);
    });

    this.replayLog.push([Ev.Drop, fromPocket ? 1 : 0]);
    this.lastDrop = { foods, specs, fromPocket };
    this.claw.setDispenser(this.currentDrop());
    this.refreshUndo();
  }

  /**
   * Take back the last drop. Only works while that exact food is still sitting
   * in the bin unmerged — once it has combined with something, the board has
   * moved on and there's nothing unambiguous to undo.
   */
  private undoDrop(): void {
    if (this.over || this.aiming || this.press) return;
    if (this.state.undosLeft <= 0) {
      this.floatText(GAME.WIDTH / 2, BIN.floor - 30, "no undos left", "#9b7a5f");
      return;
    }
    const last = this.lastDrop;
    // Every food from that drop must still be in the bin, unmerged, for the
    // undo to be unambiguous.
    const allPresent =
      last &&
      last.foods.every((f) => this.pile.items.includes(f) && !f.merging);
    if (!last || !allPresent) {
      this.floatText(GAME.WIDTH / 2, BIN.floor - 30, "too late to undo", "#9b7a5f");
      return;
    }
    this.replayLog.push([Ev.Undo, 0]);
    last.foods.forEach((f) => this.pile.remove(f));
    if (last.fromPocket) {
      // It came out of the pocket, so it goes back there — not into the queue,
      // which would launder a stashed food into free drops.
      this.state.pocket = last.specs[0];
      this.state.undosLeft--;
    } else {
      // Refund the drop bonus for every food that drop added.
      last.specs.forEach((s) => this.state.removeDropScore(s.tier));
      this.state.returnDrops(last.specs);
    }
    this.lastDrop = null;
    this.claw.setDispenser(this.currentDrop());
    this.refreshUndo();
    this.floatText(GAME.WIDTH / 2, BIN.floor - 30, "undone", "#0e9d88");
  }

  private resolvePress(p: Phaser.Input.Pointer): void {
    const { food, x, y } = this.press!;
    this.press = null;
    // It may have merged away while the finger was down.
    if (!this.pile.items.includes(food) || food.merging) return;

    if (y - p.worldY > SWIPE_UP) {
      this.pocketFood(food);
    } else if (Phaser.Math.Distance.Between(x, y, p.worldX, p.worldY) < TAP_SLOP) {
      this.feedFood(food);
    }
    // Any other drag does nothing — the pile is not yours to rearrange.
  }

  /** Lift a food out of the pile into a sprite we can fly somewhere. */
  private pluck(food: Food): Phaser.GameObjects.Image {
    const { x, y } = food.mo;
    const { tier } = food;
    this.pile.remove(food);
    return this.add
      .image(x, y, tierTexture(tier))
      .setDepth(12);
  }

  /**
   * The monster takes EXACTLY the food it craves. Anything else it refuses,
   * and the food stays where it was — a refusal never disturbs the pile.
   */
  private feedFood(food: Food): void {
    // One mouthful at a time — see `feeding`.
    if (this.feeding) return;
    if (!this.state.accepts(food.type, food.tier)) {
      this.monster.refuse();
      const want = this.state.craving.tier;
      this.floatText(
        food.mo.x,
        food.mo.y - 20,
        food.tier < want ? "too small!" : "too big!",
        "#d43a55"
      );
      return;
    }
    const { type, tier } = food;
    this.feeding = true;
    // The event is NOT logged here — see animateFeed. It has to be recorded at
    // the moment the state actually changes, not when the tap happens.
    this.animateFeed(this.pluck(food), type, tier);
  }

  private pocketFood(food: Food): void {
    if (!this.state.stash({ type: food.type, tier: food.tier })) {
      const msg =
        this.state.pocket !== null
          ? "pocket full"
          : `needs ${this.state.stashCost(food.tier)}`;
      this.floatText(food.mo.x, food.mo.y - 20, msg, "#9b7a5f");
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
        this.feeding = false;
        // Log the feed at the instant it is applied, never when it was tapped.
        // The food takes ~520ms to arc into the monster, and a quick player
        // drops more food in the meantime. Those drops age the craving and
        // shrink its freshness bonus, so a log that claimed the feed happened
        // first replayed to a HIGHER score than the client actually scored —
        // and the server rejected the run for mismatching. Recording it here
        // keeps the log in the same order as the state changes.
        const result = this.state.feed(type, tier);
        // Only log a feed the state actually accepted, so the log can never
        // describe something that didn't happen.
        if (result) {
          this.replayLog.push([Ev.Feed, tier]);
          this.applyFeed(result, type);
          // Feeding the last food empties the bin. Checked right here, at the
          // same moment the replay checks it, so the two agree.
          if (this.pile.items.length === 0) {
            this.celebrateClear(this.state.awardBinClear());
          }
        }
      },
    });
  }

  /** A clean bin is a real achievement — say so loudly. */
  private celebrateClear(bonus: number): void {
    this.cameras.main.flash(220, 55, 224, 208, false);
    const label = this.add
      .text(GAME.WIDTH / 2, BIN.floor - 120, `BIN CLEARED\n+${bonus}`, {
        fontFamily: FONT,
        resolution: TEXT_RES,
        fontSize: "26px",
        fontStyle: "700",
        color: "#0e9d88",
        align: "center",
        lineSpacing: 4,
      })
      .setOrigin(0.5)
      .setDepth(32);
    this.tweens.add({
      targets: label,
      y: label.y - 46,
      alpha: 0,
      scale: 1.15,
      duration: 1100,
      ease: "Cubic.easeOut",
      onComplete: () => label.destroy(),
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
      "#d98324"
    );
    if (result.fresh >= result.tier * 20) {
      this.floatText(this.monster.mouthX, this.monster.mouthY - 54, "fresh!", "#0e9d88");
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
      .circle(bx, by, 20, COLORS.ink, 0.08)
      .setStrokeStyle(1, COLORS.ink, 0.25)
      .setDepth(30)
      .setInteractive({ useHandCursor: true });
    this.add
      .text(bx, by - 4, "↩", { fontFamily: FONT,
        resolution: TEXT_RES, fontSize: "19px", color: "#4a3327" })
      .setOrigin(0.5)
      .setDepth(31);
    this.undoLabel = this.add
      .text(bx, by + 22, "", { fontFamily: FONT,
        resolution: TEXT_RES, fontSize: "10px", color: "#9b7a5f" })
      .setOrigin(0.5)
      .setDepth(31);
    btn.on("pointerdown", () => this.undoDrop());
    this.refreshUndo();
  }

  private refreshUndo(): void {
    this.undoLabel.setText(`UNDO ${this.state.undosLeft}`);
  }

  /**
   * The bin edge flashes red ONLY while the overflow countdown is live — the
   * same moment the "clear the bin" text is up. It used to glow on proximity,
   * pulsing every time the pile edged near the line (which a falling drop did
   * constantly), and that was just irritating. Now it means one thing: you are
   * actually overflowing, right now.
   */
  private drawDanger(time: number): void {
    const g = this.dangerGfx;
    g.clear();
    if (this.hud.overflowCountdown === null) return;

    const line = this.lineY();
    const pulse = 0.55 + 0.45 * Math.sin(time / 90);
    const h = BIN.floor - line + 20;
    g.lineStyle(3, COLORS.danger, pulse * 0.9);
    g.strokeRoundedRect(BIN.left, line - 8, BIN.right - BIN.left, h, 18);
    g.lineStyle(10, COLORS.danger, pulse * 0.25);
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
    // "Cramped Bin" starts the line lower, so there's less room from the off.
    const base = this.state.has("cramped") ? BIN.overflowLine + 70 : BIN.overflowLine;
    return Math.min(base + this.state.milestone * 6, BIN.floor - 262);
  }

  update(time: number, delta: number): void {
    if (this.over) return;
    this.pile.update();
    this.applyModifiers(time, delta);

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
    this.drawDanger(time); // after the countdown is up to date this frame
    this.refreshPocket();
    this.hud.update();
  }

  /** Per-frame work for the feel modifiers. */
  private applyModifiers(time: number, delta: number): void {
    if (this.state.has("swing") && !this.aiming) {
      // Sweep the claw across the rail; a tap drops at wherever it is.
      this.swingPhase += delta * 0.0022;
      const min = BIN.left + 22;
      const max = BIN.right - 22;
      const x = (min + max) / 2 + ((max - min) / 2) * Math.sin(this.swingPhase);
      this.claw.aim(x, this.currentDrop());
    }
    if (this.state.has("windy")) {
      // A slow, reversing breeze — enough to drift food, not to fling it.
      const gravity = this.matter.world.localWorld.gravity;
      const wind = 0.4 * Math.sin(time / 2200);
      if (gravity) gravity.x = wind;
      this.drawWind(wind);
    }
  }

  /**
   * Announce today's modifiers on a card that fades after a few seconds.
   *
   * These used to be permanent pills pinned top-left, which collided with the
   * growth bar and added clutter to an already-busy corner. A card states the
   * twist clearly at the start and then gets out of the way; the modifiers stay
   * listed on the menu and the leaderboard for anyone who wants to check.
   */
  private createModifierBanner(): void {
    const defs = this.state.mods.map((id) => MODS[id]);
    const cx = GAME.WIDTH / 2;
    const cy = 250;
    const h = 52 + defs.length * 52;

    const card = this.add.graphics().setDepth(40);
    card.fillStyle(COLORS.cardFill, 0.96);
    card.fillRoundedRect(cx - 150, cy - h / 2, 300, h, 18);
    card.lineStyle(2, COLORS.gold, 0.85);
    card.strokeRoundedRect(cx - 150, cy - h / 2, 300, h, 18);

    const parts: Phaser.GameObjects.GameObject[] = [card];
    parts.push(
      this.add
        .text(cx, cy - h / 2 + 20, this.dailyKey ? "TODAY'S TWIST" : "GAME MODE", {
          fontFamily: FONT,
          resolution: TEXT_RES,
          fontSize: "11px",
          fontStyle: "700",
          color: "#d98324",
        })
        .setOrigin(0.5)
        .setDepth(41)
    );
    defs.forEach((def, i) => {
      const y = cy - h / 2 + 52 + i * 52;
      parts.push(
        this.add
          .text(cx, y, def.name, {
            fontFamily: FONT,
            resolution: TEXT_RES,
            fontSize: "17px",
            fontStyle: "700",
            color: "#4a3327",
          })
          .setOrigin(0.5)
          .setDepth(41),
        this.add
          .text(cx, y + 22, def.desc, {
            fontFamily: FONT,
            resolution: TEXT_RES,
            fontSize: "10px",
            color: "#9b7a5f",
            align: "center",
            wordWrap: { width: 270 },
          })
          .setOrigin(0.5)
          .setDepth(41)
      );
    });

    this.tweens.add({
      targets: parts,
      alpha: 0,
      delay: 2600,
      duration: 700,
      ease: "Quad.easeIn",
      onComplete: () => parts.forEach((p) => p.destroy()),
    });
  }

  /** Show the pocketed food, or how close the next stash charge is. */
  private refreshPocket(): void {
    const p = this.state.pocket;
    this.pocketDisc.setVisible(p !== null);
    if (p !== null) {
      this.pocketDisc.setTexture(tierTexture(p.tier));
      this.pocketDisc.setDisplaySize(28, 28);
      this.pocketStatus.setText("tap to use").setColor("#0e9d88");
      return;
    }
    // Charges banked. Bigger food costs more, so this is a budget, not a flag.
    this.pocketStatus
      .setText(`⚡${this.state.pocketCharges}`)
      .setColor(this.state.pocketCharges > 0 ? "#0e9d88" : "#9b7a5f");
  }

  /** The pocket slot — tap it to load the saved food back onto the claw. */
  private createPocketUI(): void {
    const px = GameScene.POCKET_X;
    const py = GameScene.POCKET_Y;
    const panel = this.add.graphics().setDepth(19);
    panel.fillStyle(COLORS.ink, 0.13);
    panel.fillRoundedRect(px - 26, py - 30, 52, 86, 12);
    panel.lineStyle(2, COLORS.ink, 0.32);
    panel.strokeCircle(px, py + 8, 15);
    this.add
      .text(px, py - 18, "POCKET", {
        fontFamily: FONT,
        resolution: TEXT_RES,
        fontSize: "10px",
        color: "#9b7a5f",
      })
      .setOrigin(0.5)
      .setDepth(20);
    this.pocketStatus = this.add
      .text(px, py + 38, "", { fontFamily: FONT,
        resolution: TEXT_RES, fontSize: "9px", color: "#9b7a5f" })
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
    this.floatText(this.claw.x, BIN.railY + 34, "from pocket", "#9b7a5f");
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
      .circle(bx, by, 16, COLORS.ink, 0.08)
      .setStrokeStyle(1, COLORS.ink, 0.25)
      .setDepth(30)
      .setInteractive({ useHandCursor: true });
    this.add
      .text(bx, by - 1, "‹", {
        fontFamily: FONT,
        resolution: TEXT_RES,
        fontSize: "22px",
        fontStyle: "600",
        color: "#9b7a5f",
      })
      .setOrigin(0.5)
      .setDepth(31);
    btn.on("pointerdown", () => {
      if (this.over) return;
      this.askLeave();
    });
  }

  /**
   * Leaving is ambiguous — stepping away for a minute and abandoning the run
   * are very different intentions, and guessing wrong either loses progress or
   * traps the player in a game they wanted to end. So ask.
   */
  private askLeave(): void {
    const { WIDTH, HEIGHT } = GAME;
    const depth = 60;
    const cy = HEIGHT / 2 - 20;

    const shade = this.add
      .rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, COLORS.scrim, 0.93)
      .setDepth(depth)
      .setInteractive();
    const panel = this.add.graphics().setDepth(depth + 1);
    panel.fillStyle(COLORS.ink, 0.13);
    panel.fillRoundedRect(WIDTH / 2 - 150, cy - 96, 300, 268, 18);
    panel.lineStyle(2, COLORS.ink, 0.3);
    panel.strokeRoundedRect(WIDTH / 2 - 150, cy - 96, 300, 268, 18);

    const title = this.add
      .text(WIDTH / 2, cy - 62, "Leave the game?", {
        fontFamily: FONT,
        resolution: TEXT_RES,
        fontSize: "20px",
        fontStyle: "600",
        color: "#4a3327",
      })
      .setOrigin(0.5)
      .setDepth(depth + 2);
    const body = this.add
      .text(WIDTH / 2, cy - 30, "Your run is kept until you quit.", {
        fontFamily: FONT,
        resolution: TEXT_RES,
        fontSize: "12px",
        color: "#9b7a5f",
      })
      .setOrigin(0.5)
      .setDepth(depth + 2);

    const parts: { destroy(): void }[] = [];
    const close = () => {
      shade.destroy();
      panel.destroy();
      title.destroy();
      body.destroy();
      parts.forEach((p) => p.destroy());
    };

    parts.push(
      makeButton(this, {
        x: WIDTH / 2,
        y: cy + 12,
        label: "Leave — keep run",
        primary: true,
        width: 250,
        depth: depth + 2,
        onClick: () => {
          close();
          this.scene.switch("Menu");
        },
      }),
      makeButton(this, {
        x: WIDTH / 2,
        y: cy + 76,
        label: "Quit — end run",
        width: 250,
        depth: depth + 2,
        onClick: () => {
          close();
          // Ending deliberately still counts as a finished run, so the score
          // is recorded rather than silently thrown away.
          this.gameOver("overflow");
        },
      }),
      makeButton(this, {
        x: WIDTH / 2,
        y: cy + 140,
        label: "Cancel",
        width: 250,
        depth: depth + 2,
        onClick: close,
      })
    );
  }

  private createHelpButton(): void {
    const bx = GAME.WIDTH - 26;
    const by = GAME.HEIGHT - 26;
    const btn = this.add
      .circle(bx, by, 16, COLORS.ink, 0.08)
      .setStrokeStyle(1, COLORS.ink, 0.25)
      .setDepth(30)
      .setInteractive({ useHandCursor: true });
    this.add
      .text(bx, by, "?", {
        fontFamily: FONT,
        resolution: TEXT_RES,
        fontSize: "18px",
        fontStyle: "500",
        color: "#9b7a5f",
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
      .rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, COLORS.scrim, 0.94)
      .setDepth(40)
      .setInteractive();
    const txt = this.add
      .text(WIDTH / 2, HEIGHT / 2 - 30, lines.join("\n"), {
        fontFamily: FONT,
        resolution: TEXT_RES,
        fontSize: "15px",
        color: "#4a3327",
        align: "center",
        lineSpacing: 5,
      })
      .setOrigin(0.5)
      .setDepth(41);
    const tap = this.add
      .text(WIDTH / 2, HEIGHT / 2 + 190, "tap to close", {
        fontFamily: FONT,
        resolution: TEXT_RES,
        fontSize: "14px",
        color: "#0e9d88",
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
        { fontFamily: FONT,
        resolution: TEXT_RES, fontSize: "22px", fontStyle: "500", color: "#d98324" }
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
        resolution: TEXT_RES,
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
      mode: this.state.mode,
      seed: this.state.seed,
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

  /**
   * Draw the wind so it reads as wind.
   *
   * Without this the mode looked like the food had simply gone unpredictable —
   * the force was invisible, so a drop drifting off your aim looked like a bug
   * rather than the twist. Streaks travel WITH the current force and their
   * length and opacity track its strength, so you can see a gust build, slack
   * off and reverse, and time a drop against it.
   */
  private drawWind(wind: number): void {
    if (!this.windGfx) return;
    const g = this.windGfx;
    g.clear();
    const strength = Math.abs(wind) / 0.4;
    if (strength < 0.06) return; // dead calm: draw nothing rather than a hint

    const dir = Math.sign(wind);
    const top = this.lineY();
    const span = BIN.floor - top;
    for (const st of this.windStreaks) {
      // Advance with the wind; wrap round so the field never empties.
      st.x += wind * st.speed;
      const w = BIN.right - BIN.left;
      if (st.x > BIN.right + 40) st.x -= w + 80;
      if (st.x < BIN.left - 40) st.x += w + 80;
      const y = top + st.t * span;
      if (y < top || y > BIN.floor) continue;
      const len = 10 + strength * 26 * st.speed;
      // Clip to the bin. Streaks wrap 40px beyond each wall so the field never
      // thins out at the edges, but drawing them out there put wind marks on
      // the background either side of the bin, where there is no air.
      const x1 = Math.max(BIN.left + 2, Math.min(BIN.right - 2, st.x - (len / 2) * dir));
      const x2 = Math.max(BIN.left + 2, Math.min(BIN.right - 2, st.x + (len / 2) * dir));
      if (Math.abs(x2 - x1) < 3) continue;
      g.lineStyle(st.thick, COLORS.ink, 0.05 + strength * 0.16);
      g.beginPath();
      g.moveTo(x1, y);
      g.lineTo(x2, y);
      g.strokePath();
    }
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
    g.fillStyle(COLORS.ink, 0.09);
    g.fillRoundedRect(
      BIN.left,
      line - 8,
      BIN.right - BIN.left,
      BIN.floor - line + 20,
      18
    );
    g.lineStyle(2, COLORS.ink, 0.28);
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

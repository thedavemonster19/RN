import Phaser from "phaser";
import { GAME, COLORS } from "./config";
import { BootScene } from "./scenes/BootScene";
import { MenuScene } from "./scenes/MenuScene";
import { GameScene } from "./scenes/GameScene";
import { GameOverScene } from "./scenes/GameOverScene";

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: "game",
  backgroundColor: COLORS.screen,
  width: GAME.WIDTH,
  height: GAME.HEIGHT,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  // Lets us drop a real <input> over the canvas for naming the monster, so the
  // player gets their native keyboard (and iOS autocorrect off) instead of us
  // hand-rolling one. Phaser keeps the element aligned as the canvas scales.
  dom: {
    createContainer: true,
  },
  physics: {
    default: "matter",
    matter: {
      gravity: { x: 0, y: 1 },
      // More solver iterations keep the stacked food pile stable and separated
      // instead of interpenetrating — cheap at this body count, and the main
      // defence against resting-contact jitter now that gravity is softer.
      positionIterations: 24,
      velocityIterations: 16,
      // Let resting food fall asleep so the settled pile stops micro-shifting
      // and condensing. New drops / grabs wake the neighbours they touch.
      enableSleeping: true,
      debug: false,
    },
  },
  scene: [BootScene, MenuScene, GameScene, GameOverScene],
};

const game = new Phaser.Game(config);
(window as unknown as { game: Phaser.Game }).game = game;

// Destroy the old game on hot-reload so dev edits don't stack duplicate
// Phaser instances (no effect in a production build).
const hot = (import.meta as unknown as { hot?: { dispose(cb: () => void): void } })
  .hot;
if (hot) hot.dispose(() => game.destroy(true));

import Phaser from "phaser";
import { GAME, COLORS, RENDER_SCALE } from "./config";
import { BootScene } from "./scenes/BootScene";
import { MenuScene } from "./scenes/MenuScene";
import { GameScene } from "./scenes/GameScene";
import { GameOverScene } from "./scenes/GameOverScene";
import { ProfileScene } from "./scenes/ProfileScene";
import { AccountScene } from "./scenes/AccountScene";
import { ModeSelectScene } from "./scenes/ModeSelectScene";
import { LeaderboardScene } from "./scenes/LeaderboardScene";
import { CustomizeScene } from "./scenes/CustomizeScene";

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: "game",
  backgroundColor: COLORS.screen,
  width: GAME.WIDTH * RENDER_SCALE,
  height: GAME.HEIGHT * RENDER_SCALE,
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
  scene: [
    BootScene,
    MenuScene,
    ModeSelectScene,
    GameScene,
    GameOverScene,
    ProfileScene,
    AccountScene,
    LeaderboardScene,
    CustomizeScene,
  ],
};

const game = new Phaser.Game(config);
(window as unknown as { game: Phaser.Game }).game = game;

/**
 * Zoom every scene's camera by RENDER_SCALE so the oversized canvas still shows
 * exactly the 400x720 world the game is laid out in.
 *
 * Hooked once per scene on CREATE rather than written into nine create()
 * methods: a scene that restarts gets a fresh camera, and a listener cannot be
 * forgotten when a tenth scene is added. Without it the extra canvas would
 * simply show more world instead of the same world in more detail.
 */
game.events.once(Phaser.Core.Events.READY, () => {
  for (const scene of game.scene.scenes) {
    scene.events.on(Phaser.Scenes.Events.CREATE, () => {
      const cam = scene.cameras?.main;
      if (!cam) return;
      cam.setZoom(RENDER_SCALE);
      cam.centerOn(GAME.WIDTH / 2, GAME.HEIGHT / 2);
    });
  }
});

// Destroy the old game on hot-reload so dev edits don't stack duplicate
// Phaser instances (no effect in a production build).
const hot = (import.meta as unknown as { hot?: { dispose(cb: () => void): void } })
  .hot;
if (hot) hot.dispose(() => game.destroy(true));

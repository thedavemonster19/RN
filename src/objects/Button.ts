import Phaser from "phaser";
import { COLORS, UI_FONT, TEXT_RES } from "../config";

const FONT = UI_FONT;

export interface ButtonOpts {
  x: number;
  y: number;
  label: string;
  onClick: () => void;
  /** Filled teal instead of ghosted — for the one action you actually want. */
  primary?: boolean;
  width?: number;
  depth?: number;
}

export interface Button {
  destroy(): void;
  setLabel(text: string): void;
}

const HEIGHT = 54;

/**
 * A rounded pill button. Rounded corners mean drawing it with Graphics, which
 * can't take input, so a Zone sits on top to catch taps.
 */
export function makeButton(scene: Phaser.Scene, o: ButtonOpts): Button {
  const w = o.width ?? 220;
  const depth = o.depth ?? 0;
  const left = o.x - w / 2;
  const top = o.y - HEIGHT / 2;

  const g = scene.add.graphics().setDepth(depth);
  const RADIUS = 16;
  const draw = (hover: boolean) => {
    g.clear();
    // A soft drop shadow lifts the button off the background — the flat fills
    // were what made everything read as washed out.
    g.fillStyle(COLORS.ink, o.primary ? 0.35 : 0.25);
    g.fillRoundedRect(left, top + 3, w, HEIGHT, RADIUS);

    if (o.primary) {
      g.fillStyle(COLORS.teal, 1);
      g.fillRoundedRect(left, top, w, HEIGHT, RADIUS);
      // A lighter band across the top half reads as a gentle sheen.
      g.fillStyle(0xffffff, hover ? 0.28 : 0.16);
      g.fillRoundedRect(left + 3, top + 2, w - 6, HEIGHT * 0.45, RADIUS - 4);
    } else {
      g.fillStyle(COLORS.cardFill, 1);
      g.fillRoundedRect(left, top, w, HEIGHT, RADIUS);
      // A brighter top edge catches the light and stops the fill reading flat.
      g.fillStyle(0xffffff, hover ? 0.16 : 0.09);
      g.fillRoundedRect(left + 3, top + 2, w - 6, HEIGHT * 0.42, RADIUS - 4);
      g.lineStyle(2, COLORS.violet, hover ? 0.85 : 0.5);
      g.strokeRoundedRect(left, top, w, HEIGHT, RADIUS);
    }
  };
  draw(false);

  const txt = scene.add
    .text(o.x, o.y, o.label, {
      fontFamily: FONT,
        resolution: TEXT_RES,
      fontSize: "19px",
      fontStyle: "600",
      color: o.primary ? "#3a2a1e" : "#4a3327",
    })
    .setOrigin(0.5)
    .setDepth(depth + 1);

  const zone = scene.add
    .zone(o.x, o.y, w, HEIGHT)
    .setInteractive({ useHandCursor: true })
    .setDepth(depth + 2);
  zone.on("pointerover", () => draw(true));
  zone.on("pointerout", () => draw(false));
  zone.on("pointerdown", () => {
    draw(true);
    // A quick squash so a tap feels like it landed on something physical.
    scene.tweens.add({
      targets: txt,
      scale: 0.94,
      duration: 70,
      yoyo: true,
      ease: "Quad.easeOut",
    });
    o.onClick();
  });

  return {
    destroy() {
      g.destroy();
      txt.destroy();
      zone.destroy();
    },
    setLabel(text: string) {
      txt.setText(text);
    },
  };
}

import Phaser from "phaser";
import { COLORS } from "../config";

const FONT = "system-ui, -apple-system, sans-serif";

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
  const draw = (hover: boolean) => {
    g.clear();
    if (o.primary) {
      g.fillStyle(COLORS.teal, hover ? 0.9 : 1);
    } else {
      g.fillStyle(0xffffff, hover ? 0.16 : 0.08);
    }
    g.fillRoundedRect(left, top, w, HEIGHT, 14);
    if (!o.primary) {
      g.lineStyle(1.5, 0xffffff, 0.22);
      g.strokeRoundedRect(left, top, w, HEIGHT, 14);
    }
  };
  draw(false);

  const txt = scene.add
    .text(o.x, o.y, o.label, {
      fontFamily: FONT,
      fontSize: "19px",
      fontStyle: "600",
      color: o.primary ? "#0d1226" : "#eaf0ff",
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

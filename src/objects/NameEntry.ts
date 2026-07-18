import Phaser from "phaser";
import { GAME } from "../config";
import { makeButton, Button } from "./Button";
import { Save, NAME_MAX, cleanName, suggestName } from "../systems/Save";

const FONT = "system-ui, -apple-system, sans-serif";

/**
 * The name-your-monster dialog. Lives here rather than in a scene because two
 * places need it: the forced first-run prompt on the menu, and Rename in the
 * profile.
 *
 * `forced` hides the cancel button, for the first run where there's no previous
 * name to fall back to.
 */
export function openNameEntry(
  scene: Phaser.Scene,
  opts: { forced: boolean; onSaved: (name: string) => void }
): void {
  const { WIDTH, HEIGHT } = GAME;
  const depth = 50;
  const cy = HEIGHT / 2 - 40;

  const shade = scene.add
    .rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x06081a, 0.92)
    .setDepth(depth)
    .setInteractive();
  const panel = scene.add.graphics().setDepth(depth + 1);
  panel.fillStyle(0xffffff, 0.06);
  panel.fillRoundedRect(WIDTH / 2 - 150, cy - 100, 300, 236, 18);
  panel.lineStyle(1.5, 0xffffff, 0.14);
  panel.strokeRoundedRect(WIDTH / 2 - 150, cy - 100, 300, 236, 18);

  const title = scene.add
    .text(WIDTH / 2, cy - 66, "Name your monster", {
      fontFamily: FONT,
      fontSize: "19px",
      fontStyle: "600",
      color: "#eaf0ff",
    })
    .setOrigin(0.5)
    .setDepth(depth + 2);
  const hint = scene.add
    .text(WIDTH / 2, cy - 42, `up to ${NAME_MAX} characters`, {
      fontFamily: FONT,
      fontSize: "12px",
      color: "#9aa3d0",
    })
    .setOrigin(0.5)
    .setDepth(depth + 2);

  const el = document.createElement("input");
  el.type = "text";
  el.maxLength = NAME_MAX;
  el.value = Save.name;
  el.placeholder = suggestName();
  el.setAttribute("autocomplete", "off");
  el.setAttribute("autocorrect", "off");
  el.setAttribute("autocapitalize", "words");
  el.setAttribute("spellcheck", "false");
  el.style.cssText = [
    "width: 232px",
    "padding: 12px 14px",
    "font-size: 18px",
    "font-weight: 600",
    "text-align: center",
    `font-family: ${FONT}`,
    "color: #eaf0ff",
    "background: rgba(255,255,255,0.10)",
    "border: 1.5px solid rgba(255,255,255,0.25)",
    "border-radius: 12px",
    "outline: none",
  ].join(";");
  const input = scene.add.dom(WIDTH / 2, cy - 2, el).setDepth(depth + 2);
  el.focus();
  el.select();

  let cancel: Button | undefined;
  const cleanup = () => {
    shade.destroy();
    panel.destroy();
    title.destroy();
    hint.destroy();
    input.destroy();
    save.destroy();
    cancel?.destroy();
  };

  const commit = () => {
    // An empty field takes the placeholder, so a monster is never nameless.
    Save.name = cleanName(el.value) || el.placeholder;
    cleanup();
    opts.onSaved(Save.name);
  };

  el.addEventListener("keydown", (e) => {
    if (e.key === "Enter") commit();
  });

  const save = makeButton(scene, {
    x: WIDTH / 2,
    y: cy + 56,
    label: "Save",
    primary: true,
    width: 232,
    depth: depth + 2,
    onClick: commit,
  });

  if (!opts.forced) {
    cancel = makeButton(scene, {
      x: WIDTH / 2,
      y: cy + 116,
      label: "Cancel",
      width: 232,
      depth: depth + 2,
      onClick: cleanup,
    });
  }
}

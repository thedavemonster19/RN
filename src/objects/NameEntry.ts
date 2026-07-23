import Phaser from "phaser";
import { GAME, COLORS, UI_FONT, TEXT_RES } from "../config";
import { makeButton, Button } from "./Button";
import { Save, NAME_MAX, cleanName, suggestName } from "../systems/Save";
import { Cloud } from "../systems/Cloud";

const FONT = UI_FONT;

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
  panel.fillStyle(COLORS.ink, 0.13);
  panel.fillRoundedRect(WIDTH / 2 - 150, cy - 100, 300, 236, 18);
  panel.lineStyle(2, COLORS.ink, 0.3);
  panel.strokeRoundedRect(WIDTH / 2 - 150, cy - 100, 300, 236, 18);

  const title = scene.add
    .text(WIDTH / 2, cy - 66, "Name your monster", {
      fontFamily: FONT,
        resolution: TEXT_RES,
      fontSize: "19px",
      fontStyle: "600",
      color: "#4a3327",
    })
    .setOrigin(0.5)
    .setDepth(depth + 2);
  const hint = scene.add
    .text(WIDTH / 2, cy - 42, `up to ${NAME_MAX} characters`, {
      fontFamily: FONT,
        resolution: TEXT_RES,
      fontSize: "12px",
      color: "#9b7a5f",
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
    // Cream-theme colours: the input is a real DOM element, so it can't read
    // COLORS and was left on the old dark palette — dark ink on a cream field.
    "color: #4a3327",
    "background: rgba(107,74,51,0.10)",
    "border: 1.5px solid rgba(107,74,51,0.28)",
    "border-radius: 12px",
    "outline: none",
  ].join(";");
  const input = scene.add.dom(WIDTH / 2, cy - 2, el).setDepth(depth + 2);
  el.focus();
  el.select();

  let cancel: Button | undefined;
  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    shade.destroy();
    panel.destroy();
    title.destroy();
    hint.destroy();
    input.destroy();
    save.destroy();
    cancel?.destroy();
  };

  // Also tear down if the scene goes away with the prompt still open. The
  // field is a real DOM element sitting over the canvas, not a game object, so
  // an orphaned one keeps floating above whatever screen comes next — it was
  // seen hovering over the leaderboard rows. The interactive backdrop means a
  // player cannot normally leave the prompt open, but "cannot normally" is not
  // a guarantee, and the cost of being sure is one listener.
  scene.events.once("shutdown", cleanup);
  scene.events.once("destroy", cleanup);

  const commit = () => {
    // An empty field takes the placeholder, so a monster is never nameless.
    Save.name = cleanName(el.value) || el.placeholder;
    // Push the new name up so the account stays current. Without this a rename
    // lived only on this device, and the next cloud pull would quietly revert
    // it to the server's stale value. Fire-and-forget: renaming must feel
    // instant and must work signed out (where this is a safe no-op).
    if (Cloud.signedIn) void Cloud.pushName(Save.name);
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

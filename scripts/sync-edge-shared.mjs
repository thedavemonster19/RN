/**
 * Copies the pure game-logic modules into the edge function's _shared folder,
 * rewriting imports for Deno (which needs explicit .ts extensions).
 *
 * The point is that the server scores a run with the SAME code the client ran.
 * Hand-copying would let the two drift apart silently, and a scoring rule that
 * differs by one point between client and server would reject every honest
 * run. So this is mechanical, and the copies are generated — never edited.
 *
 * Run: npm run sync:edge   (and re-run after touching any of these files)
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const OUT = "supabase/functions/_shared";
const FILES = [
  ["src/systems/Rng.ts", "Rng.ts"],
  ["src/data/foods.ts", "foods.ts"],
  ["src/data/milestones.ts", "milestones.ts"],
  ["src/systems/Modifiers.ts", "Modifiers.ts"],
  ["src/systems/Modes.ts", "Modes.ts"],
  ["src/systems/GameState.ts", "GameState.ts"],
  ["src/systems/Replay.ts", "replay.ts"],
];

// Everything lands in one flat folder, so every import becomes "./name.ts".
const REWRITES = [
  [/from\s+"\.\.\/data\/foods"/g, 'from "./foods.ts"'],
  [/from\s+"\.\.\/data\/milestones"/g, 'from "./milestones.ts"'],
  [/from\s+"\.\/Rng"/g, 'from "./Rng.ts"'],
  [/from\s+"\.\/GameState"/g, 'from "./GameState.ts"'],
  [/from\s+"\.\/Modifiers"/g, 'from "./Modifiers.ts"'],
];

mkdirSync(OUT, { recursive: true });

for (const [src, dest] of FILES) {
  let code = readFileSync(src, "utf8");
  for (const [re, to] of REWRITES) code = code.replace(re, to);
  const banner =
    `// GENERATED — do not edit. Copied from ${src} by scripts/sync-edge-shared.mjs.\n` +
    `// Edit the original and re-run \`npm run sync:edge\`.\n\n`;
  writeFileSync(`${OUT}/${dest}`, banner + code);
  console.log(`  ${src} -> ${OUT}/${dest}`);
}
console.log("edge shared modules synced");
